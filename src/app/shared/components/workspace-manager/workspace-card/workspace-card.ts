import { Component, Input, Output, EventEmitter, HostListener, ElementRef, inject, OnChanges, SimpleChanges } from '@angular/core';
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
export class WorkspaceCardComponent implements OnChanges {
    @Input({ required: true }) workspace!: ManagedWorkspace;
    @Input() isFileSystemMode = false;
    @Input() isSelectionMode = false;
    @Input() isSelected = false;
    @Input() isMenuOpen = false;
    @Input() viewMode: 'list' | 'card' = 'list';

    private el = inject(ElementRef);
    isDropdownUp = false;

    @Output() restoreWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() trashWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() switchWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() toggleSelect = new EventEmitter<string>();
    @Output() renameWorkspace = new EventEmitter<ManagedWorkspace>();
    @Output() toggleMenu = new EventEmitter<Event>();

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isMenuOpen'] && changes['isMenuOpen'].currentValue) {
            // Coordinate check must run purely SYNCHRONOUSLY before the dropdown DOM visually mounts!
            const triggerEl = this.el.nativeElement.querySelector('.menu-trigger');
            if (triggerEl) {
                const rect = triggerEl.getBoundingClientRect();
                // Guaranteed CSS !important now allows this calculation to correctly visually manifest in Grid view!
                this.isDropdownUp = (window.innerHeight - rect.bottom) < 120;
            }
        } else if (changes['isMenuOpen'] && !changes['isMenuOpen'].currentValue) {
            // reset state when closed so it cleanly mounts fresh next time
            this.isDropdownUp = false;
        }
    }

    formatBytes(bytes: number | undefined): string {
        if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '--';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = 2;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}
