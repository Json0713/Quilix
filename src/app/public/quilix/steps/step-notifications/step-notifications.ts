import { Component, inject, output, signal } from '@angular/core';
import { OsNotificationService } from '../../../../core/services/ui/os-notification.service';

@Component({
  selector: 'app-step-notifications',
  standalone: true,
  templateUrl: './step-notifications.html',
  styleUrl: './step-notifications.scss',
})
export class StepNotifications {

  private readonly notifService = inject(OsNotificationService);
  readonly continue = output<void>();

  readonly permissionState = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  async requestPermission(): Promise<void> {
    await this.notifService.requestPermissionAndTest();
    this.permissionState.set(Notification.permission);
  }

}
