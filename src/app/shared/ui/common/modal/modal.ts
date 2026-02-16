import { Component, inject, HostListener, effect } from '@angular/core';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { Import } from '../../../components/import/import';
import { Router, NavigationStart } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  imports: [CommonModule, Import],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {

  readonly modal = inject(ModalService);
  private router = inject(Router);

  private dismissedOnceNotices = new Set<string>();
  private lastModalId: number | null = null;

  noticeDismissed = false;

  constructor() {
    // Observe modal changes
    effect(() => {
      const current = this.modal.modal();
      if (!current) return;

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
    this.router.events.subscribe(event => {
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
}
