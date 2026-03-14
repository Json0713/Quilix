import { Injectable, signal } from '@angular/core';

export interface FileExplorerEntry {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    sizeBytes?: number;
    lastModified?: number;
}

export interface ClipboardItem {
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    action: 'copy' | 'cut';
}

@Injectable({
    providedIn: 'root'
})
export class FileManagerService {
    
    // Global clipboard state for files
    clipboard = signal<ClipboardItem | null>(null);

    /**
     * Reads the contents of a directory natively, returning an array of raw entries.
     * We don't save these to Dexie.
     */
    async readDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileExplorerEntry[]> {
        const entries: FileExplorerEntry[] = [];
        try {
            for await (const entry of (dirHandle as any).values()) {
                // Ignore internal quilix tracking files
                if (entry.name.startsWith('.quilix')) continue;

                let sizeBytes = undefined;
                let lastModified = undefined;

                if (entry.kind === 'file') {
                    try {
                        const file = await (entry as FileSystemFileHandle).getFile();
                        sizeBytes = file.size;
                        lastModified = file.lastModified;
                    } catch (e) {
                         // File might be locked by OS
                    }
                }

                entries.push({
                    name: entry.name,
                    kind: entry.kind,
                    handle: entry,
                    sizeBytes,
                    lastModified
                });
            }
        } catch (error) {
            console.error('[FileManager] Error reading directory stream:', error);
            throw error;
        }

        // Sort: Directories first, then alphabetically
        return entries.sort((a, b) => {
            if (a.kind === b.kind) {
                return a.name.localeCompare(b.name);
            }
            return a.kind === 'directory' ? -1 : 1;
        });
    }

    /**
     * Creates a physical sub-folder
     */
    async createFolder(parentHandle: FileSystemDirectoryHandle, folderName: string): Promise<FileSystemDirectoryHandle> {
        const uniqueName = await this.resolveUniqueName(parentHandle, folderName, true);
        return await parentHandle.getDirectoryHandle(uniqueName, { create: true });
    }

    /**
     * Creates a physical empty file
     */
    async createFile(parentHandle: FileSystemDirectoryHandle, fileName: string): Promise<FileSystemFileHandle> {
        const uniqueName = await this.resolveUniqueName(parentHandle, fileName, false);
        return await parentHandle.getFileHandle(uniqueName, { create: true });
    }

    /**
     * Safely deletes a file or directory permanently using the OS
     */
    async deleteEntry(parentHandle: FileSystemDirectoryHandle, entry: FileExplorerEntry): Promise<void> {
        await (parentHandle as any).removeEntry(entry.name, { recursive: entry.kind === 'directory' });
    }

    /**
     * Renames a specific file (instantaneous using modern standard API)
     * Throws if standard move is not supported.
     */
    async renameFile(fileHandle: FileSystemFileHandle, newName: string): Promise<boolean> {
        if ('move' in fileHandle) {
             await (fileHandle as any).move(newName);
             return true;
        }
        return false; // We can't safely rename without stream copy in standard Chrome yet if move is missing
    }

    /**
     * Moves a file instantly from one directory to another
     */
    async moveFileInstant(fileHandle: FileSystemFileHandle, destinationDirHandle: FileSystemDirectoryHandle, newName?: string): Promise<boolean> {
        if ('move' in fileHandle) {
             if (newName) {
                 await (fileHandle as any).move(destinationDirHandle, newName);
             } else {
                 await (fileHandle as any).move(destinationDirHandle);
             }
             return true;
        }
        return false;
    }

    /**
     * Performs a stream copy of a file if we can't 'move' it
     */
    async copyFileStream(sourceHandle: FileSystemFileHandle, destDirHandle: FileSystemDirectoryHandle, newName?: string): Promise<void> {
        const file = await sourceHandle.getFile();
        const finalName = newName || sourceHandle.name;
        const destFileHandle = await destDirHandle.getFileHandle(finalName, { create: true });
        
        const writable = await (destFileHandle as any).createWritable();
        await writable.write(file);
        await writable.close();
    }

    /**
     * Set the clipboard contents
     */
    setClipboard(handle: FileSystemFileHandle | FileSystemDirectoryHandle, action: 'copy' | 'cut') {
        this.clipboard.set({ handle, action });
    }

    /**
     * Clear clipboard
     */
    clearClipboard() {
        this.clipboard.set(null);
    }

    /**
     * Core resolution logic for duplicating names cleanly like "New folder (2)"
     */
    private async resolveUniqueName(parentHandle: FileSystemDirectoryHandle, baseName: string, isDirectory: boolean): Promise<string> {
        const nameExists = async (testName: string) => {
            try {
                if (isDirectory) {
                    await parentHandle.getDirectoryHandle(testName, { create: false });
                } else {
                    await parentHandle.getFileHandle(testName, { create: false });
                }
                return true;
            } catch (e: any) {
                if (e.name === 'NotFoundError') return false;
                // TypeMismatchError means a file exists with the directory name, or vice versa. It still collides!
                return true; 
            }
        };

        if (!(await nameExists(baseName))) {
            return baseName;
        }

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
            if (!(await nameExists(testName))) {
                return testName;
            }
            counter++;
        }
    }

    /**
     * Execute a paste operation into a target directory
     */
    async paste(targetDirHandle: FileSystemDirectoryHandle): Promise<boolean> {
        const item = this.clipboard();
        if (!item) return false;

        try {
            if (item.handle.kind === 'file') {
                const fHandle = item.handle as FileSystemFileHandle;
                
                if (item.action === 'cut') {
                    // Try instant modern move!
                    const moved = await this.moveFileInstant(fHandle, targetDirHandle);
                    if (!moved) {
                        // Fallback: Copy stream, then we'd need to delete the source... 
                        // But since we don't have the parent handle of the source easily here,
                        // cut->paste falling back to copy stream leaves the original.
                        // For a PWA, instant move via 'cut' relies purely on modern APIs.
                        await this.copyFileStream(fHandle, targetDirHandle);
                    }
                } else {
                    // Standard copy stream using robust name incrementing to avoid collision exceptions
                    const targetName = await this.resolveUniqueName(targetDirHandle, fHandle.name, false);
                    await this.copyFileStream(fHandle, targetDirHandle, targetName);
                }
            } else {
                 // Directory copy/paste logic is extremely complex and slow, we skip it for V1
                 // Or we could implement deep recursive copy here later.
                 console.warn('[FileManager] Directory pasting is not supported in V1 PWA constraints yet.');
                 return false;
            }

            // If it was a cut, clear the clipboard after successful execution
            if (item.action === 'cut') {
                this.clearClipboard();
            }

            return true;
        } catch (err) {
            console.error('[FileManager] Paste operation failed:', err);
            return false;
        }
    }
}
