import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { WorkspaceService } from '../../../../core/workspaces/workspace.service';
import { SpaceService } from '../../../../core/services/space.service';
import { Workspace } from '../../../../core/interfaces/workspace';

@Component({
    selector: 'app-edit-workspace',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './edit-workspace.html',
    styleUrl: './edit-workspace.scss'
})
export class EditWorkspaceComponent implements OnInit {
    private modalService = inject(ModalService);
    private workspaceService = inject(WorkspaceService);
    private spaceService = inject(SpaceService);

    workspaceName = signal('');
    isSubmitting = signal(false);
    validationError = signal<string | null>(null);

    workspace: Workspace | null = null;

    ngOnInit() {
        const modalConfig = this.modalService.modal();
        if (modalConfig && modalConfig.workspaceData) {
            this.workspace = modalConfig.workspaceData;
            this.workspaceName.set(this.workspace.name);
        }
    }

    onNameChange(newName: string) {
        this.workspaceName.set(newName);
        if (!newName.trim()) {
            this.validationError.set(null);
            return;
        }
        const error = this.spaceService.validateName(newName);
        this.validationError.set(error);
    }

    async save() {
        if (!this.workspace) return;

        const name = this.workspaceName().trim();
        if (!name) return;

        // Skip if exact same name
        if (name === this.workspace.name) {
            this.modalService.cancelResult();
            return;
        }

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

            const success = await this.workspaceService.rename(this.workspace.id, name);
            if (success) {
                this.modalService.confirmResult();
            } else {
                this.validationError.set('Operation failed: OS file system error.');
            }
        } catch (err: any) {
            console.error('[EditWorkspace] Error renaming workspace:', err);
            this.validationError.set('An unexpected error occurred.');
        } finally {
            this.isSubmitting.set(false);
        }
    }
}
