import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuilixInstallerService } from '../../../core/quilix-installer/quilix-installer.service';
import { QuilixInstallerState } from '../../../core/quilix-installer/quilix-installer.state';

@Component({
  selector: 'app-quilix-installer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quilix-installer.html',
  styleUrl: './quilix-installer.scss',
})
export class QuilixInstaller {
  /* UI State */
  readonly expanded = signal(false);

  /* Visibility Logic (PWA-safe, unchanged) */
  readonly visible = computed(() =>
    !this.state.installed() &&
    (this.state.installPromptAvailable() || this.state.platform() === 'ios')
  );

  /* Accessibility */
  readonly ariaExpanded = computed(() => String(this.expanded()));

  constructor(
    readonly installer: QuilixInstallerService,
    readonly state: QuilixInstallerState
  ) {}

  /* Public Actions */
  toggle(): void {
    this.expanded.update(v => !v);
  }

  async install(): Promise<void> {
    await this.installer.requestInstall();
  }

  /* Keyboard Support */
  onKeyToggle(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
  }

}
