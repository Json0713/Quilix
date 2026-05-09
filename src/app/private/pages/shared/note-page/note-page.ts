import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NoteComponent } from '../../../../shared/components/note/note';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { NoteService } from '../../../../core/services/components/note.service';

@Component({
    selector: 'app-note-page',
    standalone: true,
    imports: [CommonModule, NoteComponent],
    templateUrl: './note-page.html',
    styleUrl: './note-page.scss'
})
export class NotePage implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private location = inject(Location);
    private breadcrumbService = inject(BreadcrumbService);
    private noteService = inject(NoteService);

    spaceId = signal<string | null>(null);
    noteId = signal<string | null>(null);
    loading = signal(true);

    private paramSub: any;

    ngOnInit() {
        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            const noteId = params['noteId'];

            this.spaceId.set(spaceId);
            this.noteId.set(noteId);
            
            this.loading.set(true);
            
            if (noteId) {
                const note = await this.noteService.getById(noteId);
                if (note) {
                    this.breadcrumbService.setTitle(note.name);
                } else {
                    this.breadcrumbService.setTitle('Note Not Found');
                }
            }
            
            this.loading.set(false);
        });
    }

    goBack() {
        if (this.spaceId()) {
            const isTeam = this.router.url.includes('/team/');
            const prefix = isTeam ? 'team' : 'personal';
            this.router.navigate(['/', prefix, 'spaces', this.spaceId()]);
        } else {
            this.location.back();
        }
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
    }
}
