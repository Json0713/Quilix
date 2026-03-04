import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Workspace } from '../../../core/interfaces/workspace';
import { Space } from '../../../core/interfaces/space';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { FileSystemService } from '../../../core/services/file-system.service';
import { SpaceService } from '../../../core/services/space.service';
import { SystemSyncService } from '../../../core/services/system-sync.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Breadcrumb } from '../../ui/common/breadcrumb/breadcrumb';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { WorkspaceMetricsComponent } from './workspace-metrics/workspace-metrics';
import { WorkspaceCardComponent } from './workspace-card/workspace-card';

export interface ManagedWorkspace extends Workspace {
    isMissingOnDisk?: boolean;
    isRestoring?: boolean;
    isTrashing?: boolean;
}

@Component({
    selector: 'app-workspace-manager',
    standalone: true,
    imports: [CommonModule, DragDropModule, Breadcrumb, WorkspaceMetricsComponent, WorkspaceCardComponent],
    templateUrl: './workspace-manager.html',
    styleUrl: './workspace-manager.scss',
})
export class WorkspaceManagerComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private fileSystem = inject(FileSystemService);
    private spaceService = inject(SpaceService);
    private systemSync = inject(SystemSyncService);
    private authService = inject(AuthService);
    private breadcrumbService = inject(BreadcrumbService);

    get totalWorkspaces() { return this.workspaces().length; }
    get syncedFolders() { return this.workspaces().filter(w => !w.isMissingOnDisk).length; }
    get missingFolders() { return this.workspaces().filter(w => w.isMissingOnDisk).length; }

    workspaces = signal<ManagedWorkspace[]>([]);
    isLoading = signal<boolean>(true);
    isFileSystemMode = signal<boolean>(false);
    needsReauth = signal<boolean>(false);
    isReauthing = signal<boolean>(false);

    currentWorkspaceId = signal<string | null>(null);
    totalSpaces = signal<number>(0);

    currentWorkspace = computed(() => this.workspaces().find(w => w.id === this.currentWorkspaceId()));
    otherWorkspaces = computed(() => this.workspaces().filter(w => w.id !== this.currentWorkspaceId()));

    // ── Selection state ──
    selectionMode = signal<boolean>(false);
    selectedIds = signal<Set<string>>(new Set());
    confirmingBulkTrash = signal<boolean>(false);
    isBulkProcessing = signal<boolean>(false);

    selectedCount = computed(() => this.selectedIds().size);
    isAllSelected = computed(() => {
        const ws = this.workspaces();
        const sel = this.selectedIds();
        return ws.length > 0 && sel.size === ws.length;
    });
    hasSelectedMissing = computed(() => {
        const sel = this.selectedIds();
        return this.workspaces().some(w => sel.has(w.id) && w.isMissingOnDisk);
    });

    // ── Single-item state ──
    confirmingTrashId = signal<string | null>(null);
    openMenuId = signal<string | null>(null);

    @HostListener('document:click')
    closeAllMenus() {
        this.openMenuId.set(null);
    }

    toggleMenu(id: string, event: Event) {
        event.stopPropagation();
        this.openMenuId.update(current => current === id ? null : id);
    }

    async ngOnInit() {
        this.breadcrumbService.setTitle('Manage Workspaces');
        await this.loadWorkspaces();

        // Load independent metrics
        this.totalSpaces.set(await this.spaceService.getTotalCount());
        const currentWs = await this.authService.getCurrentWorkspace();
        if (currentWs) {
            this.currentWorkspaceId.set(currentWs.id);
        }
    }

    @HostListener('window:focus')
    async onWindowFocus() {
        await this.quietLoadWorkspaces();
    }

    async loadWorkspaces() {
        this.isLoading.set(true);
        try {
            await this.quietLoadWorkspaces();
        } finally {
            this.isLoading.set(false);
        }
    }

    private async quietLoadWorkspaces() {
        const rawWorkspaces = await this.workspaceService.getAll();
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');

        const managed: ManagedWorkspace[] = [];
        const currentMap = new Map(this.workspaces().map(w => [w.id, w]));

        for (const ws of rawWorkspaces) {
            let isMissingOnDisk = false;

            if (this.isFileSystemMode() && ws.folderPath) {
                const result = await this.fileSystem.checkFolderExists(ws.name);
                if (result === 'no-permission') {
                    // Permission lost — don't mark as missing, show re-auth banner instead
                    this.needsReauth.set(true);
                    isMissingOnDisk = false;
                } else {
                    this.needsReauth.set(false);
                    isMissingOnDisk = !result;
                }
            }

            const existing = currentMap.get(ws.id);
            managed.push({
                ...ws,
                isMissingOnDisk,
                isRestoring: existing?.isRestoring || false,
                isTrashing: existing?.isTrashing || false
            });
        }

        this.workspaces.set(managed);

        // Clean up stale selections after reload
        if (this.selectionMode()) {
            const validIds = new Set(managed.map(w => w.id));
            this.selectedIds.update(ids => {
                const next = new Set<string>();
                ids.forEach(id => { if (validIds.has(id)) next.add(id); });
                return next;
            });
        }
    }

    // ── Re-auth (user-gesture triggered) ──

    async reconnectStorage() {
        if (this.isReauthing()) return;
        this.isReauthing.set(true);

        try {
            const granted = await this.fileSystem.requestPermissionWithGesture();
            if (granted) {
                this.needsReauth.set(false);
                await this.systemSync.importStateFromDisk();
                // Re-create workspace folders in the (possibly re-picked) directory
                await this.workspaceService.migrateToFileSystem();
                await this.quietLoadWorkspaces();
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
        this.confirmingBulkTrash.set(false);
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
            const allIds = new Set(this.workspaces().map(w => w.id));
            this.selectedIds.set(allIds);
        }
    }

    // ── Bulk trash ──

    requestBulkTrash() {
        if (this.selectedCount() === 0) return;
        this.confirmingBulkTrash.set(true);
    }

    cancelBulkTrash() {
        this.confirmingBulkTrash.set(false);
    }

    async confirmBulkTrash() {
        if (this.isBulkProcessing()) return;
        this.isBulkProcessing.set(true);

        try {
            const ids = Array.from(this.selectedIds());
            for (const id of ids) {
                await this.workspaceService.moveToTrash(id);
            }
            this.workspaces.update(list => list.filter(w => !this.selectedIds().has(w.id)));
            this.exitSelectionMode();
        } finally {
            this.isBulkProcessing.set(false);
        }
    }

    // ── Bulk folder restore ──

    async bulkRestoreFolders() {
        if (this.isBulkProcessing() || !this.hasSelectedMissing()) return;
        this.isBulkProcessing.set(true);

        try {
            const selected = this.workspaces().filter(w => this.selectedIds().has(w.id) && w.isMissingOnDisk);
            for (const ws of selected) {
                const success = await this.fileSystem.restoreFolder(ws.name);
                if (success) {
                    this.updateWorkspaceState(ws.id, { isMissingOnDisk: false });
                }
            }
            this.exitSelectionMode();
        } finally {
            this.isBulkProcessing.set(false);
        }
    }

    // ── Single-item actions ──

    async restoreWorkspace(workspace: ManagedWorkspace) {
        if (workspace.isRestoring || !workspace.isMissingOnDisk) return;

        this.updateWorkspaceState(workspace.id, { isRestoring: true });

        try {
            const success = await this.fileSystem.restoreFolder(workspace.name);
            if (success) {
                this.updateWorkspaceState(workspace.id, {
                    isRestoring: false,
                    isMissingOnDisk: false
                });
            } else {
                console.error(`Failed to restore workspace: ${workspace.name}`);
                this.updateWorkspaceState(workspace.id, { isRestoring: false });
            }
        } catch (error) {
            console.error(`Error restoring workspace: ${workspace.name}`, error);
            this.updateWorkspaceState(workspace.id, { isRestoring: false });
        }
    }

    requestTrash(workspace: ManagedWorkspace) {
        this.confirmingTrashId.set(workspace.id);
    }

    cancelTrash() {
        this.confirmingTrashId.set(null);
    }

    async confirmTrash(workspace: ManagedWorkspace) {
        this.confirmingTrashId.set(null);
        await this.moveToTrash(workspace);
    }

    async moveToTrash(workspace: ManagedWorkspace) {
        if (workspace.isTrashing) return;

        this.updateWorkspaceState(workspace.id, { isTrashing: true });

        try {
            await this.workspaceService.moveToTrash(workspace.id);
            this.workspaces.update(list => list.filter(w => w.id !== workspace.id));
        } catch (error) {
            console.error(`Error moving workspace to trash: ${workspace.name}`, error);
            this.updateWorkspaceState(workspace.id, { isTrashing: false });
        }
    }

    private updateWorkspaceState(id: string, updates: Partial<ManagedWorkspace>) {
        this.workspaces.update(list =>
            list.map(w => w.id === id ? { ...w, ...updates } : w)
        );
    }

    // ── Session Navigation ──

    async loginExistingWorkspace(workspace: ManagedWorkspace) {
        if (workspace.isMissingOnDisk) return; // Prevent logging into missing folders

        try {
            await this.authService.loginExisting(workspace);
            // After successful session creation, the authService observable will emit LOGIN and redirect to root dashboard
        } catch (error) {
            console.error(`Failed to login to workspace: ${workspace.name}`, error);
        }
    }


    // ── Drag & Drop ──

    onDrop(event: CdkDragDrop<ManagedWorkspace[]>) {
        if (event.previousIndex === event.currentIndex || this.selectionMode()) return;

        // Clone the original full array to manipulate
        const updatedWorkspaces = [...this.workspaces()];

        // The event indices are based on the filtered `otherWorkspaces` array, so we must map them 
        // to their actual indices in the `workspaces` array.
        const otherWs = this.otherWorkspaces();
        const draggedWs = otherWs[event.previousIndex];
        const targetWs = otherWs[event.currentIndex];

        const actualPrevIndex = updatedWorkspaces.findIndex(w => w.id === draggedWs.id);
        const actualCurrentIndex = updatedWorkspaces.findIndex(w => w.id === targetWs.id);

        moveItemInArray(updatedWorkspaces, actualPrevIndex, actualCurrentIndex);

        // Update local signal to immediately reflect the reorder
        this.workspaces.set(updatedWorkspaces);

        // Prepare bulk updates using the new indices
        const updates = updatedWorkspaces.map((ws, i) => ({ id: ws.id, order: i }));
        this.workspaceService.updateWorkspaceOrder(updates).catch(err => {
            console.error('Failed to update workspace order', err);
        });
    }
}
