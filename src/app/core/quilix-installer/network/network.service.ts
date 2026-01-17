import { Injectable, signal } from '@angular/core';
import { ToastService } from '../../../services/ui/common/toast/toast';

export type NetworkPhase = 'offline' | 'connecting' | 'online';


@Injectable({
  providedIn: 'root',
})
export class NetworkService {

  private readonly _online = signal<boolean>(navigator.onLine);
  readonly online = this._online.asReadonly();

  private readonly _phase = signal<NetworkPhase>(
    navigator.onLine ? 'online' : 'offline'
  );
  readonly phase = this._phase.asReadonly();

  constructor(private toast: ToastService) {
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);
  }

  private handleOffline = (): void => {
    this._online.set(false);
    this._phase.set('offline');

    this.toast.warning(
      'You’re offline. Some features may be unavailable.',
      5000
    );
  };

  private handleOnline = (): void => {
    this._online.set(true);
    this._phase.set('connecting');

    // simulate real reconnection stabilization
    setTimeout(() => {
      this._phase.set('online');
      this.toast.success('You’re back online.', 3000);
    }, 1200);
  };

}
