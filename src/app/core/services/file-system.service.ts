import { Injectable, signal } from '@angular/core';
import { db } from '../db/app-db';

@Injectable({
    providedIn: 'root',
})
export class FileSystemService {
    private readonly QUILIX_ROOT = 'Quilix';
    private readonly ID_FILENAME = '.quilix-id';

    /**
     * Reactive permission state.
     * Components can read this to show re-auth UI when permission is lost.
     */
    readonly hasPermission = signal<boolean>(false);
    readonly isSyncLocked = signal<boolean>(false);

    /**
     * Acquire a global synchronization lock to prevent background scanners 
     * and auto-exporters from conflicting with mass migrations or hydration.
     */
    acquireSyncLock() {
        this.isSyncLocked.set(true);
    }

    /**
     * Release the global synchronization lock.
     */
    releaseSyncLock() {
        this.isSyncLocked.set(false);
    }

    /**
     * Check if the File System Access API is supported in the current environment.
     * This checks both the picker AND permission APIs which some mobile browsers lack.
     */
    isSupported(): boolean {
        return (
            typeof window !== 'undefined' &&
            'showDirectoryPicker' in window &&
            typeof FileSystemHandle !== 'undefined' &&
            'queryPermission' in FileSystemHandle.prototype
        );
    }

    /**
     * Request access to a directory and store the handle in IndexedDB.
     */
    async requestDirectoryAccess(): Promise<boolean> {
        if (!this.isSupported()) return false;

        try {
            const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            await db.settings.put({ key: 'fileSystemHandle', value: handle });
            await db.settings.put({ key: 'storageMode', value: 'filesystem' });

            // Ensure Quilix root folder exists
            await this.getOrCreateDirectory(handle, this.QUILIX_ROOT);

            this.hasPermission.set(true);
            return true;
        } catch (err) {
            console.error('[FileSystem] Permission denied or picker cancelled:', err);
            return false;
        }
    }

    /**
     * Get the stored directory handle from IndexedDB.
     */
    async getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
        try {
            const setting = await db.settings.get('fileSystemHandle');
            return setting ? setting.value : null;
        } catch {
            return null;
        }
    }

    /**
     * Check and request permission for the stored handle.
     * @param withRequest If true, actively prompts the user (requires user gesture).
     *                    If false, only checks current state without prompting.
     */
    async verifyPermission(handle: FileSystemDirectoryHandle, readWrite = true, withRequest = true): Promise<boolean> {
        try {
            const options: any = { mode: readWrite ? 'readwrite' : 'read' };

            // Check if permission is already granted
            if ((await (handle as any).queryPermission(options)) === 'granted') {
                this.hasPermission.set(true);
                return true;
            }

            if (!withRequest) {
                this.hasPermission.set(false);
                return false;
            }

            // Request permission (must be triggered by a user gesture)
            if ((await (handle as any).requestPermission(options)) === 'granted') {
                this.hasPermission.set(true);
                return true;
            }
        } catch (err) {
            console.warn('[FileSystem] Permission check failed:', err);
        }

        this.hasPermission.set(false);
        return false;
    }

    /**
     * Ensure we have a valid handle with active permission before any file operation.
     * Returns the handle if permission is granted, null otherwise.
     * This NEVER prompts — it only checks current state.
     */
    private async ensurePermittedHandle(): Promise<FileSystemDirectoryHandle | null> {
        const handle = await this.getStoredHandle();
        if (!handle) {
            this.hasPermission.set(false);
            return null;
        }

        // Quick check: if we already know we have permission, skip re-verification
        if (this.hasPermission()) {
            return handle;
        }

        // Silent check — no prompt, also verify handle is truly functional
        const granted = await this.verifyPermission(handle, true, false);
        if (!granted) return null;

        // Verify the handle actually works (not just 'granted' in name only)
        const works = await this.testHandleAccess(handle);
        if (!works) {
            this.hasPermission.set(false);
            return null;
        }

        return handle;
    }

    /**
     * Test if a handle is truly functional by performing a real operation.
     * On mobile Chrome, handles can report 'granted' but still fail on actual use.
     */
    async testHandleAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
        try {
            // Try to iterate entries — this reveals stale handles
            const iter = (handle as any).entries();
            await iter.next();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Reconnect to local storage with a user gesture.
     * Strategy:
     *   1. Try requestPermission() on the stored handle
     *   2. Verify the handle actually works with a real operation
     *   3. If step 1 or 2 fails (common on mobile), re-pick directory entirely
     * Call this from a click handler (e.g., "Reconnect Storage" button).
     */
    async requestPermissionWithGesture(): Promise<boolean> {
        // Step 1: Try to revive the stored handle
        const storedHandle = await this.getStoredHandle();
        if (storedHandle) {
            const granted = await this.verifyPermission(storedHandle, true, true);
            if (granted) {
                // Step 2: Verify it actually works
                const works = await this.testHandleAccess(storedHandle);
                if (works) {
                    return true;
                }
                console.warn('[FileSystem] Handle reports granted but is stale, re-picking directory.');
            }
        }

        // Step 3: Fallback — re-pick directory to get a fresh handle
        return await this.requestDirectoryAccess();
    }

    /**
     * Delete a workspace folder permanently from local disk.
     */
    async permanentlyDeleteWorkspaceFolder(workspaceName: string): Promise<boolean> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return false;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            await (quilixRoot as any).removeEntry(workspaceName, { recursive: true });
            return true;
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                return true; // Already gone
            }
            console.error(`[FileSystem] Error deleting folder for ${workspaceName}:`, err);
            return false;
        }
    }

    /**
     * Get or create a workspace directory inside the Quilix root.
     */
    async getOrCreateWorkspaceFolder(workspaceName: string): Promise<FileSystemDirectoryHandle | null> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return null;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: true });
            return await quilixRoot.getDirectoryHandle(workspaceName, { create: true });
        } catch (err) {
            console.error(`[FileSystem] Failed to create folder for ${workspaceName}:`, err);
            return null;
        }
    }

    /**
     * Helper to get or create a directory.
     */
    private async getOrCreateDirectory(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
        return await parent.getDirectoryHandle(name, { create: true });
    }

    /**
     * Write a permanent ID marker file to a directory to track it even if renamed externally.
     */
    async writeDirectoryId(dirHandle: FileSystemDirectoryHandle, id: string): Promise<boolean> {
        try {
            const fileHandle = await dirHandle.getFileHandle(this.ID_FILENAME, { create: true });
            const writable = await (fileHandle as any).createWritable();
            await writable.write(id);
            await writable.close();

            // VERIFICATION: Read it back to ensure it was written correctly
            const verifiedId = await this.readDirectoryId(dirHandle);
            if (verifiedId !== id) {
                console.error(`[FileSystem] ID verification failed for ${dirHandle.name}. Expected ${id}, got ${verifiedId}`);
                return false;
            }

            return true;
        } catch (err) {
            console.error(`[FileSystem] Failed to write ID to directory: ${dirHandle.name}`, err);
            return false;
        }
    }

    /**
     * Read the permanent ID marker from a directory.
     */
    async readDirectoryId(dirHandle: FileSystemDirectoryHandle): Promise<string | null> {
        try {
            const fileHandle = await dirHandle.getFileHandle(this.ID_FILENAME, { create: false });
            const file = await fileHandle.getFile();
            return (await file.text()).trim();
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                console.warn(`[FileSystem] Could not read ID from ${dirHandle.name}:`, err);
            }
            return null;
        }
    }

    /**
     * Retrieves the Quilix root directory handle.
     */
    async getQuilixRootHandle(): Promise<FileSystemDirectoryHandle | null> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return null;
        try {
            return await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
        } catch {
            return null;
        }
    }

    /**
     * Safely rename a folder using the modern FileSystemHandle.move() API.
     * If .move() is not supported or fails, gracefully falls back to a full recursive copy and delete.
     */
    async safeRenameFolder(parentHandle: FileSystemDirectoryHandle, oldName: string, newName: string): Promise<boolean> {
        try {
            let oldHandle: FileSystemDirectoryHandle;
            try {
                oldHandle = await parentHandle.getDirectoryHandle(oldName, { create: false });
            } catch (err: any) {
                if (err.name === 'NotFoundError') return false;
                throw err;
            }

            // 1. Try modern fast move()
            if ('move' in oldHandle) {
                try {
                    await (oldHandle as any).move(newName);
                    return true;
                } catch (moveErr: any) {
                    // Optimized: If it's a conflict or lock error, don't immediately do a 1GB copy.
                    // Instead, report failure so the UI can "Reset" and try again.
                    console.warn(`[FileSystem] .move() failed for ${oldName}:`, moveErr);
                    
                    // Specific handling for common "locked" or "busy" errors
                    if (moveErr.name === 'InvalidStateError' || moveErr.name === 'NoModificationAllowedError') {
                        return false; 
                    }
                }
            }

            // 2. Fallback: Recursive Copy and Delete (Only if .move truly isn't supported)
            // But first, verify if we just need to re-fetch the parent handle (stale handle fix)
            console.log(`[FileSystem] Triggering recursive copy fallback from ${oldName} to ${newName}`);
            const newHandle = await parentHandle.getDirectoryHandle(newName, { create: true });

            await this.copyDirectoryContents(oldHandle, newHandle);

            // Delete old
            await (parentHandle as any).removeEntry(oldName, { recursive: true });
            return true;
        } catch (err) {
            console.error(`[FileSystem] Failed to rename folder from ${oldName} to ${newName}:`, err);
            return false;
        }
    }

    /**
     * Recursively copies all entries from one directory handle to another.
     */
    async copyDirectoryContents(src: FileSystemDirectoryHandle, dest: FileSystemDirectoryHandle): Promise<void> {
        for await (const entry of (src as any).values()) {
            if (entry.kind === 'file') {
                const fileHandle = entry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                const destFileHandle = await dest.getFileHandle(entry.name, { create: true });
                const writable = await (destFileHandle as any).createWritable();
                await writable.write(file);
                await writable.close();
            } else if (entry.kind === 'directory') {
                const destDirHandle = await dest.getDirectoryHandle(entry.name, { create: true });
                await this.copyDirectoryContents(entry as FileSystemDirectoryHandle, destDirHandle);
            }
        }
    }

    /**
     * Retrieves all workspace folders currently existing in the Quilix root.
     * Used for scanning external renames.
     */
    async getAllWorkspaceFolders(): Promise<FileSystemDirectoryHandle[]> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return [];

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            const folders: FileSystemDirectoryHandle[] = [];
            for await (const entry of (quilixRoot as any).values()) {
                if (entry.kind === 'directory') {
                    folders.push(entry);
                }
            }
            return folders;
        } catch (err) {
            console.error('[FileSystem] Could not iterate Quilix root for workspaces:', err);
            return [];
        }
    }

    /**
     * Retrieves all subfolders (spaces) within a specific workspace folder.
     */
    async getAllSpaceFolders(workspaceFolderName: string): Promise<FileSystemDirectoryHandle[]> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return [];

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            const wsHandle = await quilixRoot.getDirectoryHandle(workspaceFolderName, { create: false });
            const folders: FileSystemDirectoryHandle[] = [];
            for await (const entry of (wsHandle as any).values()) {
                if (entry.kind === 'directory') {
                    folders.push(entry);
                }
            }
            return folders;
        } catch (err) {
            // If it can't find the workspace, just return empty
            return [];
        }
    }

    /**
     * Disable filesystem mode and clear handle.
     */
    async disableFileSystem(): Promise<void> {
        await db.settings.delete('fileSystemHandle');
        await db.settings.put({ key: 'storageMode', value: 'indexeddb' });
        this.hasPermission.set(false);
    }

    /**
     * Get current storage mode.
     */
    async getStorageMode(): Promise<'indexeddb' | 'filesystem'> {
        const setting = await db.settings.get('storageMode');
        return setting ? setting.value : 'indexeddb';
    }

    /**
     * Check if a workspace folder exists on disk.
     * Returns false if permission is not granted (avoids false "missing" state).
     */
    async checkFolderExists(workspaceName: string): Promise<boolean | 'no-permission'> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return 'no-permission';

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            await quilixRoot.getDirectoryHandle(workspaceName, { create: false });
            return true;
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                return false;
            }
            // Any other error (SecurityError, etc.) = treat as permission issue
            console.error(`[FileSystem] Error checking folder for ${workspaceName}:`, err);
            return 'no-permission';
        }
    }

    /**
     * Restore a missing workspace folder on disk and write back its ID so it isn't orphaned.
     */
    async restoreWorkspaceFolder(workspaceName: string, id: string): Promise<boolean> {
        const handle = await this.getOrCreateWorkspaceFolder(workspaceName);
        if (handle) {
            await this.writeDirectoryId(handle, id);
            return true;
        }
        return false;
    }

    /**
     * Restore a missing space folder inside a workspace.
     */
    async restoreSpaceFolder(workspaceName: string, spaceFolderName: string, id: string): Promise<boolean> {
        const wsHandle = await this.getOrCreateWorkspaceFolder(workspaceName);
        if (!wsHandle) return false;

        try {
            const spaceHandle = await wsHandle.getDirectoryHandle(spaceFolderName, { create: true });
            await this.writeDirectoryId(spaceHandle, id);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Recursively calculate the size of a directory in bytes.
     */
    async calculateDirectorySize(dirHandle: FileSystemDirectoryHandle): Promise<number> {
        let size = 0;
        try {
            for await (const entry of (dirHandle as any).values()) {
                if (entry.kind === 'file') {
                    const file = await (entry as FileSystemFileHandle).getFile();
                    size += file.size;
                } else if (entry.kind === 'directory') {
                    size += await this.calculateDirectorySize(entry as FileSystemDirectoryHandle);
                }
            }
        } catch (err) {
            console.warn(`[FileSystem] Could not calculate size for ${dirHandle.name}`, err);
        }
        return size;
    }

    /**
     * Get the total physical byte size of a workspace directory.
     */
    async getWorkspaceFolderSize(workspaceName: string): Promise<number> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return 0;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            const wsHandle = await quilixRoot.getDirectoryHandle(workspaceName, { create: false });
            return await this.calculateDirectorySize(wsHandle);
        } catch {
            return 0; // Folder missing, return 0
        }
    }

    /**
     * LASER SYNC: Find a directory handle by its internal ID marker.
     * This only scans immediate children, making it extremely fast O(N) where N is folder count,
     * not total files size.
     */
    async findHandleByInternalId(parentHandle: FileSystemDirectoryHandle, targetId: string): Promise<FileSystemDirectoryHandle | null> {
        try {
            for await (const entry of (parentHandle as any).values()) {
                if (entry.kind === 'directory') {
                    const id = await this.readDirectoryId(entry as FileSystemDirectoryHandle);
                    if (id === targetId) return entry as FileSystemDirectoryHandle;
                }
            }
        } catch (err) {
            console.warn('[FileSystem] Laser discovery failed:', err);
        }
        return null;
    }

    /**
     * Re-resolve a space handle by searching for its ID inside the workspace folder.
     */
    async resolveSpaceHandle(workspaceName: string, spaceId: string): Promise<FileSystemDirectoryHandle | null> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return null;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            const wsHandle = await quilixRoot.getDirectoryHandle(workspaceName, { create: false });
            return await this.findHandleByInternalId(wsHandle, spaceId);
        } catch {
            return null;
        }
    }

    /**
     * Re-resolve a workspace handle by searching for its ID in the Quilix root.
     */
    async resolveWorkspaceHandle(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
        const rootHandle = await this.ensurePermittedHandle();
        if (!rootHandle) return null;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            return await this.findHandleByInternalId(quilixRoot, workspaceId);
        } catch {
            return null;
        }
    }
}
