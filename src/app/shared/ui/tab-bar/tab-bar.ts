import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TabService } from '../../../core/services/ui/tab.service';
import { Tab } from '../../../core/interfaces/tab';

@Component({
    selector: 'app-tab-bar',
    standalone: true,
    imports: [DragDropModule],
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
        
        // Parse the route to extract native query parameters for Angular
        const [path, queryStr] = tab.route.split('?');
        const queryParams = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
        
        this.router.navigate([path], { relativeTo: this.route, queryParams });
    }

    async onNewTab() {
        const tab = await this.tabService.createTab();
        const [path, queryStr] = tab.route.split('?');
        const queryParams = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
        this.router.navigate([path], { relativeTo: this.route, queryParams });
    }

    async onCloseTab(tab: Tab, event: Event) {
        event.stopPropagation();
        event.preventDefault();
        const newRoute = await this.tabService.closeTab(tab.id);
        if (newRoute) {
            const [path, queryStr] = newRoute.split('?');
            const queryParams = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
            this.router.navigate([path], { relativeTo: this.route, queryParams });
        }
    }

    // Handled strictly by CDK Drag and Drop events
    async onTabDrop(event: CdkDragDrop<Tab[]>) {
        const currentTabs = [...this.tabs()];

        // Tear-off Logic: If the user dropped the tab entirely outside the bounds of the tab bar container
        if (!event.isPointerOverContainer) {
            // Cannot tear-off if it's the last remaining tab in the window instance!
            if (currentTabs.length <= 1) {
                return;
            }

            const tabToTear = currentTabs[event.previousIndex];

            // Generate secure explicit 1-time token for handoff
            const tearOffId = crypto.randomUUID();

            // Intercept internal history mappings natively for this ONE specific tab!
            let historyPayload = '';
            const navService = (window as any)._quilix_nav_service_bootstrapper;
            if (navService && typeof navService.exportSingleTabHistory === 'function') {
                historyPayload = navService.exportSingleTabHistory(tabToTear.id);
            }

            // Consolidate the data explicitly for passing boundaries
            const transferData = {
                tabState: { route: tabToTear.route, label: tabToTear.label, icon: tabToTear.icon },
                historyPayload: historyPayload
            };

            // Write to shared bridge
            localStorage.setItem(`quilix_tearoff_${tearOffId}`, JSON.stringify(transferData));

            // Construct strictly absolute web pathways mapping exact state plus ID
            const [path, queryStr] = tabToTear.route.split('?');
            const queryParams = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
            queryParams['tearOffId'] = tearOffId;
            
            const tree = this.router.createUrlTree([path], { relativeTo: this.route, queryParams });
            const targetUrl = tree.toString();

            // Physically spawn a true separate Application Process view popup
            window.open(targetUrl, '_blank', 'popup,width=1024,height=768');

            // Terminate the local tab to simulate a physical transfer
            const newRoute = await this.tabService.closeTab(tabToTear.id);
            if (newRoute) {
                const [nPath, nQueryStr] = newRoute.split('?');
                const nQueryParams = nQueryStr ? Object.fromEntries(new URLSearchParams(nQueryStr)) : {};
                this.router.navigate([nPath], { relativeTo: this.route, queryParams: nQueryParams });
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
