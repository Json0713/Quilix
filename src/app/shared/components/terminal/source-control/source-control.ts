import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceService } from '../../../../core/services/components/workspace.service';
import { SpaceService } from '../../../../core/services/components/space.service';
import { FileManagerService, FileExplorerEntry } from '../../../../core/services/components/file-manager.service';
import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Workspace } from '../../../../core/interfaces/workspace';
import { Space } from '../../../../core/interfaces/space';
import { ActivityService } from '../../../../core/services/ui/activity.service';
import { ActivityRecord } from '../../../../core/interfaces/activity';
import { ActivityGraph } from './activity-graph/activity-graph';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TreeNode {
    id: string;
    name: string;
    type: 'workspace' | 'space' | 'directory' | 'file';
    expanded: boolean;
    children: TreeNode[];
    loaded: boolean;
    depth: number;
    metadata: {
        role?: 'personal' | 'team';
        isMissingOnDisk?: boolean;
        sizeBytes?: number;
        lastModified?: number;
        createdAt?: number;
        lastActiveAt?: number;
        spaceId?: string;
        workspaceName?: string;
        workspaceId?: string;
    };
}

/** @deprecated Use ActivityRecord instead */
export interface AuditLogEvent {
    id: string;
    type: 'create' | 'update' | 'delete' | 'sync' | 'login';
    entityType: 'workspace' | 'space' | 'file' | 'system';
    entityName: string;
    timestamp: number;
    description: string;
}

export interface RecentChange {
    name: string;
    kind: 'file' | 'directory';
    lastModified: number;
    path: string;
}

@Component({
    selector: 'app-source-control',
    standalone: true,
    imports: [CommonModule, ActivityGraph],
    templateUrl: './source-control.html',
    styleUrl: './source-control.scss',
})
export class SourceControl implements OnInit {
    private workspaceService = inject(WorkspaceService);
    private spaceService = inject(SpaceService);
    private fileManager = inject(FileManagerService);
    private fileSystem = inject(FileSystemService);
    private auth = inject(AuthService);
    private activityService = inject(ActivityService);

    tree = signal<TreeNode[]>([]);
    recentChanges = signal<RecentChange[]>([]);
    storageMode = signal<'indexeddb' | 'filesystem'>('indexeddb');
    isLoading = signal(false);
    activeWorkspaceId = signal<string | null>(null);
    showRecentChanges = signal(true);
    showAuditLog = signal(true);
    showSyncLog = signal(true);

    // ── Pagination & Filtering ──
    visibleSyncCount = signal(10);
    private timerHandle: any;
    now = signal<number>(Date.now()); // Stable reference for calculations
    
    // Filtering State
    selectedTimeRange = signal<{ start: number, end: number } | null>(null);

    // Raw Activities from Service (accessible to template)
    protected allActivities = toSignal(from(this.activityService.activities$), { initialValue: [] });

    // Timeline Activities (Exclude Sync, apply filter)
    projectActivities = computed(() => {
        const logs = this.allActivities().filter(l => l.category !== 'system');
        const range = this.selectedTimeRange();
        if (!range) return logs;
        return logs.filter(l => l.timestamp >= range.start && l.timestamp < range.end);
    });

    // Entire Sync Stream (accessible to template)
    protected rawSyncActivities = computed(() => {
        const logs = this.allActivities().filter(l => l.category === 'system');
        const range = this.selectedTimeRange();
        if (!range) return logs;
        return logs.filter(l => l.timestamp >= range.start && l.timestamp < range.end);
    });

    // Paginated Sync Activities
    syncActivities = computed(() => {
        return this.rawSyncActivities().slice(0, this.visibleSyncCount());
    });

    hasMoreSync = computed(() => this.rawSyncActivities().length > this.visibleSyncCount());

    /** @deprecated Use projectActivities */
    auditLog = signal<AuditLogEvent[]>([]);

    private readonly MAX_DEPTH = 6;

    async ngOnInit() {
        await this.refresh();
        
        // Update 'now' every 30 seconds to refresh relative timestamps safely
        this.timerHandle = setInterval(() => {
            this.now.set(Date.now());
        }, 30000);
    }

    async refresh() {
        this.isLoading.set(true);
        try {
            const mode = await this.fileSystem.getStorageMode();
            this.storageMode.set(mode);

            const currentWs = await this.auth.getCurrentWorkspace();
            this.activeWorkspaceId.set(currentWs?.id ?? null);

            const workspaces = await this.workspaceService.getAll();
            const nodes: TreeNode[] = [];

            for (const ws of workspaces) {
                const wsNode: TreeNode = {
                    id: ws.id,
                    name: ws.name,
                    type: 'workspace',
                    expanded: ws.id === currentWs?.id, // Auto-expand active workspace
                    children: [],
                    loaded: false,
                    depth: 0,
                    metadata: {
                        role: ws.role,
                        isMissingOnDisk: ws.isMissingOnDisk,
                        workspaceId: ws.id,
                        workspaceName: ws.name,
                        createdAt: ws.createdAt,
                        lastActiveAt: ws.lastActiveAt,
                    }
                };

                // Pre-load children for the active workspace
                if (ws.id === currentWs?.id) {
                    await this.loadWorkspaceChildren(wsNode, ws);
                }

                nodes.push(wsNode);
            }

            this.tree.set(nodes);

            // Build recent changes from the active workspace
            if (currentWs) {
                await this.buildRecentChanges(currentWs);
            }
        } catch (err) {
            console.error('[SourceControl] Failed to load tree:', err);
        } finally {
            this.isLoading.set(false);
        }
    }

    async toggleNode(node: TreeNode) {
        node.expanded = !node.expanded;

        // Lazy-load children on first expand
        if (node.expanded && !node.loaded) {
            await this.lazyLoadChildren(node);
        }

        // Force signal update
        this.tree.update(t => [...t]);
    }

    getNodeIcon(node: TreeNode): string {
        switch (node.type) {
            case 'workspace':
                return node.metadata.role === 'team' ? 'bi-building' : 'bi-person-workspace';
            case 'space':
                return node.expanded ? 'bi-folder2-open' : 'bi-folder-fill';
            case 'directory':
                return node.expanded ? 'bi-folder2-open' : 'bi-folder2';
            case 'file':
                return this.getFileIcon(node.name);
        }
    }

    getNodeIconColor(node: TreeNode): string {
        switch (node.type) {
            case 'workspace': return 'var(--bs-primary)';
            case 'space': return '#f59e0b';
            case 'directory': return '#f59e0b';
            case 'file': return '#11cce9';
        }
    }

    onRangeSelected(range: { start: number, end: number } | null) {
        this.selectedTimeRange.set(range);
    }

    getChangeIcon(kind: string): string {
        return kind === 'directory' ? 'bi-folder2 text-warning' : 'bi-file-earmark text-info';
    }

    getActivityIcon(type: string): string {
        switch (type) {
            case 'create': return 'bi-plus-circle-fill';
            case 'rename': return 'bi-pencil-square';
            case 'trash': return 'bi-trash3';
            case 'restore': return 'bi-arrow-counterclockwise';
            case 'delete': return 'bi-x-circle';
            case 'move': return 'bi-arrows-move';
            case 'sync_export': return 'bi-cloud-upload';
            case 'sync_import': return 'bi-cloud-download';
            case 'error': return 'bi-exclamation-triangle-fill';
            default: return 'bi-info-circle';
        }
    }

    getActivityClass(type: string): string {
        switch (type) {
            case 'create':
            case 'restore':
            case 'sync_export':
            case 'sync_import':
                return 'activity-green';
            case 'delete':
            case 'trash':
            case 'error':
                return 'activity-red';
            case 'rename':
            case 'move':
                return 'activity-blue';
            default:
                return 'activity-neutral';
        }
    }

    formatTime(timestamp: number): string {
        if (!timestamp) return '';
        const currentNow = this.now(); // Stable signal reference
        const diff = currentNow - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    formatSize(bytes?: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    toggleRecentChanges() {
        this.showRecentChanges.update(v => !v);
    }

    // ── Private helpers ──

    private async lazyLoadChildren(node: TreeNode) {
        try {
            if (node.type === 'workspace') {
                const ws = await this.workspaceService.getById(node.id);
                if (ws) await this.loadWorkspaceChildren(node, ws);
            } else if (node.type === 'space') {
                await this.loadSpaceChildren(node);
            } else if (node.type === 'directory') {
                await this.loadDirectoryChildren(node);
            }
        } catch (err) {
            console.warn(`[SourceControl] Failed to load children for ${node.name}:`, err);
        }
    }

    private async loadWorkspaceChildren(node: TreeNode, ws: Workspace) {
        const spaces = await this.spaceService.getByWorkspace(ws.id);
        node.children = spaces
            .filter(s => !s.trashedAt)
            .map(s => ({
                id: s.id,
                name: s.name,
                type: 'space' as const,
                expanded: false,
                children: [],
                loaded: false,
                depth: node.depth + 1,
                metadata: {
                    isMissingOnDisk: s.isMissingOnDisk,
                    spaceId: s.id,
                    workspaceName: ws.name,
                    workspaceId: ws.id,
                    createdAt: s.createdAt,
                }
            }));
        node.loaded = true;
    }

    private async loadSpaceChildren(node: TreeNode) {
        if (node.depth >= this.MAX_DEPTH) return;

        const wsName = node.metadata.workspaceName;
        const spaceId = node.metadata.spaceId ?? node.id;
        const wsId = node.metadata.workspaceId;

        const mode = await this.fileSystem.getStorageMode();
        let handle: any = undefined;
        if (mode === 'filesystem' && wsName) {
            handle = await this.fileSystem.resolveSpaceHandle(wsName, spaceId);
        }

        const entries = await this.fileManager.readDirectory({ handle, spaceId, parentId: spaceId });
        node.children = entries.map(e => this.entryToTreeNode(e, node.depth + 1, wsName, wsId, spaceId));
        node.loaded = true;
    }

    private async loadDirectoryChildren(node: TreeNode) {
        if (node.depth >= this.MAX_DEPTH) return;

        const wsName = node.metadata.workspaceName;
        const spaceId = node.metadata.spaceId!;
        const wsId = node.metadata.workspaceId;

        const mode = await this.fileSystem.getStorageMode();
        let handle: any = undefined;

        // For filesystem mode, we need to walk the tree to get a directory handle
        // For virtual/indexeddb mode, we use the node's ID as parentId
        if (mode === 'filesystem' && wsName) {
            // Attempt to get handle from node metadata or resolve
            handle = await this.fileSystem.resolveSpaceHandle(wsName, spaceId);
            // Note: For deeper directories in filesystem mode, we may need to traverse
            // For now, rely on the FileManagerService which accepts handle + parentId
        }

        const entries = await this.fileManager.readDirectory({ 
            handle: undefined, // Deep dirs use virtual entries
            spaceId, 
            parentId: node.id 
        });
        node.children = entries.map(e => this.entryToTreeNode(e, node.depth + 1, wsName, wsId, spaceId));
        node.loaded = true;
    }

    private entryToTreeNode(entry: FileExplorerEntry, depth: number, wsName?: string, wsId?: string, spaceId?: string): TreeNode {
        return {
            id: entry.id || entry.name,
            name: entry.name,
            type: entry.kind === 'directory' ? 'directory' : 'file',
            expanded: false,
            children: [],
            loaded: entry.kind === 'file', // Files have no children
            depth,
            metadata: {
                sizeBytes: entry.sizeBytes,
                lastModified: entry.lastModified,
                workspaceName: wsName,
                workspaceId: wsId,
                spaceId,
            }
        };
    }

    private async buildRecentChanges(ws: Workspace) {
        const changes: RecentChange[] = [];
        const spaces = await this.spaceService.getByWorkspace(ws.id);

        for (const sp of spaces.filter(s => !s.trashedAt)) {
            try {
                const mode = await this.fileSystem.getStorageMode();
                let handle: any = undefined;
                if (mode === 'filesystem') {
                    handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
                }

                const entries = await this.fileManager.readDirectory({ handle, spaceId: sp.id, parentId: sp.id });
                for (const e of entries) {
                    if (e.lastModified) {
                        changes.push({
                            name: e.name,
                            kind: e.kind,
                            lastModified: e.lastModified,
                            path: `${sp.name}/${e.name}`,
                        });
                    }
                }
            } catch {
                // Skip spaces that fail to load
            }
        }

        // Sort by most recent first, limit to 10
        changes.sort((a, b) => b.lastModified - a.lastModified);
        this.recentChanges.set(changes.slice(0, 10));
    }

    toggleSyncLog() {
        this.showSyncLog.update(v => !v);
    }

    showMoreSync() {
        this.visibleSyncCount.update(c => c + 10);
    }

    showLessSync() {
        this.visibleSyncCount.set(10);
    }

    private getFileIcon(name: string): string {
        const ext = name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': case 'js': return 'bi-filetype-js';
            case 'json': return 'bi-filetype-json';
            case 'html': return 'bi-filetype-html';
            case 'css': case 'scss': return 'bi-filetype-css';
            case 'md': return 'bi-filetype-md';
            case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return 'bi-file-image';
            case 'pdf': return 'bi-filetype-pdf';
            case 'txt': return 'bi-file-text';
            default: return 'bi-file-earmark';
        }
    }
}
