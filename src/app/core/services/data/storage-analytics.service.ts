import { Injectable, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { FileSystemService } from './file-system.service';
import { AuthService } from '../../auth/auth.service';
import { db } from '../../database/dexie.service';

export interface StorageMetrics {
    totalSpaces: number;
    totalEntities: number;
    mode: 'indexeddb' | 'filesystem';
    quota: number; // Total Bytes Quota
    usage: number; // Used Bytes
    percentage: number; // 0-100 float
    percentageDisplay: string; // The UI string map (e.g. '0.01')
    color: string; // Dynamic neon hex string natively mapped to utilization
}

@Injectable({
    providedIn: 'root'
})
export class StorageAnalyticsService {
    private fileSystem = inject(FileSystemService);
    private auth = inject(AuthService);

    // ── Persistent State Store ──
    private CACHE_KEY = 'quilix_dashboard_metrics';
    public lastMetrics = signal<StorageMetrics | null>(this.loadCache());

    private loadCache(): StorageMetrics | null {
        try {
            const data = localStorage.getItem(this.CACHE_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    private saveCache(metrics: StorageMetrics) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(metrics));
        } catch (e) {
            console.warn('StorageAnalyticsService: Failed to save cache', e);
        }
    }

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

        // Trigger background persistence upgrade (Silent)
        // This is what flips the 10GB sandbox back to the real 300GB+ hardware quota
        await this.fileSystem.requestPersistence();

        // Secure Chromium Native Navigator Allocations universally
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            if (estimate.quota) quota = estimate.quota;
        }

        if (mode === 'indexeddb') {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                usage = estimate.usage || 0;
            }
        } else if (mode === 'filesystem') {
            // Execute Native FileSystem Scan
            usage = await this.recursivelyComputeFilesystemSize();
        }

        percentage = quota > 0 ? (usage / quota) * 100 : 0;
        if (percentage > 100) percentage = 100; // Cap

        // Strict fraction constraints for aesthetics
        let percentageDisplay = percentage.toFixed(2);
        if (usage > 0 && percentage < 0.01) {
            percentageDisplay = '0.01';
            percentage = 0.5; // Bump purely visual conic-gradient slightly so chart isn't empty
        } else if (usage === 0) {
            percentageDisplay = '0.00';
            percentage = 0;
        }

        // Dynamic Neon Threshold Coloring
        let color = '#10b981'; // 0-25%: Emerald Green
        if (percentage >= 75) {
            color = '#ef4444'; // Neon Red
        } else if (percentage >= 50) {
            color = '#f97316'; // Neon Orange
        } else if (percentage >= 25) {
            color = '#f59e0b'; // Amber
        }

        const metrics: StorageMetrics = {
            totalSpaces,
            totalEntities,
            mode,
            usage,
            quota,
            percentage,
            percentageDisplay,
            color
        };

        // Update caches
        this.lastMetrics.set(metrics);
        this.saveCache(metrics);

        return metrics;
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
