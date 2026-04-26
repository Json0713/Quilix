import { Component, Input, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SheetService } from '../../../core/services/components/sheet.service';
import { SheetDocument } from '../../../core/interfaces/sheet';

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

    sheets = signal<SheetDocument[]>([]);
    isCreating = signal<boolean>(false);
    newItemName = signal<string>('Untitled Spreadsheet');
    
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

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }
}
