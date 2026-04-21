import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TeamMetricsComponent } from './metrics/metrics';

@Component({
  selector: 'app-team-index',
  standalone: true,
  imports: [CommonModule, TeamMetricsComponent],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);

  // Layout State
  isInitializing = signal(true);
  showModules = signal(this.getInitialSidebarState());

  ngOnInit() {
    this.breadcrumbService.setTitle('Team Home');

    // Simulate initialization completion for smooth transitions
    setTimeout(() => this.isInitializing.set(false), 300);
  }

  private getInitialSidebarState(): boolean {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 770) return false;
      const saved = localStorage.getItem('quilix_team_sidebar_state');
      return saved === null ? true : saved === 'true';
    }
    return true;
  }

  toggleModules() {
    this.showModules.update(val => {
      const newState = !val;
      if (window.innerWidth > 770) {
        localStorage.setItem('quilix_team_sidebar_state', String(newState));
      }
      return newState;
    });
  }

  closeModules() {
    this.showModules.set(false);
  }
}
