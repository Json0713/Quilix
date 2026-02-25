import { Injectable, signal } from '@angular/core';
import { db } from '../db/app-db';

@Injectable({
    providedIn: 'root',
})
export class FileSystemService {
    private readonly QUILIX_ROOT = 'Quilix';

    /**
     * Reactive permission state.
     * Components can read this to show re-auth UI when permission is lost.
     */
    readonly hasPermission = signal<boolean>(false);

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
    private async testHandleAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
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
     * Restore a missing workspace folder on disk.
     */
    async restoreFolder(workspaceName: string): Promise<boolean> {
        const handle = await this.getOrCreateWorkspaceFolder(workspaceName);
        return handle !== null;
    }
}
