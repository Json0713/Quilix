import { Component, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Breadcrumb } from '../../ui/common/breadcrumb/breadcrumb';
import { PageHeaderService } from '../../../core/services/shared/page-header.service';
import { ModulesSidebarService } from '../../../services/ui/common/sidebar/modules-sidebar.service';

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
}
