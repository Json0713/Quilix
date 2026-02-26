import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { TabService } from '../../../core/services/tab.service';
import { Tab } from '../../../core/interfaces/tab';

@Component({
    selector: 'app-tab-bar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './tab-bar.html',
    styleUrl: './tab-bar.scss',
})
export class TabBarComponent {
    private tabService = inject(TabService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    tabs = this.tabService.tabs;
    activeTab = this.tabService.activeTab;

    async onTabClick(tab: Tab) {
        await this.tabService.activateTab(tab.id);
        // routerLink on the <a> element handles actual navigation
    }

    async onNewTab() {
        const tab = await this.tabService.createTab();
        // Navigate relative to the current layout route
        this.router.navigate([tab.route], { relativeTo: this.route });
    }

    async onCloseTab(tab: Tab, event: Event) {
        event.stopPropagation();
        event.preventDefault();
        const newRoute = await this.tabService.closeTab(tab.id);
        if (newRoute) {
            // Navigate to the nearest tab's route, relative to current layout
            this.router.navigate([newRoute], { relativeTo: this.route });
        }
    }
}
