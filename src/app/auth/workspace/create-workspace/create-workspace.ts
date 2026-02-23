import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceRole } from '../../../core/interfaces/workspace';
import { Spinner } from '../../../shared/ui/common/spinner/spinner';
import { WorkspaceVisualComponent } from '../workspace-visual/workspace-visual';
import { ModalService } from '../../../services/ui/common/modal/modal';

@Component({
    selector: 'app-create-workspace',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, Spinner, WorkspaceVisualComponent],
    templateUrl: './create-workspace.html',
    styleUrl: './create-workspace.scss',
})
export class CreateWorkspaceComponent {

    name = '';
    role: WorkspaceRole = 'personal';
    isSubmitting = false;
    errorMessage: string | null = null;

    constructor(
        private auth: AuthService,
        private modal: ModalService,
        private router: Router
    ) { }

    openImport(): void {
        this.modal.openImport();
    }

    async createWorkspace(): Promise<void> {
        if (this.name.trim().length < 2 || !this.role || this.isSubmitting) return;

        this.isSubmitting = true;
        this.errorMessage = null;

        const result = await this.auth.createWorkspace(this.name, this.role);

        if (!result.success) {
            this.isSubmitting = false;
            if (result.error === 'DUPLICATE_NAME') {
                this.errorMessage = 'A workspace with this name already exists.';
            } else {
                this.errorMessage = 'Failed to create workspace. Please try again.';
            }
            return;
        }

        // UX Delay for "Preparing Workspace" feel
        setTimeout(() => {
            localStorage.setItem('justLoggedIn', 'true');
            this.router.navigate([result.workspace!.role === 'personal' ? '/personal' : '/team']);
            this.isSubmitting = false;
        }, 1800);
    }
}
