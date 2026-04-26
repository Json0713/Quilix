import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SheetComponent } from '../../../../shared/components/sheet/sheet';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { SheetService } from '../../../../core/services/components/sheet.service';

@Component({
    selector: 'app-sheet-page',
    standalone: true,
    imports: [CommonModule, SheetComponent, PageHeaderActionsDirective],
    templateUrl: './sheet-page.html',
    styleUrl: './sheet-page.scss'
})
export class SheetPage implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private location = inject(Location);
    private breadcrumbService = inject(BreadcrumbService);
    private sheetService = inject(SheetService);

    spaceId = signal<string | null>(null);
    sheetId = signal<string | null>(null);
    loading = signal(true);

    private paramSub: any;

    ngOnInit() {
        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            const sheetId = params['sheetId'];

            this.spaceId.set(spaceId);
            this.sheetId.set(sheetId);
            
            this.loading.set(true);
            
            if (sheetId) {
                const sheet = await this.sheetService.getById(sheetId);
                if (sheet) {
                    this.breadcrumbService.setTitle(sheet.name);
                } else {
                    this.breadcrumbService.setTitle('Spreadsheet Not Found');
                }
            }
            
            this.loading.set(false);
        });
    }

    goBack() {
        // Go back to the space view
        this.location.back();
    }

    onSheetSelected(newSheetId: string) {
        if (this.spaceId()) {
            // Determine if personal or team based on current route
            const isTeam = this.router.url.includes('/team/');
            const prefix = isTeam ? 'team' : 'personal';
            this.router.navigate(['/', prefix, 'spaces', this.spaceId(), 'sheet', newSheetId]);
        }
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
    }
}
