import { Component, inject, HostListener, effect, Renderer2, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { Import } from '../../../components/import/import';
import { TaskDetailComponent } from '../../tasks/task-detail/task-detail';
import { CreateWorkspaceComponent } from '../../../components/workspace-manager/create-workspace/create-workspace';
import { EditWorkspaceComponent } from '../../../components/workspace-manager/edit-workspace/edit-workspace';
import { DetailsView } from '../../../components/space-manager/file-explorer/details-view/details-view';
import { GlobalSearchComponent } from '../../../components/global-search/global-search';
import { Router, NavigationStart } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SharedClockWidget } from '../../../widgets/clock-widget';
import { SharedCalendarWidget } from '../../../widgets/calendar-widget';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, Import, TaskDetailComponent, CreateWorkspaceComponent, EditWorkspaceComponent, DetailsView, GlobalSearchComponent, SharedClockWidget, SharedCalendarWidget],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal implements OnDestroy {

  readonly modal = inject(ModalService);
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  private dismissedOnceNotices = new Set<string>();
  private lastModalId: number | null = null;
  private routerSub: Subscription;

  noticeDismissed = false;

  constructor() {
    // Observe modal changes
    effect(() => {
      const current = this.modal.modal();
      if (!current) {
        return;
      }

      if (current.id !== this.lastModalId) {
        this.lastModalId = current.id;

        const notice = current.notice;
        if (!notice) {
          this.noticeDismissed = false;
          return;
        }

        if (notice.scope === 'once') {
          this.noticeDismissed = this.dismissedOnceNotices.has(notice.message);
        } else {
          this.noticeDismissed = false;
        }
      }
    });

    // Listen to router navigation events (back/forward)
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart && this.modal.modal()) {
        // Close modal when navigating away
        this.cancel();
      }
    });
  }

  dismissNotice(): void {
    const notice = this.modal.modal()?.notice;
    if (!notice) return;

    if (notice.scope === 'once') {
      this.dismissedOnceNotices.add(notice.message);
    }

    this.noticeDismissed = true;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  confirm(): void {
    this.modal.confirmResult();
  }

  cancel(): void {
    this.modal.cancelResult();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
