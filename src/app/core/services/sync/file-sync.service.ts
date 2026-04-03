import { Injectable, inject } from '@angular/core';
import { db } from '../../db/app-db';
import { FileSystemService } from '../data/file-system.service';

@Injectable({
    providedIn: 'root'
})
export class FileSyncService {
    private fileSystem = inject(FileSystemService);

    /**
     * Hydrates the native filesystem with virtual entries from IndexedDB.
     * This is called when switching from 'indexeddb' to 'filesystem' mode.
     */
    async hydrateNativeStorage(): Promise<void> {
        const mode = await this.fileSystem.getStorageMode();
        if (mode !== 'filesystem') return;

        const rootHandle = await this.fileSystem.getStoredHandle();
        if (!rootHandle) return;

        try {
            this.fileSystem.acquireSyncLock();
            const quilixHandle = await rootHandle.getDirectoryHandle('Quilix', { create: true });
            
            // Get all virtual entries that need hydration
            const entries = await db.virtual_entries.toArray();
            if (entries.length === 0) return;

            console.log(`[FileSync] Starting hydration for ${entries.length} virtual entries...`);

            // Group by workspace for cleaner processing
            const byWorkspace = this.groupBy(entries, 'workspaceId');

            for (const [workspaceId, wsEntries] of Object.entries(byWorkspace)) {
                // Find workspace name
                const workspace = await db.workspaces.get(workspaceId);
                if (!workspace) continue;

                const wsHandle = await quilixHandle.getDirectoryHandle(workspace.name, { create: true });
                
                // Group by space
                const bySpace = this.groupBy(wsEntries, 'spaceId');

                for (const [spaceId, spEntries] of Object.entries(bySpace)) {
                    const space = await db.spaces.get(spaceId);
                    if (!space) continue;

                    const spHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: true });
                    // Anchor the space folder immediately
                    await this.fileSystem.writeDirectoryId(spHandle, spaceId);
                    
                    // Recursively hydrate from root (parentId = 'root')
                    await this.hydrateDirectory(spHandle, spEntries, 'root');
                }
            }

            // Cleanup: Once hydrated, remove virtual entries to keep the DB lean and prevent double-syncs
            await db.virtual_entries.clear();
            console.log('[FileSync] Hydration complete and virtual entries cleared.');
        } catch (err) {
            console.error('[FileSync] Hydration failed:', err);
        } finally {
            this.fileSystem.releaseSyncLock();
        }
    }

    private async hydrateDirectory(parentHandle: FileSystemDirectoryHandle, entries: any[], parentId: string): Promise<void> {
        const children = entries.filter(e => e.parentId === parentId);

        for (const entry of children) {
            try {
                if (entry.kind === 'directory') {
                    const dirHandle = await parentHandle.getDirectoryHandle(entry.name, { create: true });
                    // Anchor the directory so sync scanners recognize it
                    await this.fileSystem.writeDirectoryId(dirHandle, entry.id);
                    await this.hydrateDirectory(dirHandle, entries, entry.id);
                } else if (entry.kind === 'file') {
                    const fileHandle = await parentHandle.getFileHandle(entry.name, { create: true });
                    
                    // Only write if file is empty or missing (simple heuristic)
                    const file = await fileHandle.getFile();
                    if (file.size === 0 && entry.content) {
                        const writable = await (fileHandle as any).createWritable();
                        await writable.write(entry.content);
                        await writable.close();
                    }
                }
            } catch (err) {
                console.error(`[FileSync] Failed to hydrate entry ${entry.name}:`, err);
            }
        }
    }

    private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
        return array.reduce((acc, item) => {
            const group = String(item[key]);
            acc[group] = acc[group] || [];
            acc[group].push(item);
            return acc;
        }, {} as Record<string, T[]>);
    }
}
