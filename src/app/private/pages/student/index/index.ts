import { Component, inject } from '@angular/core';
import { AuthFacade } from '../../../../core/auth/auth.facade';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { LoaderService } from '../../../../services/ui/common/loader/loader';
import { Export } from "../../../../shared/components/export/export";

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';


@Component({
  selector: 'app-student-index',
  imports: [Export],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class StudentIndex {

  private readonly osNotify = inject(OsNotificationService);

  constructor(
    private auth: AuthFacade,
    private loader: LoaderService,
    private modal: ModalService,
  ) {}

  ngOnInit(): void {
    this.loadData();

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

  // PRESERVED STUDENT LOGIC CODE
  loadData(): void {
    this.loader.show();

    setTimeout(() => {
      this.loader.hide();
    }, 1800);
  }

  async logout(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Are you sure you want to log out?',
      {
        title: 'Confirm Logout',
        confirmText: 'Logout',
        cancelText: 'Cancel',
      }
    );

    if (!confirmed) return;

    this.auth.logout();
  }

}
