import { Injectable, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { db } from '../../database/dexie.service';
import { Space } from '../../interfaces/space';
import { FileSystemService } from '../data/file-system.service';

/** Characters not allowed in space names (filesystem-safe for major OSs) */
const INVALID_CHARS = /[\/\\:*?"<>|]/g;
const MAX_NAME_LENGTH = 206;

@Injectable({
    providedIn: 'root',
})
export class SpaceService {
    private fileSystem = inject(FileSystemService);

    // ── Loading States (Reactive) ──
    readonly isSyncing = signal<boolean>(false);
    readonly activeOperations = signal<Set<string>>(new Set());

    private startOperation(id: string) {
        this.activeOperations.update(ops => {
            const next = new Set(ops);
            next.add(id);
            return next;
        });
    }

    private stopOperation(id: string) {
        this.activeOperations.update(ops => {
            const next = new Set(ops);
            next.delete(id);
            return next;
        });
    }

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
        this.startOperation(spaceId);
        this.fileSystem.acquireSyncLock();

        try {
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
        } finally {
            this.fileSystem.releaseSyncLock();
            this.stopOperation(spaceId);
        }
    }

    /**
     * Rename a space.
     * On filesystem mode: creates new folder, removes old one.
     */
    async rename(spaceId: string, newName: string, workspaceName: string): Promise<boolean> {
        this.startOperation(spaceId);
        this.fileSystem.acquireSyncLock();
        try {
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
        } finally {
            this.fileSystem.releaseSyncLock();
            this.stopOperation(spaceId);
        }
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
        this.startOperation(spaceId);
        try {
            const space = await db.spaces.get(spaceId);
            if (!space) return false;
            await db.spaces.update(spaceId, { trashedAt: Date.now() });
            return true;
        } finally {
            this.stopOperation(spaceId);
        }
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

        this.fileSystem.acquireSyncLock();
        try {
            // Delete folder on filesystem if applicable
            if (workspaceName) {
            const storageMode = await this.fileSystem.getStorageMode();
            if (storageMode === 'filesystem') {
                await this.deleteSpaceFolder(workspaceName, space.folderName);
            }
        }

            await db.spaces.delete(spaceId);
            return true;
        } finally {
            this.fileSystem.releaseSyncLock();
        }
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
     * We preserve casing and spaces to match Workspace naming conventions.
     */
    private toFolderName(name: string): string {
        return name
            .trim()
            .replace(INVALID_CHARS, '')
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

        // PREVENTION: Ensure only one sync runs at a time for this space set
        if (this.isSyncing() || this.fileSystem.isSyncLocked()) return;

        if (!this.fileSystem.hasPermission()) return; // Bail if permission lost to avoid marking all as missing

        this.isSyncing.set(true);
        try {
            // 1. BATCH FETCH: Grab all spaces for this workspace once to avoid N+1 queries in the loop
            const allSpaces = await db.spaces.where('workspaceId').equals(workspaceId).toArray();
            const spaceMap = new Map(allSpaces.map(s => [s.id, s]));
            
            const folders = await this.fileSystem.getAllSpaceFolders(workspaceName);
            const foundSpaceIds = new Set<string>();
            const spacesToUpdate: Space[] = [];
            const newSpaces: Space[] = [];
            
            // Track the current max order to correctly append newly discovered spaces
            let maxOrder = allSpaces.length > 0 ? Math.max(...allSpaces.map(s => s.order)) : -1;

            for (const handle of folders) {
                const diskName = handle.name;
                const diskNameLower = diskName.toLowerCase();
                const res = await this.fileSystem.readDirectoryId(handle);
                let spaceId = res?.id || null;

                // HEURISTIC: If folder has no ID, check if it matches an existing missing space by name
                if (!spaceId) {
                    const existingByName = allSpaces.find(s => 
                        s.folderName.toLowerCase() === diskNameLower && 
                        !!s.isMissingOnDisk && 
                        !s.trashedAt
                    );

                    if (existingByName) {
                        console.log(`[SpaceService] HEURISTIC MATCH: Linking orphaned space folder "${diskName}" to existing Space ID ${existingByName.id}`);
                        spaceId = existingByName.id;
                        // Write anchor so it's permanently tracked natively going forward
                        await this.fileSystem.writeDirectoryId(handle, spaceId);
                    }
                }

                if (spaceId) {
                    foundSpaceIds.add(spaceId);
                    const space = spaceMap.get(spaceId);

                    // Validate it actually belongs to this workspace
                    if (space && space.workspaceId === workspaceId && !space.trashedAt) {
                        let changed = false;
                        // If the folder name on disk doesn't match the DB record, it was physically renamed
                        if (space.folderName !== diskName) {
                            console.log(`[SpaceService] Detected external space rename: Re-linking ID ${spaceId} to new folder name "${diskName}"`);
                            space.name = diskName; // Fallback display name
                            space.folderName = diskName;
                            space.isMissingOnDisk = false;
                            changed = true;
                        } else if (space.isMissingOnDisk) {
                            space.isMissingOnDisk = false;
                            changed = true;
                        }
                        
                        if (changed) {
                            spacesToUpdate.push(space);
                        }
                    }

                    // SHADOW CACHE: Proactively mirror the subdirectory tree into virtual_entries.
                    // This is the ONLY way we can know subspace structure for restoration after 
                    // an OS-level deletion — filesystem mode never writes subdirs to the DB otherwise.
                    // This is a fire-and-forget background task; errors must not block sync.
                    this.cacheSubdirectoryTree(handle, workspaceId, spaceId, null, 0).catch(err => {
                        console.warn(`[SpaceService] Subdirectory cache update failed for space ${spaceId}:`, err);
                    });

                } else {
                    // AUTO-DISCOVERY: No .quilix-id means this folder was created manually inside the Workspace via OS
                    console.log(`[SpaceService] NATIVE DISCOVERY: Found untracked OS space "${diskName}" inside "${workspaceName}". Ingesting...`);
                    const newSpaceId = crypto.randomUUID();

                    // Write anchor so it's permanently tracked natively going forward
                    await this.fileSystem.writeDirectoryId(handle, newSpaceId);

                    maxOrder++;
                    const newSpace: Space = {
                        id: newSpaceId,
                        workspaceId,
                        name: diskName,
                        folderName: diskName,
                        createdAt: Date.now(),
                        order: maxOrder,
                        isMissingOnDisk: false
                    };

                    newSpaces.push(newSpace);
                    foundSpaceIds.add(newSpaceId);

                    // SHADOW CACHE: Also cache subdirs for newly discovered spaces
                    this.cacheSubdirectoryTree(handle, workspaceId, newSpaceId, null, 0).catch(err => {
                        console.warn(`[SpaceService] Subdirectory cache failed for new space ${newSpaceId}:`, err);
                    });
                }
            }

            // Phase 2: Missing Folder Detection
            for (const space of allSpaces) {
                if (!space.trashedAt) {
                    const isNowFound = foundSpaceIds.has(space.id);
                    let changed = false;
                    
                    if (!isNowFound && !space.isMissingOnDisk) {
                        space.isMissingOnDisk = true;
                        changed = true;
                    } else if (isNowFound && space.isMissingOnDisk) {
                        space.isMissingOnDisk = false;
                        changed = true;
                    }
                    
                    if (changed && !newSpaces.some(ns => ns.id === space.id)) {
                        // Only add if not already in the update list
                        if (!spacesToUpdate.some(us => us.id === space.id)) {
                            spacesToUpdate.push(space);
                        }
                    }
                }
            }

            // Phase 3: BATCH SAVE: Commit all changes in two bulk operations
            if (newSpaces.length > 0) {
                await db.spaces.bulkAdd(newSpaces);
            }
            if (spacesToUpdate.length > 0) {
                await db.spaces.bulkPut(spacesToUpdate);
            }
        } finally {
            this.isSyncing.set(false);
        }
    }

    /**
     * Proactively mirrors a space's entire subdirectory tree into virtual_entries.
     * This creates a persistent structural snapshot so that if the physical folder is deleted 
     * from outside the app, the restore flow can reconstruct the full tree hierarchy.
     *
     * SAFETY: This method only writes 'directory' kind entries, never 'file'.
     * It uses bulkPut (upsert), so re-running it on every sync is idempotent.
     * It only runs in filesystem mode and does NOT interfere with indexeddb-mode reads.
     *
     * @param dirHandle  - Handle to the directory to scan
     * @param workspaceId - The parent workspace ID
     * @param spaceId     - The owning space ID
     * @param parentId    - The virtual_entries parentId (null => 'root')
     * @param depth       - Current recursion depth (guards against runaway traversal)
     */
    private async cacheSubdirectoryTree(
        dirHandle: FileSystemDirectoryHandle,
        workspaceId: string,
        spaceId: string,
        parentId: string | null,
        depth: number
    ): Promise<void> {
        if (depth > 6) return; // Safety limit: prevent infinite loops for very deep trees

        const parentKey = parentId ?? 'root';
        const entriesToPut: any[] = [];
        const childHandles: { handle: FileSystemDirectoryHandle; id: string }[] = [];

        try {
            for await (const entry of (dirHandle as any).values()) {
                // Only cache directory entries — files can't be restored, no point storing
                if (entry.name.startsWith('.quilix') || entry.kind !== 'directory') continue;

                let id: string | undefined = undefined;
                try {
                    const res = await this.fileSystem.readDirectoryId(entry as FileSystemDirectoryHandle);
                    id = res?.id;

                    // If the directory has no ID, assign and write one so it's permanently trackable
                    if (!id) {
                        id = crypto.randomUUID();
                        await this.fileSystem.writeDirectoryId(entry as FileSystemDirectoryHandle, id);
                    }
                } catch {
                    continue; // Can't read this entry, skip it safely
                }

                entriesToPut.push({
                    id,
                    workspaceId,
                    spaceId,
                    parentId: parentKey,
                    name: entry.name,
                    kind: 'directory',
                    lastModified: Date.now()
                });

                childHandles.push({ handle: entry as FileSystemDirectoryHandle, id });
            }
        } catch (err) {
            console.warn(`[SpaceService] cacheSubdirectoryTree: Could not read dir at depth ${depth}:`, err);
            return;
        }

        // Upsert all discovered directory entries in one batch operation
        if (entriesToPut.length > 0) {
            await db.virtual_entries.bulkPut(entriesToPut);
        }

        // Recurse into each child directory sequentially to keep memory usage low
        for (const child of childHandles) {
            await this.cacheSubdirectoryTree(child.handle, workspaceId, spaceId, child.id, depth + 1);
        }
    }

    /**
     * Restore a missing space physical folder.
     */
    async restoreSpace(spaceId: string, workspaceName: string): Promise<boolean> {
        const space = await db.spaces.get(spaceId);
        if (!space || !space.folderName) return false;

        const success = await this.fileSystem.restoreSpaceFolder(workspaceName, space.folderName, space.id);
        if (!success) return false;

        await db.spaces.update(spaceId, { isMissingOnDisk: false });

        // Recreate the subdirectory structure tracked in IndexedDB.
        // NOTE: File *content* cannot be recovered (it was on disk and is now gone).
        // We rebuild the folder tree so the app's file explorer doesn't break.
        const storageMode = await this.fileSystem.getStorageMode();
        if (storageMode === 'filesystem') {
            await this.restoreSubdirectoryTree(workspaceName, space.folderName, spaceId, null);
        }

        return true;
    }

    /**
     * Recursively recreates subdirectory folders for a space from IndexedDB virtual_entries.
     * Only recreates 'directory' kind entries — file content cannot be restored from DB.
     */
    private async restoreSubdirectoryTree(
        workspaceName: string,
        spaceFolderName: string,
        spaceId: string,
        parentId: string | null
    ): Promise<void> {
        const parentKey = parentId ?? 'root';
        const children = await db.virtual_entries
            .where('[spaceId+parentId]')
            .equals([spaceId, parentKey])
            .toArray();

        for (const entry of children) {
            if (entry.kind !== 'directory') continue;

            try {
                // Resolve the workspace handle and navigate to the space folder, then create this subdir
                const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspaceName);
                if (!wsHandle) continue;

                // Navigate down to the space folder
                const spaceHandle = await wsHandle.getDirectoryHandle(spaceFolderName, { create: false }).catch(() => null);
                if (!spaceHandle) continue;

                // Resolve path to parent subdirectory if nested
                const targetHandle = parentId
                    ? await this.resolveVirtualPath(spaceHandle, spaceId, parentId)
                    : spaceHandle;

                if (!targetHandle) continue;

                // Create the directory
                const newDirHandle = await targetHandle.getDirectoryHandle(entry.name, { create: true });
                console.log(`[SpaceService] Restored subdir: "${entry.name}" under spaceId=${spaceId}`);

                // Write the virtual entry's ID as the directory anchor
                if (entry.id) {
                    await this.fileSystem.writeDirectoryId(newDirHandle, entry.id);
                }

                // Recurse into children of this restored directory
                await this.restoreSubdirectoryTree(workspaceName, spaceFolderName, spaceId, entry.id);
            } catch (err) {
                console.warn(`[SpaceService] Could not restore subdir "${entry.name}":`, err);
            }
        }
    }

    /**
     * Resolves a FileSystemDirectoryHandle for a virtual entry's parent path,
     * walking up the virtual_entries chain from the space root.
     */
    private async resolveVirtualPath(
        spaceHandle: FileSystemDirectoryHandle,
        spaceId: string,
        entryId: string
    ): Promise<FileSystemDirectoryHandle | null> {
        // Build the ancestor chain from root down to entryId
        const chain: string[] = [];
        let currentId: string | null = entryId;

        while (currentId) {
            const entry: any = await db.virtual_entries.get(currentId);
            if (!entry || entry.kind !== 'directory') break;
            chain.unshift(entry.name);
            currentId = entry.parentId === 'root' ? null : entry.parentId;
        }

        // Walk the chain top-down from spaceHandle
        let handle: FileSystemDirectoryHandle = spaceHandle;
        for (const name of chain) {
            try {
                handle = await handle.getDirectoryHandle(name, { create: true });
            } catch {
                return null;
            }
        }
        return handle;
    }
}
