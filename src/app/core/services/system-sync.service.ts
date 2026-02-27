import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { db } from '../db/app-db';
import { FileSystemService } from './file-system.service';

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
                this.exportTrigger$.next();
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
     * Read the .quilix-data.json file and populate the DB if it is empty.
     */
    async importStateFromDisk(): Promise<boolean> {
        try {
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
                // Use bulkPut to update existing and add missing, merging gracefully
                if (state.workspaces.length) await db.workspaces.bulkPut(state.workspaces);
                if (state.spaces?.length) await db.spaces.bulkPut(state.spaces);
                if (state.tabs?.length) await db.tabs.bulkPut(state.tabs);
            });

            console.log('[SystemSync] Import successful. Data restored and merged.');
            return true;

        } catch (err) {
            console.error('[SystemSync] Failed to import state from disk:', err);
            return false;
        }
    }
}
