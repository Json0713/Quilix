import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loader } from '../../../../shared/ui/common/loader/loader';
import { Toast } from '../../../../shared/ui/common/toast/toast';
import { Modal } from "../../../../shared/ui/common/modal/modal";

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';


@Component({
  selector: 'app-teacher-template',
  imports: [RouterOutlet, Loader, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeacherTemplate {

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
