import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class AppThemeService {

  private readonly storageKey = 'app-theme';
  readonly theme = signal<ThemeMode>('system'); // default = system

  readonly isLight = computed(() => this.theme() === 'light');
  readonly isDark = computed(() => this.theme() === 'dark');
  readonly isSystem = computed(() => this.theme() === 'system');

  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  init(): void {
    const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
    this.apply(saved ?? 'system');

    // Listen to system changes if mode = system
    this.mediaQuery.addEventListener('change', () => {
      if (this.theme() === 'system') this.apply('system');
    });
  }

  apply(mode: ThemeMode): void {
    const html = document.documentElement;

    html.classList.remove('theme-light', 'theme-dark');

    let effectiveMode: 'light' | 'dark';

    if (mode === 'system') {
      effectiveMode = this.mediaQuery.matches ? 'dark' : 'light';
    } else {
      effectiveMode = mode;
    }

    if (effectiveMode === 'light') html.classList.add('theme-light');
    if (effectiveMode === 'dark') html.classList.add('theme-dark');

    // persist user choice
    mode === 'system'
      ? localStorage.removeItem(this.storageKey)
      : localStorage.setItem(this.storageKey, mode);

    this.theme.set(mode);

    // update mobile status bar dynamically
    this.updateMetaThemeColor(effectiveMode);
  }

  private updateMetaThemeColor(mode: 'light' | 'dark'): void {
    const metaTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!metaTag) return;

    const color = mode === 'light' ? '#1a3a3f' : '#2B2A2A';
    metaTag.setAttribute('content', color);
  }
}
