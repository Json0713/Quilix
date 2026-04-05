import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../../core/services/components/workspace.service';
import { SpaceService } from '../../../../core/services/components/space.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { ToastService } from '../../../../services/ui/common/toast/toast';
import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { WorkspaceRole } from '../../../../core/interfaces/workspace';

@Component({
    selector: 'app-create-workspace',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './create-workspace.html',
    styleUrl: './create-workspace.scss'
})
export class CreateWorkspaceComponent {
    private workspaceService = inject(WorkspaceService);
    private spaceService = inject(SpaceService);
    private modalService = inject(ModalService);
    private toastService = inject(ToastService);
    private fileSystem = inject(FileSystemService);

    workspaceName = signal('');
    selectedRole = signal<WorkspaceRole>('personal');
    isSubmitting = signal(false);
    isDragging = signal(false);
    selectedFolderHandle = signal<FileSystemDirectoryHandle | null>(null);
    folderSizePreview = signal<string>('0 B');
    validationError = signal<string | null>(null);

    onNameChange(newName: string) {
        this.workspaceName.set(newName);
        if (!newName.trim()) {
            this.validationError.set(null);
            return;
        }
        const error = this.spaceService.validateName(newName);
        this.validationError.set(error);
    }

    async createManual() {
        const name = this.workspaceName().trim();
        if (!name) return;

        // Run validation one last time
        const error = this.spaceService.validateName(name);
        if (error) {
            this.validationError.set(error);
            return;
        }

        if (this.isSubmitting()) return;
        this.isSubmitting.set(true);

        try {
            if (await this.workspaceService.existsByName(name)) {
                this.validationError.set('Workspace name already exists.');
                this.isSubmitting.set(false);
                return;
            }

            await this.workspaceService.create(name, this.selectedRole());
            this.toastService.success(`Workspace "${name}" created.`);
            this.modalService.cancelResult(true); // close modal and trigger refresh
        } catch (error: any) {
            console.error('Error creating workspace:', error);
            this.toastService.error('Failed to create workspace.');
        } finally {
            this.isSubmitting.set(false);
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(false);
    }

    async onDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragging.set(false);

        if (this.isSubmitting() || this.selectedFolderHandle()) return;

        // Check if drops are supported in the File System API by checking dataTransfer items
        const items = event.dataTransfer?.items;
        if (!items || items.length === 0) {
            this.toastService.error('Native folder drop is not supported or no items dropped.');
            return;
        }

        // We only process the first dropped item and expect it to be a directory
        const item = items[0];
        if (item.kind !== 'file') {
            this.toastService.error('Invalid dropped item.');
            return;
        }

        try {
            let dirHandle: FileSystemDirectoryHandle | null = null;
            if ('getAsFileSystemHandle' in item) {
                const handle = await (item as any).getAsFileSystemHandle();
                if (handle?.kind === 'directory') {
                    dirHandle = handle;
                }
            }

            if (!dirHandle) {
                this.toastService.error('Please drop a valid folder, not a file.');
                return;
            }

            await this.handleFolderSelection(dirHandle);
        } catch (error: any) {
            console.error('Error importing folder workspace:', error);
            this.toastService.error('Failed to select folder.');
        }
    }

    async onClickImportFolder() {
        if (this.isSubmitting() || this.selectedFolderHandle()) return;

        try {
            // Use the native File System Access API directory picker
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
            if (!dirHandle) return;

            await this.handleFolderSelection(dirHandle);
        } catch (error: any) {
            // showDirectoryPicker throws an AbortError if the user cancels the picker, we can ignore it
            if (error.name !== 'AbortError') {
                console.error('Error picking folder:', error);
                this.toastService.error('Failed to select folder.');
            }
        }
    }

    private async calculateFolderSize(dirHandle: any): Promise<number> {
        let size = 0;
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                size += file.size;
            } else if (entry.kind === 'directory') {
                size += await this.calculateFolderSize(entry);
            }
        }
        return size;
    }

    private formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private async handleFolderSelection(dirHandle: any) {
        const workspaceName = dirHandle.name;
        const validationError = this.spaceService.validateName(workspaceName);
        if (validationError) {
            this.toastService.error(`Invalid folder name: ${validationError}`);
            return;
        }

        if (await this.workspaceService.existsByName(workspaceName)) {
            this.toastService.error(`Workspace "${workspaceName}" already exists.`);
            return;
        }

        // Set the selection instantly so the UI isn't locked by large folders
        this.selectedFolderHandle.set(dirHandle);
        this.folderSizePreview.set('Calculating...');

        // Calculate recursive size implicitly without blocking the "Import" action
        this.calculateFolderSize(dirHandle).then(totalBytes => {
            if (this.selectedFolderHandle() === dirHandle) {
                this.folderSizePreview.set(this.formatSize(totalBytes));
            }
        }).catch(err => {
            console.warn('[CreateWorkspace] Could not calculate folder size:', err);
            if (this.selectedFolderHandle() === dirHandle) {
                this.folderSizePreview.set('Unknown Size');
            }
        });
    }

    removeSelection(event?: Event) {
        if (event) event.stopPropagation();
        this.selectedFolderHandle.set(null);
        this.folderSizePreview.set('0 B');
    }

    async confirmImport() {
        const handle = this.selectedFolderHandle();
        if (!handle || this.isSubmitting()) return;

        this.isSubmitting.set(true);
        try {
            const workspaceName = handle.name;
            const workspace = await this.workspaceService.create(workspaceName, this.selectedRole());

            // 1. Ingest: If we have a physical handle (External folder picked), 
            // we must recursively copy its contents into our newly created managed folder.
            const managedWsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (managedWsHandle && handle) {
                console.log(`[Import] Ingesting external contents from ${handle.name} to managed storage...`);
                await this.fileSystem.copyDirectoryContents(handle as any, managedWsHandle);
            }

            // 2. Discover: Now that the managed folder contains the "True" names of spaces,
            // we let the sync engine discover them natively.
            await this.spaceService.syncExternalRenames(workspace.id, workspace.name);

            // Re-fetch to get the count of discovered spaces for the toast
            const discoveredSpaces = await this.spaceService.getByWorkspace(workspace.id);
            const spaceCount = discoveredSpaces.length;

            let successMsg = `Workspace "${workspaceName}" created.`;
            if (spaceCount > 0) {
                successMsg = `Workspace "${workspaceName}" imported with ${spaceCount} space(s).`;
            }

            this.toastService.success(successMsg);
            this.modalService.cancelResult(true);
        } catch (error: any) {
            console.error('Error importing folder workspace:', error);
            this.toastService.error('Failed to import folder as workspace.');
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
