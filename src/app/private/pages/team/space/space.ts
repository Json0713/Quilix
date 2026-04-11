import { Component, inject, signal, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { SpaceService } from '../../../../core/services/components/space.service';
import { Space } from '../../../../core/interfaces/space';

import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { FileExplorerComponent } from '../../../../shared/components/space-manager/file-explorer/file-explorer';
import { Breadcrumb } from '../../../../shared/ui/common/breadcrumb/breadcrumb';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-team-space',
    standalone: true,
    imports: [CommonModule, FileExplorerComponent, Breadcrumb],
    templateUrl: './space.html',
    styleUrl: './space.scss',
})
export class TeamSpace implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private spaceService = inject(SpaceService);
    private fileSystem = inject(FileSystemService);
    private authService = inject(AuthService);
    private breadcrumbService = inject(BreadcrumbService);

    space = signal<Space | null>(null);
    loading = signal(true);

    isFileSystemMode = signal<boolean>(false);
    spaceHandle = signal<FileSystemDirectoryHandle | null>(null);
    workspaceId = signal<string | null>(null);

    // App Window Management
    explorerVisible = signal<boolean>(false);
    isMaximized = signal<boolean>(false);
    windowSize = signal<{ width: number, height: number }>({ width: 800, height: 580 });
    windowPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 }); // Centered dynamically
    
    isDragging = false;
    isResizing = false;
    private dragOffset = { x: 0, y: 0 };
    private initialSize = { width: 0, height: 0 };
    private initialPos = { x: 0, y: 0 };

    private readonly STORAGE_KEY = 'quilix_explorer_state_team';

    @ViewChild(FileExplorerComponent) explorer!: FileExplorerComponent;
    explorerBreadcrumbs = signal<any[]>([]);

    onBreadcrumbsChanged(crumbs: any[]) {
        this.explorerBreadcrumbs.set(crumbs);
    }

    navigateToExplorerCrumb(index: number) {
        if (this.explorer) {
            this.explorer.navigateToCrumb(index);
        }
    }

    private paramSub!: Subscription;
    private spaceSub: any;

    async ngOnInit() {
        this.loadWindowState();
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');

        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            this.loading.set(true);
            this.spaceHandle.set(null);

            // Auto-close app window when switching spaces
            this.explorerVisible.set(false);

            this.spaceSub?.unsubscribe();

            if (spaceId) {
                this.spaceSub = this.spaceService.liveSpace$(spaceId).subscribe(
                    async (space: Space | null) => {
                        this.space.set(space);
                        if (space) {
                            this.breadcrumbService.setTitle(space.name);
                            
                            const workspace = await this.authService.getCurrentWorkspace();
                            this.workspaceId.set(workspace?.id || null);

                            if (this.isFileSystemMode()) {
                                await this.resolveSpaceHandle(space);
                            } else {
                                this.loading.set(false);
                            }
                        } else {
                            this.breadcrumbService.setTitle('Space Not Found');
                            this.loading.set(false);
                        }
                    }
                );
            } else {
                this.space.set(null);
                this.breadcrumbService.setTitle('Loading...');
                this.loading.set(false);
            }
        });
    }

    private async resolveSpaceHandle(space: Space) {
        try {
            const workspace = await this.authService.getCurrentWorkspace();
            const rootHandle = await this.fileSystem.getStoredHandle();
            
            // Explicitly verify permission for the session if not verified yet
            let hasPerm = this.fileSystem.hasPermission();
            if (rootHandle && !hasPerm) {
                hasPerm = await this.fileSystem.verifyPermission(rootHandle, true, false);
            }
            
            if (workspace && rootHandle && hasPerm) {
                const quilixHandle = await rootHandle.getDirectoryHandle('Quilix', { create: false });
                const wsHandle = await quilixHandle.getDirectoryHandle(workspace.name, { create: false });
                const spHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false });
                this.spaceHandle.set(spHandle);
            }
        } catch (e) {
            console.error('[TeamSpace] Failed to resolve physical directory handle for Space:', e);
            this.spaceHandle.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    // Window Actions
    toggleExplorer() {
        const isMobile = window.innerWidth < 768;
        this.explorerVisible.update(v => {
            const next = !v;
            // If opening on mobile, default to maximized
            if (next && isMobile) {
                this.isMaximized.set(true);
            }
            return next;
        });

        if (!this.explorerVisible()) {
            this.isMaximized.set(false);
        }
    }

    toggleMaximize() {
        this.isMaximized.update(v => !v);
    }

    // --- Window Interaction (Drag & Resize) ---

    onDragStart(event: MouseEvent) {
        // Disable dragging in maximized mode or on mobile
        if (this.isMaximized() || window.innerWidth < 768) return;
        
        this.isDragging = true;
        this.dragOffset = {
            x: event.clientX - this.windowPosition().x,
            y: event.clientY - this.windowPosition().y
        };
        
        window.addEventListener('mousemove', this.onDragMove);
        window.addEventListener('mouseup', this.onDragEnd);
        
        // Prevent text selection during drag
        event.preventDefault();
    }

    onDragMove = (event: MouseEvent) => {
        if (!this.isDragging) return;
        
        requestAnimationFrame(() => {
            this.windowPosition.set({
                x: event.clientX - this.dragOffset.x,
                y: event.clientY - this.dragOffset.y
            });
        });
    }

    onDragEnd = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
        this.saveWindowState();
    }

    // SE Corner Resizing
    onResizeStart(event: MouseEvent) {
        if (this.isMaximized() || window.innerWidth < 768) return;
        
        event.stopPropagation();
        event.preventDefault();
        
        this.isResizing = true;
        this.initialPos = { x: event.clientX, y: event.clientY };
        this.initialSize = { ...this.windowSize() };

        window.addEventListener('mousemove', this.onResizeMove);
        window.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (event: MouseEvent) => {
        if (!this.isResizing) return;

        requestAnimationFrame(() => {
            const deltaX = event.clientX - this.initialPos.x;
            const deltaY = event.clientY - this.initialPos.y;

            // Apply constraints (Min: 600x450)
            this.windowSize.set({
                width: Math.max(600, this.initialSize.width + deltaX),
                height: Math.max(450, this.initialSize.height + deltaY)
            });
        });
    }

    onResizeEnd = () => {
        this.isResizing = false;
        window.removeEventListener('mousemove', this.onResizeMove);
        window.removeEventListener('mouseup', this.onResizeEnd);
        this.saveWindowState();
    }

    private saveWindowState() {
        const state = {
            width: this.windowSize().width,
            height: this.windowSize().height,
            x: this.windowPosition().x,
            y: this.windowPosition().y
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    private loadWindowState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.windowSize.set({ width: state.width || 800, height: state.height || 580 });
                this.windowPosition.set({ x: state.x || 0, y: state.y || 0 });
                return;
            } catch (e) {
                console.error('[TeamSpace] Failed to load window state:', e);
            }
        }
        
        // Default Centering if no state
        this.centerWindow();
    }

    private centerWindow() {
        const size = this.windowSize();
        this.windowPosition.set({
            x: (window.innerWidth - size.width) / 2,
            y: (window.innerHeight - size.height) / 2
        });
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
        this.spaceSub?.unsubscribe();
    }
}
