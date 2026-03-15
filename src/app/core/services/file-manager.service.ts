import { Injectable, inject, signal } from '@angular/core';
import { db } from '../db/app-db';
import { FileSystemService } from './file-system.service';

export interface FileExplorerEntry {
    id?: string; // For Virtual mode
    name: string;
    kind: 'file' | 'directory';
    handle?: FileSystemFileHandle | FileSystemDirectoryHandle; // For Native mode
    sizeBytes?: number;
    lastModified?: number;
    parentId?: string | null;
}

export interface ClipboardItem {
    entry: FileExplorerEntry;
    action: 'copy' | 'cut';
}

@Injectable({
    providedIn: 'root'
})
export class FileManagerService {
    private fileSystem = inject(FileSystemService);

    // Global clipboard state for files
    clipboard = signal<ClipboardItem | null>(null);

    /**
     * Polymorphic Directory Reader
     */
    async readDirectory(context: { handle?: FileSystemDirectoryHandle, spaceId: string, parentId: string | null }): Promise<FileExplorerEntry[]> {
        const mode = await this.fileSystem.getStorageMode();

        if (mode === 'filesystem' && context.handle) {
            return this.readNativeDirectory(context.handle);
        } else {
            return this.readVirtualDirectory(context.spaceId, context.parentId);
        }
    }

    private async readNativeDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileExplorerEntry[]> {
        const entries: FileExplorerEntry[] = [];
        for await (const entry of (dirHandle as any).values()) {
            if (entry.name.startsWith('.quilix')) continue;
            let sizeBytes = undefined;
            let lastModified = undefined;
            let id = undefined;

            if (entry.kind === 'file') {
                try {
                    const file = await (entry as FileSystemFileHandle).getFile();
                    sizeBytes = file.size;
                    lastModified = file.lastModified;
                } catch (e) { }
            } else if (entry.kind === 'directory') {
                // Proactively read ID for directories to support reactive re-linking
                // Also fetch the .quilix-id file's metadata to use as a proxy for the folder's mod date
                const res = await this.fileSystem.readDirectoryId(entry as FileSystemDirectoryHandle);
                id = res?.id || undefined;
                if (res) lastModified = res.lastModified;

                // SELF-HEALING: If a directory lacks an ID, it was likely created via OS. 
                // Assign one now so it becomes a tracked "Space" or Sub-space.
                if (!id) {
                    id = crypto.randomUUID();
                    console.log(`[FileManager] Self-healing directory: Anchoring ID ${id} to "${entry.name}"`);
                    await this.fileSystem.writeDirectoryId(entry as FileSystemDirectoryHandle, id);
                    lastModified = Date.now(); // Newly self-healed, use current time
                }
            }

            entries.push({
                name: entry.name,
                kind: entry.kind,
                handle: entry,
                id,
                sizeBytes,
                lastModified
            });
        }
        return this.sortEntries(entries);
    }

    private async readVirtualDirectory(spaceId: string, parentId: string | null): Promise<FileExplorerEntry[]> {
        const items = await db.virtual_entries
            .where('[spaceId+parentId]')
            .equals([spaceId, parentId || 'root'])
            .toArray();

        return this.sortEntries(items.map(i => ({
            id: i.id,
            name: i.name,
            kind: i.kind,
            sizeBytes: i.sizeBytes,
            lastModified: i.lastModified,
            parentId: i.parentId === 'root' ? null : i.parentId
        })));
    }

    private sortEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
        return entries.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    }

    /**
     * Polymorphic Create Folder
     */
    async createFolder(context: { parentHandle?: FileSystemDirectoryHandle, workspaceId: string, spaceId: string, parentId: string | null }, name: string): Promise<FileExplorerEntry> {
        const mode = await this.fileSystem.getStorageMode();
        const uniqueName = await this.resolveUniqueName(context, name, true);

        if (mode === 'filesystem' && context.parentHandle) {
            const handle = await context.parentHandle.getDirectoryHandle(uniqueName, { create: true });

            // ANCHOR: Assign a permanent unique ID so this folder is tracked even if moved/renamed via OS
            const id = crypto.randomUUID();
            await this.fileSystem.writeDirectoryId(handle, id);

            return { id, name: uniqueName, kind: 'directory', handle, lastModified: Date.now() };
        } else {
            const id = crypto.randomUUID();
            const entry = {
                id,
                workspaceId: context.workspaceId,
                spaceId: context.spaceId,
                parentId: context.parentId || 'root',
                name: uniqueName,
                kind: 'directory',
                lastModified: Date.now()
            };
            await db.virtual_entries.add(entry);
            return { id, name: uniqueName, kind: 'directory', parentId: context.parentId };
        }
    }

    /**
     * Polymorphic Create File
     */
    async createFile(context: { parentHandle?: FileSystemDirectoryHandle, workspaceId: string, spaceId: string, parentId: string | null }, name: string): Promise<FileExplorerEntry> {
        const mode = await this.fileSystem.getStorageMode();
        const uniqueName = await this.resolveUniqueName(context, name, false);

        if (mode === 'filesystem' && context.parentHandle) {
            const handle = await context.parentHandle.getFileHandle(uniqueName, { create: true });
            return { name: uniqueName, kind: 'file', handle, lastModified: Date.now(), sizeBytes: 0 };
        } else {
            const id = crypto.randomUUID();
            const entry = {
                id,
                workspaceId: context.workspaceId,
                spaceId: context.spaceId,
                parentId: context.parentId || 'root',
                name: uniqueName,
                kind: 'file',
                sizeBytes: 0,
                lastModified: Date.now(),
                content: new Blob([''], { type: 'text/plain' })
            };
            await db.virtual_entries.add(entry);
            return { id, name: uniqueName, kind: 'file', parentId: context.parentId };
        }
    }

    /**
     * Polymorphic Delete
     */
    async deleteEntry(context: { parentHandle?: FileSystemDirectoryHandle }, entry: FileExplorerEntry): Promise<void> {
        const mode = await this.fileSystem.getStorageMode();

        if (mode === 'filesystem' && context.parentHandle && entry.handle) {
            await (context.parentHandle as any).removeEntry(entry.name, { recursive: entry.kind === 'directory' });
        } else if (entry.id) {
            await db.transaction('rw', db.virtual_entries, async () => {
                if (entry.kind === 'directory') {
                    await this.deleteVirtualDirectoryRecursive(entry.id!);
                }
                await db.virtual_entries.delete(entry.id!);
            });
        }
    }

    private async deleteVirtualDirectoryRecursive(parentId: string) {
        const children = await db.virtual_entries.where('parentId').equals(parentId).toArray();
        for (const child of children) {
            if (child.kind === 'directory') {
                await this.deleteVirtualDirectoryRecursive(child.id);
            }
            await db.virtual_entries.delete(child.id);
        }
    }

    /**
     * Polymorphic Rename
     */
    async renameEntry(context: { spaceId: string, parentId: string | null, parentHandle?: FileSystemDirectoryHandle }, entry: FileExplorerEntry, newName: string): Promise<boolean> {
        if (!newName || newName === entry.name) return false;

        // RESOLVE CONFLICTS: If the target name exists, auto-number it (e.g., "Folder (2)")
        // This ensures a "Standard" experience and prevents collision errors on physical disk
        const resolvedName = await this.resolveUniqueName(
            { parentHandle: context.parentHandle, spaceId: context.spaceId, parentId: context.parentId },
            newName,
            entry.kind === 'directory'
        );

        const mode = await this.fileSystem.getStorageMode();

        if (mode === 'filesystem' && entry.handle) {
            if (!context.parentHandle) return false;
            // Native Move (Internal move() or fallback copy-delete)
            const renamed = await this.fileSystem.safeRenameFolder(context.parentHandle, entry.name, resolvedName);
            return renamed;
        } else if (entry.id) {
            await db.virtual_entries.update(entry.id, { name: resolvedName, lastModified: Date.now() });
            return true;
        }
        return false;
    }

    setClipboard(entry: FileExplorerEntry, action: 'copy' | 'cut') {
        this.clipboard.set({ entry, action });
    }

    clearClipboard() {
        this.clipboard.set(null);
    }

    async paste(context: { handle?: FileSystemDirectoryHandle, workspaceId: string, spaceId: string, parentId: string | null }): Promise<boolean> {
        const item = this.clipboard();
        if (!item) return false;

        const mode = await this.fileSystem.getStorageMode();

        try {
            if (mode === 'filesystem' && context.handle && item.entry.handle) {
                // Native Paste Logic (truncated for brevity, similar to existing)
                if (item.entry.kind === 'file') {
                    const fHandle = item.entry.handle as FileSystemFileHandle;
                    const uniqueName = await this.resolveUniqueName(context, fHandle.name, false);
                    const destHandle = await context.handle.getFileHandle(uniqueName, { create: true });
                    const file = await fHandle.getFile();
                    const writable = await (destHandle as any).createWritable();
                    await writable.write(file);
                    await writable.close();
                    if (item.action === 'cut') this.clearClipboard();
                    return true;
                }
                console.warn('[FileManager] Directory pasting not supported in Native mode yet.');
                return false;
            } else if (item.entry.id) {
                // Virtual Paste Logic
                const uniqueName = await this.resolveUniqueName(context, item.entry.name, item.entry.kind === 'directory');
                if (item.action === 'cut') {
                    await db.virtual_entries.update(item.entry.id, {
                        parentId: context.parentId || 'root',
                        name: uniqueName,
                        lastModified: Date.now()
                    });
                    this.clearClipboard();
                } else {
                    await this.copyVirtualEntry(item.entry.id, context.workspaceId, context.spaceId, context.parentId || 'root', uniqueName);
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('[FileManager] Paste failed:', err);
            return false;
        }
    }

    private async copyVirtualEntry(sourceId: string, workspaceId: string, spaceId: string, parentId: string, newName: string) {
        const source = await db.virtual_entries.get(sourceId);
        if (!source) return;

        const newId = crypto.randomUUID();
        const clone = { ...source, id: newId, workspaceId, spaceId, parentId, name: newName, lastModified: Date.now() };
        await db.virtual_entries.add(clone);

        if (source.kind === 'directory') {
            const children = await db.virtual_entries.where('parentId').equals(sourceId).toArray();
            for (const child of children) {
                await this.copyVirtualEntry(child.id, workspaceId, spaceId, newId, child.name);
            }
        }
    }

    private async resolveUniqueName(context: { parentHandle?: FileSystemDirectoryHandle, spaceId: string, parentId: string | null }, baseName: string, isDirectory: boolean): Promise<string> {
        const mode = await this.fileSystem.getStorageMode();

        const nameExists = async (testName: string) => {
            if (mode === 'filesystem' && context.parentHandle) {
                try {
                    if (isDirectory) await context.parentHandle.getDirectoryHandle(testName, { create: false });
                    else await context.parentHandle.getFileHandle(testName, { create: false });
                    return true;
                } catch { return false; }
            } else {
                const count = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([context.spaceId, context.parentId || 'root', testName])
                    .count();
                return count > 0;
            }
        };

        if (!(await nameExists(baseName))) return baseName;

        let name = baseName;
        let ext = '';
        if (!isDirectory) {
            const lastDot = baseName.lastIndexOf('.');
            if (lastDot > 0 && lastDot < baseName.length - 1) {
                name = baseName.substring(0, lastDot);
                ext = baseName.substring(lastDot);
            }
        }

        let counter = 2;
        while (true) {
            const testName = `${name} (${counter})${ext}`;
            if (!(await nameExists(testName))) return testName;
            counter++;
        }
    }
}
