import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FileSystemService } from '../../../core/services/file-system.service';
import { WorkspaceService } from '../../../core/workspaces/workspace.service';
import { SpaceService } from '../../../core/services/space.service';
import { db } from '../../../core/db/app-db';
import { liveQuery } from 'dexie';

export interface HealthIssue {
    id: string;
    type: 'workspace' | 'space';
    name: string;
    description: string;
    parentWorkspaceName?: string;
}

@Component({
    selector: 'app-storage-health',
    standalone: true,
    imports: [CommonModule, DatePipe],
    templateUrl: './storage-health.html',
    styleUrl: './storage-health.scss'
})
export class StorageHealthComponent implements OnDestroy {
    private fileSystem = inject(FileSystemService);
    private workspaceService = inject(WorkspaceService);
    private spaceService = inject(SpaceService);

    isScanning = signal(false);
    lastScanTime = signal<number | null>(null);

    issues = signal<HealthIssue[]>([]);

    private sub?: any;

    constructor() {
        this.sub = liveQuery(async () => {
            const missingWs = await db.workspaces.filter(w => !!w.isMissingOnDisk && !w.trashedAt).toArray();
            const missingSp = await db.spaces.filter(s => !!s.isMissingOnDisk && !s.trashedAt).toArray();

            const issues: HealthIssue[] = [];
            for (const w of missingWs) {
                issues.push({
                    id: w.id,
                    type: 'workspace',
                    name: w.name,
                    description: 'Workspace directory missing on local disk.'
                });
            }
            for (const s of missingSp) {
                const parent = await this.workspaceService.getById(s.workspaceId);
                issues.push({
                    id: s.id,
                    type: 'space',
                    name: s.name,
                    description: 'Space directory missing inside workspace.',
                    parentWorkspaceName: parent?.name
                });
            }
            return issues;
        }).subscribe(issues => {
            this.issues.set(issues);
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    async forceRescan() {
        if (this.isScanning()) return;
        this.isScanning.set(true);
        try {
            await this.workspaceService.syncExternalRenames();
            const workspaces = await this.workspaceService.getAll();
            for (const ws of workspaces) {
                await this.spaceService.syncExternalRenames(ws.id, ws.name);
            }
            this.lastScanTime.set(Date.now());
        } finally {
            this.isScanning.set(false);
        }
    }

    async recreateFolder(issue: HealthIssue) {
        if (issue.type === 'workspace') {
            await this.workspaceService.restoreWorkspace(issue.id, issue.name);
        } else if (issue.type === 'space' && issue.parentWorkspaceName) {
            await this.spaceService.restoreSpace(issue.id, issue.parentWorkspaceName);
        }
    }

    async trashRecord(issue: HealthIssue) {
        if (issue.type === 'workspace') {
            await this.workspaceService.moveToTrash(issue.id);
        } else if (issue.type === 'space') {
            await this.spaceService.moveToTrash(issue.id, issue.parentWorkspaceName || '');
        }
    }
}
