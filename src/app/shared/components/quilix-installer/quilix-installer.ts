import {
  Component,
  signal,
  computed,
  HostListener,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuilixInstallerService } from '../../../core/quilix-installer/quilix-installer.service';
import { QuilixInstallerState } from '../../../core/quilix-installer/quilix-installer.state';

type DockSide = 'left' | 'right';

@Component({
  selector: 'app-quilix-installer',
  imports: [CommonModule],
  templateUrl: './quilix-installer.html',
  styleUrl: './quilix-installer.scss',
})
export class QuilixInstaller {
  /* Core UI State */
  readonly expanded = signal(false);
  readonly dockSide = signal<DockSide>('right');

  // Vertical offset from top (px)
  readonly offsetY = signal(120);

  // Internal drag state
  readonly dragging = signal(false);

  /* Visibility Logic (unchanged) */
  readonly visible = computed(() =>
    !this.state.installed() &&
    (this.state.installPromptAvailable() || this.state.platform() === 'ios')
  );

  /* UX-Derived Computed State */
  readonly collapsedPeekSize = 44;

  readonly panelX = computed(() =>
    this.dockSide() === 'right'
      ? window.innerWidth - this.collapsedPeekSize
      : 0
  );

  readonly ariaExpanded = computed(() => this.expanded().toString());

  readonly prefersReducedMotion = signal(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* Constructor */
  constructor(
    readonly installer: QuilixInstallerService,
    readonly state: QuilixInstallerState
  ) {
    // Ensure Y stays valid on resize
    effect(() => {
      this.clampOffsetY();
    });
  }

  /* Public Actions */
  toggle(): void {
    this.expanded.update(v => !v);
  }

  async install(): Promise<void> {
    await this.installer.requestInstall();
  }

  /* Drag / Swipe Handling */
  startDrag(event: PointerEvent): void {
    event.preventDefault();
    this.dragging.set(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.dragging()) return;

    this.offsetY.set(event.clientY - 40);
    this.clampOffsetY();
  }

  @HostListener('window:pointerup', ['$event'])
  endDrag(event: PointerEvent): void {
    if (!this.dragging()) return;

    this.dragging.set(false);
    this.snapDockSide(event.clientX);
  }

  /* Docking & Layout Logic */
  private snapDockSide(pointerX: number): void {
    const mid = window.innerWidth / 2;
    this.dockSide.set(pointerX > mid ? 'right' : 'left');
  }

  private clampOffsetY(): void {
    const min = 80;
    const max = window.innerHeight - 120;
    this.offsetY.set(Math.min(Math.max(this.offsetY(), min), max));
  }

  /* Accessibility Hooks (UI-ready) */
  onKeyToggle(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
  }
  
}
