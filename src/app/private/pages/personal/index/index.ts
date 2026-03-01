import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { Breadcrumb } from '../../../../shared/ui/common/breadcrumb/breadcrumb';
import { StorageAnalyticsService, StorageMetrics } from '../../../../core/services/storage-analytics.service';
import { Loader } from '../../../../shared/ui/common/loader/loader';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [CommonModule, Breadcrumb, Loader],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);
  public analytics = inject(StorageAnalyticsService);

  isLoading = signal<boolean>(true);
  metrics = signal<StorageMetrics | null>(null);

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');

    // Simulate slight natural loading to let background fs queries resolve warmly
    const payload = await this.analytics.getMetrics();
    this.metrics.set(payload);
    this.isLoading.set(false);
  }

  get pieChartStyle(): string {
    const p = this.metrics()?.percentage || 0;
    return `conic-gradient(var(--primary) ${p}%, var(--surface-alt) ${p}%)`;
  }
}
