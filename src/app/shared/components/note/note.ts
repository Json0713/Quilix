import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../../core/services/components/note.service';
import { NoteDocument } from '../../../core/interfaces/note';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import Quill from 'quill';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
    selector: 'app-note',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './note.html',
    styleUrl: './note.scss',
    encapsulation: ViewEncapsulation.None
})
export class NoteComponent implements OnInit, OnDestroy {
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
    
    private contentChangeSubject = new Subject<string>();
    private titleChangeSubject = new Subject<string>();
    
    private sub?: { unsubscribe: () => void };
    private spaceSub?: { unsubscribe: () => void };
    private saveSub?: Subscription;
    private titleSub?: Subscription;
    
    private lastSavedContent = '';

    ngOnInit() {
        this.initQuill();

        if (this.noteId) {
            this.sub = this.noteService.liveDoc$(this.noteId).subscribe(note => {
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
                    
                    const currentContent = this.quill.root.innerHTML;
                    if (note.content && note.content !== currentContent && note.content !== this.lastSavedContent) {
                        const range = this.quill.getSelection();
                        this.quill.root.innerHTML = note.content;
                        this.lastSavedContent = note.content;
                        
                        if (range) {
                            setTimeout(() => this.quill.setSelection(range.index, range.length), 0);
                        }
                    }
                } else {
                    this.activeDoc.set(null);
                }
            });
            
            this.saveSub = this.contentChangeSubject.pipe(
                debounceTime(1000)
            ).subscribe(async content => {
                this.isSaving.set(true);
                this.saveStatus.set('Saving...');
                this.lastSavedContent = content;
                
                try {
                    await this.noteService.update(this.noteId, { content });
                    this.saveStatus.set('Saved to space');
                } catch (e) {
                    console.error('Failed to save note', e);
                    this.saveStatus.set('Save failed');
                } finally {
                    setTimeout(() => {
                        this.isSaving.set(false);
                    }, 500);
                }
            });
            
            this.titleSub = this.titleChangeSubject.pipe(
                debounceTime(800),
                distinctUntilChanged()
            ).subscribe(async newName => {
                const trimmed = newName.trim();
                const doc = this.activeDoc();
                if (trimmed !== '' && doc && !this.isTitleDuplicate()) {
                    this.isSaving.set(true);
                    this.saveStatus.set('Saving...');
                    
                    try {
                        await this.noteService.update(this.noteId, { name: trimmed });
                        this.breadcrumbService.setTitle(trimmed);
                        this.saveStatus.set('Saved to space');
                    } catch (e) {
                        console.error('Failed to save title', e);
                        this.saveStatus.set('Save failed');
                    } finally {
                        setTimeout(() => this.isSaving.set(false), 500);
                    }
                }
            });
        }
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
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
        this.spaceSub?.unsubscribe();
        this.saveSub?.unsubscribe();
        this.titleSub?.unsubscribe();
        this.contentChangeSubject.complete();
        this.titleChangeSubject.complete();
    }
}
