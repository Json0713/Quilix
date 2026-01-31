import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AppThemeService } from './core/theme/app-theme/app-theme.service';

import { NetworkStatus } from './shared/ui/system/network-status/network-status';
import { NetworkService } from './core/quilix-installer/network/network.service';
import { QuilixUpdateService } from './core/quilix-installer/quilix-update.service';
import { ToastRelayService } from './services/ui/common/toast/toast-relay';

import { Loader } from './shared/ui/common/loader/loader';
import { Modal } from './shared/ui/common/modal/modal';
import { Toast } from './shared/ui/common/toast/toast';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, NetworkStatus, Loader, Toast, Modal],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  protected readonly title = signal('Quilix');
  readonly network = inject(NetworkService);

  private toastRelay = inject(ToastRelayService);
  private updates = inject(QuilixUpdateService);
  private theme = inject(AppThemeService);

  constructor() {
    this.toastRelay.consume();
    this.updates.init();
    this.theme.init();
  }

}
