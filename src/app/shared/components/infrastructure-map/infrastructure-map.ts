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
  private spaces = inject(SpaceService);
  private fileSystem = inject(FileSystemService);
  private fileManager = inject(FileManagerService);
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

  public forceRefresh() {
      // Hard clear LocalStorage coordinates array, reset view, and map again.
      localStorage.removeItem(`quilix_map_positions_${this.currentWorkspaceId}`);
      this.selectedNodeIds.clear();
      
      const containerW = this.mapContainer.nativeElement.clientWidth;
      this.panX.set((containerW / 2) - 100);
      this.panY.set(60);
      this.zoomScale.set(1);

      this.scheduleBuildGraph(true);
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
      
      // Update cache block with whatever exists visually right now natively.
      const currentMap = this.loadLayouts(); 
      for (const node of this.nodes()) {
          currentMap[node.id] = { x: node.x, y: node.y };
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

  startCanvasInteraction(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.map-node')) return; // Ignore nodes
    if (event.button !== 0) return;

    if (event.shiftKey) {
        // Init Lasso Boxing Overlay
        const rect = this.mapContainer.nativeElement.getBoundingClientRect();
        // Mouse coordinate relative strictly locally to the component container mathematically
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        this.lasso.set({
           active: true,
           startX: localX,
           startY: localY,
           left: localX,
           top: localY,
           width: 0,
           height: 0
        });
        
        // If they click shift somewhere else, usually they want to start a fresh group highlight
        this.selectedNodeIds.clear(); 
        
    } else {
        // Init Panning Viewport
        this.selectedNodeIds.clear(); // Clear selections organically if they just click the background
        
        this.isPanning.set(true);
        this.startPanX = event.clientX - this.panX();
        this.startPanY = event.clientY - this.panY();
    }
  }

  onCanvasMove(event: MouseEvent) {
    // Process Panning Engine
    if (this.isPanning()) {
        this.panX.set(event.clientX - this.startPanX);
        this.panY.set(event.clientY - this.startPanY);
        return;
    }

    // Process Lasso Rectangle Selection
    const lso = this.lasso();
    if (lso.active) {
        const rect = this.mapContainer.nativeElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const left = Math.min(lso.startX, mouseX);
        const top = Math.min(lso.startY, mouseY);
        const width = Math.abs(mouseX - lso.startX);
        const height = Math.abs(mouseY - lso.startY);
        
        this.lasso.set({ ...lso, left, top, width, height });
    }
  }

  endCanvasInteraction() {
    this.isPanning.set(false);

    // Finalize Lasso intersections to nodes
    const lso = this.lasso();
    if (lso.active) {
       this.calculateLassoIntersections();
       this.lasso.set({ ...lso, active: false, width: 0, height: 0 });
    }
  }

  private calculateLassoIntersections() {
      const lso = this.lasso();
      // Localized coordinates normalized back to the surface offsets globally
      const logicLeft = (lso.left - this.panX()) / this.zoomScale();
      const logicTop = (lso.top - this.panY()) / this.zoomScale();
      const logicRight = logicLeft + (lso.width / this.zoomScale());
      const logicBottom = logicTop + (lso.height / this.zoomScale());

      const nodes = this.nodes();
      for (const node of nodes) {
          // A node roughly equals ~160px width
          const nodeWidth = node.type === 'subspace' ? 160 : 200;
          const nLeft = node.x;
          const nTop = node.y;
          const nRight = node.x + nodeWidth;
          const nBottom = node.y + 60; // rough height block

          // Boundary AABB overlap check
          if (nLeft < logicRight && nRight > logicLeft && 
              nTop < logicBottom && nBottom > logicTop) {
              this.selectedNodeIds.add(node.id);
          }
      }
  }

  // ── Drag & Drop Multi-Node Controller ──

  onNodeClick(event: MouseEvent, node: MapNode) {
     if (event.shiftKey) {
         if (this.selectedNodeIds.has(node.id)) {
             this.selectedNodeIds.delete(node.id);
         } else {
             this.selectedNodeIds.add(node.id);
         }
     } else {
         // If a user casually casually clicks a node without shift that is ALREADY part of the payload, we do nothing to let drag begin.
         // If they casually click an isolated node outside the group payload, focus strictly switches to that isolated un-grouped node logically!
         if (!this.selectedNodeIds.has(node.id)) {
            this.selectedNodeIds.clear();
         }
     }
  }

  onDragStarted(event: CdkDragStart, node: MapNode) {
     // Validate active grouping safely
     if (!this.selectedNodeIds.has(node.id)) {
         this.selectedNodeIds.clear();
         this.selectedNodeIds.add(node.id); // It implicitly groups itself temporarily for internal loop consistency
     }
  }

  onDragMoved(event: CdkDragMove, leadNode: MapNode) {
    const dragDelta = event.source.getFreeDragPosition();

    // Map synchronous coordinates visually onto all other grouped members natively
    // We adjust currentPosition to update wires AND apply visual DOM offset manually through binding.
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
    
    this.cdr.detectChanges(); // Sweep Wires logic
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

      if (this.nodes().length === 0 && this.panX() === 0 && this.panY() === 0) {
          const containerW = this.mapContainer.nativeElement.clientWidth;
          this.panX.set((containerW / 2) - 100);
          this.panY.set(60);
      }
      
      const existingNodesMap = new Map(this.nodes().map(n => [n.id, n]));

      // Hybrid Cache Layer logic
      const resolvePos = (nodeId: string, defaultX: number, defaultY: number) => {
          // 1. Is there saved manual layout in browser?
          if (savedLayouts[nodeId]) {
              return { x: savedLayouts[nodeId].x, y: savedLayouts[nodeId].y, initX: 0, initY: 0 };
          }
          // 2. Was it already actively mapped on screen prior to hot-load? Use that natively.
          const prior = existingNodesMap.get(nodeId);
          if (prior) {
              return { x: prior.x, y: prior.y, initX: prior.initialPosition.x, initY: prior.initialPosition.y };
          }
          // 3. Fallback to graph algorithmic generation coordinates entirely physically natively 
           return { x: defaultX, y: defaultY, initX: 0, initY: 0 };
      };

      // 1. Root Workspace Node
      const rPos = resolvePos(ws.id, 0, 0);
      const rootNode: MapNode = {
        id: ws.id,
        type: 'workspace',
        label: ws.name,
        icon: 'bi-grid-1x2',
        x: rPos.x,
        y: rPos.y,
        parentId: null,
        initialPosition: { x: rPos.initX, y: rPos.initY },
        currentPosition: { x: 0, y: 0 }
      };
      
      buildNodes.push(rootNode);

      // 2. Fetch Core Spaces
      const allSpaces = await this.spaces.getByWorkspace(ws.id);
      
      const gap = 300;
      const totalSpacesWidth = (allSpaces.length - 1) * gap;
      let startX = -(totalSpacesWidth / 2);

      for (let i = 0; i < allSpaces.length; i++) {
          const sp = allSpaces[i];
          const calculatedX = startX + (i * gap);
          const calculatedY = 160;

          const pPos = resolvePos(sp.id, calculatedX, calculatedY);
          
          buildNodes.push({
              id: sp.id,
              type: 'space',
              label: sp.name,
              icon: 'bi-folder2-open',
              x: pPos.x,
              y: pPos.y,
              parentId: ws.id,
              initialPosition: { x: pPos.initX, y: pPos.initY },
              currentPosition: { x: 0, y: 0 }
          });
      }
      
      this.nodes.set([...buildNodes]);

      // 3. Recursive Subspace Mapping
      const mode = await this.fileSystem.getStorageMode();
      
      await Promise.all(buildNodes.filter(n => n.type === 'space').map(async (spNode) => {
        let handle: any = undefined;
        if (mode === 'filesystem') {
           handle = await this.fileSystem.resolveSpaceHandle(ws.name, spNode.id);
        }
        // Since we load coordinates, we need the initial algorithmic parentX/parentY to be correct.
        // It relies on the tree shape, so calculating default logic is complex but safe:
        const treeRootX = startX + (allSpaces.findIndex(s => s.id === spNode.id) * gap);
        
        await this.scanDirectoryRecursive(handle, spNode.id, null, spNode.id, treeRootX, 160, buildNodes, 1, savedLayouts, existingNodesMap);
      }));

      // Set final tree layout
      this.nodes.set([...buildNodes]); 
      
    } finally {
      this.isScanning = false;
    }
  }

  private async scanDirectoryRecursive(
      dirHandle: any, 
      spaceId: string, 
      parentDirectoryId: string | null, 
      parentNodeId: string, 
      defaulParentX: number, 
      defaultParentY: number, 
      refNodes: MapNode[], 
      level: number,
      savedLayouts: Record<string, {x: number, y: number}>,
      existingNodesMap: Map<string, MapNode>
  ) {
      if (level > 3) return; 

      try {
        const entries = await this.fileManager.readDirectory({ handle: dirHandle, spaceId, parentId: parentDirectoryId });
        if (entries.length === 0) return;

        const spacingX = 180;
        const spacingY = 120;
        
        const UI_LIMIT = 5;
        const displayEntries = entries.slice(0, UI_LIMIT);
        const hasOverflow = entries.length > UI_LIMIT;
        
        const clusterBlocks = displayEntries.length + (hasOverflow ? 1 : 0);
        const totalClusterWidth = (clusterBlocks - 1) * spacingX;
        let currentDefaultX = defaulParentX - (totalClusterWidth / 2);
        let currentDefaultY = defaultParentY + spacingY;

        const resolveNodePos = (nId: string, currX: number, currY: number) => {
          if (savedLayouts[nId]) return { x: savedLayouts[nId].x, y: savedLayouts[nId].y, initX: 0, initY: 0 };
          const p = existingNodesMap.get(nId);
          if (p) return { x: p.x, y: p.y, initX: p.initialPosition.x, initY: p.initialPosition.y };
          return { x: currX, y: currY, initX: 0, initY: 0 };
        };

        for (const entry of displayEntries) {
            // Use deterministic naming. If entry.id is null (e.g., native physical files un-tracked logically), we construct a deterministic semantic route key!
            // This guarantees layout caching across refreshes hits successfully.
            const nodeId = entry.id || `virtual_${parentNodeId}_${entry.name}`;
            const p = resolveNodePos(nodeId, currentDefaultX, currentDefaultY);

            const isDirectory = entry.kind === 'directory';

            refNodes.push({
                id: nodeId,
                type: isDirectory ? 'subspace' : 'file',
                label: entry.name,
                icon: isDirectory ? 'bi-folder2' : 'bi-file-earmark',
                x: p.x,
                y: p.y,
                parentId: parentNodeId,
                initialPosition: { x: p.initX, y: p.initY },
                currentPosition: { x: 0, y: 0 }
            });

            if (isDirectory) {
                await this.scanDirectoryRecursive(entry.handle, spaceId, entry.id || null, nodeId, currentDefaultX, currentDefaultY, refNodes, level + 1, savedLayouts, existingNodesMap);
            }

            currentDefaultX += spacingX;
        }

        if (hasOverflow) {
            const overId = `overflow_${parentNodeId}`;
            const p = resolveNodePos(overId, currentDefaultX, defaultParentY + (spacingY * 0.9));
             refNodes.push({
                id: overId,
                type: 'overflow',
                label: `+ ${entries.length - UI_LIMIT} More`,
                icon: 'bi-box-seam',
                x: p.x,
                y: p.y,
                parentId: parentNodeId,
                initialPosition: { x: p.initX, y: p.initY },
                currentPosition: { x: 0, y: 0 }
            });
        }

      } catch (err) { }
  }
}
