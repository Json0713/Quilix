import { Component, Input, signal, ElementRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../../core/interfaces/task';
import { ModalService } from '../../../../services/ui/common/modal/modal';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-card.html',
    styleUrl: './task-card.scss'
})
export class TaskCardComponent {
    @Input({ required: true }) task!: Task;

    isMenuOpen = signal(false);
    private el = inject(ElementRef);
    private modalService = inject(ModalService);

    openDetails() {
        this.modalService.openTaskDetail(this.task);
    }

    toggleMenu(event: Event) {
        event.stopPropagation();
        this.isMenuOpen.set(!this.isMenuOpen());
    }

    @HostListener('document:click', ['$event'])
    closeMenu(event: Event) {
        if (!this.el.nativeElement.contains(event.target)) {
            this.isMenuOpen.set(false);
        }
    }
}
