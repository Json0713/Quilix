import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../../database/dexie.service';
import { DocDocument } from '../../interfaces/doc';
import { ActivityService } from '../ui/activity.service';

@Injectable({
    providedIn: 'root'
})
export class DocService {
    private activityService = inject(ActivityService);

    getDocsForSpace(spaceId: string) {
        return liveQuery(() =>
            db.docs.filter(d => d.spaceId === spaceId).toArray()
        );
    }

    async getById(id: string): Promise<DocDocument | undefined> {
        return db.docs.get(id);
    }

    liveDoc$(id: string) {
        return liveQuery(() => db.docs.get(id));
    }

    async getAvailableName(spaceId: string, baseName: string, excludeId?: string): Promise<string> {
        const spaceDocs = await db.docs.filter(d => d.spaceId === spaceId && d.id !== excludeId).toArray();
        const existingNames = new Set(spaceDocs.map(d => d.name.toLowerCase()));
        
        if (!existingNames.has(baseName.toLowerCase())) {
            return baseName;
        }

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

    async create(spaceId: string, name: string): Promise<DocDocument> {
        const uniqueName = await this.getAvailableName(spaceId, name);
        const id = crypto.randomUUID();
        const now = Date.now();

        const doc: DocDocument = {
            id,
            spaceId,
            name: uniqueName,
            content: '',
            wordCount: 0,
            createdAt: now,
            updatedAt: now
        };

        await db.docs.add(doc);
        
        await this.activityService.log({
            type: 'create',
            category: 'doc',
            entityId: id,
            entityName: uniqueName,
            description: `Created document "${uniqueName}"`
        });

        return doc;
    }

    async update(id: string, updates: Partial<DocDocument>): Promise<void> {
        updates.updatedAt = Date.now();
        await db.docs.update(id, updates);
    }

    async delete(id: string): Promise<void> {
        const doc = await this.getById(id);
        if (doc) {
            await db.docs.delete(id);
            await this.activityService.log({
                type: 'delete',
                category: 'doc',
                entityId: id,
                entityName: doc.name,
                description: `Deleted document "${doc.name}"`
            });
        }
    }
}
