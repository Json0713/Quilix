import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Workspace } from '../../../core/interfaces/workspace';
import { Space } from '../../../core/interfaces/space';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { FileSystemService } from '../../../core/services/file-system.service';
import { SpaceService } from '../../../core/services/space.service';
import { SystemSyncService } from '../../../core/services/system-sync.service';

export interface ManagedWorkspace extends Workspace {
    isMissingOnDisk?: boolean;
    isRestoring?: boolean;
    isTrashing?: boolean;
}

export interface ManagedSpace extends Space {
    isMissingOnDisk?: boolean;
    isRestoring?: boolean;
}

@Component({
    selector: 'app-workspace-manager',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './workspace-manager.html',
    styleUrl: './workspace-manager.scss',
})
export class WorkspaceManagerComponent implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private fileSystem = inject(FileSystemService);
    private spaceService = inject(SpaceService);
    private systemSync = inject(SystemSyncService);

    workspaces = signal<ManagedWorkspace[]>([]);
    isLoading = signal<boolean>(true);
    isFileSystemMode = signal<boolean>(false);
    needsReauth = signal<boolean>(false);
    isReauthing = signal<boolean>(false);

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

    // ── Space expansion state ──
    expandedWorkspaceId = signal<string | null>(null);
    spacesByWorkspace = signal<Map<string, ManagedSpace[]>>(new Map());
    isLoadingSpaces = signal(false);

    async ngOnInit() {
        await this.loadWorkspaces();
    }

    @HostListener('window:focus')
    async onWindowFocus() {
        await this.quietLoadWorkspaces();
        // Re-check space folders for expanded workspace
        const expandedId = this.expandedWorkspaceId();
        if (expandedId) {
            const ws = this.workspaces().find(w => w.id === expandedId);
            if (ws) await this.loadSpacesForWorkspace(ws);
        }
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

    // ── Space expansion ──

    async toggleExpand(workspace: ManagedWorkspace) {
        if (this.expandedWorkspaceId() === workspace.id) {
            this.expandedWorkspaceId.set(null);
            return;
        }

        this.expandedWorkspaceId.set(workspace.id);
        await this.loadSpacesForWorkspace(workspace);
    }

    private async loadSpacesForWorkspace(workspace: ManagedWorkspace) {
        this.isLoadingSpaces.set(true);

        try {
            const allSpaces = await this.spaceService.getByWorkspace(workspace.id);
            // Filter out trashed spaces
            const activeSpaces = allSpaces.filter(s => !s.trashedAt);

            const managed: ManagedSpace[] = [];
            const currentMap = this.spacesByWorkspace().get(workspace.id);
            const existingMap = new Map(currentMap?.map(s => [s.id, s]) ?? []);

            for (const space of activeSpaces) {
                let isMissingOnDisk = false;

                if (this.isFileSystemMode() && workspace.folderPath) {
                    const result = await this.spaceService.checkSpaceFolderExists(workspace.name, space.folderName);
                    if (result !== 'no-permission') {
                        isMissingOnDisk = !result;
                    }
                }

                const existing = existingMap.get(space.id);
                managed.push({
                    ...space,
                    isMissingOnDisk,
                    isRestoring: existing?.isRestoring || false,
                });
            }

            this.spacesByWorkspace.update(map => {
                const next = new Map(map);
                next.set(workspace.id, managed);
                return next;
            });
        } finally {
            this.isLoadingSpaces.set(false);
        }
    }

    getSpaces(workspaceId: string): ManagedSpace[] {
        return this.spacesByWorkspace().get(workspaceId) ?? [];
    }

    hasMissingSpaces(workspaceId: string): boolean {
        return this.getSpaces(workspaceId).some(s => s.isMissingOnDisk);
    }

    async restoreSpace(workspace: ManagedWorkspace, space: ManagedSpace) {
        if (space.isRestoring || !space.isMissingOnDisk) return;

        this.updateSpaceState(workspace.id, space.id, { isRestoring: true });

        try {
            const success = await this.spaceService.restoreSpaceFolder(workspace.name, space.folderName);
            this.updateSpaceState(workspace.id, space.id, {
                isRestoring: false,
                isMissingOnDisk: !success,
            });
        } catch {
            this.updateSpaceState(workspace.id, space.id, { isRestoring: false });
        }
    }

    async restoreAllSpaces(workspace: ManagedWorkspace) {
        const missing = this.getSpaces(workspace.id).filter(s => s.isMissingOnDisk);
        for (const space of missing) {
            await this.restoreSpace(workspace, space);
        }
    }

    private updateSpaceState(workspaceId: string, spaceId: string, updates: Partial<ManagedSpace>) {
        this.spacesByWorkspace.update(map => {
            const next = new Map(map);
            const spaces = next.get(workspaceId) ?? [];
            next.set(workspaceId, spaces.map(s => s.id === spaceId ? { ...s, ...updates } : s));
            return next;
        });
    }
}
