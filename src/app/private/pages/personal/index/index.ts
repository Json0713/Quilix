import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PersonalMetricsComponent } from './metrics/metrics';
import { ModulesSidebarService } from '../../../../services/ui/common/sidebar/modules-sidebar.service';
import { PageHeaderActionsDirective } from '../../../../shared/components/page-header/page-header-actions.directive';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [
    CommonModule, 
    PersonalMetricsComponent,
    PageHeaderActionsDirective
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);
  private modulesSidebarService = inject(ModulesSidebarService);
  private authService = inject(AuthService);

  async ngOnInit() {
    const currentWs = await this.authService.getCurrentWorkspace();
    this.breadcrumbService.setTitle(currentWs?.name || 'Personal Home');
    
    // Smooth initialization transition handled by template level service
    setTimeout(() => this.modulesSidebarService.setInitializing(false), 300);
  }
}