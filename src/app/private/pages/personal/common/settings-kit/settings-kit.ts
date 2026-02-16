import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarService } from '../../../../../core/sidebar/sidebar.service';
import { AppThemeService } from '../../../../../core/theme/app-theme/app-theme.service';
import { OsNotificationService } from '../../../../../core/notifications/os-notification.service';

@Component({
  selector: 'app-settings-kit',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './settings-kit.html',
  styleUrl: './settings-kit.scss',
})
export class SettingsKitComponent {
  private sidebarService = inject(SidebarService);
  private themeService = inject(AppThemeService);
  private osNotify = inject(OsNotificationService);

  isCollapsed = this.sidebarService.isCollapsed;
  currentTheme = this.themeService.theme;

  showTools = signal(false);

  notificationPermission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  handleSettingsClick(event: Event) {
    // Navigate directly, but close mobile sidebar if open
    this.sidebarService.closeMobile();
  }

  toggleTools(event: Event) {
    event.stopPropagation();
    if (this.isCollapsed()) {
      // Expand sidebar to show tools when collapsed on desktop
      this.sidebarService.setCollapsed(false);
      this.showTools.set(true);
    } else {
      this.showTools.update(v => !v);
    }
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
