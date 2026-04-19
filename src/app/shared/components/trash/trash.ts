import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Workspace } from '../../../core/interfaces/workspace';
import { Space } from '../../../core/interfaces/space';
import { WorkspaceService } from '../../../core/services/components/workspace.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { TimeAgoPipe } from '../../ui/common/time-ago/time-ago-pipe';
import { StorageHealthBanner } from '../storage-health-banner/storage-health-banner';
import { SnackbarService } from '../../../services/ui/common/snackbar/snackbar.service';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PageHeaderActionsDirective } from '../page-header/page-header-actions.directive';

@Component({
    selector: 'app-trash',
    standalone: true,
    imports: [CommonModule, TimeAgoPipe, TitleCasePipe, StorageHealthBanner, PageHeaderActionsDirective],
    templateUrl: './trash.html',
    styleUrl: './trash.scss',
})
export class TrashComponent implements OnInit, OnDestroy {
    private workspaceService = inject(WorkspaceService);
    private spaceService = inject(SpaceService);
    private authService = inject(AuthService);
    private fileSystem = inject(FileSystemService);
    private snackbarService = inject(SnackbarService);
    private breadcrumbService = inject(BreadcrumbService);

    trashedWorkspaces = signal<Workspace[]>([]);
    trashedSpaces = signal<Space[]>([]);
    isLoading = signal<boolean>(true);

    // ── Single-item & Bulk UI state ──
    processingIds = signal<Set<string>>(new Set());
    confirmingDeleteId = signal<string | null>(null);

    // ── Selection state ──
    selectionMode = signal<boolean>(false);
    selectedIds = signal<Set<string>>(new Set());
    confirmingBulkDelete = signal<boolean>(false);
    isBulkProcessing = signal<boolean>(false);

    // ── Filesystem re-auth state ──
    isFileSystemMode = signal<boolean>(false);
    needsReauth = signal<boolean>(false);
    isReauthing = signal<boolean>(false);

    selectedCount = computed(() => this.selectedIds().size);
    isAllSelected = computed(() => {
        const total = this.trashedWorkspaces().length + this.trashedSpaces().length;
        const sel = this.selectedIds();
        return total > 0 && sel.size === total;
    });
    hasAnyTrashed = computed(() => this.trashedWorkspaces().length > 0 || this.trashedSpaces().length > 0);

    private wsSub: any;
    private spaceSub: any;
    private activeWorkspaceName: string | null = null;

    async ngOnInit() {
        this.breadcrumbService.setTitle('Trash');
        // Check filesystem mode and permission state
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');
        if (this.isFileSystemMode() && !this.fileSystem.hasPermission()) {
            this.needsReauth.set(true);
        }

        this.wsSub = this.workspaceService.trashedWorkspaces$.subscribe((list: Workspace[]) => {
            this.trashedWorkspaces.set(list);
            this.isLoading.set(false);

            // Clean up stale selections
            if (this.selectionMode()) {
                const validIds = new Set(list.map(w => 'ws:' + w.id));
                this.trashedSpaces().forEach(s => validIds.add('sp:' + s.id));
                this.selectedIds.update(ids => {
                    const next = new Set<string>();
                    ids.forEach(id => { if (validIds.has(id)) next.add(id); });
                    return next;
                });
            }
        });

        // Load trashed spaces for the current workspace
        const workspace = await this.authService.getCurrentWorkspace();
        if (workspace) {
            this.activeWorkspaceName = workspace.name;
            this.spaceSub = this.spaceService.liveTrashedSpaces$(workspace.id).subscribe(
                (list: Space[]) => this.trashedSpaces.set(list)
            );
        }
    }

    ngOnDestroy() {
        this.wsSub?.unsubscribe();
        this.spaceSub?.unsubscribe();
    }

    // ── Re-auth (user-gesture triggered) ──

    async reconnectStorage() {
        if (this.isReauthing()) return;
        this.isReauthing.set(true);

        try {
            const granted = await this.fileSystem.requestPermissionWithGesture();
            if (granted) {
                this.needsReauth.set(false);
                // Re-create workspace folders in the (possibly re-picked) directory
                await this.workspaceService.migrateToFileSystem();
            }
        } finally {
            this.isReauthing.set(false);
        }
    }

    // ── Selection methods ──

    toggleSelectionMode() {
        if (this.selectionMode()) {
            this.exitSelectionMode();
        } else {
            this.selectionMode.set(true);
        }
    }

    exitSelectionMode() {
        this.selectionMode.set(false);
        this.selectedIds.set(new Set());
        this.confirmingBulkDelete.set(false);
    }

    toggleSelect(id: string) {
        this.selectedIds.update(ids => {
            const next = new Set(ids);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    isSelected(id: string): boolean {
        return this.selectedIds().has(id);
    }

    toggleSelectAll() {
        if (this.isAllSelected()) {
            this.selectedIds.set(new Set());
        } else {
            const allIds = new Set([
                ...this.trashedWorkspaces().map(w => 'ws:' + w.id),
                ...this.trashedSpaces().map(s => 'sp:' + s.id)
            ]);
            this.selectedIds.set(allIds);
        }
    }

    // ── Bulk restore ──

    async bulkRestore() {
        if (this.isBulkProcessing() || this.selectedCount() === 0) return;
        this.isBulkProcessing.set(true);

        try {
            const ids = Array.from(this.selectedIds());

            // visually spin all selected items
            this.processingIds.set(new Set(ids));

            for (const prefixedId of ids) {
                if (prefixedId.startsWith('ws:')) {
                    await this.workspaceService.restoreFromTrash(prefixedId.slice(3));
                } else if (prefixedId.startsWith('sp:') && this.activeWorkspaceName) {
                    await this.spaceService.restoreFromTrash(prefixedId.slice(3), this.activeWorkspaceName);
                }
            }
            this.snackbarService.success(`Restored ${ids.length} items successfully.`);
            this.exitSelectionMode();
        } finally {
            this.isBulkProcessing.set(false);
            this.processingIds.set(new Set());
        }
    }

    // ── Bulk permanent delete ──

    requestBulkDelete() {
        if (this.selectedCount() === 0) return;
        this.confirmingBulkDelete.set(true);
    }

    cancelBulkDelete() {
        this.confirmingBulkDelete.set(false);
    }

    async confirmBulkDelete() {
        if (this.isBulkProcessing()) return;
        this.isBulkProcessing.set(true);

        try {
            // Ensure storage access before deleting folders
            await this.ensureStorageForDelete();

            const ids = Array.from(this.selectedIds());
            this.processingIds.set(new Set(ids));

            for (const prefixedId of ids) {
                if (prefixedId.startsWith('ws:')) {
                    await this.workspaceService.permanentlyDelete(prefixedId.slice(3));
                } else if (prefixedId.startsWith('sp:')) {
                    await this.spaceService.permanentlyDelete(prefixedId.slice(3), this.activeWorkspaceName ?? undefined);
                }
            }
            this.snackbarService.warning(`Permanently deleted ${ids.length} items.`);
            this.exitSelectionMode();
            this.confirmingBulkDelete.set(false);
        } catch (error) {
            this.snackbarService.error('Error permanently deleting files.');
            console.error(error);
        } finally {
            this.isBulkProcessing.set(false);
            this.processingIds.set(new Set());
        }
    }

    // ── Single-item actions ──

    async restoreWorkspace(workspaceId: string) {
        if (this.processingIds().has('ws:' + workspaceId)) return;
        this.processingIds.update(s => new Set(s).add('ws:' + workspaceId));

        try {
            await this.workspaceService.restoreFromTrash(workspaceId);
            this.snackbarService.success('Workspace restored');
        } finally {
            this.processingIds.update(s => {
                const next = new Set(s);
                next.delete('ws:' + workspaceId);
                return next;
            });
        }
    }

    requestPermanentDelete(workspaceId: string) {
        this.confirmingDeleteId.set(workspaceId);
    }

    cancelDelete() {
        this.confirmingDeleteId.set(null);
    }

    async confirmDelete(workspaceId: string) {
        if (this.processingIds().has('ws:' + workspaceId)) return;
        this.processingIds.update(s => new Set(s).add('ws:' + workspaceId));

        try {
            // Ensure storage access before deleting folder
            await this.ensureStorageForDelete();
            await this.workspaceService.permanentlyDelete(workspaceId);
            this.snackbarService.warning('Workspace permanently deleted');
        } finally {
            this.processingIds.update(s => {
                const next = new Set(s);
                next.delete('ws:' + workspaceId);
                return next;
            });
            this.confirmingDeleteId.set(null);
        }
    }

    getDaysLeft(trashedAt?: number): string {
        if (!trashedAt) return 'Unknown';
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((Date.now() - trashedAt) / msPerDay);
        const daysLeft = Math.max(0, 30 - daysPassed);
        return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
    }

    /**
     * If filesystem mode is on but permission is lost, try to reconnect inline.
     * This makes permanent delete also clean up the folder on mobile.
     */
    private async ensureStorageForDelete(): Promise<void> {
        if (!this.isFileSystemMode()) return;
        if (this.fileSystem.hasPermission()) return;

        // Try to get permission with gesture (we're inside a click handler)
        const granted = await this.fileSystem.requestPermissionWithGesture();
        if (granted) {
            this.needsReauth.set(false);
        }
    }

    // ── Space-specific actions ──

    async restoreSpace(spaceId: string) {
        if (this.processingIds().has('sp:' + spaceId)) return;
        if (!this.activeWorkspaceName) return;
        this.processingIds.update(s => new Set(s).add('sp:' + spaceId));

        try {
            await this.spaceService.restoreFromTrash(spaceId, this.activeWorkspaceName);
            this.snackbarService.success('Space restored');
        } finally {
            this.processingIds.update(s => {
                const next = new Set(s);
                next.delete('sp:' + spaceId);
                return next;
            });
        }
    }

    confirmingDeleteSpaceId = signal<string | null>(null);

    requestDeleteSpace(spaceId: string) {
        this.confirmingDeleteSpaceId.set(spaceId);
    }

    cancelDeleteSpace() {
        this.confirmingDeleteSpaceId.set(null);
    }

    async confirmDeleteSpace(spaceId: string) {
        if (this.processingIds().has('sp:' + spaceId)) return;
        this.processingIds.update(s => new Set(s).add('sp:' + spaceId));

        try {
            await this.spaceService.permanentlyDelete(spaceId, this.activeWorkspaceName ?? undefined);
            this.snackbarService.warning('Space permanently deleted');
        } finally {
            this.processingIds.update(s => {
                const next = new Set(s);
                next.delete('sp:' + spaceId);
                return next;
            });
            this.confirmingDeleteSpaceId.set(null);
        }
    }
}
