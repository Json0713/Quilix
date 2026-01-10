import { Component } from '@angular/core';
import { inject, HostListener, effect } from '@angular/core';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { Import } from '../../../components/import/import';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  imports: [ CommonModule, Import],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {

  readonly modal = inject(ModalService);

  private dismissedOnceNotices = new Set<string>();
  private lastModalId: number | null = null;

  noticeDismissed = false;

  constructor() {

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
