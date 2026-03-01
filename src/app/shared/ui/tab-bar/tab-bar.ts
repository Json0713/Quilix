import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TabService } from '../../../core/services/tab.service';
import { Tab } from '../../../core/interfaces/tab';

@Component({
    selector: 'app-tab-bar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, DragDropModule],
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

    // Handled strictly by CDK Drag and Drop events
    async onTabDrop(event: CdkDragDrop<Tab[]>) {
        const currentTabs = [...this.tabs()];

        // Tear-off Logic: If the user dropped the tab entirely outside the bounds of the tab bar container
        if (!event.isPointerOverContainer) {
            const tabToTear = currentTabs[event.previousIndex];

            // Construct strictly absolute web pathways mapping exact state
            const targetUrl = this.router.createUrlTree([tabToTear.route], { relativeTo: this.route }).toString();

            // Physically spawn a true separate Application Process view popup 
            window.open(targetUrl, '_blank', 'popup,width=1024,height=768');

            // Terminate the local tab to simulate a physical transfer
            const newRoute = await this.tabService.closeTab(tabToTear.id);
            if (newRoute) {
                this.router.navigate([newRoute], { relativeTo: this.route });
            }
            return;
        }

        // Internal Reordering Logic
        if (event.previousIndex !== event.currentIndex) {
            // Mutate the array indices natively
            moveItemInArray(currentTabs, event.previousIndex, event.currentIndex);
            // Submit strict batch sorting commands down to Dexie DB bounds
            await this.tabService.updateTabOrders(currentTabs);
        }
    }
}
