import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { ModalService } from '../../../../services/ui/common/modal/modal';

@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly modal = inject(ModalService);

  confirm(): void {
    this.modal.close(true);
  }

  cancel(): void {
    this.modal.close(false);
  }
}
