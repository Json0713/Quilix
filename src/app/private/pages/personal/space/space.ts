import { Component, inject, signal, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SpaceService } from '../../../../core/services/components/space.service';
import { Space } from '../../../../core/interfaces/space';

import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { FileExplorerComponent } from '../../../../shared/components/space-manager/file-explorer/file-explorer';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';
import { SpaceCardComponent } from '../../../../shared/components/space-manager/space-card/space-card';
import { FloatingWindowComponent } from '../../../../shared/components/floating-window/floating-window';
import { SheetListComponent } from '../../../../shared/components/sheet-list/sheet-list';

@Component({
    selector: 'app-personal-space',
    standalone: true,
    imports: [
        CommonModule, 
        FileExplorerComponent, 
        PageHeaderActionsDirective,
        SpaceCardComponent,
        FloatingWindowComponent,
        SheetListComponent
    ],
    templateUrl: './space.html',
    styleUrl: './space.scss',
})
export class PersonalSpace implements OnInit, OnDestroy {
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

    // App Windows
    explorerVisible = signal<boolean>(false);
    sheetVisible = signal<boolean>(false);

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
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');

        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            this.loading.set(true);
            this.spaceHandle.set(null);
            
            // Auto-close app windows when switching spaces
            this.explorerVisible.set(false);
            this.sheetVisible.set(false);

            // Tear down previous live subscription
            this.spaceSub?.unsubscribe();

            if (spaceId) {
                // Reactive: updates when space is renamed, trashed, or deleted
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
            console.error('[PersonalSpace] Failed to resolve physical directory handle for Space:', e);
            this.spaceHandle.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    // Window Actions
    toggleExplorer() {
        this.explorerVisible.update(v => !v);
    }

    toggleSheet() {
        this.sheetVisible.update(v => !v);
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
        this.spaceSub?.unsubscribe();
    }
}
