import { Injectable } from '@angular/core';
import { QuilixInstallerState } from './quilix-installer.state';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class QuilixInstallerService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor(private readonly state: QuilixInstallerState) {
    this.detectPlatform();
    this.detectInstalledOnLoad();
    this.bindInstallPrompt();
  }

  /* ---------- PLATFORM DETECTION ---------- */
  private detectPlatform(): void {
    const ua = window.navigator.userAgent.toLowerCase();

    if (/android/.test(ua)) {
      this.state.platform.set('android');
    } else if (/iphone|ipad|ipod/.test(ua)) {
      this.state.platform.set('ios');
    } else if (window.matchMedia('(display-mode: browser)').matches) {
      this.state.platform.set('desktop');
    } else {
      this.state.platform.set('unsupported');
    }
  }

  /* ---------- INITIAL INSTALL CHECK ---------- */
  private detectInstalledOnLoad(): void {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      this.state.installed.set(true);
      this.state.installPromptAvailable.set(false);
    }
  }

  /* ---------- INSTALL PROMPT LISTENERS ---------- */
  private bindInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();

      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.state.installPromptAvailable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.state.installed.set(true);
      this.state.installPromptAvailable.set(false);
      this.deferredPrompt = null;
    });
  }

  /* ---------- TRIGGER INSTALL ---------- */
  async requestInstall(): Promise<void> {
    if (!this.deferredPrompt) return;

    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      this.state.installPromptAvailable.set(false);
    }

    this.deferredPrompt = null;
  }
}