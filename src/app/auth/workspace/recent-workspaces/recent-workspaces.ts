import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { Workspace, WorkspaceRole } from '../../../core/interfaces/workspace';
import { Spinner } from '../../../shared/ui/common/spinner/spinner';
import { TimeAgoPipe } from '../../../shared/ui/common/time-ago/time-ago-pipe';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { WorkspaceVisualComponent } from '../workspace-visual/workspace-visual';

@Component({
    selector: 'app-recent-workspaces',
    standalone: true,
    imports: [CommonModule, RouterModule, Spinner, TimeAgoPipe, TitleCasePipe, WorkspaceVisualComponent],
    templateUrl: './recent-workspaces.html',
    styleUrl: './recent-workspaces.scss',
})
export class RecentWorkspacesComponent implements OnInit, OnDestroy {

    workspaces: Workspace[] = [];
    loading = true;
    loadingWorkspaceId: string | null = null;
    deletingWorkspaceId: string | null = null;

    private workspacesSub: any;

    constructor(
        private workspaceService: WorkspaceService,
        private auth: AuthService,
        private modal: ModalService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.workspacesSub = this.workspaceService.workspaces$.subscribe(
            (list: Workspace[]) => {
                this.workspaces = list;
                this.loading = false;
            }
        );
    }

    ngOnDestroy(): void {
        this.workspacesSub?.unsubscribe();
    }

    async continueWorkspace(workspace: Workspace): Promise<void> {
        if (this.loadingWorkspaceId) return;
        this.loadingWorkspaceId = workspace.id;

        setTimeout(async () => {
            await this.auth.loginExisting(workspace);
            localStorage.setItem('justLoggedIn', 'true');
            this.router.navigate([workspace.role === 'personal' ? '/personal' : '/team']);
            this.loadingWorkspaceId = null;
        }, 1500);
    }

    requestDelete(workspace: Workspace): void {
        this.deletingWorkspaceId = workspace.id;
    }

    cancelDelete(): void {
        this.deletingWorkspaceId = null;
    }

    async confirmDelete(workspace: Workspace): Promise<void> {
        if (this.loadingWorkspaceId) return;
        this.loadingWorkspaceId = workspace.id;

        setTimeout(async () => {
            try {
                await this.auth.deleteWorkspace(workspace.id);
            } finally {
                this.deletingWorkspaceId = null;
                this.loadingWorkspaceId = null;
            }
        }, 1200);
    }

    openImport(): void {
        this.modal.openImport();
    }

    /* UI Helpers */
    getAvatarColor(workspaceId: string): string {
        const colors = ['#4fa3a8', '#6b8e23', '#c0841a', '#8b5a9a', '#a76d5c', '#3f6c7a'];
        let hash = 0;
        for (let i = 0; i < workspaceId.length; i++) {
            hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    getAvatarIcon(workspaceId: string): string {
        const icons = ['bi-rocket-takeoff', 'bi-controller', 'bi-palette', 'bi-layers', 'bi-grid', 'bi-briefcase'];
        let hash = 0;
        for (let i = 0; i < workspaceId.length; i++) {
            hash = workspaceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return icons[Math.abs(hash) % icons.length];
    }
}
