import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { from, Subscription } from 'rxjs';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TaskBoardComponent } from '../../../../shared/ui/tasks/task-board/task-board';
import { TaskService } from '../../../../core/services/components/task.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Task } from '../../../../core/interfaces/task';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';

@Component({
  selector: 'app-personal-tasks',
  standalone: true,
  imports: [CommonModule, TaskBoardComponent, PageHeaderActionsDirective],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class PersonalTasks implements OnInit, OnDestroy {
  private breadcrumbService = inject(BreadcrumbService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);

  private sub: Subscription | null = null;
  readonly tasks = signal<Task[]>([]);

  get totalTasks() { return this.tasks().length; }
  get inProgressTasks() { return this.tasks().filter(t => t.status === 'progress').length; }
  get completedTasks() { return this.tasks().filter(t => t.status === 'completed').length; }

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Tasks');

    const ws = await this.authService.getCurrentWorkspace();
    if (ws) {
      this.sub = from(this.taskService.liveTasks$(ws.id)).subscribe(tasks => {
        this.tasks.set(tasks);
      });
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  // Quick Demo helper
  async seedDemoTask() {
    const ws = await this.authService.getCurrentWorkspace();
    if (ws) {
      await this.taskService.create(ws.id, ws.name, 'Implement Kanban Drag & Drop Engine');
    }
  }
}
