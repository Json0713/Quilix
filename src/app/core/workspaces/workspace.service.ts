import { Injectable } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../db/app-db';
import { Workspace, WorkspaceRole } from '../interfaces/workspace';


@Injectable({
    providedIn: 'root',
})
export class WorkspaceService {

    // Real-time observable of workspaces, sorted by lastActiveAt
    readonly workspaces$ = liveQuery(() =>
        db.workspaces.orderBy('lastActiveAt').reverse().toArray()
    );

    async getAll(): Promise<Workspace[]> {
        return db.workspaces.orderBy('lastActiveAt').reverse().toArray();
    }

    async getById(id: string): Promise<Workspace | undefined> {
        return db.workspaces.get(id);
    }

    async existsByName(name: string): Promise<boolean> {
        const normalized = name.trim().toLowerCase();
        const all = await db.workspaces.toArray();
        return all.some(w => w.name.toLowerCase() === normalized);
    }

    async create(name: string, role: WorkspaceRole): Promise<Workspace> {
        const now = Date.now();

        const workspace: Workspace = {
            id: crypto.randomUUID(),
            name: name.trim(),
            role,
            createdAt: now,
            lastActiveAt: now,
        };

        await db.workspaces.add(workspace);
        return workspace;
    }

    async updateLastActive(workspaceId: string): Promise<void> {
        await db.workspaces.update(workspaceId, { lastActiveAt: Date.now() });
    }

    async delete(workspaceId: string): Promise<void> {
        await db.workspaces.delete(workspaceId);
    }

}
