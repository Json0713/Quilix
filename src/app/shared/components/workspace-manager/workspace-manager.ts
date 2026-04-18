import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Workspace } from '../../../core/interfaces/workspace';
import { WorkspaceService } from '../../../core/services/components/workspace.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { SystemSyncService } from '../../../core/services/sync/system-sync.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Breadcrumb } from '../../ui/common/breadcrumb/breadcrumb';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { FileSyncService } from '../../../core/services/sync/file-sync.service';
import { WorkspaceCardComponent } from './workspace-card/workspace-card';
import { WorkspaceMetrics } from './workspace-metrics/workspace-metrics';
import { SnackbarService } from '../../../services/ui/common/snackbar/snackbar.service';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ActivityService } from '../../../core/services/ui/activity.service';
import { ActivityGraph } from '../terminal/source-control/activity-graph/activity-graph';
import { TerminalService } from '../../../core/services/ui/terminal.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';

export interface ManagedWorkspace extends Workspace {
    isMissingOnDisk?: boolean;
    isRestoring?: boolean;
    isTrashing?: boolean;
    sizeBytes?: number;
}

@Component({
    selector: 'app-workspace-manager',
    standalone: true,
    imports: [CommonModule, DragDropModule, Breadcrumb, WorkspaceCardComponent, WorkspaceMetrics, ActivityGraph],
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
    private snackbarService = inject(SnackbarService);
    private router = inject(Router);
    private modalService = inject(ModalService);
    private fileSync = inject(FileSyncService);
    private activityService = inject(ActivityService);
    private terminalService = inject(TerminalService);

    openSourceControlTerminal() {
        this.terminalService.activeTab.set('source-control');
        this.terminalService.isMaximized.set(true);
        this.terminalService.isOpen.set(true);
    }

    // ── Activity Graph Integration ──
    protected allActivities = toSignal(from(this.activityService.activities$), { initialValue: [] });
    protected graphActivities = computed(() => {
        return this.allActivities().filter(l => l.category !== 'system');
    });
    selectedTimeRange = signal<{ start: number, end: number } | null>(null);

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
        const otherWs = this.otherWorkspaces();
        const sel = this.selectedIds();
        return otherWs.length > 0 && sel.size === otherWs.length;
    });
    hasSelectedMissing = computed(() => {
        const sel = this.selectedIds();
        return this.workspaces().some(w => sel.has(w.id) && w.isMissingOnDisk);
    });

    // ── Single-item state ──
    openMenuId = signal<string | null>(null);
    headerMenuOpen = signal<boolean>(false);

    // ── View state ──
    viewMode = signal<'list' | 'card'>('list');

    // ── Insight/Metrics Carousel State ──
    activeInsightView = signal<'graph' | 'metrics'>('graph');

    toggleInsightView() {
        this.activeInsightView.set(this.activeInsightView() === 'graph' ? 'metrics' : 'graph');
    }

    @HostListener('document:click')
    closeAllMenus() {
        this.openMenuId.set(null);
        this.headerMenuOpen.set(false);
    }

    toggleMenu(id: string, event: Event) {
        event.stopPropagation();
        this.headerMenuOpen.set(false);
        this.openMenuId.update(current => current === id ? null : id);
    }

    toggleHeaderMenu(event: Event) {
        event.stopPropagation();
        this.openMenuId.set(null);
        this.headerMenuOpen.update(v => !v);
    }

    async ngOnInit() {
        this.breadcrumbService.setTitle('Manage Workspaces');

        // Prevent major DOM jerks by querying and establishing structural views instantly
        const savedView = localStorage.getItem('workspaceViewMode');
        if (savedView === 'list' || savedView === 'card') {
            this.viewMode.set(savedView);
        }

        await this.loadWorkspaces();

        // Load independent metrics
        this.totalSpaces.set(await this.spaceService.getTotalCount());
        const currentWs = await this.authService.getCurrentWorkspace();
        if (currentWs) {
            this.currentWorkspaceId.set(currentWs.id);
        }
    }

    setViewMode(mode: 'list' | 'card') {
        this.viewMode.set(mode);
        localStorage.setItem('workspaceViewMode', mode);
    }

    async openCreateWorkspace() {
        const needsRefresh = await this.modalService.openCreateWorkspace();
        if (needsRefresh) {
            await this.quietLoadWorkspaces();
        }
    }

    async renameWorkspace(workspace: ManagedWorkspace) {
        const needsRefresh = await this.modalService.openEditWorkspace(workspace);
        if (needsRefresh) {
            await this.quietLoadWorkspaces();
            this.snackbarService.success(`Workspace renamed successfully.`);
        }
    }

    @HostListener('window:focus')
    async onWindowFocus() {
        // PREVENTION: Don't trigger background load if we are currently re-authenticating 
        // to prevent race conditions between sync and permission grant.
        if (this.isReauthing() || this.isLoading()) return;
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
        const mode = await this.fileSystem.getStorageMode();
        this.isFileSystemMode.set(mode === 'filesystem');

        // Sync OS-level renames first if applicable
        if (this.isFileSystemMode()) {
            await this.workspaceService.syncExternalRenames();
        }

        const rawWorkspaces = await this.workspaceService.getAll();

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
                isTrashing: existing?.isTrashing || false,
                sizeBytes: existing?.sizeBytes
            });
        }

        this.workspaces.set(managed);

        // Kick off async size calculation
        if (this.isFileSystemMode() && !this.needsReauth()) {
            this.calculateWorkspaceSizes(managed);
        }

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

                try {
                    this.fileSystem.acquireSyncLock();

                    // 1. First, import any backed up state from disk
                    await this.systemSync.importStateFromDisk();

                    // 2. Re-create workspace folders if they were missing (e.g. fresh device or re-picked dir)
                    // This will also write the .quilix-id markers.
                    await this.workspaceService.migrateToFileSystem();

                    // 3. Hydrate file-level virtual entries to disk
                    await this.fileSync.hydrateNativeStorage();

                    // 4. Finally, perform the internal sync and local reload.
                    await this.workspaceService.syncExternalRenames();
                    await this.quietLoadWorkspaces();
                } finally {
                    this.fileSystem.releaseSyncLock();
                }

                this.snackbarService.success('Storage reconnected and synced successfully.');
            }
        } catch (error) {
            console.error('[WorkspaceManager] Reconnection failed:', error);
            this.snackbarService.error('Failed to reconnect storage.');
        } finally {
            this.isReauthing.set(true); // Keep state true for a micro-second to let window:focus clear
            setTimeout(() => this.isReauthing.set(false), 300);
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
            const allIds = new Set(this.otherWorkspaces().map(w => w.id));
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
            // Set trashing state for visual feedback
            ids.forEach(id => this.updateWorkspaceState(id, { isTrashing: true }));

            for (const id of ids) {
                await this.workspaceService.moveToTrash(id);
            }
            this.workspaces.update(list => list.filter(w => !this.selectedIds().has(w.id)));
            this.snackbarService.info(`Moved ${ids.length} workspaces to trash.`);
            this.exitSelectionMode();
            this.confirmingBulkTrash.set(false);
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

            // Set all to restoring state first for UI feedback
            selected.forEach(ws => this.updateWorkspaceState(ws.id, { isRestoring: true }));

            for (const ws of selected) {
                const success = await this.workspaceService.restoreWorkspace(ws.id, ws.name);
                if (success) {
                    this.updateWorkspaceState(ws.id, { isRestoring: false, isMissingOnDisk: false });
                } else {
                    this.updateWorkspaceState(ws.id, { isRestoring: false });
                }
            }
            this.snackbarService.success(`Restored ${selected.length} workspace folders.`);
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
            const success = await this.workspaceService.restoreWorkspace(workspace.id, workspace.name);
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

    async trashWorkspace(workspace: ManagedWorkspace) {
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
        this.workspaces.update(list => list.map(w => w.id === id ? { ...w, ...updates } : w));
    }

    private async calculateWorkspaceSizes(workspaces: ManagedWorkspace[]) {
        for (const ws of workspaces) {
            // Skip missing ones or those without physical bound limits
            if (ws.isMissingOnDisk || ws.role === 'team' || !this.isFileSystemMode()) continue;
            try {
                const size = await this.fileSystem.getWorkspaceFolderSize(ws.name);
                // Update only if size changed or wasn't set to prevent unnecessary trigger renders
                const current = this.workspaces().find(w => w.id === ws.id);
                if (current && current.sizeBytes !== size) {
                    this.updateWorkspaceState(ws.id, { sizeBytes: size });
                }
            } catch (err) {
                console.warn(`[WorkspaceManager] Could not compute size for ${ws.name}`, err);
            }
        }
    }

    // ── Actions ──

    async switchToWorkspace(workspace: ManagedWorkspace) {
        if (workspace.id === this.currentWorkspaceId()) return;
        if (workspace.isMissingOnDisk) return;

        try {
            this.snackbarService.info(`Switching to "${workspace.name}"...`);
            await this.authService.loginExisting(workspace);
            localStorage.setItem('quilix_entry_type', 'return');
            localStorage.setItem('quilix_entry_name', workspace.name);
            this.router.navigate([workspace.role === 'personal' ? '/personal' : '/team']);
        } catch (error) {
            console.error(`Failed to switch workspace: ${workspace.name}`, error);
            this.snackbarService.error('Failed to switch workspace.');
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

    onRangeSelected(range: { start: number, end: number } | null) {
        this.selectedTimeRange.set(range);
    }
}
