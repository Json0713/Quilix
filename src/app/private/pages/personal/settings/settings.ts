import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppThemeService } from '../../../../core/theme/app-theme/app-theme.service';
import { OsNotificationService } from '../../../../core/notifications/os-notification.service';
import { TabService } from '../../../../core/services/tab.service';
import { StorageToggleComponent } from '../../../../shared/ui/system/storage-toggle/storage-toggle';
import { FileSystemService } from '../../../../core/services/file-system.service';

@Component({
  selector: 'app-personal-settings',
  standalone: true,
  imports: [RouterModule, StorageToggleComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class PersonalSettings {
  private themeService = inject(AppThemeService);
  private osNotify = inject(OsNotificationService);
  private fileSystem = inject(FileSystemService);
  private tabService = inject(TabService);

  currentTheme = this.themeService.theme;
  notificationPermission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  isFileSystemMode = signal(false);

  constructor() {
    this.checkStorageMode();
    this.tabService.updateActiveTabRoute('./settings', 'Settings', 'bi bi-gear');
  }

  private async checkStorageMode() {
    const mode = await this.fileSystem.getStorageMode();
    this.isFileSystemMode.set(mode === 'filesystem');
  }

  setTheme(mode: 'light' | 'dark' | 'system') {
    this.themeService.apply(mode);
  }

  async enableNotifications() {
    if (!('Notification' in window)) return;

    const permission = await Notification.requestPermission();
    this.notificationPermission.set(permission);

    if (permission === 'granted') {
      this.osNotify.notify({
        title: 'Notifications Enabled',
        body: 'You will now receive updates from Quilix.',
        tag: 'notif-enabled',
      });
    }
  }
}