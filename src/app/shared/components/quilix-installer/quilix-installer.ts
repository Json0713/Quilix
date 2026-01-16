import { Component, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuilixInstallerService } from '../../../core/quilix-installer/quilix-installer.service';
import { QuilixInstallerState } from '../../../core/quilix-installer/quilix-installer.state';

@Component({
  selector: 'app-quilix-installer',
  imports: [CommonModule],
  templateUrl: './quilix-installer.html',
  styleUrl: './quilix-installer.scss',
})
export class QuilixInstaller {
  readonly expanded = signal(false);
  readonly side = signal<'left' | 'right'>('right');
  readonly y = signal(120);

  readonly visible = computed(() =>
    !this.state.installed() &&
    (this.state.installPromptAvailable() || this.state.platform() === 'ios')
  );

  constructor(
    readonly installer: QuilixInstallerService,
    readonly state: QuilixInstallerState
  ) {}

  toggle(): void {
    this.expanded.update(v => !v);
  }

  async install(): Promise<void> {
    await this.installer.requestInstall();
  }

  startDrag(event: PointerEvent): void {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('window:pointermove', ['$event'])
  onDrag(event: PointerEvent): void {
    if (event.buttons !== 1) return;
    this.y.set(Math.max(80, event.clientY - 40));
  }

  @HostListener('window:pointerup')
  endDrag(): void {
    const mid = window.innerWidth / 2;
    this.side.set(this.getPanelX() > mid ? 'right' : 'left');
  }

  private getPanelX(): number {
    return this.side() === 'right'
      ? window.innerWidth - 40
      : 40;
  }
  
}
