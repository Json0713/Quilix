import { Component, inject, output } from '@angular/core';
import { QuilixVersionService } from '../../../../core/pwa/installer/version/quilix-version.service';

@Component({
  selector: 'app-step-welcome',
  standalone: true,
  templateUrl: './step-welcome.html',
  styleUrl: './step-welcome.scss',
})
export class StepWelcome {

  readonly version = inject(QuilixVersionService);
  readonly continue = output<void>();

}
