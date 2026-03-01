import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Task, TaskStatus } from '../../../../core/interfaces/task';
import { TaskCardComponent } from '../task-card/task-card';

@Component({
    selector: 'app-task-column',
    standalone: true,
    imports: [CommonModule, DragDropModule, TaskCardComponent],
    templateUrl: './task-column.html',
    styleUrl: './task-column.scss'
})
export class TaskColumnComponent {
    @Input({ required: true }) title!: string;
    @Input({ required: true }) status!: TaskStatus;
    @Input({ required: true }) tasks: Task[] = [];
    @Input({ required: true }) connectedTo: string[] = [];

    @Output() dropped = new EventEmitter<CdkDragDrop<Task[]>>();
}
