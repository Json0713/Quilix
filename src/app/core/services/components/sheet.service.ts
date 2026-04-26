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

    async getAvailableName(spaceId: string, baseName: string, excludeId?: string): Promise<string> {
        const spaceSheets = await db.sheets.filter(s => s.spaceId === spaceId && s.id !== excludeId).toArray();
        const existingNames = new Set(spaceSheets.map(s => s.name.toLowerCase()));
        
        if (!existingNames.has(baseName.toLowerCase())) {
            return baseName;
        }

        let name = baseName;
        let counter = 2;
        
        // Handle names that already end with (n)
        const match = baseName.match(/(.*?)\s\((\d+)\)$/);
        let prefix = baseName;
        if (match) {
            prefix = match[1];
            counter = parseInt(match[2]) + 1;
        }

        while (existingNames.has(`${prefix} (${counter})`.toLowerCase())) {
            counter++;
        }

        return `${prefix} (${counter})`;
    }

    async create(spaceId: string, name: string): Promise<SheetDocument> {
        const uniqueName = await this.getAvailableName(spaceId, name);
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
            name: uniqueName,
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
            entityName: uniqueName,
            description: `Created spreadsheet "${uniqueName}"`
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
