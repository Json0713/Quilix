import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { Breadcrumb } from '../../../../shared/ui/common/breadcrumb/breadcrumb';
import { TeamMetricsComponent } from './metrics/metrics';

@Component({
  selector: 'app-team-index',
  standalone: true,
  imports: [CommonModule, Breadcrumb, TeamMetricsComponent],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);

  ngOnInit() {
    this.breadcrumbService.setTitle('Team Home');
  }
}
