import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
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
    selector: 'app-team-space-view',
    standalone: true,
    imports: [CommonModule, FileExplorerComponent, Breadcrumb],
    templateUrl: './space-view.html',
    styleUrl: './space-view.scss',
})
export class SpaceView implements OnInit, OnDestroy {
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
    windowPosition = signal<{ x: number, y: number }>({ x: 20, y: 20 });
    isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    private paramSub!: Subscription;
    private spaceSub: any;

    async ngOnInit() {
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');

        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            this.loading.set(true);
            this.spaceHandle.set(null);

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
            console.error('[SpaceView (Team)] Failed to resolve physical directory handle for Space:', e);
            this.spaceHandle.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    // Window Actions
    toggleExplorer() {
        this.explorerVisible.update(v => !v);
        // Reset to windowed mode if opening
        if (!this.explorerVisible()) this.isMaximized.set(false);
    }

    toggleMaximize() {
        this.isMaximized.update(v => !v);
    }

    // Dragging Logic
    onDragStart(event: MouseEvent) {
        if (this.isMaximized()) return;
        this.isDragging = true;
        this.dragOffset = {
            x: event.clientX - this.windowPosition().x,
            y: event.clientY - this.windowPosition().y
        };
        
        // Add global listeners
        window.addEventListener('mousemove', this.onDragMove);
        window.addEventListener('mouseup', this.onDragEnd);
    }

    onDragMove = (event: MouseEvent) => {
        if (!this.isDragging) return;
        this.windowPosition.set({
            x: event.clientX - this.dragOffset.x,
            y: event.clientY - this.dragOffset.y
        });
    }

    onDragEnd = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
        this.spaceSub?.unsubscribe();
    }
}
