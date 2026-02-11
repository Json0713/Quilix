import {
  Component,
  HostListener,
  ViewChild,
  ElementRef,
  signal,
  computed,
  OnDestroy,
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
export class CtaKeyboard implements OnDestroy {

  @ViewChild('input', { static: true })
  private readonly input!: ElementRef<HTMLInputElement>;

  readonly text = signal('');
  readonly activeKey = signal<string | null>(null);
  readonly floating = signal<FloatingText[]>([]);
  readonly isAutoTyping = signal(false);

  private floatId = 0;

  private idleTimer?: number;
  private typingTimer?: number;

  private messageIndex = 0;
  private charIndex = 0;

  readonly messages = [
    'Welcome to Quilix',
    'How’s your day?',
    'Take a coffee break',
    'Build something meaningful',
  ];

  readonly rows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ];

  readonly display = computed(() => this.text() || ' ');

  constructor() {
    this.scheduleIdle();
  }

  // ------------------------------------------------
  // INPUT / INTERACTION
  // ------------------------------------------------

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {

    if (e.key === ' ') {
      e.preventDefault();
    }

    this.handleUserInteraction(true);

    if (e.key === 'Backspace') return this.backspace();
    if (e.key === 'Enter') return this.enter();
    if (e.key === ' ') return this.commit(' ');
    if (e.key.length === 1) this.commit(e.key);
  }

  onInput(e: Event): void {
    this.handleUserInteraction(true);
    this.text.set((e.target as HTMLInputElement).value.slice(-48));
  }

  press(key: string): void {
    this.handleUserInteraction(true);
    this.input.nativeElement.focus();

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

    this.resetAutoTyping();
  }

  private flash(key: string): void {
    this.activeKey.set(key);
    setTimeout(() => this.activeKey.set(null), 150);
  }

  // ------------------------------------------------
  // IDLE / AUTO TYPING
  // ------------------------------------------------

  private scheduleIdle(): void {
    this.clearTimers();

    this.idleTimer = window.setTimeout(() => {
      this.startAutoTyping();
    }, 3500);
  }

  private startAutoTyping(): void {
    this.isAutoTyping.set(true);
    this.charIndex = 0;
    this.text.set('');
    this.typeNextChar();
  }

  private typeNextChar(): void {
    if (!this.isAutoTyping()) return;

    const msg = this.messages[this.messageIndex];

    if (this.charIndex < msg.length) {
      this.text.update(t => t + msg[this.charIndex++]);

      this.typingTimer = window.setTimeout(() => {
        this.typeNextChar();
      }, 320);

    } else {
      // Pause before vanishing
      this.typingTimer = window.setTimeout(() => {

        this.enter();

        this.messageIndex =
          (this.messageIndex + 1) % this.messages.length;

        this.isAutoTyping.set(false);
        this.scheduleIdle();

      }, 2000); // <-- CHANGE THIS VALUE (milliseconds)
    }
  }

  // ------------------------------------------------
  // CRITICAL FIX: Immediate erase on interrupt
  // ------------------------------------------------

  private handleUserInteraction(fromKeyboard: boolean): void {

    if (this.isAutoTyping()) {
      // STOP auto typing immediately
      this.isAutoTyping.set(false);
      this.clearTimers();
      this.charIndex = 0;

      // IMMEDIATELY erase unfinished auto text
      this.text.set('');
    }

    // restart idle countdown
    this.scheduleIdle();
  }

  private resetAutoTyping(): void {
    this.isAutoTyping.set(false);
    this.charIndex = 0;
    this.clearTimers();
    this.scheduleIdle();
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = undefined;
    }
  }

  // ------------------------------------------------
  // CLEANUP
  // ------------------------------------------------

  ngOnDestroy(): void {
    this.clearTimers();
  }
}
