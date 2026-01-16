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
    this.bindInstallPrompt();
  }

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