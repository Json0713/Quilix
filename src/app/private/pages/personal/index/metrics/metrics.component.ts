import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StorageAnalyticsService } from '../../../../../core/services/data/storage-analytics.service';

@Component({
  selector: 'app-personal-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.component.html',
  styleUrl: './metrics.component.scss',
})
export class PersonalMetricsComponent implements OnInit, OnDestroy {
  public analytics = inject(StorageAnalyticsService);

  private metricsSub?: Subscription;

  isLoading = signal<boolean>(!this.analytics.lastMetrics());
  metrics = this.analytics.lastMetrics;

  ngOnInit() {
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
