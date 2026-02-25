import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Workspace } from '../../../core/interfaces/workspace';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { TimeAgoPipe } from '../../ui/common/time-ago/time-ago-pipe';

@Component({
    selector: 'app-trash',
    standalone: true,
    imports: [CommonModule, TimeAgoPipe, TitleCasePipe],
    templateUrl: './trash.html',
    styleUrl: './trash.scss',
})
export class TrashComponent implements OnInit, OnDestroy {
    private workspaceService = inject(WorkspaceService);

    trashedWorkspaces = signal<Workspace[]>([]);
    isLoading = signal<boolean>(true);

    // UI state for row actions
    processingId = signal<string | null>(null);
    confirmingDeleteId = signal<string | null>(null);

    private sub: any;

    ngOnInit() {
        this.sub = this.workspaceService.trashedWorkspaces$.subscribe((list: Workspace[]) => {
            this.trashedWorkspaces.set(list);
            this.isLoading.set(false);
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    async restoreWorkspace(workspaceId: string) {
        if (this.processingId()) return;
        this.processingId.set(workspaceId);

        try {
            await this.workspaceService.restoreFromTrash(workspaceId);
        } finally {
            this.processingId.set(null);
        }
    }

    requestPermanentDelete(workspaceId: string) {
        this.confirmingDeleteId.set(workspaceId);
    }

    cancelDelete() {
        this.confirmingDeleteId.set(null);
    }

    async confirmDelete(workspaceId: string) {
        if (this.processingId()) return;
        this.processingId.set(workspaceId);

        try {
            await this.workspaceService.permanentlyDelete(workspaceId);
        } finally {
            this.processingId.set(null);
            this.confirmingDeleteId.set(null);
        }
    }

    getDaysLeft(trashedAt?: number): string {
        if (!trashedAt) return 'Unknown';
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((Date.now() - trashedAt) / msPerDay);
        const daysLeft = Math.max(0, 30 - daysPassed);
        return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
    }
}
