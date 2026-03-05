import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ManagedWorkspace } from '../workspace-manager';

@Component({
    selector: 'app-workspace-card',
    standalone: true,
    imports: [CommonModule, DragDropModule],
    templateUrl: './workspace-card.html',
    styleUrls: ['./workspace-card.scss']
})
export class WorkspaceCardComponent {
    @Input({ required: true }) workspace!: ManagedWorkspace;
    @Input() isCurrentWorkspace = false;
    @Input() isFileSystemMode = false;
    @Input() isSelectionMode = false;
    @Input() isSelected = false;
    @Input() isMenuOpen = false;
    @Input() isLast = false;
    @Input() viewMode: 'list' | 'card' = 'list';

    @Output() restoreWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() trashWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() switchWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() toggleSelect = new EventEmitter<string>();
    @Output() renameWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() toggleMenu = new EventEmitter<Event>();
}
