import { Injectable } from '@angular/core';
import { db } from '../db/app-db';

@Injectable({
    providedIn: 'root',
})
export class FileSystemService {
    private readonly QUILIX_ROOT = 'Quilix';

    /**
     * Check if the File System Access API is supported in the current environment.
     */
    isSupported(): boolean {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Request access to a directory and store the handle in IndexedDB.
     */
    async requestDirectoryAccess(): Promise<boolean> {
        if (!this.isSupported()) return false;

        try {
            const handle = await (window as any).showDirectoryPicker();
            await db.settings.put({ key: 'fileSystemHandle', value: handle });
            await db.settings.put({ key: 'storageMode', value: 'filesystem' });

            // Ensure Quilix root folder exists
            await this.getOrCreateDirectory(handle, this.QUILIX_ROOT);

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
        const setting = await db.settings.get('fileSystemHandle');
        return setting ? setting.value : null;
    }

    /**
     * Check and request permission for the stored handle.
     */
    async verifyPermission(handle: FileSystemDirectoryHandle, readWrite = true, withRequest = true): Promise<boolean> {
        const options: any = { mode: readWrite ? 'readwrite' : 'read' };

        // Check if permission is already granted
        if ((await (handle as any).queryPermission(options)) === 'granted') {
            return true;
        }

        if (!withRequest) {
            return false; // Do not trigger an error on load without user gesture
        }

        // Request permission (must be triggered by a user gesture generally)
        if ((await (handle as any).requestPermission(options)) === 'granted') {
            return true;
        }

        return false;
    }

    /**
     * Delete a workspace folder permanently from local disk.
     */
    async permanentlyDeleteWorkspaceFolder(workspaceName: string): Promise<boolean> {
        const rootHandle = await this.getStoredHandle();
        if (!rootHandle) return false;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            // removeEntry is supported in File System Access API
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
        const rootHandle = await this.getStoredHandle();
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
     * Disable filesystem mode and clear handle.
     */
    async disableFileSystem(): Promise<void> {
        await db.settings.delete('fileSystemHandle');
        await db.settings.put({ key: 'storageMode', value: 'indexeddb' });
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
     */
    async checkFolderExists(workspaceName: string): Promise<boolean> {
        const rootHandle = await this.getStoredHandle();
        if (!rootHandle) return false;

        try {
            const quilixRoot = await rootHandle.getDirectoryHandle(this.QUILIX_ROOT, { create: false });
            await quilixRoot.getDirectoryHandle(workspaceName, { create: false });
            return true;
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                return false;
            }
            console.error(`[FileSystem] Error checking folder for ${workspaceName}:`, err);
            return false;
        }
    }

    /**
     * Restore a missing workspace folder on disk.
     */
    async restoreFolder(workspaceName: string): Promise<boolean> {
        const handle = await this.getOrCreateWorkspaceFolder(workspaceName);
        return handle !== null;
    }
}
