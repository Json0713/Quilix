import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceRole } from '../../../core/interfaces/workspace';
import { Spinner } from '../../../shared/ui/common/spinner/spinner';

@Component({
    selector: 'app-create-workspace',
    standalone: true,
    imports: [FormsModule, Spinner],
    templateUrl: './create-workspace.html',
    styleUrl: './create-workspace.scss',
})
export class CreateWorkspaceComponent {
    @Output() cancel = new EventEmitter<void>();
    @Output() created = new EventEmitter<WorkspaceRole>();

    name = '';
    role: WorkspaceRole = 'personal';
    isSubmitting = false;
    errorMessage: string | null = null;

    constructor(private auth: AuthService) { }

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
            this.created.emit(result.workspace!.role);
            this.isSubmitting = false;
        }, 1800);
    }
}
