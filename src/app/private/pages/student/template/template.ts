import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loader } from '../../../../shared/ui/common/loader/loader';
import { Toast } from '../../../../shared/ui/common/toast/toast';
import { Modal } from "../../../../shared/ui/common/modal/modal";

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';

@Component({
  selector: 'app-student-template',
  imports: [RouterOutlet, Loader, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class StudentTemplate {
  
  private readonly osNotify = inject(OsNotificationService);

  constructor() {}

  ngOnInit(): void {
    this.requestNotificationPermission();
    this.sendTestNotification();
  }

  private requestNotificationPermission(): void {
    const alreadyRequested = localStorage.getItem('os-notif-permission-requested');
    if (alreadyRequested) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        localStorage.setItem('os-notif-permission-requested', 'true');
        if (permission === 'granted') console.log('OS notifications enabled');
      });
    }
  }

  private sendTestNotification(): void {
    const justLoggedIn = localStorage.getItem('justLoggedIn') === 'true';
    if (!justLoggedIn) return;

    this.osNotify.notify({
      title: 'Test Notification',
      body: 'This is an OS-level notification working!',
      tag: 'test-notif'
    });

    localStorage.removeItem('justLoggedIn');
  }

}
