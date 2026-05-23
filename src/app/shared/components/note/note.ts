import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, inject, signal, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../../core/services/components/note.service';
import { NoteDocument } from '../../../core/interfaces/note';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import Quill from 'quill';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

// Patch Quill's Cursor blot to avoid TypeError: Cannot read properties of undefined (reading 'composing')
// This occurs when loading content containing '<span class="ql-cursor">' from database,
// because Quill parses the element from DOM but does not pass a selection reference to the constructor.
try {
    const Cursor = Quill.import('blots/cursor') as any;
    if (Cursor && Cursor.prototype) {
        const originalRestore = Cursor.prototype.restore;
        Cursor.prototype.restore = function() {
            if (!this.selection) {
                const quill = (this.scroll?.domNode?.parentNode as any)?.__quill;
                if (quill && quill.selection) {
                    this.selection = quill.selection;
                } else {
                    this.selection = {
                        composing: false,
                        getNativeRange: () => null
                    };
                }
            }
            return originalRestore.apply(this, arguments);
        };
    }
} catch (e) {
    console.error('Failed to patch Quill Cursor blot', e);
}

@Component({
    selector: 'app-note',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './note.html',
    styleUrl: './note.scss',
    encapsulation: ViewEncapsulation.None
})
export class NoteComponent implements OnInit, OnDestroy, OnChanges {
    @Input() noteId!: string;
    @Output() noteSelected = new EventEmitter<string>();
    
    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
    
    private noteService = inject(NoteService);
    private breadcrumbService = inject(BreadcrumbService);
    
    quill!: Quill;
    activeDoc = signal<NoteDocument | null>(null);
    noteTitle = signal<string>('Loading...');
    isSaving = signal<boolean>(false);
    saveStatus = signal<string>('Saved to space');
    
    spaceNotes = signal<NoteDocument[]>([]);
    showDropdown = signal<boolean>(false);
    isTitleDuplicate = signal<boolean>(false);
    activeMenu = signal<string | null>(null);
    
    private contentChangeSubject = new Subject<string>();
    private titleChangeSubject = new Subject<string>();
    
    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private saveSub?: Subscription;
    private titleSub?: Subscription;
    
    private lastSavedContent = '';
    private activeNoteId: string | null = null;
    private isInitialized = false;

    ngOnInit() {
        this.initQuill();
        this.isInitialized = true;

        if (this.noteId) {
            this.setupNote(this.noteId);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['noteId'] && this.isInitialized) {
            const currentId = changes['noteId'].currentValue;
            const previousId = changes['noteId'].previousValue;
            if (currentId !== previousId) {
                this.setupNote(currentId);
            }
        }
    }

    private async savePendingChanges() {
        const oldId = this.activeNoteId;
        if (!oldId || !this.quill) return;

        const currentContent = this.quill.root.innerHTML;
        const cleanContent = currentContent.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
        
        if (cleanContent !== '<p><br></p>' && cleanContent !== this.lastSavedContent) {
            this.lastSavedContent = cleanContent;
            try {
                await this.noteService.update(oldId, { content: cleanContent });
            } catch (e) {
                console.error('Failed to save pending changes for note ' + oldId, e);
            }
        }

        // Also check if title is pending
        const currentTitle = this.noteTitle().trim();
        const doc = this.activeDoc();
        if (currentTitle && doc && currentTitle !== doc.name && !this.isTitleDuplicate()) {
            try {
                await this.noteService.update(oldId, { name: currentTitle });
                this.breadcrumbService.setTitle(currentTitle);
            } catch (e) {
                console.error('Failed to save pending title for note ' + oldId, e);
            }
        }
    }

    private async setupNote(newNoteId: string) {
        // Save pending changes of previous note if any
        await this.savePendingChanges();

        // Clear previous subscriptions
        this.unsubscribeAll();

        // Set the active note ID
        this.activeNoteId = newNoteId;

        // Initialize subscriptions for the new note
        this.subscribeToNote(newNoteId);
    }

    private subscribeToNote(noteId: string) {
        this.isSaving.set(false);
        this.saveStatus.set('Saved to space');
        this.isTitleDuplicate.set(false);

        this.sub = this.noteService.liveDoc$(noteId).subscribe(note => {
            if (note) {
                this.activeDoc.set(note);
                this.noteTitle.set(note.name);
                
                // Load space notes for dropdown if not already loaded
                if (this.spaceNotes().length === 0 || this.spaceNotes()[0].spaceId !== note.spaceId) {
                    this.spaceSub?.unsubscribe();
                    this.spaceSub = this.noteService.getNotesForSpace(note.spaceId).subscribe(notes => {
                        this.spaceNotes.set(notes);
                    });
                }
                
                const sanitizedContent = (note.content || '').replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
                const currentContent = this.quill.root.innerHTML;
                if (sanitizedContent !== currentContent && sanitizedContent !== this.lastSavedContent) {
                    const range = this.quill.getSelection();
                    this.quill.root.innerHTML = sanitizedContent;
                    this.lastSavedContent = sanitizedContent;
                    
                    if (range) {
                        setTimeout(() => {
                            try {
                                this.quill.setSelection(range.index, range.length);
                            } catch (e) {
                                // Ignore selection errors
                            }
                        }, 0);
                    }
                }
            } else {
                this.activeDoc.set(null);
            }
        });
        
        this.saveSub = this.contentChangeSubject.pipe(
            debounceTime(1000)
        ).subscribe(async content => {
            const currentId = this.activeNoteId;
            if (!currentId || currentId !== noteId) return; // Guard against race conditions
            
            this.isSaving.set(true);
            this.saveStatus.set('Saving...');
            
            const cleanContent = content.replace(/<span class="ql-cursor">.*?<\/span>/g, '').replace(/\uFEFF/g, '');
            this.lastSavedContent = cleanContent;
            
            try {
                await this.noteService.update(currentId, { content: cleanContent });
                this.saveStatus.set('Saved to space');
            } catch (e) {
                console.error('Failed to save note', e);
                this.saveStatus.set('Save failed');
            } finally {
                setTimeout(() => {
                    if (this.activeNoteId === noteId) {
                        this.isSaving.set(false);
                    }
                }, 500);
            }
        });
        
        this.titleSub = this.titleChangeSubject.pipe(
            debounceTime(800),
            distinctUntilChanged()
        ).subscribe(async newName => {
            const currentId = this.activeNoteId;
            if (!currentId || currentId !== noteId) return; // Guard against race conditions
            
            const trimmed = newName.trim();
            const doc = this.activeDoc();
            if (trimmed !== '' && doc && !this.isTitleDuplicate()) {
                this.isSaving.set(true);
                this.saveStatus.set('Saving...');
                
                try {
                    await this.noteService.update(currentId, { name: trimmed });
                    this.breadcrumbService.setTitle(trimmed);
                    this.saveStatus.set('Saved to space');
                } catch (e) {
                    console.error('Failed to save title', e);
                    this.saveStatus.set('Save failed');
                } finally {
                    setTimeout(() => {
                        if (this.activeNoteId === noteId) {
                            this.isSaving.set(false);
                        }
                    }, 500);
                }
            }
        });
    }

    updateTitle(newName: string) {
        const doc = this.activeDoc();
        if (!doc) return;
        
        const trimmed = newName.trim();
        this.noteTitle.set(newName); 
        
        const isDuplicate = this.spaceNotes().some(n => 
            n.name.toLowerCase() === trimmed.toLowerCase() && n.id !== doc.id
        );
        this.isTitleDuplicate.set(isDuplicate);
        
        this.titleChangeSubject.next(newName);
    }

    private initQuill() {
        this.quill = new Quill(this.editorContainer.nativeElement, {
            theme: 'snow',
            placeholder: 'Start writing...',
            bounds: this.editorContainer.nativeElement,
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link'],
                    ['clean']
                ]
            }
        });

        this.quill.on('text-change', () => {
            const content = this.quill.root.innerHTML;
            if (content !== '<p><br></p>') {
                 this.contentChangeSubject.next(content);
            }
        });
    }
    
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (this.showDropdown() && !target.closest('.note-dropdown') && !target.closest('.note-icon')) {
            this.showDropdown.set(false);
        }
        if (this.activeMenu() && !target.closest('.menu-container')) {
            this.activeMenu.set(null);
        }
    }

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

    exportAsTxt() {
        const text = this.quill.getText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.noteTitle() || 'Untitled Note'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportAsHtml() {
        const html = this.quill.root.innerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.noteTitle() || 'Untitled Note'}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async deleteNote() {
        const id = this.activeNoteId;
        if (!id) return;
        
        if (confirm(`Are you sure you want to delete "${this.noteTitle()}"?`)) {
            await this.noteService.delete(id);
            this.noteSelected.emit('');
        }
    }

    undo() {
        (this.quill as any).history?.undo();
    }

    redo() {
        (this.quill as any).history?.redo();
    }

    selectAll() {
        this.quill.setSelection(0, this.quill.getLength());
    }

    showStats() {
        const text = this.quill.getText().trim();
        const chars = text.length;
        const words = text ? text.split(/\s+/).length : 0;
        alert(`Note Statistics:\nWords: ${words}\nCharacters: ${chars}`);
    }

    insertLink() {
        const range = this.quill.getSelection();
        if (range) {
            const url = prompt('Enter link URL:');
            if (url) {
                this.quill.formatText(range.index, range.length, 'link', url);
            }
        } else {
            alert('Please select some text first to insert a link.');
        }
    }

    insertDateTime() {
        const range = this.quill.getSelection();
        const index = range ? range.index : this.quill.getLength() - 1;
        const dateTimeStr = new Date().toLocaleString();
        this.quill.insertText(index, dateTimeStr);
        this.quill.setSelection(index + dateTimeStr.length, 0);
    }

    formatText(format: string) {
        const range = this.quill.getSelection();
        if (range) {
            const currentFormat = this.quill.getFormat(range);
            this.quill.format(format, !currentFormat[format]);
        } else {
            const currentFormat = this.quill.getFormat();
            this.quill.format(format, !currentFormat[format]);
        }
    }

    clearFormatting() {
        const range = this.quill.getSelection();
        if (range) {
            this.quill.removeFormat(range.index, range.length);
        } else {
            this.quill.removeFormat(0, this.quill.getLength());
        }
    }

    printNote() {
        window.print();
    }

    private unsubscribeAll() {
        this.sub?.unsubscribe();
        this.sub = undefined;
        this.spaceSub?.unsubscribe();
        this.spaceSub = undefined;
        this.saveSub?.unsubscribe();
        this.saveSub = undefined;
        this.titleSub?.unsubscribe();
        this.titleSub = undefined;
    }

    ngOnDestroy() {
        this.savePendingChanges().then(() => {
            this.unsubscribeAll();
            this.contentChangeSubject.complete();
            this.titleChangeSubject.complete();
        });
    }
}

