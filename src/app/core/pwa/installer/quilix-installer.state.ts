import { Injectable, signal, computed } from '@angular/core';

export type QuilixPlatform =
  | 'android'
  | 'desktop'
  | 'ios'
  | 'unsupported';

@Injectable({ providedIn: 'root' })
export class QuilixInstallerState {
  /* Platform detection result */
  readonly platform = signal<QuilixPlatform>('unsupported');

  /* Browser exposed install prompt (beforeinstallprompt) */
  readonly installPromptAvailable = signal(false);

  /* App already installed (display-mode / appinstalled) */
  readonly installed = signal(false);

  /* UI visibility control (dismiss, auto-hide, etc.) */
  readonly visible = signal(true);

  /* Derived capability flags */
  readonly isSupported = computed(
    () => this.platform() !== 'unsupported'
  );

  readonly canInstall = computed(
    () =>
      this.isSupported() &&
      this.installPromptAvailable() &&
      !this.installed()
  );

  readonly shouldShowInstaller = computed(
    () =>
      this.visible() &&
      !this.installed() &&
      this.isSupported()
  );
}
