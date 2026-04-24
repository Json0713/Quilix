import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';

import { OsNotificationService } from '../../../../core/services/ui/os-notification.service';

import { TeamSidebarComponent } from '../common/sidebar/sidebar';
import { SidebarService } from '../../../../services/ui/common/sidebar/sidebar.service';
import { TabBarComponent } from '../../../../shared/ui/tab-bar/tab-bar';
import { NavigationBar } from '../../../../shared/ui/navigation-bar/navigation-bar';
import { TabService } from '../../../../core/services/ui/tab.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { TerminalComponent } from '../../../../shared/components/terminal/terminal';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';
import { ModulesSidebarService } from '../../../../services/ui/common/sidebar/modules-sidebar.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { SharedClockWidget } from '../../../../shared/widgets/clock-widget';
import { SharedCalendarWidget } from '../../../../shared/widgets/calendar-widget';
import { SharedAppGrid } from '../../../../shared/widgets/app-grid';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-team-template',
  imports: [
    CommonModule,
    RouterOutlet, 
    TeamSidebarComponent, 
    TabBarComponent, 
    NavigationBar, 
    TerminalComponent, 
    PageHeaderComponent,
    SharedClockWidget,
    SharedCalendarWidget,
    SharedAppGrid
  ],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeamTemplate implements OnDestroy {
  private sidebarService = inject(SidebarService);
  private tabService = inject(TabService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private modulesSidebarService = inject(ModulesSidebarService);
  
  private authSub: any;
  isMobileOpen = this.sidebarService.isMobileOpen;
  isCollapsed = this.sidebarService.isCollapsed;

  // Modules Sidebar State
  showModules = this.modulesSidebarService.isOpen;
  isInitializing = this.modulesSidebarService.isInitializing;

  toggleMobileSidebar() {
    this.sidebarService.toggleMobile();
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobile();
  }

  toggleModules() {
    this.modulesSidebarService.toggle();
  }

  closeModules() {
    this.modulesSidebarService.close();
  }

  openClock() {
    this.modalService.openClock();
  }

  openCalendar() {
    this.modalService.openCalendar();
  }

  private readonly osNotify = inject(OsNotificationService);

  ngOnInit(): void {
    // Initialize Modules Sidebar Context
    this.modulesSidebarService.setContext('team');
    
    // Initial tab load
    this.loadWorkspaceTabs();

    // Re-load tabs when switching workspaces of the same role (team→team)
    this.authSub = this.authService.authEvents$.subscribe(event => {
      if (event === 'LOGIN') {
        this.loadWorkspaceTabs();
      }
    });

    this.osNotify.showWorkspaceWelcomeIfNeeded();
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.sidebarService.closeMobile();
  }

  private async loadWorkspaceTabs(): Promise<void> {
    const ws = await this.authService.getCurrentWorkspace();
    if (ws) {
      await this.tabService.loadTabs(ws.id);
      // Navigate to the last active tab's route to restore workspace state
      const activeTab = this.tabService.activeTab();
      if (activeTab && activeTab.route && activeTab.route !== './') {
        this.router.navigate([activeTab.route], { relativeTo: this.route });
      }
    }
  }

}
