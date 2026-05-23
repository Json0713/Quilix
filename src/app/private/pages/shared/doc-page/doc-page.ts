import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DocComponent } from '../../../../shared/components/doc/doc';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { DocService } from '../../../../core/services/components/doc.service';

@Component({
    selector: 'app-doc-page',
    standalone: true,
    imports: [CommonModule, DocComponent],
    templateUrl: './doc-page.html',
    styleUrl: './doc-page.scss'
})
export class DocPage implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private location = inject(Location);
    private breadcrumbService = inject(BreadcrumbService);
    private docService = inject(DocService);

    spaceId = signal<string | null>(null);
    docId = signal<string | null>(null);
    loading = signal(true);

    private paramSub: any;

    ngOnInit() {
        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            const docId = params['docId'];

            this.spaceId.set(spaceId);
            this.docId.set(docId);
            
            this.loading.set(true);
            
            if (docId) {
                const doc = await this.docService.getById(docId);
                if (doc) {
                    this.breadcrumbService.setTitle(doc.name);
                } else {
                    this.breadcrumbService.setTitle('Document Not Found');
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

    onDocSelected(selectedDocId: string) {
        if (!selectedDocId) {
            this.goBack();
        } else {
            const isTeam = this.router.url.includes('/team/');
            const prefix = isTeam ? 'team' : 'personal';
            this.router.navigate(['/', prefix, 'spaces', this.spaceId(), 'doc', selectedDocId]);
        }
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
    }
}
