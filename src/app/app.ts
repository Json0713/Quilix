import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AppThemeService } from './core/theme/app-theme/app-theme.service';

import { NetworkStatus } from './shared/ui/system/network-status/network-status';
import { NetworkService } from './core/quilix-installer/network/network.service';
import { QuilixUpdateService } from './core/quilix-installer/quilix-update.service';
import { ToastRelayService } from './services/ui/common/toast/toast-relay';

import { Loader } from './shared/ui/common/loader/loader';
import { Modal } from './shared/ui/common/modal/modal';
import { ToastService } from './services/ui/common/toast/toast';
import { Toast } from './shared/ui/common/toast/toast';

import { GlobalSyncService } from './core/sync/global-sync.service';
import { Tooltip } from './shared/ui/common/tooltip/tooltip';
import { TooltipManagerService } from './core/services/tooltip-manager.service';
import { FileSystemService } from './core/services/file-system.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, NetworkStatus, Loader, Toast, Modal, Tooltip],
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  protected readonly title = signal('Quilix');
  readonly network = inject(NetworkService);

  private toastRelay = inject(ToastRelayService);
  private toast = inject(ToastService);
  private updates = inject(QuilixUpdateService);
  private theme = inject(AppThemeService);
  private sync: GlobalSyncService = inject(GlobalSyncService);
  private tooltipManager = inject(TooltipManagerService);
  private fileSystem = inject(FileSystemService);

  constructor() {
    this.toastRelay.consume();
    this.updates.init();
    this.theme.init();
    this.sync.init();
    this.tooltipManager.init();
    this.validateFileSystem();
  }

  private async validateFileSystem() {
    const mode = await this.fileSystem.getStorageMode();
    if (mode === 'filesystem') {
      const handle = await this.fileSystem.getStoredHandle();
      if (handle) {
        // Only run queryPermission by skipping the direct requestPermission prompt on normal boot
        const granted = await this.fileSystem.verifyPermission(handle, true, false);
        if (!granted) {
          // File system permission lacks user activation. Will request when interacting with files.
          // Don't disable filesystem or throw error. The handle is stored, 
          // let the app degrade gracefully or prompt when the user explicitly triggers a file operation.
        }
      } else {
        await this.fileSystem.disableFileSystem();
      }
    }
  }

}
