import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { Breadcrumb } from '../../../../shared/ui/common/breadcrumb/breadcrumb';
import { StorageAnalyticsService, StorageMetrics } from '../../../../core/services/storage-analytics.service';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [CommonModule, Breadcrumb],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit, OnDestroy {
  private breadcrumbService = inject(BreadcrumbService);
  public analytics = inject(StorageAnalyticsService);

  private metricsSub?: Subscription;

  isLoading = signal<boolean>(!this.analytics.lastMetrics());
  metrics = this.analytics.lastMetrics;

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');

    // Subscribe to liveQuery revalidations
    this.metricsSub = this.analytics.watchMetrics().subscribe(() => {
      this.isLoading.set(false);
    });
  }

  ngOnDestroy() {
    if (this.metricsSub) {
      this.metricsSub.unsubscribe();
    }
  }

  get pieChartStyle(): string {
    const p = this.metrics()?.percentage || 0;
    const color = this.metrics()?.color || 'var(--primary)';
    return `conic-gradient(${color} ${p}%, var(--surface-alt) ${p}%)`;
  }
}
