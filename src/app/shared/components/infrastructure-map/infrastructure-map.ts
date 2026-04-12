import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, signal, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragMove, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { liveQuery } from 'dexie';

import { AuthService } from '../../../core/auth/auth.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { FileManagerService } from '../../../core/services/components/file-manager.service';
import { db } from '../../../core/database/dexie.service';
import { ModalService } from '../../../services/ui/common/modal/modal';

interface MapNode {
  id: string;
  type: 'workspace' | 'space' | 'subspace' | 'file' | 'overflow' | 'loading';
  label: string;
  icon: string;
  x: number;
  y: number;
  parentId: string | null;
  // cdkDragFreeDragPosition ONLY takes initial to prevent infinite feedback loops
  initialPosition: { x: number, y: number };
  // updated ONLY through event reporting to recalculate SVG wires
  currentPosition: { x: number, y: number };
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
}

@Component({
  selector: 'app-infrastructure-map',
  standalone: true,
  imports: [CommonModule, CdkDrag],
  templateUrl: './infrastructure-map.html',
  styleUrl: './infrastructure-map.scss'
})
export class InfrastructureMapComponent implements OnInit, OnDestroy {
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
      // Re-fetches structures but does NOT wipe valid saved manual layouts
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
          
          this.nodes.set([]); // Trigger initial view logic
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

  // ── Storage Cache Utils ──

  private loadLayouts(): Record<string, {x: number, y: number}> {
      try {
          const str = localStorage.getItem(`quilix_map_positions_${this.currentWorkspaceId}`);
          if (str) return JSON.parse(str);
      } catch(e) {}
      return {};
  }

  private saveLayouts() {
      if (!this.currentWorkspaceId) return;
      
      // Update cache block specifically only with manually dragged nodes.
      const currentMap = this.loadLayouts(); 
      for (const id of this.selectedNodeIds) {
          const node = this.nodes().find(n => n.id === id);
          if (node) {
              currentMap[node.id] = { x: node.x, y: node.y };
          }
      }
      localStorage.setItem(`quilix_map_positions_${this.currentWorkspaceId}`, JSON.stringify(currentMap));
  }

  // ── Zoom Controls ──
  
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

  // ── Canvas Navigation Physics (Pan & Lasso) ──

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
    if ((event.target as HTMLElement).closest('.map-node')) return; // Ignore nodes
    
    // Ignore native right clicks (allow touch freely)
    if (event instanceof MouseEvent && event.button !== 0) return;

    const coords = this.getNormalizedCoordinates(event);

    // Lasso is logically reserved for mouse+shift users.
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
        // Generic Panning
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
        if (event instanceof TouchEvent && event.cancelable) event.preventDefault(); // Stop native drag effects safely
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

  // ── Drag & Drop Multi-Node Controller ──

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

    // 60FPS Batch DOM updating strategy to eliminate 20fps drag lag heavily on low-power touch devices.
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
      // 1. Commit absolute finalized cumulative DOM values universally globally
      for (const id of this.selectedNodeIds) {
          const gn = this.nodes().find(n => n.id === id);
          if (gn) {
              gn.x += gn.currentPosition.x;
              gn.y += gn.currentPosition.y;
              gn.currentPosition = { x: 0, y: 0 };
              gn.initialPosition = { x: 0, y: 0 }; // Resets physical angular DOM constraints for the next possible drag
          }
      }
      
      // Zero out the specific native handle that caused the trigger because the physical CSS offsets already absorbed the value.
      event.source.reset();
      
      this.saveLayouts(); // Persist all
  }

  // ── Graphics Helper Renderers ──

  trackByNode(index: number, node: MapNode): string {
    return node.id; 
  }

  getBrotherTransform(node: MapNode): string {
      // Transforms the position specifically for nodes that are NOT being actively pulled by cdkDrag
      // but are pulled instead by group dynamics payload.
      if (node.currentPosition.x === 0 && node.currentPosition.y === 0) return '';
      // We check if cdkDrag logic isn't natively handling it internally
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

    // Smooth Bezier Curve logic
    const distanceY = Math.abs(childY - parentY);
    const tension = Math.min(distanceY / 2, 80); 
    
    return `M ${parentX} ${parentY} C ${parentX} ${parentY + tension}, ${childX} ${childY - tension}, ${childX} ${childY}`;
  }

  // ── Smart Graph Topology Compiler ──

  private async buildGraph(forcePhysicalLayoutReset = false) {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const ws = await this.auth.getCurrentWorkspace();
      if (!ws) return;

      let buildNodes: MapNode[] = [];

      const savedLayouts = forcePhysicalLayoutReset ? {} : this.loadLayouts();
      
      const existingNodesMap = new Map(this.nodes().map(n => [n.id, n]));

      // Hybrid Cache Layer logic
      const resolvePos = (nodeId: string, defaultX: number, defaultY: number) => {
          let finalX = defaultX;
          let finalY = defaultY;

          // 1. Is there saved manual layout in browser for THIS specific node?
          if (savedLayouts[nodeId]) {
              finalX = savedLayouts[nodeId].x;
              finalY = savedLayouts[nodeId].y;
          }

          // 2. Prevent snatching actively dragged nodes by restoring their temporary drag-offsets
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
          
          // 3. Fallback to purely fresh computed mathematics bounds so topological insertions expand perfectly seamlessly!
          return { x: finalX, y: finalY, initX: 0, initY: 0, currentPos: {x: 0, y: 0} };
      };

      // 1. Root Workspace Node
      const rootLayoutNode: LayoutNode = {
          id: ws.id,
          type: 'workspace',
          label: ws.name,
          icon: 'bi-grid-1x2',
          parentId: null,
          children: [],
          subtreeWidth: 0,
          x: 0,
          y: 0
      };

      // 2. Fetch Core Spaces & Subtrees Concurrently
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
              y: 0
          };
          
          let handle: any = undefined;
          if (mode === 'filesystem') {
             handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
          }
          
          // Use '1' as the starting level for recursive depth control
          spNode.children = await this.fetchTreeRecursive(handle, sp.id, null, sp.id, 1);
          return spNode;
      }));

      // 3. Mathematical Two-Pass Layout Calculation (Bottom-Up)
      const spacingX = 220; // Increased horizontal stretch to eliminate text overlapping
      this.calculateSubtreeWidth(rootLayoutNode, spacingX);

      // 4. Assign Absolute Viewport Coordinates (Top-Down)
      const rPos = resolvePos(ws.id, 0, 0);
      rootLayoutNode.x = rPos.x;
      rootLayoutNode.y = rPos.y;

      if (this.nodes().length === 0 && this.panX() === 0 && this.panY() === 0) {
          const containerW = this.mapContainer.nativeElement.clientWidth;
          const containerH = this.mapContainer.nativeElement.clientHeight;
          
          this.zoomScale.set(0.7); // Default zoom out
          // Place the workspace node strictly in the exact mathematical center
          this.panX.set((containerW / 2) - ((rPos.x + 100) * 0.7));
          this.panY.set((containerH / 2) - ((rPos.y + 300) * 0.7));
      }

      this.assignCoordinates(rootLayoutNode, buildNodes, resolvePos);

      // Set final tree layout natively
      this.nodes.set([...buildNodes]); 
      
    } finally {
      this.isScanning = false;
    }
  }

  // ── Two-Pass Core Algorithms ──

  private calculateSubtreeWidth(node: LayoutNode, spacingX: number): number {
      if (node.children.length === 0) {
          // A leaf node guarantees at least `spacingX` width for itself
          node.subtreeWidth = spacingX;
          return node.subtreeWidth;
      }
      let sum = 0;
      const margin = node.type === 'workspace' ? 80 : 30; // Horizontal gap boundaries between blocks

      for (let i = 0; i < node.children.length; i++) {
          sum += this.calculateSubtreeWidth(node.children[i], spacingX);
          if (i > 0) sum += margin; 
      }
      // Expand the parent's logical stride if its children need more space laterally
      node.subtreeWidth = Math.max(spacingX, sum);
      return node.subtreeWidth;
  }

  private assignCoordinates(
      node: LayoutNode,
      refNodes: MapNode[],
      resolveNodePos: (id: string, defX: number, defY: number) => {x: number, y: number, initX: number, initY: number, currentPos: {x: number, y: number}},
      collisionOverrideX?: number
  ) {
      // 1. Establish precise algorithmic coordinate or inherit manual boundary push
      const p = resolveNodePos(node.id, collisionOverrideX ?? node.x, node.y);
      
      if (collisionOverrideX !== undefined) {
          p.x = collisionOverrideX; // Enforce visual repulsion priority over manual layout!
      }

      // 2. IMPORTANT: Update the LayoutNode reference point down the tree instantly so children align perfectly under the dragged/repulsed parent
      node.x = p.x;
      node.y = p.y;

      // Construct concrete UI MapNode and push to the flattened render array
      refNodes.push({
          id: node.id,
          type: node.type,
          label: node.label,
          icon: node.icon,
          x: p.x,
          y: p.y,
          parentId: node.parentId,
          initialPosition: { x: p.initX, y: p.initY },
          currentPosition: p.currentPos
      });

      if (node.children.length > 0) {
          
          // PHASE 1: Determine Topographical Targets 
          let organicCurrentX = node.x - (node.subtreeWidth / 2);
          const margin = node.type === 'workspace' ? 80 : 30;

          for (const child of node.children) {
              child.x = organicCurrentX + (child.subtreeWidth / 2);
              
              // Fetch user-defined explicit coordinates to prepare for collision sweep
              const intended = resolveNodePos(child.id, child.x, node.y);
              child.x = intended.x;
              
              organicCurrentX += child.subtreeWidth + margin;
          }

          // PHASE 2: Spatial Collision Repulsion (Uniformly applied across the tree)
          let overrides = new Map<string, number>();
          
          // Sort structurally left-to-right organically or by manual user preference
          const sortedChildren = [...node.children].sort((a, b) => a.x - b.x);

          let safeLeftBoundary = -Infinity;
          
          for (const child of sortedChildren) {
              const requiredLeftEdge = child.x - (child.subtreeWidth / 2);

              let finalSafeX = child.x;
              if (requiredLeftEdge < safeLeftBoundary) {
                  // Subtree overlaps prior sibling's protected boundary zone! PUSH RIGHT mathematically.
                  finalSafeX = safeLeftBoundary + (child.subtreeWidth / 2);
                  overrides.set(child.id, finalSafeX);
              }
              
              // Lock down physical right boundary protected block
              safeLeftBoundary = finalSafeX + (child.subtreeWidth / 2) + margin; 
          }

          // PHASE 3: Cascade recursive geometry down into files and deeper sub-spaces dynamically!
          for (const child of node.children) {
              const isSpaceLevel = node.type === 'workspace'; 
              const childGapY = isSpaceLevel ? 160 : 120;
              
              child.y = node.y + childGapY;
              
              if (child.type === 'overflow') {
                  child.y -= 10; 
              }

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
      if (level > 4) return []; // Stop runaway depth

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
                // Fetch deeply dynamically
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
