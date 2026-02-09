import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';

interface Tech {
  src: string;
  alt: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-img-stack',
  standalone: true,
  templateUrl: './img-stack.html',
  styleUrl: './img-stack.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImgStack implements AfterViewInit, OnDestroy {

  readonly technologies: readonly Tech[] = [
    {
      src: 'assets/icons/favicon-96x96.png',
      alt: 'Angular',
      label: 'Angular',
      description: 'Modern, performant frontend framework.',
    },
    {
      src: 'assets/icons/favicon-96x96.png',
      alt: 'TypeScript',
      label: 'TypeScript',
      description: 'Strongly typed JavaScript at scale.',
    },
    {
      src: 'assets/icons/favicon-96x96.png',
      alt: 'Sass',
      label: 'Sass',
      description: 'Scalable, maintainable styling.',
    },
    {
      src: 'assets/icons/favicon-96x96.png',
      alt: 'Node.js',
      label: 'Node.js',
      description: 'High-performance backend runtime.',
    },
    {
      src: 'assets/icons/favicon-96x96.png',
      alt: 'Supabase',
      label: 'Supabase',
      description: 'Realtime backend & auth platform.',
    },
  ];

  // clone-edge loop
  readonly slides: readonly Tech[] = [
    this.technologies[this.technologies.length - 1],
    ...this.technologies,
    this.technologies[0],
  ];

  readonly index = signal(1);
  readonly isAnimating = signal(false);
  readonly isPaused = signal(false);

  private readonly intervalMs = 5000;
  private timerId?: number;

  private startX = 0;
  private deltaX = 0;

  ngAfterViewInit(): void {
    this.startAutoPlay();
  }

  // ---------- Navigation ----------

  next(): void {
    if (this.isAnimating()) return;
    this.isAnimating.set(true);
    this.index.update(i => i + 1);
  }

  prev(): void {
    if (this.isAnimating()) return;
    this.isAnimating.set(true);
    this.index.update(i => i - 1);
  }

  onTransitionEnd(): void {
    const lastIndex = this.slides.length - 1;

    // jump WITHOUT animation
    if (this.index() === 0) {
      this.jumpTo(this.technologies.length);
    } else if (this.index() === lastIndex) {
      this.jumpTo(1);
    }

    this.isAnimating.set(false);
    this.isPaused.set(false);
  }

  private jumpTo(target: number): void {
    this.isAnimating.set(false);
    this.index.set(target);
  }

  // ---------- Autoplay ----------

  private startAutoPlay(): void {
    this.timerId = window.setInterval(() => {
      if (!this.isPaused() && !this.isAnimating()) {
        this.next();
      }
    }, this.intervalMs);
  }

  // ---------- Touch ----------

  onTouchStart(e: TouchEvent): void {
    this.isPaused.set(true);
    this.startX = e.touches[0].clientX;
  }

  onTouchMove(e: TouchEvent): void {
    this.deltaX = e.touches[0].clientX - this.startX;
  }

  onTouchEnd(): void {
    if (Math.abs(this.deltaX) > 60) {
      this.deltaX > 0 ? this.prev() : this.next();
    }
    this.deltaX = 0;
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }
}
