import { signal, computed } from '@angular/core';

export type QuilixPlatform =
  | 'android'
  | 'desktop'
  | 'ios'
  | 'unsupported';

export class QuilixInstallerState {
  readonly platform = signal<QuilixPlatform>('unsupported');
  readonly installPromptAvailable = signal(false);
  readonly installed = signal(false);

  readonly canInstall = computed(
    () => this.installPromptAvailable() && !this.installed()
  );
}