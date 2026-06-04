import { Component, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Breadcrumb } from '../../ui/common/breadcrumb/breadcrumb';
import { PageHeaderService } from '../../../core/services/shared/page-header.service';
import { ModulesSidebarService } from '../../../services/ui/common/sidebar/modules-sidebar.service';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, Breadcrumb, NgTemplateOutlet],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  encapsulation: ViewEncapsulation.None
})
export class PageHeaderComponent {
  protected headerService = inject(PageHeaderService);
  protected modulesSidebarService = inject(ModulesSidebarService);
  private router = inject(Router);

  constructor() {
    // Clear page-specific header actions on every navigation start.
    // If the destination page has actions, its directive will re-register them.
    // If it's a cached page being restored, its ngDoCheck will seamlessly re-register them.
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      this.headerService.headerActions.set(null);
    });
  }
}
