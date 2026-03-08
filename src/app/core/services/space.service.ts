import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../db/app-db';
import { Space } from '../interfaces/space';
import { FileSystemService } from './file-system.service';

/** Characters not allowed in space names (filesystem-safe) */
const INVALID_CHARS = /[\/\\:*?"<>|.@#$%^&!+=~`{}\[\]();,]/g;
const MAX_NAME_LENGTH = 206;

@Injectable({
    providedIn: 'root',
})
export class SpaceService {
    private fileSystem = inject(FileSystemService);

    /**
     * Live-query observable of spaces for a workspace, ordered by creation.
     */
    liveSpaces$(workspaceId: string) {
        return liveQuery(async () => {
            const all = await db.spaces
                .where('workspaceId')
                .equals(workspaceId)
                .sortBy('order');
            return all.filter(s => !s.trashedAt);
        });
    }

    /**
     * Live-query observable for a single space by ID.
     * Returns null when space is trashed or deleted.
     */
    liveSpace$(spaceId: string) {
        return liveQuery(async () => {
            const space = await db.spaces.get(spaceId);
            if (!space || space.trashedAt) return null;
            return space;
        });
    }

    /**
     * Live-query observable for a single space by ID regardless of trash status.
     * Useful for Breadcrumbs and audit trails mapping.
     */
    liveSpaceAnyStatus$(spaceId: string) {
        return liveQuery(async () => {
            const space = await db.spaces.get(spaceId);
            return space ?? null;
        });
    }

    /**
     * Live-query observable of trashed spaces for a workspace.
     */
    liveTrashedSpaces$(workspaceId: string) {
        return liveQuery(async () => {
            const all = await db.spaces
                .where('workspaceId')
                .equals(workspaceId)
                .toArray();
            return all.filter(s => !!s.trashedAt);
        });
    }

    /**
     * Get the total count of all spaces across all workspaces.
     */
    async getTotalCount(): Promise<number> {
        return db.spaces.count();
    }

    /**
     * Get all spaces for a workspace.
     */
    async getByWorkspace(workspaceId: string): Promise<Space[]> {
        return db.spaces
            .where('workspaceId')
            .equals(workspaceId)
            .sortBy('order');
    }

    /**
     * Get a single space by ID.
     */
    async getById(spaceId: string): Promise<Space | null> {
        const space = await db.spaces.get(spaceId);
        return space ?? null;
    }

    /**
     * Create a new space inside a workspace.
     * @param workspaceId Parent workspace ID
     * @param workspaceName Parent workspace name (for filesystem path)
     * @param rawName User-provided name (empty = auto-generate)
     */
    async create(workspaceId: string, workspaceName: string, rawName?: string): Promise<Space> {
        const name = await this.resolveUniqueName(workspaceId, rawName);
        const folderName = this.toFolderName(name);

        // Determine order (append to end)
        const existing = await this.getByWorkspace(workspaceId);
        const order = existing.length > 0
            ? Math.max(...existing.map(s => s.order)) + 1
            : 0;

        const spaceId = crypto.randomUUID();

        // Create folder on filesystem if applicable
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem') {
            await this.createSpaceFolder(workspaceName, folderName, spaceId);
        }

        const space: Space = {
            id: spaceId,
            workspaceId,
            name,
            folderName,
            createdAt: Date.now(),
            order,
        };

        await db.spaces.add(space);
        return space;
    }

    /**
     * Rename a space.
     * On filesystem mode: creates new folder, removes old one.
     */
    async rename(spaceId: string, newName: string, workspaceName: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space) return false;

        const sanitized = this.sanitizeName(newName);
        if (!sanitized) return false;

        const newFolderName = this.toFolderName(sanitized);
        const oldFolderName = space.folderName;

        // Rename folder on filesystem: rename physically using robust copy/move hybrid
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem' && newFolderName !== oldFolderName) {
            const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (wsHandle) {
                const renamed = await this.fileSystem.safeRenameFolder(wsHandle, oldFolderName, newFolderName);
                if (!renamed) return false;
            }
        }

        await db.spaces.update(spaceId, { name: sanitized, folderName: newFolderName });
        return true;
    }

    /**
     * Batch update all space sequential positions natively from Drag & Drop CDK mutations.
     */
    async updateSpaceOrders(orderedSpaces: Space[]): Promise<void> {
        // Re-assign order properties natively mapped down from their organized UI index constraints
        const updatedSpaces = orderedSpaces.map((space, index) => ({ ...space, order: index }));

        // Batch persist the exact physical DOM order out to Dexie
        await db.spaces.bulkPut(updatedSpaces);
    }

    /**
     * Move a space to trash (soft-delete).
     * Folder is preserved on disk — only removed on permanent delete.
     */
    async moveToTrash(spaceId: string, _workspaceName: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space) return false;

        await db.spaces.update(spaceId, { trashedAt: Date.now() });
        return true;
    }

    /**
     * Restore a space from trash.
     * Folder was preserved on disk, so just clear trashedAt.
     */
    async restoreFromTrash(spaceId: string, _workspaceName: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space) return false;

        await db.spaces.update(spaceId, { trashedAt: undefined as any });
        return true;
    }

    /**
     * Permanently delete a space — removes DB record and filesystem folder.
     */
    async permanentlyDelete(spaceId: string, workspaceName?: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space) return false;

        // Delete folder on filesystem if applicable
        if (workspaceName) {
            const storageMode = await this.fileSystem.getStorageMode();
            if (storageMode === 'filesystem') {
                await this.deleteSpaceFolder(workspaceName, space.folderName);
            }
        }

        await db.spaces.delete(spaceId);
        return true;
    }

    /**
     * Delete all spaces for a workspace (used when workspace is permanently deleted).
     */
    async deleteAllForWorkspace(workspaceId: string): Promise<void> {
        await db.spaces.where('workspaceId').equals(workspaceId).delete();
    }

    // ── Naming Logic ──

    /**
     * Sanitize a name: trim, remove invalid chars, enforce max length.
     */
    sanitizeName(raw: string): string {
        return raw
            .trim()
            .replace(INVALID_CHARS, '')
            .substring(0, MAX_NAME_LENGTH)
            .trim();
    }

    /**
     * Validate a name for display (returns error message or null).
     */
    validateName(raw: string): string | null {
        const trimmed = raw.trim();
        if (trimmed.length === 0) return null; // Empty = will use default
        if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or less`;
        if (INVALID_CHARS.test(trimmed)) return 'Name contains invalid characters';
        return null;
    }

    /**
     * Generate a unique name with file-manager-style numbering.
     * "New space" → "New space (2)" → "New space (3)"
     */
    private async resolveUniqueName(workspaceId: string, rawName?: string): Promise<string> {
        const baseName = rawName ? this.sanitizeName(rawName) : '';
        const name = baseName || 'New space';

        const existing = await this.getByWorkspace(workspaceId);
        const existingNames = new Set(existing.map(s => s.name.toLowerCase()));

        if (!existingNames.has(name.toLowerCase())) {
            return name;
        }

        // Find next available number
        let counter = 2;
        while (existingNames.has(`${name} (${counter})`.toLowerCase())) {
            counter++;
        }
        return `${name} (${counter})`;
    }

    /**
     * Convert display name to a filesystem-safe folder name.
     */
    private toFolderName(name: string): string {
        return name
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9\-_()]/g, '')
            .toLowerCase()
            || 'space';
    }

    // ── Filesystem Operations ──

    /**
     * Check if a space folder exists on disk inside its workspace folder.
     */
    async checkSpaceFolderExists(workspaceName: string, folderName: string): Promise<boolean | 'no-permission'> {
        const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
        if (!wsHandle) return 'no-permission';

        try {
            await wsHandle.getDirectoryHandle(folderName, { create: false });
            return true;
        } catch (err: any) {
            if (err.name === 'NotFoundError') return false;
            return 'no-permission';
        }
    }

    /**
     * Restore a missing space folder on disk.
     */
    async restoreSpaceFolder(workspaceName: string, folderName: string, spaceId: string): Promise<boolean> {
        try {
            await this.createSpaceFolder(workspaceName, folderName, spaceId);
            return true;
        } catch {
            return false;
        }
    }

    private async createSpaceFolder(workspaceName: string, folderName: string, spaceId: string): Promise<void> {
        try {
            const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (wsHandle) {
                const spaceHandle = await wsHandle.getDirectoryHandle(folderName, { create: true });
                await this.fileSystem.writeDirectoryId(spaceHandle, spaceId);
            }
        } catch (err) {
            console.error(`[SpaceService] Failed to create space folder: ${folderName}`, err);
        }
    }

    private async deleteSpaceFolder(workspaceName: string, folderName: string): Promise<void> {
        try {
            const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (wsHandle) {
                await (wsHandle as any).removeEntry(folderName, { recursive: true });
            }
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                console.error(`[SpaceService] Failed to delete space folder: ${folderName}`, err);
            }
        }
    }

    /**
     * Scans all subdirectories of a workspace folder to detect OS-level renames.
     * Uses the inner `.quilix-id` file.
     */
    async syncExternalRenames(workspaceId: string, workspaceName: string): Promise<void> {
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode !== 'filesystem') return;

        const folders = await this.fileSystem.getAllSpaceFolders(workspaceName);
        if (!this.fileSystem.hasPermission()) return; // Bail if permission lost to avoid marking all as missing

        const foundSpaceIds = new Set<string>();

        for (const handle of folders) {
            const diskName = handle.name;
            const spaceId = await this.fileSystem.readDirectoryId(handle);

            if (spaceId) {
                foundSpaceIds.add(spaceId);
                const space = await db.spaces.get(spaceId);
                // Validate it actually belongs to this workspace and its disk name represents its folderName.
                if (space && space.workspaceId === workspaceId && !space.trashedAt && space.folderName !== diskName) {
                    console.log(`[SpaceService] Detected external space rename: Re-linking ID ${spaceId} to new folder name "${diskName}"`);

                    await db.spaces.update(spaceId, {
                        name: diskName, // Fallback display name
                        folderName: diskName
                    });
                }
            } else {
                // AUTO-DISCOVERY: No .quilix-id means this folder was created manually inside the Workspace via OS
                console.log(`[SpaceService] NATIVE DISCOVERY: Found untracked OS space "${diskName}" inside "${workspaceName}". Ingesting...`);
                const newSpaceId = crypto.randomUUID();

                // Write anchor so it's permanently tracked natively going forward
                await this.fileSystem.writeDirectoryId(handle, newSpaceId);

                // Determine order (append to end)
                const existing = await this.getByWorkspace(workspaceId);
                const order = existing.length > 0 ? Math.max(...existing.map(s => s.order)) + 1 : 0;

                const newSpace: Space = {
                    id: newSpaceId,
                    workspaceId,
                    name: diskName,
                    folderName: diskName,
                    createdAt: Date.now(),
                    order,
                };

                await db.spaces.add(newSpace);
                foundSpaceIds.add(newSpaceId);
            }
        }

        // Phase 1: Missing Folder Detection
        const allSpaces = await db.spaces.where('workspaceId').equals(workspaceId).toArray();
        for (const space of allSpaces) {
            if (!space.trashedAt && !foundSpaceIds.has(space.id)) {
                if (!space.isMissingOnDisk) {
                    await db.spaces.update(space.id, { isMissingOnDisk: true });
                }
            } else if (space.isMissingOnDisk && foundSpaceIds.has(space.id)) {
                await db.spaces.update(space.id, { isMissingOnDisk: false });
            }
        }
    }

    /**
     * Restore a missing space physical folder.
     */
    async restoreSpace(spaceId: string, workspaceName: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space || !space.folderName) return false;

        const success = await this.fileSystem.restoreSpaceFolder(workspaceName, space.folderName, space.id);
        if (success) {
            await db.spaces.update(spaceId, { isMissingOnDisk: false });
            return true;
        }
        return false;
    }
}
