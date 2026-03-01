import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="breadcrumb-container">
      <h1 class="breadcrumb-title">{{ breadcrumb.title() }}</h1>
      <div class="hairline"></div>
    </div>
  `,
  styles: [`
    .breadcrumb-container {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      width: 100%;
      margin-bottom: 2rem;
    }

    .breadcrumb-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-main, #e5e7eb);
      margin: 0;
      white-space: nowrap;
      letter-spacing: -0.01em;
    }

    .hairline {
      flex-grow: 1;
      height: 1px;
      background-color: var(--border-color, rgba(255, 255, 255, 0.1));
    }
  `]
})
export class Breadcrumb {
  protected breadcrumb = inject(BreadcrumbService);
}
