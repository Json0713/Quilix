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
  protected osNotify = inject(OsNotificationService);
  private fileSystem = inject(FileSystemService);
  private tabService = inject(TabService);

  currentTheme = this.themeService.theme;

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
}