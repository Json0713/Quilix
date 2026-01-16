import { Injectable } from '@angular/core';
import { QuilixInstallerState, QuilixPlatform } from './quilix-installer.state';

@Injectable({ providedIn: 'root' })
export class QuilixPlatformService {
  constructor(private readonly state: QuilixInstallerState) {
    this.detectPlatform();
    this.detectStandalone();
  }

  private detectPlatform(): void {
    const ua = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) {
      this.state.platform.set('ios');
      return;
    }

    if (/android/.test(ua)) {
      this.state.platform.set('android');
      return;
    }

    if (window.matchMedia('(display-mode: browser)').matches) {
      this.state.platform.set('desktop');
      return;
    }

    this.state.platform.set('unsupported');
  }

  private detectStandalone(): void {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||

      (navigator as any).standalone === true;

    if (isStandalone) {
      this.state.installed.set(true);
    }
  }
}