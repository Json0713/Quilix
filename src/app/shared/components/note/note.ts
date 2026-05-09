import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService } from '../../../core/services/components/note.service';
import { Subject, debounceTime } from 'rxjs';
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
    
    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
    
    private noteService = inject(NoteService);
    private breadcrumbService = inject(BreadcrumbService);
    
    quill!: Quill;
    noteTitle = signal<string>('Loading...');
    isSaving = signal<boolean>(false);
    
    private contentChangeSubject = new Subject<string>();
    private sub: any;
    private saveSub: any;
    private titleTimeout: any;

    ngOnInit() {
        this.initQuill();

        if (this.noteId) {
            this.sub = this.noteService.liveDoc$(this.noteId).subscribe(note => {
                if (note) {
                    this.noteTitle.set(note.name);
                    
                    // Only update content if editor is empty or it's a completely different doc
                    // to prevent cursor jumping while typing
                    if (this.quill.root.innerHTML === '<p><br></p>' && note.content) {
                        this.quill.root.innerHTML = note.content;
                    }
                }
            });
            
            // Set up debounced saving
            this.saveSub = this.contentChangeSubject.pipe(
                debounceTime(1000)
            ).subscribe(async content => {
                this.isSaving.set(true);
                await this.noteService.update(this.noteId, { content });
                setTimeout(() => {
                    this.isSaving.set(false);
                }, 500); // Small delay to show the saving state to the user
            });
        }
    }

    updateTitle(newName: string) {
        const trimmed = newName.trim();
        this.noteTitle.set(newName); // Update local state immediately for visual feedback
        
        clearTimeout(this.titleTimeout);
        this.titleTimeout = setTimeout(async () => {
            if (trimmed !== '') {
                await this.noteService.update(this.noteId, { name: trimmed });
                this.breadcrumbService.setTitle(trimmed);
            }
        }, 800);
    }

    private initQuill() {
        this.quill = new Quill(this.editorContainer.nativeElement, {
            theme: 'snow',
            placeholder: 'Start writing your note...',
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
            this.contentChangeSubject.next(content);
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
        this.saveSub?.unsubscribe();
        this.contentChangeSubject.complete();
    }
}
