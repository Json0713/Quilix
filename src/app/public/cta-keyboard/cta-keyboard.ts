import {
  Component,
  HostListener,
  ViewChild,
  ElementRef,
  signal,
  computed,
  effect,
} from '@angular/core';

type FloatingText = {
  id: number;
  value: string;
};

@Component({
  selector: 'app-cta-keyboard',
  standalone: true,
  templateUrl: './cta-keyboard.html',
  styleUrl: './cta-keyboard.scss',
})
export class CtaKeyboard {
  @ViewChild('input', { static: true })
  private readonly input!: ElementRef<HTMLInputElement>;

  readonly text = signal('');
  readonly activeKey = signal<string | null>(null);
  readonly floating = signal<FloatingText[]>([]);

  private floatId = 0;

  private lastInteractionAt = Date.now();
  private idleInterval?: number;

  readonly messages = [
    'Welcome to Quilix',
    'How’s your day?',
    'Take a coffee break',
    'Build something meaningful',
  ];

  private messageIndex = 0;
  private charIndex = 0;

  readonly rows = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ];

  readonly display = computed(() => this.text() || ' ');

  constructor() {
    effect(() => this.input.nativeElement.focus());
    this.startIdleLoop();
  }

  // ----------------------------
  // Keyboard input
  // ----------------------------

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    this.markInteraction();

    if (e.key === 'Backspace') return this.backspace();
    if (e.key === 'Enter') return this.enter();
    if (e.key === ' ') return this.commit(' ');
    if (e.key.length === 1) this.commit(e.key);
  }

  onInput(e: Event): void {
    this.markInteraction();
    this.text.set((e.target as HTMLInputElement).value.slice(-48));
  }

  press(key: string): void {
    this.markInteraction();

    if (key === 'SPACE') return this.commit(' ');
    if (key === 'BACK') return this.backspace();
    if (key === 'ENTER') return this.enter();

    this.commit(key);
  }

  private commit(char: string): void {
    this.activeKey.set(char.toUpperCase());
    this.text.update(t => (t + char).slice(-48));
    setTimeout(() => this.activeKey.set(null), 120);
  }

  private backspace(): void {
    this.text.update(t => t.slice(0, -1));
    this.flash('BACK');
  }

  private enter(): void {
    const value = this.text().trim();
    if (!value) return;

    const id = ++this.floatId;

    this.floating.update(f => [...f, { id, value }]);
    this.text.set('');
    this.flash('ENTER');

    setTimeout(() => {
      this.floating.update(f => f.filter(x => x.id !== id));
    }, 2600);
  }

  private flash(key: string): void {
    this.activeKey.set(key);
    setTimeout(() => this.activeKey.set(null), 150);
  }

  // ----------------------------
  // Idle typing (FIXED)
  // ----------------------------

  private startIdleLoop(): void {
    this.idleInterval = window.setInterval(() => {
      const now = Date.now();
      const quietFor = now - this.lastInteractionAt;

      // only auto-type after user is truly idle
      if (quietFor < 3500) return;

      const msg = this.messages[this.messageIndex];

      if (this.charIndex < msg.length) {
        this.text.update(t => t + msg[this.charIndex++]);
      } else {
        this.enter();
        this.charIndex = 0;
        this.messageIndex =
          (this.messageIndex + 1) % this.messages.length;
      }
    }, 300);
  }

  private markInteraction(): void {
    this.lastInteractionAt = Date.now();
    this.charIndex = 0;
  }
}
