import { Component, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AppThemeService } from './core/services/ui/app-theme.service';

import { NetworkStatus } from './shared/ui/system/network-status/network-status';
import { NetworkService } from './core/pwa/installer/network/network.service';
import { QuilixUpdateService } from './core/pwa/installer/quilix-update.service';
import { ToastRelayService } from './services/ui/common/toast/toast-relay';

import { Loader } from './shared/ui/common/loader/loader';
import { Modal } from './shared/ui/common/modal/modal';
import { ToastService } from './services/ui/common/toast/toast';
import { Toast } from './shared/ui/common/toast/toast';

import { GlobalSyncService } from './core/sync/global-sync.service';
import { Tooltip } from './shared/ui/common/tooltip/tooltip';
import { TooltipService } from './services/ui/common/tooltip/tooltip.service';
import { FileSystemService } from './core/services/data/file-system.service';
import { SystemSyncService } from './core/services/sync/system-sync.service';
import { PwaNavigationService } from './core/pwa/pwa-navigation.service';
import { ShortcutService } from './core/services/ui/shortcut.service';


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
  private tooltipManager = inject(TooltipService);
  private fileSystem = inject(FileSystemService);
  private systemSync = inject(SystemSyncService);
  private pwaNav = inject(PwaNavigationService);
  private shortcuts = inject(ShortcutService);


  constructor() {
    this.toastRelay.consume();
    this.updates.init();
    this.theme.init();
    this.sync.init();
    this.tooltipManager.init();
    this.systemSync.init();
    this.validateFileSystem();
    this.pwaNav.init();
    this.shortcuts.init();
  }

  private async validateFileSystem() {
    const mode = await this.fileSystem.getStorageMode();
    if (mode === 'filesystem') {
      try {
        const handle = await this.fileSystem.getStoredHandle();
        if (handle) {
          // Silent check only — don't prompt on boot (requires user gesture)
          await this.fileSystem.verifyPermission(handle, true, false);
          // hasPermission signal is set inside verifyPermission
        } else {
          // Handle is missing (cleared, corrupted, or from another origin)
          await this.fileSystem.disableFileSystem();
        }
      } catch (err) {
        // Handle deserialization failure — stored handle is incompatible
        console.warn('[FileSystem] Stored handle is invalid, disabling filesystem:', err);
        await this.fileSystem.disableFileSystem();
      }
    }
  }


}
