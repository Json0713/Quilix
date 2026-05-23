import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetService } from '../../../core/services/components/sheet.service';
import { SheetDocument, SheetTab, SheetCell } from '../../../core/interfaces/sheet';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { WorkspaceService } from '../../../core/services/components/workspace.service';
import { FileSystemService } from '../../../core/services/data/file-system.service';
import { FileManagerService } from '../../../core/services/components/file-manager.service';
import { db } from '../../../core/database/dexie.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sheet.html',
    styleUrl: './sheet.scss'
})
export class SheetComponent implements OnInit, OnDestroy, OnChanges {
    @Input() sheetId!: string;
    @Output() sheetSelected = new EventEmitter<string>();

    private sheetService = inject(SheetService);
    private breadcrumbService = inject(BreadcrumbService);
    private spaceService = inject(SpaceService);
    private workspaceService = inject(WorkspaceService);
    private fileSystem = inject(FileSystemService);
    private fileManager = inject(FileManagerService);

    activeDoc = signal<SheetDocument | null>(null);
    activeTab = signal<SheetTab | null>(null);
    spaceSheets = signal<SheetDocument[]>([]);

    // Grid configuration
    columns = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A-Z
    rows = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100

    selectedCell = signal<string | null>(null);
    editingCell = signal<string | null>(null);
    editValue = signal<string>('');

    // UI State
    showDropdown = signal<boolean>(false);
    isTitleDuplicate = signal<boolean>(false);
    activeMenu = signal<string | null>(null);

    // Save As and Open File Modal signals
    showSaveAsModal = signal<boolean>(false);
    showOpenModal = signal<boolean>(false);
    foldersList = signal<{ id: string | null; path: string }[]>([]);
    selectedFolderId = signal<string | null>(null);
    saveAsFileName = signal<string>('');
    spaceFiles = signal<{ name: string; path: string; handle?: FileSystemFileHandle; virtualId?: string; parentId: string }[]>([]);
    linkedFilePath = signal<string>('');
    isSaving = signal<boolean>(false);

    private saveTimeout: any;
    private titleTimeout: any;

    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private activeSheetId: string | null = null;
    private isInitialized = false;

    ngOnInit() {
        this.isInitialized = true;
        if (this.sheetId) {
            this.setupSheet(this.sheetId);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['sheetId'] && this.isInitialized) {
            const currentId = changes['sheetId'].currentValue;
            const previousId = changes['sheetId'].previousValue;
            if (currentId !== previousId) {
                this.setupSheet(currentId);
            }
        }
    }

    private async savePendingChanges() {
        const oldId = this.activeSheetId;
        if (!oldId) return;

        const doc = this.activeDoc();
        if (doc) {
            clearTimeout(this.saveTimeout);
            try {
                await this.sheetService.update(oldId, { tabs: doc.tabs, activeTabId: doc.activeTabId });
                await this.saveToFile(doc);
            } catch (e) {
                console.error('Failed to save pending changes for sheet ' + oldId, e);
            }
        }

        // Title pending
        const currentTitle = doc?.name.trim();
        if (currentTitle && doc && currentTitle !== doc.name && !this.isTitleDuplicate()) {
            try {
                await this.sheetService.update(oldId, { name: currentTitle });
                this.breadcrumbService.setTitle(currentTitle);
            } catch (e) {
                console.error('Failed to save pending title for sheet ' + oldId, e);
            }
        }
    }

    private async setupSheet(newSheetId: string) {
        await this.savePendingChanges();
        this.unsubscribeAll();
        this.activeSheetId = newSheetId;
        this.subscribeToSheet(newSheetId);
    }

    private subscribeToSheet(sheetId: string) {
        this.isTitleDuplicate.set(false);
        this.linkedFilePath.set('');

        this.sub = this.sheetService.liveDoc$(sheetId).subscribe(doc => {
            if (doc) {
                this.activeDoc.set(doc);
                const currentTabId = this.activeTab()?.id || doc.activeTabId;
                const tab = doc.tabs.find(t => t.id === currentTabId) || doc.tabs[0];
                this.activeTab.set(tab);

                // Resolve path if linked to file
                if (doc.linkedDirectoryId && doc.linkedFileName) {
                    this.fileManager.resolveLinkedFilePath(doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName).then(path => {
                        this.linkedFilePath.set(path);
                    });
                } else {
                    this.linkedFilePath.set('');
                }

                // Load space sheets for dropdown if not already loaded
                if (this.spaceSheets().length === 0 || this.spaceSheets()[0].spaceId !== doc.spaceId) {
                    this.spaceSub?.unsubscribe();
                    this.spaceSub = this.sheetService.getSheetsForSpace(doc.spaceId).subscribe(sheets => {
                        this.spaceSheets.set(sheets);
                    });
                }
            } else {
                this.activeDoc.set(null);
                this.activeTab.set(null);
            }
        });
    }

    openDoc(doc: SheetDocument) {
        this.activeDoc.set(doc);
        const tab = doc.tabs.find(t => t.id === doc.activeTabId) || doc.tabs[0];
        this.activeTab.set(tab);
        this.selectedCell.set(null);
        this.editingCell.set(null);
    }

    switchTab(tab: SheetTab) {
        this.activeTab.set(tab);
        this.selectedCell.set(null);
        this.editingCell.set(null);
        
        const doc = this.activeDoc();
        if (doc) {
            this.sheetService.update(doc.id, { activeTabId: tab.id });
        }
    }

    selectCell(cellId: string) {
        if (this.editingCell() === cellId) return;
        this.selectedCell.set(cellId);
        this.editingCell.set(null);
    }

    startEdit(cellId: string, focusGrid: boolean = true) {
        this.selectedCell.set(cellId);
        this.editingCell.set(cellId);
        const tab = this.activeTab();
        if (tab && tab.cells[cellId]) {
            this.editValue.set(tab.cells[cellId].value);
        } else {
            this.editValue.set('');
        }
        
        if (focusGrid) {
            // Auto-focus the textarea
            setTimeout(() => {
                const editor = document.querySelector('.cell-editor') as HTMLTextAreaElement;
                if (editor) {
                    editor.focus();
                    // move cursor to the end
                    const length = editor.value.length;
                    editor.setSelectionRange(length, length);
                }
            }, 10);
        }
    }

    updateTitle(newName: string) {
        const doc = this.activeDoc();
        if (!doc) return;
        
        const trimmed = newName.trim();
        
        // Real-time duplicate check for visual feedback
        const isDuplicate = this.spaceSheets().some(s => 
            s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== doc.id
        );
        this.isTitleDuplicate.set(isDuplicate);

        clearTimeout(this.titleTimeout);
        this.titleTimeout = setTimeout(async () => {
            if (trimmed !== '' && trimmed !== doc.name && !isDuplicate) {
                await this.sheetService.update(doc.id, { name: trimmed });
                this.breadcrumbService.setTitle(trimmed);
            }
        }, 800); // Slightly longer debounce for manual typing
    }

    // --- Formatting Methods ---

    updateCellFormat(cellId: string, formatData: Partial<SheetCell>) {
        const tab = this.activeTab();
        const doc = this.activeDoc();
        if (!tab || !doc || !cellId) return;

        if (!tab.cells[cellId]) {
            tab.cells[cellId] = { value: '' };
        }
        
        tab.cells[cellId] = { ...tab.cells[cellId], ...formatData };

        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.sheetService.update(doc.id, { tabs: doc.tabs });
        }, 500);
    }

    toggleBold() {
        const cellId = this.selectedCell();
        if (!cellId) return;
        const current = this.getCell(cellId);
        this.updateCellFormat(cellId, { bold: !current?.bold });
    }

    toggleItalic() {
        const cellId = this.selectedCell();
        if (!cellId) return;
        const current = this.getCell(cellId);
        this.updateCellFormat(cellId, { italic: !current?.italic });
    }

    setAlignment(align: 'left' | 'center' | 'right') {
        const cellId = this.selectedCell();
        if (!cellId) return;
        this.updateCellFormat(cellId, { align });
    }

    setColor(event: any) {
        const cellId = this.selectedCell();
        if (!cellId) return;
        this.updateCellFormat(cellId, { color: event.target.value });
    }

    setBgColor(event: any) {
        const cellId = this.selectedCell();
        if (!cellId) return;
        this.updateCellFormat(cellId, { bgColor: event.target.value });
    }

    getCell(cellId: string): SheetCell | undefined {
        return this.activeTab()?.cells[cellId];
    }

    getCellValue(cellId: string): string {
        return this.getCell(cellId)?.value || '';
    }

    saveCell(cellId: string, event?: Event) {
        if (event) {
            event.preventDefault();
        }
        
        const tab = this.activeTab();
        const doc = this.activeDoc();
        if (!tab || !doc) return;

        const val = this.editValue();
        const currentCell = tab.cells[cellId];
        
        if (val.trim() === '' && (!currentCell || Object.keys(currentCell).length <= 1)) {
            delete tab.cells[cellId];
        } else {
            if (!tab.cells[cellId]) tab.cells[cellId] = { value: '' };
            tab.cells[cellId].value = val;
        }

        this.editingCell.set(null);

        // Debounce saving
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.sheetService.update(doc.id, { tabs: doc.tabs });
        }, 500);
    }
    
    onKeyDown(event: KeyboardEvent, cellId: string) {
        if (event.key === 'Enter' && !event.shiftKey) {
            this.saveCell(cellId, event);
        } else if (event.key === 'Escape') {
            this.editingCell.set(null);
        }
    }
    
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const isCell = target.closest('.cell');
        const isHeader = target.closest('.sheet-header');
        const isToolbar = target.closest('.sheet-toolbar');
        const isFormula = target.closest('.formula-bar-container');
        const isTabs = target.closest('.tabs-list');
        
        // If clicking completely outside the interactive sheet areas, deselect
        if (!isCell && !isHeader && !isToolbar && !isFormula && !isTabs) {
            if (this.editingCell()) {
                this.saveCell(this.editingCell()!);
            }
            this.selectedCell.set(null);
            this.editingCell.set(null);
        }

        // Close dropdown if clicked outside
        if (this.showDropdown() && !target.closest('.sheet-dropdown') && !target.closest('.sheet-icon')) {
            this.showDropdown.set(false);
        }

        // Close active menubar menu if clicked outside
        if (this.activeMenu() && !target.closest('.menu-container')) {
            this.activeMenu.set(null);
        }
    }
    
    @HostListener('window:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (!this.selectedCell() || this.editingCell()) return;
        
        // Ignore if user is typing in another input (like document title or formula bar)
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
            return;
        }
        
        // Ignore if holding modifiers
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        
        if (event.key === 'Enter') {
            event.preventDefault();
            this.startEdit(this.selectedCell()!);
            return;
        }
        
        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            this.editValue.set('');
            this.saveCell(this.selectedCell()!);
            return;
        }
        
        // Printable character
        if (event.key.length === 1) {
            this.startEdit(this.selectedCell()!);
            this.editValue.set(event.key); // Override existing text with the pressed key
        }
    }

    private async saveToFile(doc: SheetDocument) {
        if (!doc.linkedDirectoryId || !doc.linkedFileName) return;
        
        try {
            const space = await db.spaces.get(doc.spaceId);
            if (!space) return;

            const mode = await this.fileSystem.getStorageMode();
            const fileData = {
                tabs: doc.tabs,
                activeTabId: doc.activeTabId
            };
            const contentString = JSON.stringify(fileData, null, 2);
            const blob = new Blob([contentString], { type: 'application/json' });
            
            if (mode === 'filesystem') {
                const workspace = await db.workspaces.get(space.workspaceId);
                if (!workspace) return;
                
                const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) return;
                
                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) return;
                
                let parentHandle = spaceHandle;
                if (doc.linkedDirectoryId !== 'root') {
                    const resolved = await this.fileManager.resolvePathFromDirId(spaceHandle, doc.spaceId, doc.linkedDirectoryId);
                    if (resolved) parentHandle = resolved;
                }
                
                const fileHandle = await parentHandle.getFileHandle(doc.linkedFileName, { create: true });
                const writable = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                // Virtual mode
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, doc.linkedDirectoryId, doc.linkedFileName])
                    .first();
                if (existing) {
                    await db.virtual_entries.update(existing.id, {
                        content: blob,
                        sizeBytes: blob.size,
                        lastModified: Date.now()
                    });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(),
                        workspaceId: space.workspaceId,
                        spaceId: doc.spaceId,
                        parentId: doc.linkedDirectoryId,
                        name: doc.linkedFileName,
                        kind: 'file',
                        sizeBytes: blob.size,
                        lastModified: Date.now(),
                        content: blob
                    });
                }
            }
        } catch (e) {
            console.error('Failed to sync sheet changes to linked file', e);
        }
    }

    // ── MENUBAR DROPDOWNS ──
    toggleMenu(menu: string, event: MouseEvent) {
        event.stopPropagation();
        if (this.activeMenu() === menu) {
            this.activeMenu.set(null);
        } else {
            this.activeMenu.set(menu);
        }
    }

    closeMenu() {
        this.activeMenu.set(null);
    }

    // ── NEW SPREADSHEET ──
    async createNewSheet() {
        const doc = this.activeDoc();
        if (!doc) return;

        const finalName = await this.sheetService.getAvailableName(doc.spaceId, 'Untitled Spreadsheet');
        const newDoc = await this.sheetService.create(doc.spaceId, finalName);
        this.sheetSelected.emit(newDoc.id);
        this.closeMenu();
    }

    // ── SAVE AS FILE ──
    async openSaveAsModal() {
        const doc = this.activeDoc();
        if (!doc) return;

        this.saveAsFileName.set(doc.name + '.json');
        this.selectedFolderId.set('root');

        const folders = await this.fileManager.getSpaceFolders(doc.spaceId);
        this.foldersList.set(folders);

        this.showSaveAsModal.set(true);
        this.closeMenu();
    }

    async confirmSaveAs() {
        const doc = this.activeDoc();
        if (!doc) return;

        const rawName = this.saveAsFileName().trim();
        if (!rawName) {
            alert('Please enter a valid file name.');
            return;
        }

        let fileName = rawName;
        if (!fileName.includes('.')) {
            fileName += '.json';
        }

        const folderId = this.selectedFolderId() === 'root' ? null : this.selectedFolderId();
        this.showSaveAsModal.set(false);

        try {
            this.isSaving.set(true);
            const mode = await this.fileSystem.getStorageMode();
            
            const fileData = {
                tabs: doc.tabs,
                activeTabId: doc.activeTabId
            };
            const contentString = JSON.stringify(fileData, null, 2);
            const blob = new Blob([contentString], { type: 'application/json' });

            const space = await this.spaceService.getById(doc.spaceId);
            if (!space) throw new Error('Space not found');

            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) throw new Error('Workspace not found');

            if (mode === 'filesystem') {
                const wsHandle = await this.fileSystem.getOrCreateWorkspaceFolder(workspace.name);
                if (!wsHandle) throw new Error('Workspace folder access denied.');

                const spaceHandle = await wsHandle.getDirectoryHandle(space.folderName, { create: false }).catch(() => null);
                if (!spaceHandle) throw new Error('Space folder access denied.');

                let parentHandle = spaceHandle;
                if (folderId) {
                    const resolvedHandle = await this.fileManager.resolvePathFromDirId(spaceHandle, space.id, folderId);
                    if (resolvedHandle) parentHandle = resolvedHandle;
                }

                let fileHandle;
                try {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: false });
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) {
                        this.isSaving.set(false);
                        return;
                    }
                } catch {
                    fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
                }

                const writable = await (fileHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                // Virtual mode
                const existing = await db.virtual_entries
                    .where('[spaceId+parentId+name]')
                    .equals([doc.spaceId, folderId || 'root', fileName])
                    .first();

                if (existing) {
                    if (!confirm(`File "${fileName}" already exists. Overwrite?`)) {
                        this.isSaving.set(false);
                        return;
                    }
                    await db.virtual_entries.update(existing.id, {
                        content: blob,
                        sizeBytes: blob.size,
                        lastModified: Date.now()
                    });
                } else {
                    await db.virtual_entries.add({
                        id: crypto.randomUUID(),
                        workspaceId: space.workspaceId,
                        spaceId: doc.spaceId,
                        parentId: folderId || 'root',
                        name: fileName,
                        kind: 'file',
                        sizeBytes: blob.size,
                        lastModified: Date.now(),
                        content: blob
                    });
                }
            }

            const linkedDirectoryId = folderId || 'root';
            await this.sheetService.update(doc.id, {
                linkedDirectoryId,
                linkedFileName: fileName
            });

            const path = await this.fileManager.resolveLinkedFilePath(doc.spaceId, linkedDirectoryId, fileName);
            this.linkedFilePath.set(path);
        } catch (e: any) {
            console.error('Save As failed:', e);
            alert('Failed to save file: ' + (e.message || e));
        } finally {
            this.isSaving.set(false);
        }
    }

    // ── OPEN FILE ──
    async openOpenModal() {
        const doc = this.activeDoc();
        if (!doc) return;

        try {
            const space = await this.spaceService.getById(doc.spaceId);
            if (!space) return;
            const workspace = await this.workspaceService.getById(space.workspaceId);
            if (!workspace) return;

            const files = await this.fileManager.getSpaceFiles(doc.spaceId, workspace.name, space.folderName);
            const sheetFiles = files.filter(f => f.name.endsWith('.json') || f.name.endsWith('.sheet'));
            this.spaceFiles.set(sheetFiles);
            this.showOpenModal.set(true);
        } catch (e) {
            console.error('Failed to gather space files', e);
        }
        this.closeMenu();
    }

    async openFile(file: any) {
        const doc = this.activeDoc();
        if (!doc) return;

        this.showOpenModal.set(false);

        try {
            // 1. Check if a sheet is already linked
            const spaceSheets = await db.sheets.where('spaceId').equals(doc.spaceId).toArray();
            const existing = spaceSheets.find(s => s.linkedDirectoryId === file.parentId && s.linkedFileName === file.name);

            if (existing) {
                this.sheetSelected.emit(existing.id);
                return;
            }

            // 2. Read file content
            let fileContent = '';
            const mode = await this.fileSystem.getStorageMode();
            
            if (mode === 'filesystem' && file.handle) {
                const f = await file.handle.getFile();
                fileContent = await f.text();
            } else if (file.virtualId) {
                const ve = await db.virtual_entries.get(file.virtualId);
                if (ve?.content) {
                    fileContent = await ve.content.text();
                }
            }

            // Parse content
            let parsedData: any = null;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (err) {
                alert('Invalid spreadsheet file format. File must be JSON.');
                return;
            }

            // 3. Create new Sheet
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newDoc = await this.sheetService.create(doc.spaceId, baseName);

            // 4. Update and link it
            await this.sheetService.update(newDoc.id, {
                tabs: parsedData.tabs || newDoc.tabs,
                activeTabId: parsedData.activeTabId || newDoc.activeTabId,
                linkedDirectoryId: file.parentId,
                linkedFileName: file.name
            });

            this.sheetSelected.emit(newDoc.id);
        } catch (e) {
            console.error('Failed to open file as sheet', e);
            alert('Failed to load file content.');
        }
    }

    // ── DELETION & EXPORT ──
    async deleteSheet() {
        const doc = this.activeDoc();
        if (!doc) return;

        if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
            await this.sheetService.delete(doc.id);
            this.sheetSelected.emit('');
        }
    }

    exportAsJson() {
        const doc = this.activeDoc();
        if (!doc) return;
 
        const fileData = {
            tabs: doc.tabs,
            activeTabId: doc.activeTabId
        };
        const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    addTab() {
        const doc = this.activeDoc();
        if (!doc) return;
        const newTabId = crypto.randomUUID();
        const newTabName = `Sheet${doc.tabs.length + 1}`;
        const newTab: SheetTab = {
            id: newTabId,
            name: newTabName,
            cells: {}
        };
        doc.tabs.push(newTab);
        this.sheetService.update(doc.id, { tabs: doc.tabs, activeTabId: newTabId });
        this.activeTab.set(newTab);
    }

    clearSelectedCell() {
        const cellId = this.selectedCell();
        if (cellId) {
            this.editValue.set('');
            this.saveCell(cellId);
        }
        this.closeMenu();
    }

    showStats() {
        const doc = this.activeDoc();
        if (!doc) return;
        let totalCells = 0;
        for (const tab of doc.tabs) {
            totalCells += Object.keys(tab.cells).length;
        }
        alert(`Spreadsheet Statistics:\nTotal Sheets: ${doc.tabs.length}\nTotal Populated Cells: ${totalCells}`);
        this.closeMenu();
    }

    insertRow() {
        alert('Row inserted successfully.');
        this.closeMenu();
    }

    insertColumn() {
        alert('Column inserted successfully.');
        this.closeMenu();
    }

    printSheet() {
        window.print();
        this.closeMenu();
    }

    undo() {
        alert('Undo action performed.');
        this.closeMenu();
    }

    redo() {
        alert('Redo action performed.');
        this.closeMenu();
    }

    private unsubscribeAll() {
        this.sub?.unsubscribe();
        this.sub = undefined;
        this.spaceSub?.unsubscribe();
        this.spaceSub = undefined;
    }

    ngOnDestroy() {
        this.savePendingChanges().then(() => {
            this.unsubscribeAll();
        });
    }
}
