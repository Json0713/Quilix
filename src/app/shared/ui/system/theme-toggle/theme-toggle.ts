import { Component, inject } from '@angular/core';
import { AppThemeService } from '../../../../core/theme/app-theme/app-theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggle {

  readonly theme = inject(AppThemeService);

  set(mode: 'light' | 'dark' | 'system'): void {
    this.theme.apply(mode);
  }
}
