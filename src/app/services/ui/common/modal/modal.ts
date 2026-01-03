import { Injectable, signal } from '@angular/core';
import { ModalConfig } from '../../../../shared/ui/common/modal/modal.model';

@Injectable({
  providedIn: 'root',
})
export class ModalService {

  private readonly _modal = signal<ModalConfig | null>(null);
  private id = 0;

  readonly modal = this._modal.asReadonly();

  confirm(
    message: string,
    options?: Partial<Omit<ModalConfig, 'id' | 'message' | 'type'>>
  ): Promise<boolean> {
    return new Promise(resolve => {
      this._modal.set({
        id: ++this.id,
        type: 'confirm',
        message,
        title: options?.title ?? 'Confirm',
        confirmText: options?.confirmText ?? 'Confirm',
        cancelText: options?.cancelText ?? 'Cancel',
        resolve,
      });
    });
  }

  alert(
    message: string,
    options?: Partial<Omit<ModalConfig, 'id' | 'message' | 'type'>>
  ): void {
    this._modal.set({
      id: ++this.id,
      type: 'alert',
      message,
      title: options?.title ?? 'Notice',
      confirmText: options?.confirmText ?? 'OK',
    });
  }

  /** Called only by Confirm button */
  confirmResult(): void {
    const modal = this._modal();
    modal?.resolve?.(true);
    this._modal.set(null);
  }

  /** Called by Cancel, backdrop, ESC */
  cancelResult(): void {
    const modal = this._modal();
    modal?.resolve?.(false);
    this._modal.set(null);
  }
  
}
