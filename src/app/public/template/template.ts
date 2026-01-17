import { Component, inject } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { Loader } from '../../shared/ui/common/loader/loader';
import { Toast } from '../../shared/ui/common/toast/toast';
import { Modal } from '../../shared/ui/common/modal/modal';
import { ToastRelayService } from '../../services/ui/common/toast/toast-relay';

import { QuilixInstaller } from '../../shared/components/quilix-installer/quilix-installer';
import { QuilixUpdateService } from '../../core/quilix-installer/quilix-update.service';
import { NetworkService } from '../../core/quilix-installer/network/network.service';

@Component({
  selector: 'app-template',
  imports: [RouterOutlet, QuilixInstaller, Loader, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

  readonly network = inject(NetworkService);
  private updates = inject(QuilixUpdateService);
  private toastRelay = inject(ToastRelayService);

  constructor() {
    this.toastRelay.consume();
    this.updates.init();
  }

}

