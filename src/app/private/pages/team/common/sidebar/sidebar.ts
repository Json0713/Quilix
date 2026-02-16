import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarService } from '../../../../../core/sidebar/sidebar.service';
import { SettingsKitComponent } from '../settings-kit/settings-kit';

@Component({
    selector: 'app-team-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, SettingsKitComponent],
    templateUrl: './sidebar.html',
    styleUrl: './sidebar.scss',
})
export class TeamSidebarComponent {
    private sidebarService = inject(SidebarService);

    isCollapsed = this.sidebarService.isCollapsed;
    isMobileOpen = this.sidebarService.isMobileOpen;

    navItems = [
        { label: 'Home', icon: 'bi bi-house', route: './' },
        { label: 'Team Tasks', icon: 'bi bi-list-check', route: './tasks' },
    ];

    toggleSidebar() {
        if (this.isMobileOpen()) {
            this.sidebarService.closeMobile();
        } else {
            this.sidebarService.toggleCollapsed();
        }
    }

    onItemClick() {
        this.sidebarService.closeMobile();
    }
}
