import { Component, inject, output } from '@angular/core';
import { AppThemeService } from '../../../../core/services/ui/app-theme.service';

@Component({
  selector: 'app-step-preferences',
  standalone: true,
  templateUrl: './step-preferences.html',
  styleUrl: './step-preferences.scss',
})
export class StepPreferences {

  readonly theme = inject(AppThemeService);
  readonly continue = output<void>();

}
