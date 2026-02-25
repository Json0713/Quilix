import {
  Pipe,
  PipeTransform,
  NgZone,
  ChangeDetectorRef,
  OnDestroy
} from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: true,
  pure: false,
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer: number | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  transform(value: number | string | Date | null | undefined): string {
    if (!value) return '';

    const date = this.toDate(value);
    this.startTimer();

    return this.format(date);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private toDate(value: number | string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private startTimer(): void {
    if (this.timer) return;

    this.ngZone.runOutsideAngular(() => {
      this.timer = window.setInterval(() => {
        this.ngZone.run(() => this.cdr.markForCheck());
      }, 1000);
    });
  }

  private format(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const isCompact = this.isCompactView();
    const absolute = date.toLocaleDateString('en-US');

    // MOBILE RULE: after 24h, show DATE ONLY
    if (isCompact && days >= 1) {
      return absolute;
    }

    let relative: string;
    if (seconds < 60) relative = 'just now';
    else if (minutes < 60) relative = `${minutes}m ago`;
    else if (hours < 24) relative = `${hours}h ago`;
    else relative = `${days}d ago`;

    // MOBILE 
    if (isCompact) {
      return relative;
    }

    // DESKTOP
    return `${relative} · ${absolute}`;
  }

  private isCompactView(): boolean {
    return window.innerWidth < 640;
  }
}
