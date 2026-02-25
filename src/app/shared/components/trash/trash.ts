import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
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

    // ── Single-item UI state ──
    processingId = signal<string | null>(null);
    confirmingDeleteId = signal<string | null>(null);

    // ── Selection state ──
    selectionMode = signal<boolean>(false);
    selectedIds = signal<Set<string>>(new Set());
    confirmingBulkDelete = signal<boolean>(false);
    isBulkProcessing = signal<boolean>(false);

    selectedCount = computed(() => this.selectedIds().size);
    isAllSelected = computed(() => {
        const ws = this.trashedWorkspaces();
        const sel = this.selectedIds();
        return ws.length > 0 && sel.size === ws.length;
    });

    private sub: any;

    ngOnInit() {
        this.sub = this.workspaceService.trashedWorkspaces$.subscribe((list: Workspace[]) => {
            this.trashedWorkspaces.set(list);
            this.isLoading.set(false);

            // Clean up stale selections
            if (this.selectionMode()) {
                const validIds = new Set(list.map(w => w.id));
                this.selectedIds.update(ids => {
                    const next = new Set<string>();
                    ids.forEach(id => { if (validIds.has(id)) next.add(id); });
                    return next;
                });
            }
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
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
        this.confirmingBulkDelete.set(false);
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
            const allIds = new Set(this.trashedWorkspaces().map(w => w.id));
            this.selectedIds.set(allIds);
        }
    }

    // ── Bulk restore ──

    async bulkRestore() {
        if (this.isBulkProcessing() || this.selectedCount() === 0) return;
        this.isBulkProcessing.set(true);

        try {
            const ids = Array.from(this.selectedIds());
            for (const id of ids) {
                await this.workspaceService.restoreFromTrash(id);
            }
            this.exitSelectionMode();
        } finally {
            this.isBulkProcessing.set(false);
        }
    }

    // ── Bulk permanent delete ──

    requestBulkDelete() {
        if (this.selectedCount() === 0) return;
        this.confirmingBulkDelete.set(true);
    }

    cancelBulkDelete() {
        this.confirmingBulkDelete.set(false);
    }

    async confirmBulkDelete() {
        if (this.isBulkProcessing()) return;
        this.isBulkProcessing.set(true);

        try {
            const ids = Array.from(this.selectedIds());
            for (const id of ids) {
                await this.workspaceService.permanentlyDelete(id);
            }
            this.exitSelectionMode();
        } finally {
            this.isBulkProcessing.set(false);
        }
    }

    // ── Single-item actions ──

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
