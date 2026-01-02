import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '.././../../shared/ui/toast/toast.model';

@Injectable({
  providedIn: 'root',
})
export class ToastService {

  private readonly _toasts = signal<Toast[]>([]);
  private id = 0;

  readonly toasts = this._toasts.asReadonly();

  show(type: ToastType, message: string, duration = 4000): void {
    const toast: Toast = {
      id: ++this.id,
      type,
      message,
      duration,
    };

    this._toasts.update(t => [...t, toast]);
    setTimeout(() => this.remove(toast.id), duration);
  }

  success(msg: string, d?: number): void { this.show('success', msg, d); }
  error(msg: string, d?: number): void { this.show('error', msg, d); }
  warning(msg: string, d?: number): void { this.show('warning', msg, d); }
  info(msg: string, d?: number): void { this.show('info', msg, d); }

  remove(id: number): void {
    this._toasts.update(t => t.filter(toast => toast.id !== id));
  }

}
