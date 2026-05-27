import { Component, Input, OnInit, inject, signal, OnDestroy, HostListener, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocService } from '../../../core/services/components/doc.service';
import { DocDocument } from '../../../core/interfaces/doc';
import { ModalService } from '../../../services/ui/common/modal/modal';

@Component({
    selector: 'app-doc-list',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './doc-list.html',
    styleUrl: './doc-list.scss'
})
export class DocListComponent implements OnInit, OnDestroy {
    @Input() spaceId!: string;
    @Input() routePrefix!: 'personal' | 'team';

    private docService = inject(DocService);
    private modalService = inject(ModalService);

    docs = signal<DocDocument[]>([]);
    isCreating = signal<boolean>(false);
    newItemName = signal<string>('Untitled Document');
    
    renamingDoc = signal<DocDocument | null>(null);
    renameValue = signal<string>('');
    
    activeMenuId = signal<string | null>(null);

    @ViewChildren('renameInput') renameInputs!: QueryList<ElementRef>;
    @ViewChildren('createInput') createInputs!: QueryList<ElementRef>;

    private sub?: { unsubscribe: () => void };

    ngOnInit() {
        if (this.spaceId) {
            this.sub = this.docService.getDocsForSpace(this.spaceId).subscribe(docs => {
                this.docs.set(docs);
            });
        }
    }

    createNewDoc() {
        this.isCreating.set(true);
        this.newItemName.set('Untitled Document');
        
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
        if (!this.isCreating()) return;
        this.isCreating.set(false);
        const name = this.newItemName().trim();
        if (name && this.spaceId) {
            await this.docService.create(this.spaceId, name);
        }
    }

    cancelCreate() {
        this.isCreating.set(false);
    }

    startRename(doc: DocDocument, event?: Event) {
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
        if (!doc) return;
        this.renamingDoc.set(null);
        
        const newName = this.renameValue().trim();
        if (newName && newName !== doc.name) {
            const finalName = await this.docService.getAvailableName(this.spaceId, newName, doc.id);
            await this.docService.update(doc.id, { name: finalName });
        }
    }

    cancelRename() {
        this.renamingDoc.set(null);
    }

    async deleteDoc(doc: DocDocument, event?: Event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const confirmed = await this.modalService.confirm(`Are you sure you want to delete "${doc.name}"?`, {
            title: 'Delete Document',
            confirmText: 'Delete',
            notice: {
                type: 'warning',
                message: 'This action cannot be undone.'
            }
        });

        if (confirmed) {
            await this.docService.delete(doc.id);
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
