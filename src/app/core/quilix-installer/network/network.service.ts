import { Injectable, signal } from '@angular/core';
import { ToastService } from '../../../services/ui/common/toast/toast';


@Injectable({
  providedIn: 'root',
})
export class NetworkService {

  private readonly _online = signal<boolean>(navigator.onLine);
  readonly online = this._online.asReadonly();

  private wasOffline = !navigator.onLine;

  constructor(private toast: ToastService) {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    this._online.set(true);

    if (this.wasOffline) {
      this.toast.success('You’re back online.', 12000);
    }

    this.wasOffline = false;
  };

  private handleOffline = (): void => {
    this._online.set(false);

    if (!this.wasOffline) {
      this.toast.warning(
        'You’re offline. Some features may be unavailable.',
        12000
      );
    }

    this.wasOffline = true;
  };
}
