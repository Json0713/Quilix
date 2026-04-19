import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PersonalMetricsComponent } from './metrics/metrics';
import { InfrastructureMapComponent } from '../../../../shared/components/infrastructure-map/infrastructure-map';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [CommonModule, PersonalMetricsComponent, InfrastructureMapComponent],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');
  }
}
