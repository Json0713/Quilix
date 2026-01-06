import { Component } from '@angular/core';
import { inject, HostListener } from '@angular/core';
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

  confirm(): void {
    this.modal.confirmResult();
  }

  cancel(): void {
    this.modal.cancelResult();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }
  
}
