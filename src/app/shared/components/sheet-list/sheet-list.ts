import { Component, Input, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SheetService } from '../../../core/services/components/sheet.service';
import { SheetDocument } from '../../../core/interfaces/sheet';

@Component({
    selector: 'app-sheet-list',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './sheet-list.html',
    styleUrl: './sheet-list.scss'
})
export class SheetListComponent implements OnInit, OnDestroy {
    @Input() spaceId!: string;
    @Input() routePrefix!: 'personal' | 'team';

    private sheetService = inject(SheetService);

    sheets = signal<SheetDocument[]>([]);
    
    private sub: any;

    ngOnInit() {
        if (this.spaceId) {
            this.sub = this.sheetService.getSheetsForSpace(this.spaceId).subscribe(docs => {
                this.sheets.set(docs);
            });
        }
    }

    async createNewDoc() {
        if (!this.spaceId) return;
        const name = prompt('Enter spreadsheet name:', 'Untitled Spreadsheet');
        if (name) {
            await this.sheetService.create(this.spaceId, name);
        }
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
}
