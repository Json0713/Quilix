import { Component, signal, computed, OnInit } from '@angular/core';

import { StepWelcome } from './steps/step-welcome/step-welcome';
import { StepPreferences } from './steps/step-preferences/step-preferences';
import { StepNotifications } from './steps/step-notifications/step-notifications';
import { StepStorage } from './steps/step-storage/step-storage';
import { StepTerms } from './steps/step-terms/step-terms';
import { StepLaunchpad } from './steps/step-launchpad/step-launchpad';

export interface SetupStep {
  id: number;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-quilix',
  standalone: true,
  imports: [
    StepWelcome,
    StepPreferences,
    StepNotifications,
    StepStorage,
    StepTerms,
    StepLaunchpad,
  ],
  templateUrl: './quilix.html',
  styleUrl: './quilix.scss',
})
export class Quilix implements OnInit {

  readonly steps: SetupStep[] = [
    { id: 1, label: 'Welcome',       icon: 'bi-feather',    description: 'Get started with Quilix' },
    { id: 2, label: 'Preferences',   icon: 'bi-palette',      description: 'Customize your experience' },
    { id: 3, label: 'Notifications', icon: 'bi-bell',         description: 'Stay in the loop' },
    { id: 4, label: 'Storage',       icon: 'bi-hdd',          description: 'Configure data storage' },
    { id: 5, label: 'Terms',         icon: 'bi-shield-check', description: 'Review our policies' },
    { id: 6, label: 'Launchpad',     icon: 'bi-rocket-takeoff', description: 'Choose your path' },
  ];

  readonly currentStep = signal(1);
  readonly completedSteps = signal<Set<number>>(new Set());
  readonly termsAccepted = signal(false);

  readonly progress = computed(() =>
    Math.round(((this.currentStep() - 1) / (this.steps.length - 1)) * 100)
  );

  ngOnInit(): void {
    // Returning users skip to Launchpad
    const onboarded = localStorage.getItem('quilix_onboarding_complete');
    if (onboarded === 'true') {
      this.currentStep.set(6);
      this.completedSteps.set(new Set([1, 2, 3, 4, 5]));
    }
  }

  goToStep(stepId: number): void {
    if (this.canNavigateTo(stepId)) {
      this.currentStep.set(stepId);
    }
  }

  canNavigateTo(stepId: number): boolean {
    // Current step is always "navigatable" (though redundant)
    if (stepId === this.currentStep()) return true;

    // Allow going back to any previous step
    if (stepId < this.currentStep()) return true;

    // Allow going forward only if the step is already completed
    // (This handles cases where a user went back and now wants to return to their furthest progress)
    if (this.isCompleted(stepId)) {
      // Special check for Launchpad: must have terms accepted
      if (stepId === 6 && !this.termsAccepted()) return false;
      return true;
    }

    return false;
  }

  nextStep(): void {
    const current = this.currentStep();
    this.completedSteps.update(s => {
      const next = new Set(s);
      next.add(current);
      return next;
    });
    if (current < this.steps.length) {
      this.currentStep.set(current + 1);
    }
  }

  prevStep(): void {
    const current = this.currentStep();
    if (current > 1) {
      this.currentStep.set(current - 1);
    }
  }

  isCompleted(stepId: number): boolean {
    return this.completedSteps().has(stepId);
  }

  isActive(stepId: number): boolean {
    return this.currentStep() === stepId;
  }

}
