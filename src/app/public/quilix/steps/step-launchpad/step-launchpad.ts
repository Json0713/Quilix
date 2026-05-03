import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-step-launchpad',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './step-launchpad.html',
  styleUrl: './step-launchpad.scss',
})
export class StepLaunchpad {

  onLaunch(): void {
    localStorage.setItem('quilix_onboarding_complete', 'true');
  }

}
