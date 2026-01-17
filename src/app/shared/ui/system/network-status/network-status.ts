import {
  Component,
  inject,
  signal,
  effect,
  OnDestroy
} from '@angular/core';
import { NetworkService } from '../../../../core/quilix-installer/network/network.service';


@Component({
  selector: 'app-network-status',
  imports: [],
  templateUrl: './network-status.html',
  styleUrl: './network-status.scss',
})
export class NetworkStatus implements OnDestroy {

  readonly network = inject(NetworkService);
  readonly visible = signal(false);

  private hideTimer: number | null = null;
  private initialized = false;

  constructor() {
    effect(() => {
      const phase = this.network.phase();

      // Skip first run to prevent initial load flicker
      if (!this.initialized) {
        this.initialized = true;
        this.visible.set(phase !== 'online');
        return;
      }

      // Always visible while offline or reconnecting
      if (phase === 'offline' || phase === 'connecting') {
        this.clearHideTimer();
        this.visible.set(true);
        return;
      }

      // Online → briefly show then hide
      if (phase === 'online' && this.visible()) {
        this.clearHideTimer();
        this.hideTimer = window.setTimeout(() => {
          this.visible.set(false);
          this.hideTimer = null;
        }, 1500);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearHideTimer();
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

}
