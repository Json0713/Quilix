import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../db/app-db';
import { Space } from '../interfaces/space';
import { FileSystemService } from './file-system.service';

/** Characters not allowed in space names (filesystem-safe) */
const INVALID_CHARS = /[\/\\:*?"<>|.@#$%^&!+=~`{}\[\]();,]/g;
const MAX_NAME_LENGTH = 50;

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

        // Create folder on filesystem if applicable
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem') {
            await this.createSpaceFolder(workspaceName, folderName);
        }

        const space: Space = {
            id: crypto.randomUUID(),
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

        // Rename folder on filesystem: create new → delete old
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem' && newFolderName !== oldFolderName) {
            await this.createSpaceFolder(workspaceName, newFolderName);
            await this.deleteSpaceFolder(workspaceName, oldFolderName);
        }

        await db.spaces.update(spaceId, { name: sanitized, folderName: newFolderName });
        return true;
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

    private async createSpaceFolder(workspaceName: string, folderName: string): Promise<void> {
        try {
            const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
            if (wsHandle) {
                await wsHandle.getDirectoryHandle(folderName, { create: true });
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
}
