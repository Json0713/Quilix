import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';
import { PersonalSidebarComponent } from '../common/sidebar/sidebar';
import { SidebarService } from '../../../../core/sidebar/sidebar.service';

@Component({
  selector: 'app-personal-template',
  imports: [RouterOutlet, PersonalSidebarComponent],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PersonalTemplate {
  private sidebarService = inject(SidebarService);
  isMobileOpen = this.sidebarService.isMobileOpen;
  isCollapsed = this.sidebarService.isCollapsed;

  toggleMobileSidebar() {
    this.sidebarService.toggleMobile();
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobile();
  }

  private readonly osNotify = inject(OsNotificationService);

  showEnableNotif =
    'Notification' in window &&
    Notification.permission === 'default';

  async enableNotifications(): Promise<void> {
    const permission = await Notification.requestPermission();
    console.log('[OS NOTIF] permission:', permission);

    this.showEnableNotif = false;

    if (permission === 'granted') {
      setTimeout(() => {
        this.osNotify.notify({
          title: 'Notifications Enabled',
          body: 'You will now receive updates from Quilix.',
          tag: 'notif-enabled',
        });
      }, 500);
    }
  }

  ngOnInit(): void {
    const justLoggedIn = localStorage.getItem('justLoggedIn') === 'true';

    if (justLoggedIn && Notification.permission === 'granted') {
      setTimeout(() => {
        this.osNotify.notify({
          title: 'Welcome to Quilix',
          body: 'You are logged in successfully.',
          tag: 'login-welcome',
        });
      }, 800);

      localStorage.removeItem('justLoggedIn');
    }
  }

}
