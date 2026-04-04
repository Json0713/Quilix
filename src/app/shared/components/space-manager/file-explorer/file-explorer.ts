import { Component, Input, OnInit, signal, computed, HostListener, inject, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileExplorerEntry, FileManagerService } from '../../../../core/services/components/file-manager.service';
import { FileSystemService } from '../../../../core/services/data/file-system.service';
import { SnackbarService } from '../../../../services/ui/common/snackbar/snackbar.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { db } from '../../../../core/database/dexie.service';
import { Space } from '../../../../core/interfaces/space';
import { SpaceService } from '../../../../core/services/components/space.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-file-explorer',
    standalone: true,
    imports: [CommonModule, FormsModule, DatePipe],
    templateUrl: './file-explorer.html',
    styleUrl: './file-explorer.scss'
})
export class FileExplorerComponent implements OnInit, OnDestroy {
    private fileManager = inject(FileManagerService);
    private fileSystem = inject(FileSystemService);
    private spaceService = inject(SpaceService);
    private snackbar = inject(SnackbarService);
    private router = inject(Router);
    readonly modals = inject(ModalService);

    private spaceSub?: any;

    @Input({ required: true }) spaceId!: string;
    @Input({ required: true }) workspaceId!: string;
    @Input() rootHandle: FileSystemDirectoryHandle | null = null;
    @Input() spaceName: string = 'Space';
    reactiveSpaceName = signal<string>('Space');
    @Output() breadcrumbsChanged = new EventEmitter<any[]>();

    // Navigation History (Breadcrumbs map to polymorphic Nodes)
    history = signal<{ name: string, handle?: FileSystemDirectoryHandle, id?: string, parentHandle?: FileSystemDirectoryHandle }[]>([]);
    forwardHistory = signal<{ name: string, handle?: FileSystemDirectoryHandle, id?: string, parentHandle?: FileSystemDirectoryHandle }[]>([]);

    currentNode = computed(() => {
        const hist = this.history();
        return hist.length > 0 ? hist[hist.length - 1] : { name: this.reactiveSpaceName(), handle: this.rootHandle || undefined, id: undefined };
    });

    entries = signal<FileExplorerEntry[]>([]);
    isLoading = signal<boolean>(true);

    // Search State
    searchQuery = signal<string>('');
    searchResults = signal<FileExplorerEntry[]>([]);
    isSearching = signal<boolean>(false);
    isSearchExpanded = signal<boolean>(false); // Mobile toggle

    // Responsive State
    isToolbarCollapsed = signal<boolean>(false);

    // View and Sorting state
    viewMode = signal<'grid' | 'list'>('grid');
    sortBy = signal<'name' | 'date' | 'size'>('name');
    sortAscending = signal<boolean>(true);

    // Context Menu State
    openMenuId = signal<string | null>(null);
    contextMenuX = signal<number>(0);
    contextMenuY = signal<number>(0);

    // Selection
    selectedEntry = signal<FileExplorerEntry | null>(null);

    // Rename state
    renamingEntry = signal<FileExplorerEntry | null>(null);
    renameValue = signal<string>('');

    // New folder/file state
    isCreatingFolder = signal<boolean>(false);
    isCreatingFile = signal<boolean>(false);
    newItemName = signal<string>('');

    // Global clipboard state exposed for UI
    clipboardHasItem = computed(() => this.fileManager.clipboard() !== null);

    constructor() { }

    ngOnInit() {
        this.reactiveSpaceName.set(this.spaceName);
        this.monitorSpaceDetails();

        this.history.set([{
            name: this.reactiveSpaceName(),
            handle: this.rootHandle || undefined,
            id: undefined // Space root is always 'root' in virtual engine
        }]);
        this.emitBreadcrumbs();
        this.loadCurrentDirectory();
        this.checkToolbarResponsive();
    }

    ngOnDestroy() {
        if (this.spaceSub) this.spaceSub.unsubscribe();
    }

    private monitorSpaceDetails() {
        this.spaceSub = this.spaceService.liveSpaceAnyStatus$(this.spaceId).subscribe(space => {
            if (space && space.name !== this.reactiveSpaceName()) {
                this.reactiveSpaceName.set(space.name);
                this.emitBreadcrumbs(); // Header breadcrumbs should update if space is renamed
            }
        });
    }

    private emitBreadcrumbs() {
        const hist = this.history();
        const breadcrumbs = hist.map((node, index) => {
            let label = node.name;
            if (index === 0) label = this.reactiveSpaceName();
            return {
                label: label,
                isLast: index === hist.length - 1
            };
        });
        this.breadcrumbsChanged.emit(breadcrumbs);
    }

    // Derived sorted entries
    sortedEntries = computed(() => {
        const raw = this.searchQuery() ? this.searchResults() : this.entries();
        const asc = this.sortAscending() ? 1 : -1;
        const sortBy = this.sortBy();

        return [...raw].sort((a, b) => {
            // ALWAYS put folders first, regardless of sort criteria
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }

            if (sortBy === 'name') {
                return a.name.localeCompare(b.name) * asc;
            } else if (sortBy === 'size') {
                const sizeA = a.sizeBytes ?? 0;
                const sizeB = b.sizeBytes ?? 0;
                return (sizeA - sizeB) * asc;
            } else if (sortBy === 'date') {
                const dateA = a.lastModified ?? 0;
                const dateB = b.lastModified ?? 0;
                return (dateA - dateB) * asc;
            }
            return 0;
        });
    });

    @HostListener('document:click')
    closeMenus() {
        this.openMenuId.set(null);
    }

    @HostListener('window:resize')
    onResize() {
        this.checkToolbarResponsive();
    }

    private checkToolbarResponsive() {
        // Threshold for collapsing breadcrumbs and showing mobile search toggle
        this.isToolbarCollapsed.set(window.innerWidth < 770);
    }

    @HostListener('window:focus')
    onWindowFocus() {
        // Refresh directory silently
        if (!this.renamingEntry() && !this.isCreatingFolder() && !this.isCreatingFile() && !this.searchQuery()) {
            this.loadCurrentDirectory(false);
        }
    }

    async loadCurrentDirectory(showLoader = true): Promise<void> {
        if (showLoader) this.isLoading.set(true);
        try {
            const node = this.currentNode();

            // If we are in filesystem mode and have a handle, verify it
            if (node.handle) {
                const hasPerm = await this.fileSystem.verifyPermission(node.handle, true, false);
                if (!hasPerm) {
                    console.warn('[FileExplorer] Permission lost for current directory');
                    return;
                }
            }

            const newEntries = await this.fileManager.readDirectory({
                handle: node.handle,
                spaceId: this.spaceId,
                parentId: node.id || null
            });

            this.entries.set(newEntries);

            // Clear selection if it doesn't exist anymore
            const currentSelected = this.selectedEntry();
            if (currentSelected && !newEntries.find(e =>
                (e.id && e.id === currentSelected.id) ||
                (e.handle && e.handle === currentSelected.handle) ||
                (!e.id && !e.handle && e.name === currentSelected.name)
            )) {
                this.selectedEntry.set(null);
            }

            // BACKGROUND: Trigger a size sweep for subfolders to populate the List View columns asynchronously
            this.triggerSizeSweep();
        } catch (err: any) {
            if (err.name === 'NotFoundError') {
                console.warn('[FileExplorer] Handle lost, attempting reactive re-link...');
                const recovered = await this.reResolveStaleHandle();
                if (recovered) {
                    // Try loading again with the new handle
                    return this.loadCurrentDirectory(false);
                }
            }
            console.error('[FileExplorer] Failed to load directory:', err);
            this.snackbar.error('Could not read folder contents.', undefined, {
                label: 'Refresh',
                callback: () => window.location.reload()
            });
        } finally {
            this.isLoading.set(false);
        }
    }

    private currentSweepId = 0;
    /**
     * Iterate through all directory entries and asynchronously calculate their recursive sizes.
     * This ensures the List View "Size" column populates without blocking the main directory load.
     */
    private async triggerSizeSweep() {
        this.currentSweepId++;
        const sweepId = this.currentSweepId;
        const folders = this.entries().filter(e => e.kind === 'directory' && e.handle);

        for (const folder of folders) {
            // Run calculations in parallel-ish (using .then to not block the loop)
            this.fileSystem.calculateDirectorySize(folder.handle as FileSystemDirectoryHandle).then(size => {
                // Check if context is still valid (user hasn't navigated)
                if (this.currentSweepId !== sweepId) return;

                this.entries.update(entries => {
                    const updated = [...entries];
                    const target = updated.find(e => e.name === folder.name && e.kind === 'directory');
                    if (target) {
                        target.sizeBytes = size;
                    }
                    return updated;
                });
            });
        }
    }

    // --- Search Logic ---

    async onSearch() {
        const query = this.searchQuery().trim();
        if (!query) {
            this.searchResults.set([]);
            return;
        }

        this.isSearching.set(true);
        try {
            const results = await this.fileManager.searchEntries({
                handle: this.rootHandle || undefined,
                spaceId: this.spaceId
            }, query);
            this.searchResults.set(results);
        } catch (err) {
            console.error('[FileExplorer] Search failed:', err);
            this.snackbar.error('Search failed.');
        } finally {
            this.isSearching.set(false);
        }
    }

    clearSearch() {
        this.searchQuery.set('');
        this.searchResults.set([]);
        this.isSearchExpanded.set(false);
    }

    toggleSearchExpanded() {
        this.isSearchExpanded.set(!this.isSearchExpanded());
    }

    // --- Utilities & State Management ---

    async navigateInto(entry: FileExplorerEntry) {
        if (entry.kind === 'directory') {
            this.history.update(h => [...h, {
                name: entry.name,
                handle: entry.handle as FileSystemDirectoryHandle,
                id: entry.id, // Now captured in native mode as well
                parentHandle: this.currentNode().handle // Track parent for faster re-linking
            }]);
            this.forwardHistory.set([]); // Clear forward stack on new branching path
            this.selectedEntry.set(null);
            this.openMenuId.set(null);
            if (this.searchQuery()) this.clearSearch();
            await this.loadCurrentDirectory();
            this.emitBreadcrumbs();
        } else {
            // It's a file, try to open it natively?
            this.snackbar.info(`File preview coming soon. (${entry.name})`);
        }
    }

    async navigateBack() {
        const hist = [...this.history()];
        if (hist.length > 1) {
            const popped = hist.pop()!;
            this.history.set(hist);
            this.forwardHistory.update(f => [...f, popped]);
            this.selectedEntry.set(null);
            this.openMenuId.set(null);
            if (this.searchQuery()) this.clearSearch();
            await this.loadCurrentDirectory();
            this.emitBreadcrumbs();
        }
    }

    async navigateForward() {
        const fHist = [...this.forwardHistory()];
        if (fHist.length > 0) {
            const popped = fHist.pop()!;
            this.forwardHistory.set(fHist);
            this.history.update(h => [...h, popped]);
            this.selectedEntry.set(null);
            this.openMenuId.set(null);
            if (this.searchQuery()) this.clearSearch();
            await this.loadCurrentDirectory();
            this.emitBreadcrumbs();
        }
    }

    public async navigateToCrumb(index: number) {
        const hist = [...this.history()];
        if (index >= 0 && index < hist.length - 1) {
            const removed = hist.splice(index + 1); // Everything after the chosen crumb index
            this.history.set(hist);
            this.forwardHistory.set(removed.reverse()); // Flip order so the immediate next folder is top of forward stack
            this.selectedEntry.set(null);
            this.openMenuId.set(null);
            if (this.searchQuery()) this.clearSearch();
            await this.loadCurrentDirectory();
            this.emitBreadcrumbs();
        }
    }

    // --- Interaction ---

    toggleSelection(entry: FileExplorerEntry, event: MouseEvent) {
        event.stopPropagation();
        if (this.selectedEntry()?.name === entry.name) {
            this.selectedEntry.set(null);
        } else {
            this.selectedEntry.set(entry);
        }
        this.openMenuId.set(null);
    }

    openContextMenu(entry: FileExplorerEntry, event: MouseEvent) {
        event.preventDefault(); // Prevent native right click
        event.stopPropagation();
        this.selectedEntry.set(entry);

        const menuWidth = 180; // approximate max menu width
        const menuHeight = 260; // approximate menu height

        let x = event.clientX;
        let y = event.clientY;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }

        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        this.contextMenuX.set(Math.max(10, x));
        this.contextMenuY.set(Math.max(10, y));
        this.openMenuId.set(entry.name);
    }

    openEmptyAreaMenu(event: MouseEvent) {
        // Optional: Context menu for empty area (Paste, New Folder)
        // implementation pending below
    }

    // --- File Operations ---

    startRename(entry: FileExplorerEntry) {
        this.renamingEntry.set(entry);
        this.renameValue.set(entry.name);
        this.openMenuId.set(null);
        setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('.inline-rename-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 10);
    }

    cancelRename() {
        this.renamingEntry.set(null);
        this.renameValue.set('');
    }

    async confirmRename() {
        const entry = this.renamingEntry();
        if (!entry) return;

        const newName = this.renameValue().trim();
        if (!newName || newName === entry.name) {
            this.cancelRename();
            return;
        }

        try {
            const node = this.currentNode();
            // Determine parent handle context (Breadcrumbs track this naturally)
            // CRITICAL FIX: The parent of the entry being renamed is EVERY TIME the currentNode's handle, 
            // because we are currently INSIDE that folder viewing its entries.
            const parentHandle = node.handle || this.rootHandle;

            if (!parentHandle) {
                this.snackbar.error('Rename failed: Parent context lost.');
                return;
            }

            // OPTIMIZATION: Release active selection/focus before rename to release OS file locks
            this.selectedEntry.set(null);

            const success = await this.fileManager.renameEntry(
                {
                    spaceId: this.spaceId,
                    parentId: node.id || null,
                    parentHandle
                },
                {
                    ...entry,
                    handle: entry.handle
                } as any,
                newName
            );

            if (success) {
                this.snackbar.success('Item renamed.');
            } else {
                this.snackbar.error('Rename failed.');
            }
        } catch (err: any) {
            console.error(err);
            this.snackbar.error(err.message || 'Failed to rename.');
        } finally {
            this.cancelRename();
            await this.loadCurrentDirectory(false);
        }
    }

    async deleteSelected(entry: FileExplorerEntry) {
        this.openMenuId.set(null);
        if (!confirm(`Are you sure you want to permanently delete "${entry.name}"?`)) return;

        try {
            const node = this.currentNode();
            await this.fileManager.deleteEntry({ parentHandle: node.handle }, entry);
            this.snackbar.info('Item permanently deleted.');
            if (this.selectedEntry()?.name === entry.name) this.selectedEntry.set(null);
            await this.loadCurrentDirectory(false);
        } catch (err) {
            console.error(err);
            this.snackbar.error('Failed to delete item.');
        }
    }

    // --- Folder & File Creation ---

    startCreateFolder() {
        this.isCreatingFolder.set(true);
        this.isCreatingFile.set(false);
        this.newItemName.set('New folder');
        setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('.inline-rename-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 10);
    }

    startCreateFile() {
        this.isCreatingFile.set(true);
        this.isCreatingFolder.set(false);
        this.newItemName.set('New file.txt');
        setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('.inline-rename-input');
            if (input) {
                input.focus();
                // Highlight only the filename, not the extension, for convenience
                const lastDot = input.value.lastIndexOf('.');
                if (lastDot > 0) input.setSelectionRange(0, lastDot);
                else input.select();
            }
        }, 10);
    }

    cancelCreateItem() {
        this.isCreatingFolder.set(false);
        this.isCreatingFile.set(false);
        this.newItemName.set('');
    }

    async confirmCreateItem() {
        const name = this.newItemName().trim();
        if (!name) {
            this.cancelCreateItem();
            return;
        }

        try {
            const node = this.currentNode();
            const context = {
                parentHandle: node.handle,
                workspaceId: this.workspaceId,
                spaceId: this.spaceId,
                parentId: node.id || null
            };

            if (this.isCreatingFolder()) {
                await this.fileManager.createFolder(context, name);
                this.snackbar.success('Folder created.');
            } else if (this.isCreatingFile()) {
                await this.fileManager.createFile(context, name);
                this.snackbar.success('File created.');
            }
        } catch (err) {
            console.error(err);
            this.snackbar.error('Failed to create item.');
        } finally {
            this.cancelCreateItem();
            await this.loadCurrentDirectory(false);
        }
    }

    // --- Clipboard ---

    copy(entry: FileExplorerEntry) {
        this.fileManager.setClipboard(entry, 'copy');
        this.openMenuId.set(null);
        this.snackbar.info(`Copied ${entry.name}`);
    }

    cut(entry: FileExplorerEntry) {
        this.fileManager.setClipboard(entry, 'cut');
        this.openMenuId.set(null);
        this.snackbar.info(`Cut ${entry.name}`);
    }

    async paste() {
        if (!this.clipboardHasItem()) return;

        this.isLoading.set(true);
        try {
            const node = this.currentNode();
            const context = {
                handle: node.handle,
                workspaceId: this.workspaceId,
                spaceId: this.spaceId,
                parentId: node.id || null
            };

            const success = await this.fileManager.paste(context);
            if (success) {
                this.snackbar.success('Pasted successfully.');
                await this.loadCurrentDirectory(false);
            } else {
                this.snackbar.error('Paste failed. (Note: Directory copying is coming soon)');
            }
        } finally {
            this.isLoading.set(false);
        }
    }

    // --- Utilities & State Management ---

    toggleViewMode() {
        this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
    }

    setSort(by: 'name' | 'date' | 'size') {
        if (this.sortBy() === by) {
            this.sortAscending.set(!this.sortAscending()); // toggle direction
        } else {
            this.sortBy.set(by);
            this.sortAscending.set(true); // default to asc when changing criteria
        }
    }

    getDetailedType(entry: FileExplorerEntry): string {
        if (entry.kind === 'directory') return 'File folder';

        const name = entry.name;
        const ext = name.split('.').pop()?.toLowerCase();

        const typeMap: Record<string, string> = {
            'txt': 'Text Document',
            'pdf': 'PDF Document',
            'png': 'PNG Image',
            'jpg': 'JPEG Image',
            'jpeg': 'JPEG Image',
            'gif': 'GIF Image',
            'svg': 'Scalable Vector Graphics',
            'json': 'JSON Configuration',
            'ts': 'TypeScript Source',
            'js': 'JavaScript Source',
            'html': 'HTML Document',
            'css': 'CSS Stylesheet',
            'scss': 'Sass Stylesheet',
            'md': 'Markdown Documentation',
            'zip': 'Compressed Archive',
            'exe': 'Windows Executable',
        };

        return (ext && typeMap[ext]) || (ext ? `${ext.toUpperCase()} File` : 'File');
    }

    formatBytes(bytes: number | undefined): string {
        if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = 2;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * RECURSIVE SELF-HEALING HISTORY
     * Iterates through the entire breadcrumb stack and re-resolves handles
     * that have become stale due to parent/workspace renames.
     */
    private async reResolveStaleHandle(): Promise<boolean> {
        const hist = [...this.history()];
        let changed = false;

        // 1. Resolve Root Node (Space)
        const root = hist[0];
        const rootValid = await this.fileSystem.verifyPermission(root.handle!, true, false)
            .then(v => v && this.fileSystem.testHandleAccess(root.handle!))
            .catch(() => false);

        if (!rootValid) {
            const workspace = await db.workspaces.get(this.workspaceId);
            if (!workspace) return false;

            const freshRoot = await this.fileSystem.resolveSpaceHandle(workspace.name, this.spaceId);
            if (freshRoot) {
                hist[0] = { ...hist[0], handle: freshRoot, name: freshRoot.name };
                changed = true;
            } else {
                // Even the root is truly gone or un-discoverable
                return false;
            }
        }

        // 2. Resolve Child Nodes Recursively
        for (let i = 1; i < hist.length; i++) {
            const parent = hist[i - 1];
            const current = hist[i];

            // Verify if current handle is still valid relative to its parent
            const currentValid = await this.fileSystem.testHandleAccess(current.handle!).catch(() => false);

            if (!currentValid && parent.handle && current.id) {
                // Targeted discovery: find this folder inside its (now fixed) parent
                const freshHandle = await this.fileSystem.findHandleByInternalId(parent.handle, current.id);
                if (freshHandle) {
                    hist[i] = { ...hist[i], handle: freshHandle, name: freshHandle.name, parentHandle: parent.handle };
                    changed = true;
                } else {
                    // Chain broken - we cannot find this subfolder anymore.
                    // Truncate history here as we can't restore the path.
                    const recoveredPart = hist.slice(0, i);
                    this.history.set(recoveredPart);
                    return true; // We recovered what we could
                }
            }
        }

        if (changed) {
            this.history.set(hist);
            return true;
        }

        return false;
    }

    viewDetails(entry: FileExplorerEntry) {
        this.openMenuId.set(null);
        this.modals.openFileDetails(entry);
    }
}
