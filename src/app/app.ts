import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

import { NetworkStatus } from './shared/ui/system/network-status/network-status';
import { NetworkService } from './core/quilix-installer/network/network.service';
import { QuilixUpdateService } from './core/quilix-installer/quilix-update.service';
import { ToastRelayService } from './services/ui/common/toast/toast-relay';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, NetworkStatus],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  protected readonly title = signal('Quilix');
  readonly network = inject(NetworkService);

  private toastRelay = inject(ToastRelayService);
  private updates = inject(QuilixUpdateService);

  constructor() {
    this.toastRelay.consume();
    this.updates.init();
  }

}
