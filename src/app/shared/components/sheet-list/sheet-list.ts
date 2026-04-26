import { Component, Input, OnInit, inject, signal, OnDestroy, HostListener, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SheetService } from '../../../core/services/components/sheet.service';
import { SheetDocument } from '../../../core/interfaces/sheet';
import { ModalService } from '../../../services/ui/common/modal/modal';

@Component({
    selector: 'app-sheet-list',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './sheet-list.html',
    styleUrl: './sheet-list.scss'
})
export class SheetListComponent implements OnInit, OnDestroy {
    @Input() spaceId!: string;
    @Input() routePrefix!: 'personal' | 'team';

    private sheetService = inject(SheetService);
    private modalService = inject(ModalService);

    sheets = signal<SheetDocument[]>([]);
    isCreating = signal<boolean>(false);
    newItemName = signal<string>('Untitled Spreadsheet');
    
    renamingDoc = signal<SheetDocument | null>(null);
    renameValue = signal<string>('');
    
    activeMenuId = signal<string | null>(null);

    @ViewChildren('renameInput') renameInputs!: QueryList<ElementRef>;
    @ViewChildren('createInput') createInputs!: QueryList<ElementRef>;

    private sub: any;

    ngOnInit() {
        if (this.spaceId) {
            this.sub = this.sheetService.getSheetsForSpace(this.spaceId).subscribe(docs => {
                this.sheets.set(docs);
            });
        }
    }

    createNewDoc() {
        this.isCreating.set(true);
        this.newItemName.set('Untitled Spreadsheet');
        
        // Focus create input
        setTimeout(() => {
            const input = this.createInputs.first?.nativeElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    }

    async confirmCreate() {
        const name = this.newItemName().trim();
        if (name && this.spaceId) {
            await this.sheetService.create(this.spaceId, name);
        }
        this.isCreating.set(false);
    }

    cancelCreate() {
        this.isCreating.set(false);
    }

    startRename(doc: SheetDocument, event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.renamingDoc.set(doc);
        this.renameValue.set(doc.name);
        this.activeMenuId.set(null); // Close menu on rename start

        // Focus rename input
        setTimeout(() => {
            const input = this.renameInputs.first?.nativeElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    }

    async confirmRename() {
        const doc = this.renamingDoc();
        const newName = this.renameValue().trim();
        if (doc && newName && newName !== doc.name) {
            await this.sheetService.update(doc.id, { name: newName });
        }
        this.renamingDoc.set(null);
    }

    cancelRename() {
        this.renamingDoc.set(null);
    }

    async deleteDoc(doc: SheetDocument, event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const confirmed = await this.modalService.confirm(`Are you sure you want to delete "${doc.name}"?`, {
            title: 'Delete Spreadsheet',
            confirmText: 'Delete',
            notice: {
                type: 'warning',
                message: 'This action cannot be undone.'
            }
        });

        if (confirmed) {
            await this.sheetService.delete(doc.id);
        }
        this.activeMenuId.set(null); // Close menu on delete
    }

    toggleMenu(docId: string, event: Event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.activeMenuId() === docId) {
            this.activeMenuId.set(null);
        } else {
            this.activeMenuId.set(docId);
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-container')) {
            this.activeMenuId.set(null);
        }
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
}
