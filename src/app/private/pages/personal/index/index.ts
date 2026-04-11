import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { Breadcrumb } from '../../../../shared/ui/common/breadcrumb/breadcrumb';
import { PersonalMetricsComponent } from './metrics/metrics';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [CommonModule, Breadcrumb, PersonalMetricsComponent],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');
  }
}
