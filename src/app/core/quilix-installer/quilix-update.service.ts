import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ToastRelayService } from '../../services/ui/common/toast/toast-relay';


@Injectable({ providedIn: 'root' 
})
export class QuilixUpdateService {

  private swUpdate = inject(SwUpdate);
  private toastRelay = inject(ToastRelayService);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.toastRelay.set(
          'info',
          'New version available. Tap to refresh.',
          20000
        )

        setTimeout(() => {
          this.swUpdate.activateUpdate().then(() => {
            location.reload();
          });
        }, 1500);
      }
    });
  }

}
