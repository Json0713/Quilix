import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { db } from '../../database/dexie.service';
import { FileSystemService } from '../data/file-system.service';

export interface SystemState {
    version: number;
    exportedAt: number;
    workspaces: any[];
    spaces: any[];
    tabs: any[];
}

@Injectable({
    providedIn: 'root'
})
export class SystemSyncService {
    private fileSystem = inject(FileSystemService);
    private exportTrigger$ = new Subject<void>();
    private readonly SYNC_FILENAME = '.quilix-data.json';

    private isImporting = false;

    constructor() {
        // Debounce export triggers to avoid spamming disk I/O
        this.exportTrigger$.pipe(
            debounceTime(2000)
        ).subscribe(() => {
            this.exportStateToDisk();
        });

        // Use liveQuery to naturally detect any changes to these tables
        import('dexie').then(({ liveQuery }) => {
            liveQuery(async () => {
                // Just querying them registers the observer
                await db.workspaces.count();
                await db.spaces.count();
                await db.tabs.count();
                return Date.now();
            }).subscribe(() => {
                // PREVENTION: Do not trigger an export if we are currently 
                // importing state from disk to avoid overwriting the backup 
                // with incomplete intermediate local data.
                if (!this.isImporting && !this.fileSystem.isSyncLocked()) {
                    this.exportTrigger$.next();
                }
            });
        });
    }

    /**
     * Required logic to get the service to instantiate if provided at root 
     * but not injected directly in components.
     */
    init() {
        console.log('[SystemSync] Auto-export listener initialized.');
    }

    /**
     * Gather table states and write them to the .quilix-data.json file.
     */
    async exportStateToDisk(): Promise<boolean> {
        try {
            const mode = await this.fileSystem.getStorageMode();
            if (mode !== 'filesystem') return false;

            // Use the stored handle (does not prompt)
            const rootHandle = await this.fileSystem.getStoredHandle();
            if (!rootHandle) return false;

            // Verify permission silently
            const granted = await this.fileSystem.verifyPermission(rootHandle, true, false);
            if (!granted) return false;

            // Needs to be inside Quilix folder
            const quilixHandle = await rootHandle.getDirectoryHandle('Quilix', { create: false }).catch(() => null);
            if (!quilixHandle) return false;

            // Gather state
            const state: SystemState = {
                version: 1,
                exportedAt: Date.now(),
                workspaces: await db.workspaces.toArray(),
                spaces: await db.spaces.toArray(),
                tabs: await db.tabs.toArray()
            };

            // Write to file
            const fileHandle = await quilixHandle.getFileHandle(this.SYNC_FILENAME, { create: true });
            const writable = await (fileHandle as any).createWritable();
            await writable.write(JSON.stringify(state, null, 2));
            await writable.close();

            console.log('[SystemSync] Successfully exported state to disk.');
            return true;
        } catch (err) {
            console.error('[SystemSync] Failed to export state to disk:', err);
            return false;
        }
    }

    /**
     * Reads just the metadata portion of the sync file to get the last exported timestamp.
     */
    async getLastExportTime(): Promise<number | null> {
        try {
            const rootHandle = await this.fileSystem.getStoredHandle();
            if (!rootHandle) return null;

            const quilixHandle = await rootHandle.getDirectoryHandle('Quilix', { create: false }).catch(() => null);
            if (!quilixHandle) return null;

            const fileHandle = await quilixHandle.getFileHandle(this.SYNC_FILENAME, { create: false }).catch(() => null);
            if (!fileHandle) return null;

            const file = await fileHandle.getFile();
            const text = await file.text();
            if (!text.trim()) return null;

            const state = JSON.parse(text);
            return state.exportedAt || null;
        } catch {
            return null;
        }
    }

    /**
     * Read the .quilix-data.json file and populate the DB if it is empty.
     */
    async importStateFromDisk(): Promise<boolean> {
        if (this.isImporting) return false;

        try {
            this.isImporting = true;
            const rootHandle = await this.fileSystem.getStoredHandle();
            if (!rootHandle) return false;

            const quilixHandle = await rootHandle.getDirectoryHandle('Quilix', { create: false }).catch(() => null);
            if (!quilixHandle) return false;

            const fileHandle = await quilixHandle.getFileHandle(this.SYNC_FILENAME, { create: false }).catch(() => null);
            if (!fileHandle) {
                console.log('[SystemSync] No sync file found. Skipping import.');
                return false;
            }

            const file = await fileHandle.getFile();
            const text = await file.text();

            if (!text.trim()) return false;

            const state: SystemState = JSON.parse(text);

            if (!state || !state.workspaces) {
                console.error('[SystemSync] Sync file is corrupted or invalid format.');
                return false;
            }

            console.log('[SystemSync] Sync file found. Merging data from disk to local DB...');

            await db.transaction('rw', db.workspaces, db.spaces, db.tabs, async () => {
                // Merge Workspaces: If backup has older lastActiveAt than local, keep local. Else take backup.
                if (state.workspaces.length) {
                    const localWs = await db.workspaces.toArray();
                    const localMap = new Map(localWs.map((w: any) => [w.id, w]));
                    const toPutWs = state.workspaces.map((backupWs: any) => {
                        const l = localMap.get(backupWs.id);
                        if (l && l.lastActiveAt > backupWs.lastActiveAt) return l;
                        return backupWs;
                    });
                    await db.workspaces.bulkPut(toPutWs);
                }

                // Spaces
                if (state.spaces?.length) {
                    const localSp = await db.spaces.toArray();
                    const localMap = new Map(localSp.map((s: any) => [s.id, s]));
                    const toPutSp = state.spaces.map((backupSp: any) => {
                        const l = localMap.get(backupSp.id);
                        if (l && l.updatedAt && backupSp.updatedAt && l.updatedAt > backupSp.updatedAt) return l;
                        return backupSp;
                    });
                    await db.spaces.bulkPut(toPutSp);
                }

                if (state.tabs?.length) {
                    const currentWindowId = sessionStorage.getItem('quilix_windowId');
                    const localTabs = await db.tabs.toArray();
                    const localTabMap = new Map(localTabs.map((t: any) => [t.id, t]));

                    const toPutTabs = state.tabs.map((backupTab: any) => {
                        // PROTECTION: If this tab belongs to the current window sessions, the local state is ALWAYS the source of truth.
                        // Overwriting it would cause active UI glitches, lost back-stacks, or "teleporting" routes.
                        if (backupTab.windowId === currentWindowId) {
                            const l = localTabMap.get(backupTab.id);
                            return l || backupTab; // Keep local if exists, else it's a new tab for this window from the backup
                        }
                        return backupTab;
                    });
                    await db.tabs.bulkPut(toPutTabs);
                }
            });

            console.log('[SystemSync] Import successful. Data restored and merged.');

            // Now that we've imported, we can trigger an export of the NEW merged state
            this.isImporting = false;
            this.exportTrigger$.next();

            return true;

        } catch (err) {
            console.error('[SystemSync] Failed to import state from disk:', err);
            return false;
        } finally {
            this.isImporting = false;
        }
    }
}
