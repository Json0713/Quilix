import {
  Component,
  HostListener,
  signal,
  computed,
  effect,
  ViewChild,
  ElementRef,
} from '@angular/core';

@Component({
  selector: 'app-cta-keyboard',
  imports: [],
  templateUrl: './cta-keyboard.html',
  styleUrl: './cta-keyboard.scss',
})
export class CtaKeyboard {
  @ViewChild('input', { static: true })
  private readonly input!: ElementRef<HTMLInputElement>;

  readonly text = signal('');
  readonly activeKey = signal<string | null>(null);

  readonly rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  readonly display = computed(() =>
    this.text() || 'Start typing…'
  );

  constructor() {
    effect(() => {
      // keeps mobile keyboard active
      this.input.nativeElement.focus();
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key.length !== 1) return;
    this.commit(event.key);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value.slice(-32));
  }

  press(key: string): void {
    this.commit(key);
  }

  private commit(key: string): void {
    const upper = key.toUpperCase();

    this.activeKey.set(upper);
    this.text.update((t) => (t + key).slice(-32));

    setTimeout(() => this.activeKey.set(null), 120);
  }
}

