import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class AppThemeService {

  private readonly storageKey = 'theme';
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  readonly theme = signal<ThemeMode>('system');

  readonly isSystem = computed(() => this.theme() === 'system');
  readonly isLight = computed(() => this.theme() === 'light');
  readonly isDark = computed(() => this.theme() === 'dark');

  private initialized = false;

  private onSystemChange = () => {
    if (this.theme() === 'system') {
      this.apply('system');
    }
  };

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
    this.apply(saved ?? 'system');

    this.mediaQuery.addEventListener('change', this.onSystemChange);
  }

  apply(mode: ThemeMode): void {
    const html = document.documentElement;

    const effective: 'light' | 'dark' =
      mode === 'system'
        ? (this.mediaQuery.matches ? 'dark' : 'light')
        : mode;

    html.classList.toggle('light-theme', effective === 'light');
    html.classList.toggle('dark-theme', effective === 'dark');

    if (mode === 'system') {
      localStorage.removeItem(this.storageKey);
    } else {
      localStorage.setItem(this.storageKey, mode);
    }

    this.theme.set(mode);
    this.updateMetaThemeColor(effective);
  }

  private updateMetaThemeColor(mode: 'light' | 'dark'): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;

    meta.content = mode === 'light'
      ? '#a2c2c2'
      : '#232222';
  }
}
