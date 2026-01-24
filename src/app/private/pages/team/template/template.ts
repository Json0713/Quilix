import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';

@Component({
  selector: 'app-team-template',
  imports: [RouterOutlet],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeamTemplate {

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
