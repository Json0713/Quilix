import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetService } from '../../../core/services/components/sheet.service';
import { SheetDocument, SheetTab, SheetCell } from '../../../core/interfaces/sheet';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
    selector: 'app-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sheet.html',
    styleUrl: './sheet.scss'
})
export class SheetComponent implements OnInit, OnDestroy {
    @Input() sheetId!: string;
    @Output() sheetSelected = new EventEmitter<string>();

    private sheetService = inject(SheetService);
    private breadcrumbService = inject(BreadcrumbService);

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

    private saveTimeout: any;
    private titleTimeout: any;

    private sub: any;
    private spaceSub: any;

    ngOnInit() {
        if (this.sheetId) {
            this.sub = this.sheetService.liveDoc$(this.sheetId).subscribe(doc => {
                if (doc) {
                    this.activeDoc.set(doc);
                    // Maintain active tab if possible
                    const currentTabId = this.activeTab()?.id || doc.activeTabId;
                    const tab = doc.tabs.find(t => t.id === currentTabId) || doc.tabs[0];
                    this.activeTab.set(tab);

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
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
        this.spaceSub?.unsubscribe();
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
}
