import { Component, Input, Output, EventEmitter, OnInit, signal, computed, HostListener, inject, effect, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileExplorerEntry, FileManagerService } from '../../../core/services/file-manager.service';
import { FileSystemService } from '../../../core/services/file-system.service';
import { SnackbarService } from '../../../services/ui/common/snackbar/snackbar.service';
import { ModalService } from '../../../services/ui/common/modal/modal';
import { ToolbarService, ToolbarConfig } from '../../../core/services/toolbar.service';
import { db } from '../../../core/db/app-db';
import { Space } from '../../../core/interfaces/space';

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
  private snackbar = inject(SnackbarService);
  private toolbar = inject(ToolbarService);
  private router = inject(Router);
  readonly modals = inject(ModalService);

  @Input({ required: true }) spaceId!: string;
  @Input({ required: true }) workspaceId!: string;
  @Input() rootHandle: FileSystemDirectoryHandle | null = null;
  @Input() spaceName: string = 'Space';

  // Navigation History (Breadcrumbs map to polymorphic Nodes)
  history = signal<{ name: string, handle?: FileSystemDirectoryHandle, id?: string, parentHandle?: FileSystemDirectoryHandle }[]>([]);
  forwardHistory = signal<{ name: string, handle?: FileSystemDirectoryHandle, id?: string, parentHandle?: FileSystemDirectoryHandle }[]>([]);
  
  currentNode = computed(() => {
    const hist = this.history();
    return hist.length > 0 ? hist[hist.length - 1] : { name: this.spaceName, handle: this.rootHandle || undefined, id: undefined };
  });

  entries = signal<FileExplorerEntry[]>([]);
  isLoading = signal<boolean>(true);

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

  constructor() {
      // Actively project internal Signals out to the Global Nav Bar
      effect(() => {
          this.updateGlobalToolbar();
      });
  }

  ngOnInit() {
    // Initialize history with space root (handles either native or virtual)
    this.history.set([{ 
        name: this.spaceName, 
        handle: this.rootHandle || undefined, 
        id: undefined // Space root is always 'root' in virtual engine
    }]);
    this.loadCurrentDirectory();
  }

  ngOnDestroy() {
      this.toolbar.clearConfig(); // Restore global nav bar when leaving the Space
  }

  // --- Toolbar Integration ---
  
  private updateGlobalToolbar() {
      // Resolve states
      const hist = this.history();
      const currentMode = this.viewMode();
      const currentSort = this.sortBy();
      const asc = this.sortAscending();
      const hasClipboard = this.clipboardHasItem();

      // Ensure root URL is correct for Space
      const spaceRootParts = location.pathname.split('/');
      const rootType = spaceRootParts[1]; // 'personal' or 'team'
      const spaceUrlRoot = `/${rootType}/spaces`;

      // 1. Build Breadcrumbs mapped to the history array
      const breadcrumbs = hist.map((node, index) => ({
          label: node.name,
          isLast: index === hist.length - 1,
          action: () => {
              if (index < hist.length - 1) {
                  this.navigateToCrumb(index);
              }
          }
      }));

      // Add "Home" escape hatch to Breadcrumbs
      breadcrumbs.unshift({
          label: 'Home',
          isLast: false,
          action: () => {
              // Now completely SPA bound, no more refreshing the page context.
              this.router.navigate([`/${rootType}`]);
          }
      });

      // 2. Build Config Object
      const config: ToolbarConfig = {
          breadcrumbs: breadcrumbs,
          navControls: {
              canGoBack: hist.length > 1,
              canGoForward: this.forwardHistory().length > 0,
              onBack: () => this.navigateBack(),
              onForward: () => this.navigateForward(),
              onRefresh: () => this.loadCurrentDirectory(true)
          },
          pillGroups: [
              {
                  id: 'view-toggles',
                  pills: [
                      {
                          id: 'list',
                          icon: 'bi-list',
                          isActive: currentMode === 'list',
                          tooltip: 'List View',
                          action: () => this.viewMode.set('list')
                      },
                      {
                          id: 'grid',
                          icon: 'bi-grid-fill',
                          isActive: currentMode === 'grid',
                          tooltip: 'Grid View',
                          action: () => this.viewMode.set('grid')
                      }
                  ]
              }
          ],
          dropdowns: [
              {
                  id: 'sort',
                  icon: 'bi-sort-down',
                  label: `Sort by: ${currentSort}`,
                  items: [
                      { id: 'name', label: 'Name', icon: currentSort === 'name' ? (asc ? 'bi-chevron-up' : 'bi-chevron-down') : '', action: () => this.setSort('name') },
                      { id: 'date', label: 'Date Modified', icon: currentSort === 'date' ? (asc ? 'bi-chevron-up' : 'bi-chevron-down') : '', action: () => this.setSort('date') },
                      { id: 'size', label: 'Size', icon: currentSort === 'size' ? (asc ? 'bi-chevron-up' : 'bi-chevron-down') : '', action: () => this.setSort('size') }
                  ]
              }
          ],
          actions: []
      };

      // Add Paste button conditionally based on clipboard
      if (hasClipboard) {
          config.actions!.push({
              id: 'paste',
              label: 'Paste',
              icon: 'bi-clipboard',
              isPrimary: false,
              action: () => this.paste()
          });
      }

      // Push to global context
      this.toolbar.setConfig(config);
  }

  // Derived sorted entries
  sortedEntries = computed(() => {
    const raw = this.entries();
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

  @HostListener('window:focus')
  onWindowFocus() {
    // Refresh directory silently
    if (!this.renamingEntry() && !this.isCreatingFolder() && !this.isCreatingFile()) {
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
      if (currentSelected && !newEntries.find(e => e.name === currentSelected.name)) {
          this.selectedEntry.set(null);
      }
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

  // --- Navigation ---

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
      await this.loadCurrentDirectory();
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
      await this.loadCurrentDirectory();
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
      await this.loadCurrentDirectory();
    }
  }

  async navigateToCrumb(index: number) {
    const hist = [...this.history()];
    if (index >= 0 && index < hist.length - 1) {
      const removed = hist.splice(index + 1); // Everything after the chosen crumb index
      this.history.set(hist);
      this.forwardHistory.set(removed.reverse()); // Flip order so the immediate next folder is top of forward stack
      this.selectedEntry.set(null);
      this.openMenuId.set(null);
      await this.loadCurrentDirectory();
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
    this.contextMenuX.set(event.clientX);
    this.contextMenuY.set(event.clientY);
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
  }

  startCreateFile() {
      this.isCreatingFile.set(true);
      this.isCreatingFolder.set(false);
      this.newItemName.set('New file.txt');
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
          const parent = hist[i-1];
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
