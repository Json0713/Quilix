import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TeamMetricsComponent } from './metrics/metrics';
import { ModulesSidebarService } from '../../../../services/ui/common/sidebar/modules-sidebar.service';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';

@Component({
  selector: 'app-team-index',
  standalone: true,
  imports: [
    CommonModule, 
    TeamMetricsComponent,
    PageHeaderActionsDirective
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);
  private modulesSidebarService = inject(ModulesSidebarService);

  ngOnInit() {
    this.breadcrumbService.setTitle('Team Home');
    
    // Smooth initialization transition handled by template level service
    setTimeout(() => this.modulesSidebarService.setInitializing(false), 300);
  }
}
