import { Injectable, signal, OnDestroy } from '@angular/core';
import { ToastService } from '../../../services/ui/common/toast/toast';

export type NetworkPhase = 'offline' | 'connecting' | 'online';


@Injectable({
  providedIn: 'root',
})
export class NetworkService implements OnDestroy {

  /** Raw browser online state */
  private readonly _online = signal<boolean>(navigator.onLine);
  readonly online = this._online.asReadonly();

  /** UX-oriented network phase */
  private readonly _phase = signal<NetworkPhase>(
    navigator.onLine ? 'online' : 'offline'
  );
  readonly phase = this._phase.asReadonly();

  /** Internal reconnect timer */
  private reconnectTimer: number | null = null;

  constructor(private toast: ToastService) {
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);
  }

  /** Cleanup to avoid leaks in HMR / tests */
  ngOnDestroy(): void {
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('online', this.handleOnline);

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
  }

  /** Browser reports loss of network */
  private handleOffline = (): void => {
    if (!this._online()) return; // guard against duplicate events

    this._online.set(false);
    this._phase.set('offline');

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.toast.warning(
      'You’re using Offline Mode.',
      5000
    );
  };

  /** Browser reports network restoration */
  private handleOnline = (): void => {
    if (this._online()) return; // guard against duplicate events

    this._online.set(true);
    this._phase.set('connecting');

    // Smooth reconnection to avoid flicker on unstable networks
    this.reconnectTimer = window.setTimeout(() => {
      this._phase.set('online');
      this.toast.success('You’re back online.', 3000);
      this.reconnectTimer = null;
    }, 3200);
  };

}
