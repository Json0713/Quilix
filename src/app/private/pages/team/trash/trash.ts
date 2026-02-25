import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrashComponent } from '../../../../shared/components/trash/trash';

@Component({
    selector: 'app-team-trash',
    standalone: true,
    imports: [CommonModule, TrashComponent],
    template: `
        <div class="page-container" style="padding: 24px;">
            <app-trash></app-trash>
        </div>
    `
})
export class TeamTrash { }
