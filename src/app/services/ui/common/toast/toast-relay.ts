import { Injectable } from '@angular/core';
import { ToastService } from '../toast/toast';
import { ToastType } from '../../../../shared/ui/common/toast/toast.model';

interface PendingToast {
  type: ToastType;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastRelayService {
  
  private readonly KEY = 'quilix_post_reload_toast';

  constructor(
    private toast: ToastService
  ) {

  }

  /** Call BEFORE reload */
  set(type: ToastType, message: string, duration?: number): void {
    const payload: PendingToast = { type, message, duration };
    sessionStorage.setItem(this.KEY, JSON.stringify(payload));
  }

  /** Call ON app bootstrap */
  consume(): void {
    const raw = sessionStorage.getItem(this.KEY);
    if (!raw) return;

    sessionStorage.removeItem(this.KEY);

    try {
      const toast = JSON.parse(raw) as PendingToast;
      this.toast.show(toast.type, toast.message, toast.duration);
    } catch {
      // silent fail — bad data shouldn't crash app
    }
  }
}
