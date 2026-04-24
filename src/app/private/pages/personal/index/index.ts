import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PersonalMetricsComponent } from './metrics/metrics';
import { ModulesSidebarService } from '../../../../services/ui/common/sidebar/modules-sidebar.service';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [
    CommonModule, 
    PersonalMetricsComponent
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);
  private modulesSidebarService = inject(ModulesSidebarService);

  ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');
    
    // Smooth initialization transition handled by template level service
    setTimeout(() => this.modulesSidebarService.setInitializing(false), 300);
  }
}