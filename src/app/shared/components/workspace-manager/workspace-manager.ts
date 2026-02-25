import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Workspace } from '../../../core/interfaces/workspace';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { FileSystemService } from '../../../core/services/file-system.service';

export interface ManagedWorkspace extends Workspace {
    isMissingOnDisk?: boolean;
    isRestoring?: boolean;
    isTrashing?: boolean;
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

    workspaces = signal<ManagedWorkspace[]>([]);
    isLoading = signal<boolean>(true);
    isFileSystemMode = signal<boolean>(false);

    async ngOnInit() {
        await this.loadWorkspaces();
    }

    @HostListener('window:focus')
    async onWindowFocus() {
        // Dynamically re-check folders when the user returns to the browser
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

        // Preserve current 'isRestoring' or 'isTrashing' states so UI doesn't flicker
        const currentMap = new Map(this.workspaces().map(w => [w.id, w]));

        for (const ws of rawWorkspaces) {
            let isMissingOnDisk = false;

            if (this.isFileSystemMode() && ws.folderPath) {
                const exists = await this.fileSystem.checkFolderExists(ws.name);
                isMissingOnDisk = !exists;
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
    }

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

    confirmingTrashId = signal<string | null>(null);

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
            // Remove from local list to reflect UI instantly
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
}
