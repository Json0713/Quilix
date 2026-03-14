import { Component, Input, Output, EventEmitter, OnInit, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileExplorerEntry, FileManagerService } from '../../../core/services/file-manager.service';
import { FileSystemService } from '../../../core/services/file-system.service';
import { SnackbarService } from '../../../services/ui/common/snackbar/snackbar.service';

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './file-explorer.html',
  styleUrl: './file-explorer.scss'
})
export class FileExplorerComponent implements OnInit {
  private fileManager = inject(FileManagerService);
  private fileSystem = inject(FileSystemService);
  private snackbar = inject(SnackbarService);

  @Input({ required: true }) rootHandle!: FileSystemDirectoryHandle;
  @Input() spaceName: string = 'Space';

  // Navigation History (Breadcrumbs map to Handles)
  history = signal<{ name: string, handle: FileSystemDirectoryHandle }[]>([]);
  
  currentDirHandle = computed(() => {
    const hist = this.history();
    return hist.length > 0 ? hist[hist.length - 1].handle : this.rootHandle;
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

  ngOnInit() {
    // Initialize history with root
    this.history.set([{ name: this.spaceName, handle: this.rootHandle }]);
    this.loadCurrentDirectory();
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

  async loadCurrentDirectory(showLoader = true) {
    if (showLoader) this.isLoading.set(true);
    try {
      // Verify permission just in case
      const hasPerm = await this.fileSystem.verifyPermission(this.currentDirHandle(), true, false);
      if (!hasPerm) {
          console.warn('[FileExplorer] Permission lost for current directory');
          return;
      }
      const newEntries = await this.fileManager.readDirectory(this.currentDirHandle());
      this.entries.set(newEntries);
      
      // Clear selection if it doesn't exist anymore
      const currentSelected = this.selectedEntry();
      if (currentSelected && !newEntries.find(e => e.name === currentSelected.name)) {
          this.selectedEntry.set(null);
      }
    } catch (err) {
      console.error('[FileExplorer] Failed to load directory:', err);
      this.snackbar.error('Could not read folder contents.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Navigation ---

  async navigateInto(entry: FileExplorerEntry) {
    if (entry.kind === 'directory') {
      this.history.update(h => [...h, { name: entry.name, handle: entry.handle as FileSystemDirectoryHandle }]);
      this.selectedEntry.set(null);
      this.openMenuId.set(null);
      await this.loadCurrentDirectory();
    } else {
      // It's a file, try to open it natively?
      this.snackbar.info(`File preview coming soon. (${entry.name})`);
    }
  }

  async navigateUp() {
    const hist = [...this.history()];
    if (hist.length > 1) {
      hist.pop();
      this.history.set(hist);
      this.selectedEntry.set(null);
      this.openMenuId.set(null);
      await this.loadCurrentDirectory();
    }
  }

  async navigateToCrumb(index: number) {
    const hist = [...this.history()];
    if (index >= 0 && index < hist.length - 1) {
      this.history.set(hist.slice(0, index + 1));
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
        if (entry.kind === 'file') {
            const success = await this.fileManager.renameFile(entry.handle as FileSystemFileHandle, newName);
            if (success) {
                this.snackbar.success('File renamed.');
            } else {
                this.snackbar.error('Instant file rename not supported in this browser.');
            }
        } else {
            // Folder rename is forbidden by W3C API. We could implement recursive stream copy here.
            this.snackbar.error('Folders cannot be instantly renamed due to Browser Sandbox Security constraints.');
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
    if (!confirm(`Are you sure you want to permanently delete "${entry.name}"? This bypasses the trash.`)) return;

    try {
        await this.fileManager.deleteEntry(this.currentDirHandle(), entry);
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
          if (this.isCreatingFolder()) {
              await this.fileManager.createFolder(this.currentDirHandle(), name);
              this.snackbar.success('Folder created.');
          } else if (this.isCreatingFile()) {
              await this.fileManager.createFile(this.currentDirHandle(), name);
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
      this.fileManager.setClipboard(entry.handle, 'copy');
      this.openMenuId.set(null);
      this.snackbar.info(`Copied ${entry.name}`);
  }

  cut(entry: FileExplorerEntry) {
      this.fileManager.setClipboard(entry.handle, 'cut');
      this.openMenuId.set(null);
      this.snackbar.info(`Cut ${entry.name}`);
  }

  async paste() {
      if (!this.clipboardHasItem()) return;
      
      this.isLoading.set(true);
      try {
          const success = await this.fileManager.paste(this.currentDirHandle());
          if (success) {
              this.snackbar.success('Pasted successfully.');
              await this.loadCurrentDirectory(false);
          } else {
              this.snackbar.error('Paste failed. (Note: Folders cannot be pasted yet)');
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
}
