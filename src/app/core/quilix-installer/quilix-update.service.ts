import { Injectable, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject, filter, takeUntil } from 'rxjs';

import { ToastRelayService } from '../../services/ui/common/toast/toast-relay';

@Injectable({ providedIn: 'root' 
})
export class QuilixUpdateService implements OnDestroy {

  private readonly swUpdate = inject(SwUpdate);
  private readonly toastRelay = inject(ToastRelayService);

  // UI/UX Hygiene 
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
    this.toastRelay.set(
      'info',
      'New version detected.\nYour app is now updating.',
      QuilixUpdateService.TOAST_DURATION_MS
    );

    setTimeout(() => this.activateAndReload(), QuilixUpdateService.RELOAD_DELAY_MS);
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
