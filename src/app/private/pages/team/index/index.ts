import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TeamMetricsComponent } from './metrics/metrics';
import { ModulesSidebarService } from '../../../../services/ui/common/sidebar/modules-sidebar.service';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';
import { AuthService } from '../../../../core/auth/auth.service';

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
  private authService = inject(AuthService);

  async ngOnInit() {
    const currentWs = await this.authService.getCurrentWorkspace();
    this.breadcrumbService.setTitle(currentWs?.name || 'Team Home');
    
    // Smooth initialization transition handled by template level service
    setTimeout(() => this.modulesSidebarService.setInitializing(false), 300);
  }
}
