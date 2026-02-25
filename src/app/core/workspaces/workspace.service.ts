import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../db/app-db';
import { Workspace, WorkspaceRole } from '../interfaces/workspace';
import { FileSystemService } from '../services/file-system.service';

@Injectable({
    providedIn: 'root',
})
export class WorkspaceService {
    private fileSystem = inject(FileSystemService);

    // Real-time observable of workspaces, sorted by lastActiveAt
    readonly workspaces$ = liveQuery(() =>
        db.workspaces
            .orderBy('lastActiveAt')
            .reverse()
            .filter(w => !w.trashedAt)
            .toArray()
    );

    // Real-time observable of trashed workspaces
    readonly trashedWorkspaces$ = liveQuery(() =>
        db.workspaces
            .filter(w => !!w.trashedAt)
            .toArray()
    );

    async getAll(): Promise<Workspace[]> {
        const all = await db.workspaces.orderBy('lastActiveAt').reverse().toArray();
        return all.filter(w => !w.trashedAt);
    }

    async getTrashed(): Promise<Workspace[]> {
        const all = await db.workspaces.toArray();
        return all.filter(w => !!w.trashedAt);
    }

    async getById(id: string): Promise<Workspace | undefined> {
        return db.workspaces.get(id);
    }

    async existsByName(name: string): Promise<boolean> {
        const normalized = name.trim().toLowerCase();
        const all = await db.workspaces.toArray();
        return all.some(w => w.name.toLowerCase() === normalized && !w.trashedAt);
    }

    async create(name: string, role: WorkspaceRole): Promise<Workspace> {
        const now = Date.now();
        const storageMode = await this.fileSystem.getStorageMode();
        let folderPath: string | undefined = undefined;

        if (storageMode === 'filesystem') {
            const handle = await this.fileSystem.getOrCreateWorkspaceFolder(name.trim());
            if (handle) {
                folderPath = `Quilix/${name.trim()}`;
                console.log(`[WorkspaceService] Local folder created at: ${folderPath}`);
            } else {
                console.warn('[WorkspaceService] Failed to create local folder, falling back to metadata only.');
            }
        }

        const workspace: Workspace = {
            id: crypto.randomUUID(),
            name: name.trim(),
            role,
            createdAt: now,
            lastActiveAt: now,
            folderPath
        };

        await db.workspaces.add(workspace);
        return workspace;
    }

    async updateLastActive(workspaceId: string): Promise<void> {
        await db.workspaces.update(workspaceId, { lastActiveAt: Date.now() });
    }

    /**
     * Move a workspace to the trash.
     */
    async moveToTrash(workspaceId: string): Promise<void> {
        await db.workspaces.update(workspaceId, { trashedAt: Date.now() });
    }

    /**
     * Restore a workspace from the trash.
     */
    async restoreFromTrash(workspaceId: string): Promise<void> {
        await db.workspaces.update(workspaceId, { trashedAt: undefined as any });
    }

    /**
     * Permanently delete a workspace from the database and disk if applicable.
     */
    async permanentlyDelete(workspaceId: string): Promise<void> {
        const workspace = await this.getById(workspaceId);
        if (!workspace) return;

        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem' && workspace.folderPath) {
            await this.fileSystem.permanentlyDeleteWorkspaceFolder(workspace.name);
        }

        await db.workspaces.delete(workspaceId);
    }

    /**
     * Migrate existing workspaces to the local file system.
     * Iterates over all workspaces and creates a folder for them if one doesn't exist.
     */
    async migrateToFileSystem(): Promise<void> {
        const all = await this.getAll();
        const handle = await this.fileSystem.getStoredHandle();

        if (!handle) {
            console.warn('[WorkspaceService] Cannot migrate: No file system handle found.');
            return;
        }

        for (const w of all) {
            if (!w.folderPath) {
                const folderHandle = await this.fileSystem.getOrCreateWorkspaceFolder(w.name);
                if (folderHandle) {
                    const newPath = `Quilix/${w.name}`;
                    await db.workspaces.update(w.id, { folderPath: newPath });
                    console.log(`[WorkspaceService] Migrated workspace ${w.name} to ${newPath}`);
                } else {
                    console.error(`[WorkspaceService] Failed to create folder for ${w.name} during migration.`);
                }
            }
        }
    }
}
