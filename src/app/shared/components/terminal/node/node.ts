import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, signal, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragMove, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { liveQuery } from 'dexie';

import { AuthService } from '../../../../core/auth/auth.service';
import { SpaceService } from '../../../../core/services/components/space.service';
import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { FileManagerService } from '../../../../core/services/components/file-manager.service';
import { db } from '../../../../core/database/dexie.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';

interface MapNode {
  id: string;
  type: 'workspace' | 'space' | 'subspace' | 'file' | 'overflow' | 'loading';
  label: string;
  icon: string;
  x: number;
  y: number;
  parentId: string | null;
  initialPosition: { x: number, y: number };
  currentPosition: { x: number, y: number };
  isMissingOnDisk?: boolean;
}

interface LayoutNode {
  id: string;
  type: 'workspace' | 'space' | 'subspace' | 'file' | 'overflow' | 'loading';
  label: string;
  icon: string;
  parentId: string | null;
  children: LayoutNode[];
  subtreeWidth: number;
  x: number;
  y: number;
  isMissingOnDisk?: boolean;
}

@Component({
  selector: 'app-terminal-node',
  standalone: true,
  imports: [CommonModule, CdkDrag],
  templateUrl: './node.html',
  styleUrl: './node.scss'
})
export class TerminalNode implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private auth = inject(AuthService);
  private readonly spaces = inject(SpaceService);
  private readonly fileSystem = inject(FileSystemService);
  private readonly fileManager = inject(FileManagerService);
  private readonly modal = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  public nodes = signal<MapNode[]>([]);
  public isContainerReady = signal<boolean>(false);

  private currentWorkspaceId = '';

  // ── Perspective State ──
  public panX = signal(0);
  public panY = signal(0);
  public zoomScale = signal(1);
  
  public isPanning = signal(false);
  private startPanX = 0;
  private startPanY = 0;

  // ── Multi-Select Lasso State ──
  public selectedNodeIds = new Set<string>();
  
  public lasso = signal({
     active: false,
     startX: 0,
     startY: 0,
     left: 0,
     top: 0,
     width: 0,
     height: 0
  });

  private isScanning = false;
  private debounceTimer: any = null;
  
  private authSub?: any;
  private spaceSub?: any;
  private virtualSub?: any;

  async ngOnInit() {
    setTimeout(async () => {
      this.isContainerReady.set(true);

      const ws = await this.auth.getCurrentWorkspace();
      if (!ws) return;
      this.currentWorkspaceId = ws.id;

      // Reactively listen to Space updates so creation/renames trigger re-draws live!
      this.spaceSub = this.spaces.liveSpaces$(ws.id).subscribe(() => {
         this.scheduleBuildGraph(false);
      });

      // Reactively listen to IDB virtual entries to catch file-level changes
      this.virtualSub = liveQuery(() => db.virtual_entries.where('workspaceId').equals(ws.id).toArray()).subscribe(() => {
         this.scheduleBuildGraph(false);
      });

      // And we schedule one immediately
      this.scheduleBuildGraph(false);
      
    }, 100);
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.spaceSub?.unsubscribe();
    this.virtualSub?.unsubscribe();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  public refreshMap() {
      this.scheduleBuildGraph(false);
  }

  public async resetLayout() {
      const confirmed = await this.modal.confirm(
          'Are you sure you want to completely reset the manual layout back to the automatic tree?',
          {
              title: 'Reset Map Layout',
              confirmText: 'Reset Layout',
              cancelText: 'Cancel'
          }
      );
      
      if (confirmed) {
          localStorage.removeItem(`quilix_map_positions_${this.currentWorkspaceId}`);
          this.selectedNodeIds.clear();
          
          this.nodes.set([]); 
          this.panX.set(0);
          this.panY.set(0);

          this.scheduleBuildGraph(true);
      }
  }

  private scheduleBuildGraph(forceRefresh: boolean = false) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
          this.buildGraph(forceRefresh);
      }, 300);
  }

  private loadLayouts(): Record<string, {x: number, y: number}> {
      try {
          const str = localStorage.getItem(`quilix_map_positions_${this.currentWorkspaceId}`);
          if (str) return JSON.parse(str);
      } catch(e) {}
      return {};
  }

  private saveLayouts() {
      if (!this.currentWorkspaceId) return;
      
      const currentMap = this.loadLayouts(); 
      for (const id of this.selectedNodeIds) {
          const node = this.nodes().find(n => n.id === id);
          if (node) {
              currentMap[node.id] = { x: node.x, y: node.y };
          }
      }
      localStorage.setItem(`quilix_map_positions_${this.currentWorkspaceId}`, JSON.stringify(currentMap));
  }

  zoomIn() {
    this.zoomScale.update(s => Math.min(s + 0.15, 2.5));
  }
  
  zoomOut() {
    this.zoomScale.update(s => Math.max(s - 0.15, 0.4));
  }

  onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault(); 
        if (event.deltaY > 0) {
            this.zoomOut();
        } else {
            this.zoomIn();
        }
    }
  }

  private getNormalizedCoordinates(event: MouseEvent | TouchEvent) {
      if (window.TouchEvent && event instanceof TouchEvent) {
          if (event.touches.length > 0) {
              return { x: event.touches[0].clientX, y: event.touches[0].clientY };
          }
      }
      const e = event as MouseEvent;
      return { x: e.clientX, y: e.clientY };
  }

  startCanvasInteraction(event: MouseEvent | TouchEvent) {
    if ((event.target as HTMLElement).closest('.map-node')) return;
    
    if (event instanceof MouseEvent && event.button !== 0) return;

    const coords = this.getNormalizedCoordinates(event);

    if (event instanceof MouseEvent && event.shiftKey) {
        const rect = this.mapContainer.nativeElement.getBoundingClientRect();
        const localX = coords.x - rect.left;
        const localY = coords.y - rect.top;

        this.lasso.set({
           active: true,
           startX: localX,
           startY: localY,
           left: localX,
           top: localY,
           width: 0,
           height: 0
        });
        
        this.selectedNodeIds.clear(); 
    } else {
        this.selectedNodeIds.clear(); 
        this.isPanning.set(true);
        this.startPanX = coords.x - this.panX();
        this.startPanY = coords.y - this.panY();
    }
  }

  onCanvasMove(event: MouseEvent | TouchEvent) {
    if (!this.isPanning() && !this.lasso().active) return;
    const coords = this.getNormalizedCoordinates(event);

    if (this.isPanning()) {
        if (event instanceof TouchEvent && event.cancelable) event.preventDefault();
        this.panX.set(coords.x - this.startPanX);
        this.panY.set(coords.y - this.startPanY);
        return;
    }

    const lso = this.lasso();
    if (lso.active && event instanceof MouseEvent) {
        const rect = this.mapContainer.nativeElement.getBoundingClientRect();
        const mouseX = coords.x - rect.left;
        const mouseY = coords.y - rect.top;

        const left = Math.min(lso.startX, mouseX);
        const top = Math.min(lso.startY, mouseY);
        const width = Math.abs(mouseX - lso.startX);
        const height = Math.abs(mouseY - lso.startY);
        
        this.lasso.set({ ...lso, left, top, width, height });
    }
  }

  endCanvasInteraction() {
    this.isPanning.set(false);

    const lso = this.lasso();
    if (lso.active) {
       this.calculateLassoIntersections();
       this.lasso.set({ ...lso, active: false, width: 0, height: 0 });
    }
  }

  private calculateLassoIntersections() {
      const lso = this.lasso();
      const logicLeft = (lso.left - this.panX()) / this.zoomScale();
      const logicTop = (lso.top - this.panY()) / this.zoomScale();
      const logicRight = logicLeft + (lso.width / this.zoomScale());
      const logicBottom = logicTop + (lso.height / this.zoomScale());

      const nodes = this.nodes();
      for (const node of nodes) {
          const nodeWidth = (node.type === 'subspace' || node.type === 'file') ? 160 : 200;
          const nLeft = node.x;
          const nTop = node.y;
          const nRight = node.x + nodeWidth;
          const nBottom = node.y + 60; 

          if (nLeft < logicRight && nRight > logicLeft && 
              nTop < logicBottom && nBottom > logicTop) {
              this.selectedNodeIds.add(node.id);
          }
      }
  }

  onNodeClick(event: MouseEvent | TouchEvent, node: MapNode) {
     const isShift = event instanceof MouseEvent && event.shiftKey;
     if (isShift) {
         if (this.selectedNodeIds.has(node.id)) {
             this.selectedNodeIds.delete(node.id);
         } else {
             this.selectedNodeIds.add(node.id);
         }
     } else {
         if (!this.selectedNodeIds.has(node.id)) {
            this.selectedNodeIds.clear();
         }
     }
  }

  onDragStarted(event: CdkDragStart, node: MapNode) {
     if (!this.selectedNodeIds.has(node.id)) {
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(node.id); 
     }
  }

  private animationFrameId?: number;

  onDragMoved(event: CdkDragMove, leadNode: MapNode) {
    const dragDelta = event.source.getFreeDragPosition();

    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
    
    this.animationFrameId = requestAnimationFrame(() => {
        for (const id of this.selectedNodeIds) {
            if (id === leadNode.id) {
                 leadNode.currentPosition = dragDelta;
                 continue; 
            }
            const brother = this.nodes().find(n => n.id === id);
            if (brother) {
                brother.currentPosition = { x: dragDelta.x, y: dragDelta.y };
            }
        }
        this.cdr.detectChanges(); 
    });
  }

  onDragEnded(event: CdkDragEnd, leadNode: MapNode) {
      for (const id of this.selectedNodeIds) {
          const gn = this.nodes().find(n => n.id === id);
          if (gn) {
              gn.x += gn.currentPosition.x;
              gn.y += gn.currentPosition.y;
              gn.currentPosition = { x: 0, y: 0 };
              gn.initialPosition = { x: 0, y: 0 }; 
          }
      }
      event.source.reset();
      this.saveLayouts(); 
  }

  trackByNode(index: number, node: MapNode): string {
    return node.id; 
  }

  getBrotherTransform(node: MapNode): string {
      if (node.currentPosition.x === 0 && node.currentPosition.y === 0) return '';
      return `translate3d(${node.currentPosition.x}px, ${node.currentPosition.y}px, 0)`;
  }

  getWirePath(child: MapNode): string {
    if (!child.parentId) return '';
    const parent = this.nodes().find(n => n.id === child.parentId);
    if (!parent) return '';

    const parentX = parent.x + parent.currentPosition.x + 100;
    const parentY = parent.y + parent.currentPosition.y + 60;
    
    const childWidthCenter = child.type === 'subspace' ? 80 : 100;
    const childX = child.x + child.currentPosition.x + childWidthCenter;
    const childY = child.y + child.currentPosition.y; 

    const distanceY = Math.abs(childY - parentY);
    const tension = Math.min(distanceY / 2, 80); 
    
    return `M ${parentX} ${parentY} C ${parentX} ${parentY + tension}, ${childX} ${childY - tension}, ${childX} ${childY}`;
  }

  private async buildGraph(forcePhysicalLayoutReset = false) {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const ws = await this.auth.getCurrentWorkspace();
      if (!ws) return;

      let buildNodes: MapNode[] = [];
      const savedLayouts = forcePhysicalLayoutReset ? {} : this.loadLayouts();
      const existingNodesMap = new Map(this.nodes().map(n => [n.id, n]));

      const resolvePos = (nodeId: string, defaultX: number, defaultY: number) => {
          let finalX = defaultX;
          let finalY = defaultY;

          if (savedLayouts[nodeId]) {
              finalX = savedLayouts[nodeId].x;
              finalY = savedLayouts[nodeId].y;
          }

          const prior = existingNodesMap.get(nodeId);
          if (prior) {
              return { 
                  x: finalX, 
                  y: finalY, 
                  initX: prior.initialPosition.x, 
                  initY: prior.initialPosition.y, 
                  currentPos: prior.currentPosition 
              };
          }
          
          return { x: finalX, y: finalY, initX: 0, initY: 0, currentPos: {x: 0, y: 0} };
      };

      const rootLayoutNode: LayoutNode = {
          id: ws.id,
          type: 'workspace',
          label: ws.name,
          icon: 'bi-grid-1x2',
          parentId: null,
          children: [],
          subtreeWidth: 0,
          x: 0,
          y: 0,
          isMissingOnDisk: ws.isMissingOnDisk
      };

      const allSpaces = await this.spaces.getByWorkspace(ws.id);
      const mode = await this.fileSystem.getStorageMode();

      rootLayoutNode.children = await Promise.all(allSpaces.map(async (sp) => {
          const spNode: LayoutNode = {
              id: sp.id,
              type: 'space',
              label: sp.name,
              icon: 'bi-folder2-open',
              parentId: ws.id,
              children: [],
              subtreeWidth: 0,
              x: 0,
              y: 0,
              isMissingOnDisk: sp.isMissingOnDisk
          };
          
          let handle: any = undefined;
          if (mode === 'filesystem') {
             handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
          }
          
          spNode.children = await this.fetchTreeRecursive(handle, sp.id, null, sp.id, 1);
          return spNode;
      }));

      const spacingX = 220; 
      this.calculateSubtreeWidth(rootLayoutNode, spacingX);

      const rPos = resolvePos(ws.id, 0, 0);
      rootLayoutNode.x = rPos.x;
      rootLayoutNode.y = rPos.y;

      if (this.nodes().length === 0 && this.panX() === 0 && this.panY() === 0) {
          const containerW = this.mapContainer.nativeElement.clientWidth;
          const containerH = this.mapContainer.nativeElement.clientHeight;
          
          this.zoomScale.set(0.6); 
          this.panX.set((containerW / 2) - ((rPos.x + 100) * 0.6));
          this.panY.set((containerH / 2) - ((rPos.y + 100) * 0.6));
      }

      this.assignCoordinates(rootLayoutNode, buildNodes, resolvePos);
      this.nodes.set([...buildNodes]); 
      
    } finally {
      this.isScanning = false;
    }
  }

  private calculateSubtreeWidth(node: LayoutNode, spacingX: number): number {
      if (node.children.length === 0) {
          node.subtreeWidth = spacingX;
          return node.subtreeWidth;
      }
      let sum = 0;
      const margin = node.type === 'workspace' ? 80 : 30;

      for (let i = 0; i < node.children.length; i++) {
          sum += this.calculateSubtreeWidth(node.children[i], spacingX);
          if (i > 0) sum += margin; 
      }
      node.subtreeWidth = Math.max(spacingX, sum);
      return node.subtreeWidth;
  }

  private assignCoordinates(
      node: LayoutNode,
      refNodes: MapNode[],
      resolveNodePos: (id: string, defX: number, defY: number) => {x: number, y: number, initX: number, initY: number, currentPos: {x: number, y: number}},
      collisionOverrideX?: number
  ) {
      const p = resolveNodePos(node.id, collisionOverrideX ?? node.x, node.y);
      if (collisionOverrideX !== undefined) p.x = collisionOverrideX;

      node.x = p.x;
      node.y = p.y;

      refNodes.push({
          id: node.id,
          type: node.type,
          label: node.label,
          icon: node.icon,
          x: p.x,
          y: p.y,
          parentId: node.parentId,
          initialPosition: { x: p.initX, y: p.initY },
          currentPosition: p.currentPos,
          isMissingOnDisk: node.isMissingOnDisk
      });

      if (node.children.length > 0) {
          let organicCurrentX = node.x - (node.subtreeWidth / 2);
          const margin = node.type === 'workspace' ? 80 : 30;

          for (const child of node.children) {
              child.x = organicCurrentX + (child.subtreeWidth / 2);
              const intended = resolveNodePos(child.id, child.x, node.y);
              child.x = intended.x;
              organicCurrentX += child.subtreeWidth + margin;
          }

          let overrides = new Map<string, number>();
          const sortedChildren = [...node.children].sort((a, b) => a.x - b.x);
          let safeLeftBoundary = -Infinity;
          
          for (const child of sortedChildren) {
              const requiredLeftEdge = child.x - (child.subtreeWidth / 2);
              let finalSafeX = child.x;
              if (requiredLeftEdge < safeLeftBoundary) {
                  finalSafeX = safeLeftBoundary + (child.subtreeWidth / 2);
                  overrides.set(child.id, finalSafeX);
              }
              safeLeftBoundary = finalSafeX + (child.subtreeWidth / 2) + margin; 
          }

          for (const child of node.children) {
              const isSpaceLevel = node.type === 'workspace'; 
              const childGapY = isSpaceLevel ? 160 : 120;
              child.y = node.y + childGapY;
              if (child.type === 'overflow') child.y -= 10; 
              if (node.isMissingOnDisk) child.isMissingOnDisk = true;
              this.assignCoordinates(child, refNodes, resolveNodePos, overrides.get(child.id));
          }
      }
  }

  private async fetchTreeRecursive(
      dirHandle: any, 
      spaceId: string, 
      parentDirectoryId: string | null, 
      parentNodeId: string, 
      level: number
  ): Promise<LayoutNode[]> {
      if (level > 4) return [];

      try {
        const entries = await this.fileManager.readDirectory({ handle: dirHandle, spaceId, parentId: parentDirectoryId });
        if (entries.length === 0) return [];

        const UI_LIMIT = 5;
        const displayEntries = entries.slice(0, UI_LIMIT);
        const hasOverflow = entries.length > UI_LIMIT;

        const childrenNodes: LayoutNode[] = [];

        for (const entry of displayEntries) {
            const nodeId = entry.id || `virtual_${parentNodeId}_${entry.name}`;
            const isDirectory = entry.kind === 'directory';

            const node: LayoutNode = {
                id: nodeId,
                type: isDirectory ? 'subspace' : 'file',
                label: entry.name,
                icon: isDirectory ? 'bi-folder2' : 'bi-file-earmark',
                parentId: parentNodeId,
                children: [],
                subtreeWidth: 0,
                x: 0,
                y: 0
            };

            if (isDirectory) {
                node.children = await this.fetchTreeRecursive(entry.handle, spaceId, entry.id || null, nodeId, level + 1);
            }
            childrenNodes.push(node);
        }

        if (hasOverflow) {
             childrenNodes.push({
                id: `overflow_${parentNodeId}`,
                type: 'overflow',
                label: `+ ${entries.length - UI_LIMIT} More`,
                icon: 'bi-box-seam',
                parentId: parentNodeId,
                children: [],
                subtreeWidth: 0,
                x: 0,
                y: 0
            });
        }

        return childrenNodes;
      } catch (err) {
         return []; 
      }
  }
}
