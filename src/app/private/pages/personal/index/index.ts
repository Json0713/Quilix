import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

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
export class PersonalIndex implements OnInit, OnDestroy {
  private breadcrumbService = inject(BreadcrumbService);
  public analytics = inject(StorageAnalyticsService);

  private metricsSub?: Subscription;

  isLoading = signal<boolean>(true);
  metrics = signal<StorageMetrics | null>(null);

  async ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');

    // Subscribe natively to the generic Storage Dexie liveQuery feed
    this.metricsSub = this.analytics.watchMetrics().subscribe(payload => {
      this.metrics.set(payload);
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
    return `conic-gradient(var(--primary) ${p}%, var(--surface-alt) ${p}%)`;
  }
}
