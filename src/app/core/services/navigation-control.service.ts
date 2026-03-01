import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { TabService } from './tab.service';

export interface HistoryEntry {
    url: string;
    tabState: { route: string; label: string; icon: string; };
}

export interface TabHistory {
    history: HistoryEntry[];
    forward: HistoryEntry[];
}

@Injectable({
    providedIn: 'root'
})
export class NavigationControlService {
    private router = inject(Router);
    private tabService = inject(TabService);

    // Maintain a distinct history stack per tab ID
    private tabHistories = new Map<string, TabHistory>();

    // Track if a navigation is user-initiated vs back/forward action
    private isTravelingHistory = false;

    constructor() {
        // INTERCEPT WINDOW CLONES:
        // window.open natively copies sessionStorage from parent to child, bringing the ENTIRE parent's history!
        const params = new URLSearchParams(window.location.search);
        if (params.has('tearOffId')) {
            // Shred the incorrectly cloned array. Pure new physical window instance!
            sessionStorage.removeItem('quilix_tabHistories');
        }

        this.loadHistories();

        // Expose to window for tear-off payload injections during application boot sequence
        (window as any)._quilix_nav_service_bootstrapper = this;

        // Listen to router events and build history naturally
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            const url = event.urlAfterRedirects || event.url;
            const activeTab = this.tabService.activeTab();

            if (!activeTab) return;

            const tabId = activeTab.id;
            if (!this.tabHistories.has(tabId)) {
                this.tabHistories.set(tabId, { history: [], forward: [] });
            }

            const tabHistory = this.tabHistories.get(tabId)!;

            if (!this.isTravelingHistory) {
                // Normal navigation: add to history, clear forward stack
                if (tabHistory.history.length === 0 || tabHistory.history[tabHistory.history.length - 1].url !== url) {
                    tabHistory.history.push({
                        url: url,
                        // Freeze the metadata state as it is at this exact route
                        tabState: { route: activeTab.route, label: activeTab.label, icon: activeTab.icon }
                    });

                    // Limit history stack size if needed (e.g., max 50 items) per tab
                    if (tabHistory.history.length > 50) {
                        tabHistory.history.shift();
                    }
                }
                tabHistory.forward = [];
                this.saveHistories();
            } else {
                // Reset flag after history travel resolves
                this.isTravelingHistory = false;
            }
        });
    }

    private getActiveTabHistory(): TabHistory | undefined {
        const activeTab = this.tabService.activeTab();
        if (!activeTab) return undefined;
        return this.tabHistories.get(activeTab.id);
    }

    get canGoBack(): boolean {
        const hist = this.getActiveTabHistory();
        return hist ? hist.history.length > 1 : false;
    }

    get canGoForward(): boolean {
        const hist = this.getActiveTabHistory();
        return hist ? hist.forward.length > 0 : false;
    }

    goBack(): void {
        const hist = this.getActiveTabHistory();
        if (hist && this.canGoBack) {
            this.isTravelingHistory = true;
            const currentEntry = hist.history.pop()!;
            hist.forward.push(currentEntry);
            this.saveHistories();

            const previousEntry = hist.history[hist.history.length - 1];

            // Restore exact tab metadata matching the previous path
            this.tabService.updateActiveTabRoute(previousEntry.tabState.route, previousEntry.tabState.label, previousEntry.tabState.icon);
            this.router.navigateByUrl(previousEntry.url);
        }
    }

    goForward(): void {
        const hist = this.getActiveTabHistory();
        if (hist && this.canGoForward) {
            this.isTravelingHistory = true;
            const nextEntry = hist.forward.pop()!;
            hist.history.push(nextEntry);
            this.saveHistories();

            // Restore exact tab metadata matching the forward path
            this.tabService.updateActiveTabRoute(nextEntry.tabState.route, nextEntry.tabState.label, nextEntry.tabState.icon);
            this.router.navigateByUrl(nextEntry.url);
        }
    }

    refresh(): void {
        window.location.reload();
    }

    // Exposed payload injection strictly mapping the SINGLE requested tab to its NEW UUID identity
    injectSingleTabHistory(newTabId: string, payload: string): void {
        this.tabHistories.clear(); // Safe as it's a completely virgin window
        this.tabHistories.set(newTabId, JSON.parse(payload));
        this.saveHistories();
    }

    // Explicit helper exporting solely the specific Tab being violently torn-off
    exportSingleTabHistory(tabId: string): string {
        const hist = this.tabHistories.get(tabId) || { history: [], forward: [] };
        return JSON.stringify(hist);
    }

    private saveHistories(): void {
        try {
            const serialized = JSON.stringify(Array.from(this.tabHistories.entries()));
            sessionStorage.setItem('quilix_tabHistories', serialized);
        } catch (e) {
            console.error('Failed to save tab histories to sessionStorage', e);
        }
    }

    private loadHistories(): void {
        try {
            const stored = sessionStorage.getItem('quilix_tabHistories');
            if (stored) {
                this.tabHistories = new Map(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load tab histories from sessionStorage', e);
        }
    }
}
