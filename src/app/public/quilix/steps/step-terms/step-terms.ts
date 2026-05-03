import { Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-step-terms',
  standalone: true,
  templateUrl: './step-terms.html',
  styleUrl: './step-terms.scss',
})
export class StepTerms {

  readonly continue = output<void>();
  readonly acceptedChange = output<boolean>();
  
  readonly accepted = signal(false);

  toggleAccepted(): void {
    const newVal = !this.accepted();
    this.accepted.set(newVal);
    this.acceptedChange.emit(newVal);
  }

}
