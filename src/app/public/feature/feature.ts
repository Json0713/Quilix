import { Component, ChangeDetectionStrategy } from '@angular/core';

interface Features {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-feature',
  imports: [],
  templateUrl: './feature.html',
  styleUrl: './feature.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Feature {
  readonly features: Features[] = [
    {
      icon: 'bi-grid',
      title: 'Structured Workflows',
      description:
        'Organize tasks, projects, and ideas into clear, flexible flows that adapt to how you work.',
    },
    {
      icon: 'bi-lightning',
      title: 'Stay in Motion',
      description:
        'Move seamlessly from planning to execution without breaking focus or context.',
    },
    {
      icon: 'bi-layers',
      title: 'Everything in One Place',
      description:
        'Keep work, progress, and priorities connected in a single, distraction-free workspace.',
    },
    {
      icon: 'bi-sliders',
      title: 'Built to Adapt',
      description:
        'Quilix adjusts to your style from simple task lists to structured boards and beyond.',
    },
  ];
}
