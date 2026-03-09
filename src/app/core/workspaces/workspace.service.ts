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

    // Real-time observable of workspaces, sorted by order, then lastActiveAt
    readonly workspaces$ = liveQuery(async () => {
        const ws = await db.workspaces.filter(w => !w.trashedAt).toArray();
        return ws.sort((a, b) => {
            const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            return b.lastActiveAt - a.lastActiveAt;
        });
    });

    // Real-time observable of trashed workspaces
    readonly trashedWorkspaces$ = liveQuery(() =>
        db.workspaces
            .filter(w => !!w.trashedAt)
            .toArray()
    );

    async getAll(): Promise<Workspace[]> {
        const all = await db.workspaces.filter(w => !w.trashedAt).toArray();
        return all.sort((a, b) => {
            const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            return b.lastActiveAt - a.lastActiveAt;
        });
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

        const workspaceId = crypto.randomUUID();

        if (storageMode === 'filesystem') {
            const handle = await this.fileSystem.getOrCreateWorkspaceFolder(name.trim());
            if (handle) {
                folderPath = `Quilix/${name.trim()}`;
                await this.fileSystem.writeDirectoryId(handle, workspaceId);
                console.log(`[WorkspaceService] Local folder created at: ${folderPath}`);
            } else {
                console.warn('[WorkspaceService] Failed to create local folder, falling back to metadata only.');
            }
        }

        const workspace: Workspace = {
            id: workspaceId,
            name: name.trim(),
            role,
            createdAt: now,
            lastActiveAt: now,
            folderPath
        };

        await db.workspaces.add(workspace);
        return workspace;
    }

    /**
     * Rename a workspace, coordinating DB mapping and FileSystem physical rename
     */
    async rename(workspaceId: string, newName: string): Promise<boolean> {
        const workspace = await this.getById(workspaceId);
        if (!workspace) return false;

        const sanitized = newName.trim();
        if (!sanitized) return false;

        let newFolderPath = workspace.folderPath;
        const storageMode = await this.fileSystem.getStorageMode();

        if (storageMode === 'filesystem' && workspace.folderPath) {
            const quilixHandle = await this.fileSystem.getQuilixRootHandle();
            if (quilixHandle) {
                const renamed = await this.fileSystem.safeRenameFolder(quilixHandle, workspace.name, sanitized);
                if (renamed) {
                    newFolderPath = `Quilix/${sanitized}`;
                } else {
                    return false; // Abort if OS physical rename fails
                }
            } else {
                return false;
            }
        }

        await db.workspaces.update(workspaceId, { name: sanitized, folderPath: newFolderPath });
        return true;
    }

    async updateLastActive(workspaceId: string): Promise<void> {
        await db.workspaces.update(workspaceId, { lastActiveAt: Date.now() });
    }

    /**
     * Bulk update workspace ordering.
     */
    async updateWorkspaceOrder(updates: { id: string; order: number }[]): Promise<void> {
        await db.transaction('rw', db.workspaces, async () => {
            for (const update of updates) {
                await db.workspaces.update(update.id, { order: update.order });
            }
        });
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
     * Restore a missing workspace physical folder.
     */
    async restoreWorkspace(workspaceId: string, workspaceName: string): Promise<boolean> {
        const success = await this.fileSystem.restoreWorkspaceFolder(workspaceName, workspaceId);
        if (success) {
            await db.workspaces.update(workspaceId, { isMissingOnDisk: false });
            return true;
        }
        return false;
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
                    await this.fileSystem.writeDirectoryId(folderHandle, w.id);
                    await db.workspaces.update(w.id, { folderPath: newPath });
                    console.log(`[WorkspaceService] Migrated workspace ${w.name} to ${newPath}`);
                } else {
                    console.error(`[WorkspaceService] Failed to create folder for ${w.name} during migration.`);
                }
            }
        }
    }

    private isSyncing = false;

    /**
     * Scans the file system Quilix/ root to catch missing folders that were renamed through the OS File Manager.
     * Re-links them based by matching their inner `.quilix-id`.
     */
    async syncExternalRenames(): Promise<void> {
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode !== 'filesystem') return;

        // PREVENTION: Ensure only one sync runs at a time to prevent race conditions
        if (this.isSyncing) {
            console.log('[WorkspaceService] Sync already in progress, skipping concurrent run.');
            return;
        }

        if (!this.fileSystem.hasPermission()) return; // Bail if permission lost to avoid marking all as missing

        this.isSyncing = true;
        try {
            const folders = await this.fileSystem.getAllWorkspaceFolders();
            const foundWorkspaceIds = new Set<string>();

            // Phase 1: Identify existing workspaces by ID or Name (Heuristic)
            for (const handle of folders) {
                const diskName = handle.name;
                let folderId = await this.fileSystem.readDirectoryId(handle);

                // HEURISTIC: If folder has no ID, check if it matches an existing missing workspace by name
                if (!folderId) {
                    const existingByName = await db.workspaces
                        .filter(w => w.name === diskName && !!w.isMissingOnDisk && !w.trashedAt)
                        .first();

                    if (existingByName) {
                        console.log(`[WorkspaceService] HEURISTIC MATCH: Linking orphaned folder "${diskName}" to existing Workspace ID ${existingByName.id}`);
                        folderId = existingByName.id;
                        // Write back the ID to the folder so it becomes "tracked"
                        await this.fileSystem.writeDirectoryId(handle, folderId);
                    }
                }

                if (folderId) {
                    foundWorkspaceIds.add(folderId);
                    const ws = await this.getById(folderId);

                    if (ws && !ws.trashedAt) {
                        // If the folder name on disk doesn't match the DB name, it was physically renamed
                        if (ws.name !== diskName) {
                            console.log(`[WorkspaceService] Detected external rename: Re-linking Workspace ID ${folderId} to new name "${diskName}"`);
                            await db.workspaces.update(folderId, {
                                name: diskName,
                                folderPath: `Quilix/${diskName}`,
                                isMissingOnDisk: false // Ensure it's marked as present
                            });
                        } else if (ws.isMissingOnDisk) {
                            // If it was marked as missing but we found it now
                            await db.workspaces.update(folderId, { isMissingOnDisk: false });
                        }
                    }
                } else {
                    // AUTO-DISCOVERY: No .quilix-id and no name clash = brand new folder from OS
                    console.log(`[WorkspaceService] NATIVE DISCOVERY: Found untracked OS folder "${diskName}". Ingesting as new Workspace...`);
                    const newWorkspaceId = crypto.randomUUID();
                    const now = Date.now();

                    // Write our anchor ID into it so we own it moving forward
                    await this.fileSystem.writeDirectoryId(handle, newWorkspaceId);

                    const newWorkspace: Workspace = {
                        id: newWorkspaceId,
                        name: diskName,
                        role: 'personal',
                        createdAt: now,
                        lastActiveAt: now,
                        folderPath: `Quilix/${diskName}`,
                        isMissingOnDisk: false
                    };

                    await db.workspaces.add(newWorkspace);
                    foundWorkspaceIds.add(newWorkspaceId);
                }
            }

            // Phase 2: Missing Folder Detection
            const allWorkspaces = await db.workspaces.toArray();
            for (const ws of allWorkspaces) {
                // Only track missing status for workspaces that have a physical folder record
                if (!ws.trashedAt && ws.folderPath) {
                    const isNowFound = foundWorkspaceIds.has(ws.id);

                    if (!isNowFound && !ws.isMissingOnDisk) {
                        await db.workspaces.update(ws.id, { isMissingOnDisk: true });
                    } else if (isNowFound && ws.isMissingOnDisk) {
                        await db.workspaces.update(ws.id, { isMissingOnDisk: false });
                    }
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }
}
