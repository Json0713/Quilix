import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../../../core/workspaces/workspace.service';
import { SpaceService } from '../../../../core/services/space.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { ToastService } from '../../../../services/ui/common/toast/toast';
import { FileSystemService } from '../../../../core/services/file-system.service';

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
    isSubmitting = signal(false);
    isDragging = signal(false);

    async createManual() {
        const name = this.workspaceName().trim();
        if (!name) return;

        if (this.isSubmitting()) return;
        this.isSubmitting.set(true);

        try {
            const validationError = this.spaceService.validateName(name);
            if (validationError) {
                this.toastService.error(validationError);
                this.isSubmitting.set(false);
                return;
            }

            if (await this.workspaceService.existsByName(name)) {
                this.toastService.error('Workspace name already exists.');
                this.isSubmitting.set(false);
                return;
            }

            await this.workspaceService.create(name, 'personal');
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

        if (this.isSubmitting()) return;

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

            this.isSubmitting.set(true);
            const workspaceName = dirHandle.name;

            if (await this.workspaceService.existsByName(workspaceName)) {
                this.toastService.error(`Workspace "${workspaceName}" already exists.`);
                this.isSubmitting.set(false);
                return;
            }

            // 1. Create the Workspace (this creates the root folder in Quilix/)
            const workspace = await this.workspaceService.create(workspaceName, 'personal');

            // 2. We now iterate the dropped directory to see if there are subfolders to make as Spaces
            let spaceCount = 0;
            for await (const entry of (dirHandle as any).values()) {
                if (entry.kind === 'directory') {
                    // It's a subfolder, so we create a Space
                    await this.spaceService.create(workspace.id, workspaceName, entry.name);
                    spaceCount++;
                }
            }

            let successMsg = `Workspace "${workspaceName}" created.`;
            if (spaceCount > 0) {
                successMsg = `Workspace "${workspaceName}" created with ${spaceCount} space(s).`;
            }

            this.toastService.success(successMsg);
            this.modalService.cancelResult();

        } catch (error: any) {
            console.error('Error importing folder workspace:', error);
            this.toastService.error('Failed to import folder as workspace.');
        } finally {
            this.isSubmitting.set(false);
        }
    }

    async onClickImportFolder() {
        if (this.isSubmitting()) return;

        try {
            // Use the native File System Access API directory picker
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
            if (!dirHandle) return;

            this.isSubmitting.set(true);
            const workspaceName = dirHandle.name;

            const validationError = this.spaceService.validateName(workspaceName);
            if (validationError) {
                this.toastService.error(`Invalid folder name: ${validationError}`);
                this.isSubmitting.set(false);
                return;
            }

            if (await this.workspaceService.existsByName(workspaceName)) {
                this.toastService.error(`Workspace "${workspaceName}" already exists.`);
                this.isSubmitting.set(false);
                return;
            }

            const workspace = await this.workspaceService.create(workspaceName, 'personal');

            let spaceCount = 0;
            for await (const entry of (dirHandle as any).values()) {
                if (entry.kind === 'directory') {
                    await this.spaceService.create(workspace.id, workspaceName, entry.name);
                    spaceCount++;
                }
            }

            let successMsg = `Workspace "${workspaceName}" created.`;
            if (spaceCount > 0) {
                successMsg = `Workspace "${workspaceName}" created with ${spaceCount} space(s).`;
            }

            this.toastService.success(successMsg);
            this.modalService.cancelResult(true); // pass true to indicate a refresh might be needed by the caller

        } catch (error: any) {
            // showDirectoryPicker throws an AbortError if the user cancels the picker, we can ignore it
            if (error.name !== 'AbortError') {
                console.error('Error picking folder:', error);
                this.toastService.error('Failed to import folder.');
            }
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
