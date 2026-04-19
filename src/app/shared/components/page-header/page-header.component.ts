import { Component, inject } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Breadcrumb } from '../../ui/common/breadcrumb/breadcrumb';
import { PageHeaderService } from '../../../core/services/shared/page-header.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, Breadcrumb, NgTemplateOutlet],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  protected headerService = inject(PageHeaderService);
}
