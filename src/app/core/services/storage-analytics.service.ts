import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { FileSystemService } from './file-system.service';
import { AuthService } from '../auth/auth.service';
import { db } from '../db/app-db';

export interface StorageMetrics {
    totalSpaces: number;
    totalEntities: number;
    mode: 'indexeddb' | 'filesystem';
    quota: number; // Total Bytes Quota
    usage: number; // Used Bytes
    percentage: number; // 0-100 float
    percentageDisplay: string; // The UI string map (e.g. '< 1')
}

@Injectable({
    providedIn: 'root'
})
export class StorageAnalyticsService {
    private fileSystem = inject(FileSystemService);
    private auth = inject(AuthService);

    /**
     * Exposes a real-time reactive feed of Dashboard metrics driven by Dexie liveQuery.
     */
    watchMetrics(): Observable<StorageMetrics> {
        return from(liveQuery(() => this.getMetrics())) as unknown as Observable<StorageMetrics>;
    }

    /**
     * Computes the aggregate analytical payload for Dashboard rendering.
     */
    async getMetrics(): Promise<StorageMetrics> {
        const mode = await this.fileSystem.getStorageMode();
        const currentWorkspace = await this.auth.getCurrentWorkspace();

        let totalSpaces = 0;
        if (currentWorkspace) {
            // Accurately scope spaces uniquely mapped to the logged in Dashboard
            totalSpaces = await db.spaces.where('workspaceId').equals(currentWorkspace.id).count();
        }

        // Merge tabs into a generic total entities count for broader user analytics
        const totalEntities = await db.tabs.count();

        let usage = 0;
        let quota = 0;
        let percentage = 0;

        if (mode === 'indexeddb') {
            // Execute Chromium Native Navigator Analytics
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                usage = estimate.usage || 0;
                quota = estimate.quota || 0;
                percentage = quota > 0 ? (usage / quota) * 100 : 0;
            }
        } else if (mode === 'filesystem') {
            // Execute Native FileSystem Scan
            quota = 10 * 1024 * 1024 * 1024; // 10GB Virtual Quota limit standard
            usage = await this.recursivelyComputeFilesystemSize();
            percentage = (usage / quota) * 100;
            if (percentage > 100) percentage = 100; // Cap
        }

        // Ensure 0% is prevented visually if space is physically utilized
        let percentageDisplay = percentage.toFixed(1);
        if (usage > 0 && percentage < 0.1) {
            percentageDisplay = '0.1';
            percentage = 0.5; // Bump the purely visual conic-gradient slightly so the pie chart isn't empty
        } else if (usage === 0) {
            percentageDisplay = '0';
            percentage = 0;
        }

        return {
            totalSpaces,
            totalEntities,
            mode,
            usage,
            quota,
            percentage,
            percentageDisplay
        };
    }

    /**
     * Deep scans the physically mounted Local Directory to map total Megabytes used
     * natively across Quilix Workspaces on standard OS Disks.
     */
    private async recursivelyComputeFilesystemSize(): Promise<number> {
        const handle = await this.fileSystem.getStoredHandle();
        if (!handle) return 0;

        const granted = await this.fileSystem.verifyPermission(handle, false, false);
        if (!granted) return 0; // Prevent UI locks

        return await this.scanDirectory(handle);
    }

    private async scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<number> {
        let size = 0;
        try {
            for await (const entry of (dirHandle as any).values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    size += file.size;
                } else if (entry.kind === 'directory') {
                    size += await this.scanDirectory(entry);
                }
            }
        } catch (err) {
            console.warn('StorageAnalyticsService FileSystem Warning: Encountered blocked node', err);
        }
        return size;
    }

    /**
     * Humanize generic byte counts strictly into precise MB, GB variants.
     */
    formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}
