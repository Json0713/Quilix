import { Component, inject, signal, effect } from '@angular/core';
import { NetworkService } from '../../../../core/quilix-installer/network/network.service';


@Component({
  selector: 'app-network-status',
  imports: [],
  templateUrl: './network-status.html',
  styleUrl: './network-status.scss',
})
export class NetworkStatus {

  readonly network = inject(NetworkService);
  readonly visible = signal(false);

  constructor() {
    effect(() => {
      const phase = this.network.phase();

      if (phase === 'offline' || phase === 'connecting') {
        this.visible.set(true);
      }

      if (phase === 'online' && this.visible()) {
        // show "Connected" briefly, then hide
        setTimeout(() => this.visible.set(false), 1500);
      }
    });
  }

}
