import {
  Component,
  inject,
  signal,
  effect,
  OnDestroy
} from '@angular/core';
import { NetworkService } from '../../../../core/quilix-installer/network/network.service';

const IDLE_ACK_KEY = 'network-idle-acknowledged';

@Component({
  selector: 'app-network-status',
  imports: [],
  templateUrl: './network-status.html',
  styleUrl: './network-status.scss',
})
export class NetworkStatus implements OnDestroy {

  readonly network = inject(NetworkService);

  readonly visible = signal(false);
  readonly idle = signal(false);

  private hideTimer: number | null = null;
  private idleTimer: number | null = null;
  private initialized = false;

  constructor() {
    effect(() => {
      const phase = this.network.phase();

      // Prevent initial flicker
      if (!this.initialized) {
        this.initialized = true;

        if (phase !== 'online') {
          this.visible.set(true);

          if (this.wasIdleAcknowledged()) {
            this.idle.set(true);
          } else {
            this.idle.set(false);
            this.startIdleTimer();
          }
        }

        return;
      }


      // OFFLINE / CONNECTING
      if (phase === 'offline' || phase === 'connecting') {
        this.clearHideTimer();
        this.visible.set(true);

        if (this.wasIdleAcknowledged()) {
          this.idle.set(true);
        } else {
          this.idle.set(false);
          this.startIdleTimer();
        }

        return;
      }

      // ONLINE
      if (phase === 'online' && this.visible()) {
        this.clearIdleTimer();
        this.idle.set(false);
        this.clearIdleAcknowledged();

        this.clearHideTimer();
        this.hideTimer = window.setTimeout(() => {
          this.visible.set(false);
          this.hideTimer = null;
        }, 6500);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearHideTimer();
    this.clearIdleTimer();
  }

  // ----- Idle logic ----- //
  private startIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = window.setTimeout(() => {
      this.idle.set(true);
      this.markIdleAcknowledged();
      this.idleTimer = null;
    }, 6000); // 6 seconds
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }


  // ------ sessionStorage helpers ------ //
  private wasIdleAcknowledged(): boolean {
    return sessionStorage.getItem(IDLE_ACK_KEY) === 'true';
  }

  private markIdleAcknowledged(): void {
    sessionStorage.setItem(IDLE_ACK_KEY, 'true');
  }

  private clearIdleAcknowledged(): void {
    sessionStorage.removeItem(IDLE_ACK_KEY);
  }

}
