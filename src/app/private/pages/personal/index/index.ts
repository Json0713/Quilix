import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { PersonalMetricsComponent } from './metrics/metrics';
import { ModalService } from '../../../../services/ui/common/modal/modal';

// Import Shared Widget Components
import { SharedClockWidget } from '../../../../shared/widgets/clock-widget';
import { SharedCalendarWidget } from '../../../../shared/widgets/calendar-widget';
import { SharedAppGrid } from '../../../../shared/widgets/app-grid';

@Component({
  selector: 'app-personal-index',
  standalone: true,
  imports: [
    CommonModule, 
    PersonalMetricsComponent,
    SharedClockWidget,
    SharedCalendarWidget,
    SharedAppGrid
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {
  private breadcrumbService = inject(BreadcrumbService);
  private modalService = inject(ModalService);

  // Layout State
  isInitializing = signal(true);
  showModules = signal(this.getInitialSidebarState());

  ngOnInit() {
    this.breadcrumbService.setTitle('Personal Home');

    // Simulate initialization completion for smooth transitions
    setTimeout(() => this.isInitializing.set(false), 300);
  }

  // Interactivity
  openClock() {
    this.modalService.openClock();
  }

  openCalendar() {
    this.modalService.openCalendar();
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
