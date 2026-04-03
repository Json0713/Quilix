import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';

import { OsNotificationService } from '../../../../core/notifications/os-notification.service';

import { TeamSidebarComponent } from '../common/sidebar/sidebar';
import { SidebarService } from '../../../../services/ui/common/sidebar/sidebar.service';
import { TabBarComponent } from '../../../../shared/ui/tab-bar/tab-bar';
import { NavigationBar } from '../../../../shared/ui/navigation-bar/navigation-bar';
import { TabService } from '../../../../core/services/tab.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-team-template',
  imports: [RouterOutlet, TeamSidebarComponent, TabBarComponent, NavigationBar],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeamTemplate implements OnDestroy {
  private sidebarService = inject(SidebarService);
  private tabService = inject(TabService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authSub: any;
  isMobileOpen = this.sidebarService.isMobileOpen;
  isCollapsed = this.sidebarService.isCollapsed;

  toggleMobileSidebar() {
    this.sidebarService.toggleMobile();
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobile();
  }

  private readonly osNotify = inject(OsNotificationService);

  ngOnInit(): void {
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
