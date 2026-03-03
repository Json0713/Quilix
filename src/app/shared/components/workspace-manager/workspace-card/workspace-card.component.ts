import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ManagedWorkspace, ManagedSpace } from '../workspace-manager';

@Component({
    selector: 'app-workspace-card',
    standalone: true,
    imports: [CommonModule, DragDropModule],
    templateUrl: './workspace-card.component.html',
    styleUrls: ['./workspace-card.component.scss']
})
export class WorkspaceCardComponent {
    @Input({ required: true }) workspace!: ManagedWorkspace;
    @Input() isCurrentWorkspace = false;
    @Input() isFileSystemMode = false;
    @Input() isExpanded = false;
    @Input() isSelectionMode = false;
    @Input() isSelected = false;
    @Input() isConfirmingTrash = false;
    @Input() spaces: ManagedSpace[] = [];
    @Input() isLoadingSpaces = false;
    @Input() hasMissingSpaces = false;

    @Output() restoreWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() toggleExpand = new EventEmitter<ManagedWorkspace>();
    @Output() requestTrash = new EventEmitter<ManagedWorkspace>();
    @Output() confirmTrash = new EventEmitter<ManagedWorkspace>();
    @Output() cancelTrash = new EventEmitter<void>();
    @Output() toggleSelect = new EventEmitter<string>();
    @Output() restoreAllSpaces = new EventEmitter<ManagedWorkspace>();
    @Output() restoreSpace = new EventEmitter<{ workspace: ManagedWorkspace, space: ManagedSpace }>();
}
