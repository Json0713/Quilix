import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../../database/dexie.service';
import { SheetDocument, SheetTab } from '../../interfaces/sheet';
import { ActivityService } from '../ui/activity.service';

@Injectable({
    providedIn: 'root'
})
export class SheetService {
    private activityService = inject(ActivityService);

    getSheetsForSpace(spaceId: string) {
        return liveQuery(() =>
            db.sheets.filter(s => s.spaceId === spaceId).toArray()
        );
    }

    async getById(id: string): Promise<SheetDocument | undefined> {
        return db.sheets.get(id);
    }

    liveDoc$(id: string) {
        return liveQuery(() => db.sheets.get(id));
    }

    async create(spaceId: string, name: string): Promise<SheetDocument> {
        const id = crypto.randomUUID();
        const tabId = crypto.randomUUID();
        const now = Date.now();

        const initialTab: SheetTab = {
            id: tabId,
            name: 'Sheet1',
            cells: {}
        };

        const doc: SheetDocument = {
            id,
            spaceId,
            name,
            tabs: [initialTab],
            activeTabId: tabId,
            createdAt: now,
            updatedAt: now
        };

        await db.sheets.add(doc);
        
        await this.activityService.log({
            type: 'create',
            category: 'sheet',
            entityId: id,
            entityName: name,
            description: `Created spreadsheet "${name}"`
        });

        return doc;
    }

    async update(id: string, updates: Partial<SheetDocument>): Promise<void> {
        updates.updatedAt = Date.now();
        await db.sheets.update(id, updates);
    }

    async delete(id: string): Promise<void> {
        const sheet = await this.getById(id);
        if (sheet) {
            await db.sheets.delete(id);
            await this.activityService.log({
                type: 'delete',
                category: 'sheet',
                entityId: id,
                entityName: sheet.name,
                description: `Deleted spreadsheet "${sheet.name}"`
            });
        }
    }
}
