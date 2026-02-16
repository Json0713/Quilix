import { Component, inject, signal } from '@angular/core';
import { AppThemeService } from '../../../../core/theme/app-theme/app-theme.service';
import { OsNotificationService } from '../../../../core/notifications/os-notification.service';

@Component({
  selector: 'app-personal-settings',
  standalone: true,
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class PersonalSettings {
  private themeService = inject(AppThemeService);
  private osNotify = inject(OsNotificationService);

  currentTheme = this.themeService.theme;
  notificationPermission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

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