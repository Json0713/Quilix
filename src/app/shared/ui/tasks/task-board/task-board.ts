import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Task, TaskStatus } from '../../../../core/interfaces/task';
import { TaskColumnComponent } from '../task-column/task-column';
import { TaskService } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
    selector: 'app-task-board',
    standalone: true,
    imports: [CommonModule, DragDropModule, TaskColumnComponent],
    templateUrl: './task-board.html',
    styleUrl: './task-board.scss'
})
export class TaskBoardComponent implements OnChanges {
    @Input({ required: true }) tasks: Task[] = [];

    todoTasks: Task[] = [];
    progressTasks: Task[] = [];
    completedTasks: Task[] = [];

    private taskService = inject(TaskService);
    private authService = inject(AuthService);

    ngOnChanges(changes: SimpleChanges) {
        if (changes['tasks']) {
            this.categorizeTasks();
        }
    }

    /**
     * Structurally bind the parent state array into three physical Drag & Drop lane arrays, securely ordered.
     */
    private categorizeTasks() {
        // Sort tasks identically mapping to exact Native Order structures
        this.todoTasks = this.tasks.filter(t => t.status === 'todo').sort((a, b) => a.order - b.order);
        this.progressTasks = this.tasks.filter(t => t.status === 'progress').sort((a, b) => a.order - b.order);
        this.completedTasks = this.tasks.filter(t => t.status === 'completed').sort((a, b) => a.order - b.order);
    }

    /**
   * Listen to CdkDragDrop streams dispatched natively from embedded Columns and securely mutate Storage payload.
   */
    async drop(event: CdkDragDrop<Task[]>) {
        const activeWorkspace = await this.authService.getCurrentWorkspace();
        const wsName = activeWorkspace?.name || 'workspace';

        if (event.previousContainer === event.container) {
            // Mutation contained strictly within identical column lane
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

            const orderedTasks = event.container.data.map((task, index) => ({ ...task, order: index }));
            await this.taskService.updateTaskOrders(orderedTasks, wsName);
        } else {
            // Horizontal cross-container mutation
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex,
            );

            const newStatus = event.container.id as TaskStatus;

            // Rewrite the new host Column indexes and overwrite the old status 
            const targetList = event.container.data.map((task, index) => ({ ...task, status: newStatus, order: index }));

            // Condense old Container array logic synchronously 
            const sourceList = event.previousContainer.data.map((task, index) => ({ ...task, order: index }));

            const combinedPayload = [...sourceList, ...targetList];
            await this.taskService.updateTaskOrders(combinedPayload, wsName);
        }
    }
}
