import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Workspace } from '../../../core/interfaces/workspace';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { FileSystemService } from '../../../core/services/file-system.service';

export interface ManagedWorkspace extends Workspace {
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

    workspaces = signal<ManagedWorkspace[]>([]);
    isLoading = signal<boolean>(true);
    isFileSystemMode = signal<boolean>(false);

    async ngOnInit() {
        await this.loadWorkspaces();
    }

    async loadWorkspaces() {
        this.isLoading.set(true);
        try {
            const rawWorkspaces = await this.workspaceService.getAll();
            const mode = await this.fileSystem.getStorageMode();
            this.isFileSystemMode.set(mode === 'filesystem');

            const managed: ManagedWorkspace[] = [];

            for (const ws of rawWorkspaces) {
                let isMissingOnDisk = false;

                if (this.isFileSystemMode() && ws.folderPath) {
                    const exists = await this.fileSystem.checkFolderExists(ws.name);
                    isMissingOnDisk = !exists;
                }

                managed.push({ ...ws, isMissingOnDisk, isRestoring: false });
            }

            this.workspaces.set(managed);
        } finally {
            this.isLoading.set(false);
        }
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

    private updateWorkspaceState(id: string, updates: Partial<ManagedWorkspace>) {
        this.workspaces.update(list =>
            list.map(w => w.id === id ? { ...w, ...updates } : w)
        );
    }
}
