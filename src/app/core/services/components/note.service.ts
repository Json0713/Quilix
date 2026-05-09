import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../../database/dexie.service';
import { NoteDocument } from '../../interfaces/note';
import { ActivityService } from '../ui/activity.service';

@Injectable({
    providedIn: 'root'
})
export class NoteService {
    private activityService = inject(ActivityService);

    getNotesForSpace(spaceId: string) {
        return liveQuery(() =>
            db.notes.filter(n => n.spaceId === spaceId).toArray()
        );
    }

    async getById(id: string): Promise<NoteDocument | undefined> {
        return db.notes.get(id);
    }

    liveDoc$(id: string) {
        return liveQuery(() => db.notes.get(id));
    }

    async getAvailableName(spaceId: string, baseName: string, excludeId?: string): Promise<string> {
        const spaceNotes = await db.notes.filter(n => n.spaceId === spaceId && n.id !== excludeId).toArray();
        const existingNames = new Set(spaceNotes.map(n => n.name.toLowerCase()));
        
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

    async create(spaceId: string, name: string): Promise<NoteDocument> {
        const uniqueName = await this.getAvailableName(spaceId, name);
        const id = crypto.randomUUID();
        const now = Date.now();

        const doc: NoteDocument = {
            id,
            spaceId,
            name: uniqueName,
            content: '', // Start empty
            createdAt: now,
            updatedAt: now
        };

        await db.notes.add(doc);
        
        await this.activityService.log({
            type: 'create',
            category: 'note',
            entityId: id,
            entityName: uniqueName,
            description: `Created note "${uniqueName}"`
        });

        return doc;
    }

    async update(id: string, updates: Partial<NoteDocument>): Promise<void> {
        updates.updatedAt = Date.now();
        await db.notes.update(id, updates);
    }

    async delete(id: string): Promise<void> {
        const note = await this.getById(id);
        if (note) {
            await db.notes.delete(id);
            await this.activityService.log({
                type: 'delete',
                category: 'note',
                entityId: id,
                entityName: note.name,
                description: `Deleted note "${note.name}"`
            });
        }
    }
}
