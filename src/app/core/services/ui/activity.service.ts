import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../../database/dexie.service';
import { ActivityRecord, ActivityType, ActivityCategory } from '../../interfaces/activity';

@Injectable({
    providedIn: 'root'
})
export class ActivityService {

    /**
     * Live observable of the most recent activities.
     * Pruned locally to the last 200 items for UI performance.
     */
    readonly activities$ = liveQuery(async () => {
        const all = await db.activities
            .orderBy('timestamp')
            .reverse()
            .limit(200)
            .toArray();
        return all as ActivityRecord[];
    });

    /**
     * Log a new activity record to the database.
     */
    async log(params: {
        type: ActivityType;
        category: ActivityCategory;
        entityId: string;
        entityName: string;
        description: string;
        oldName?: string;
        newName?: string;
        metadata?: any;
    }): Promise<void> {
        const record: ActivityRecord = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...params
        };

        try {
            await db.activities.add(record);
            
            // Prune old logs if we exceed a certain threshold (e.g., 1000 items)
            // This happens in the background to prevent UI lag.
            this.pruneOldLogs();
        } catch (err) {
            console.error('[ActivityService] Failed to log activity:', err);
        }
    }

    /**
     * Remove extremely old logs to keep IndexedDB light.
     */
    private async pruneOldLogs() {
        const count = await db.activities.count();
        if (count > 1000) {
            const oldest = await db.activities
                .orderBy('timestamp')
                .limit(count - 800)
                .toArray();
            
            const ids = oldest.map(r => r.id);
            await db.activities.bulkDelete(ids);
            console.log(`[ActivityService] Pruned ${ids.length} old activity records.`);
        }
    }
}
