import { Injectable, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject, filter, takeUntil } from 'rxjs';

import { ToastRelayService } from '../../services/ui/common/toast/toast-relay';
import { OsNotificationService } from '../notifications/os-notification.service';


@Injectable({ providedIn: 'root' 
})
export class QuilixUpdateService implements OnDestroy {

  private readonly swUpdate = inject(SwUpdate);
  private readonly toastRelay = inject(ToastRelayService);
  private readonly osNotify = inject(OsNotificationService);

  private readonly destroy$ = new Subject<void>();

  // UX Timing
  private static readonly RELOAD_DELAY_MS = 1500;
  private static readonly TOAST_DURATION_MS = 32000;

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (event): event is VersionReadyEvent =>
            event.type === 'VERSION_READY'
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.handleVersionReady());
  }

  private handleVersionReady(): void {
    // In-app feedback
    this.toastRelay.set(
      'info',
      'New Version Detected.\nYour app is now updated.',
      QuilixUpdateService.TOAST_DURATION_MS
    );

    // OS-level Notification
    this.osNotify.notify({
      title: 'Quilix Updated',
      body: 'A new version detected. your app is updated!',
      tag: 'quilix-update',
      requireInteraction: false,
    });

    setTimeout(
      () => this.activateAndReload(),
      QuilixUpdateService.RELOAD_DELAY_MS
    );
  }

  private activateAndReload(): void {
    this.swUpdate.activateUpdate().then(() => {
      location.reload();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
