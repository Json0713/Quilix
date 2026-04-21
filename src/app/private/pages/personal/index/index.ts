import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PersonalMetricsComponent } from './metrics/metrics';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [CommonModule, PersonalMetricsComponent],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);

  // Layout State
  isInitializing = signal(true);
  showModules = signal(this.getInitialSidebarState());

  ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');

    // Simulate initialization completion for smooth transitions
    setTimeout(() => this.isInitializing.set(false), 300);
  }

  private getInitialSidebarState(): boolean {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 770) return false;
      const saved = localStorage.getItem('quilix_personal_sidebar_state');
      return saved === null ? true : saved === 'true';
    }
    return true;
  }

  toggleModules() {
    this.showModules.update(val => {
      const newState = !val;
      if (window.innerWidth > 770) {
        localStorage.setItem('quilix_personal_sidebar_state', String(newState));
      }
      return newState;
    });
  }

  closeModules() {
    this.showModules.set(false);
  }
}
