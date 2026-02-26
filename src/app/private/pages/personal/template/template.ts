import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';
import { PersonalSidebarComponent } from '../common/sidebar/sidebar';
import { SidebarService } from '../../../../core/sidebar/sidebar.service';
import { TabBarComponent } from '../../../../shared/ui/tab-bar/tab-bar';
import { TabService } from '../../../../core/services/tab.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-personal-template',
  imports: [RouterOutlet, PersonalSidebarComponent, TabBarComponent],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PersonalTemplate {
  private sidebarService = inject(SidebarService);
  private tabService = inject(TabService);
  private authService = inject(AuthService);
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
    // Load tabs for the active workspace
    this.authService.getCurrentWorkspace().then(ws => {
      if (ws) {
        this.tabService.loadTabs(ws.id);
      }
    });

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
