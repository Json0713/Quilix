import { Injectable, signal } from '@angular/core';
import { db } from '../db/app-db';
import { Tab } from '../interfaces/tab';

@Injectable({ providedIn: 'root' })
export class TabService {
    /** All tabs for the active workspace, bounded strictly to this specific Browser Window */
    tabs = signal<Tab[]>([]);

    /** Currently active tab */
    activeTab = signal<Tab | null>(null);

    private currentWorkspaceId: string | null = null;

    // Explicit UUID identifying this specific OS Window context (Survives Refresh, Isolated from Popups)
    private readonly windowSessionId: string;

    constructor() {
        let existingId = sessionStorage.getItem('quilix_windowId');

        // INTERCEPT WINDOW CLONES:
        // window.open natively copies sessionStorage from parent to child, carrying over the WRONG Window ID.
        // If we boot up with a tearOffId parameter, we FORCE a brand new Window ID to violently separate scopes.
        const params = new URLSearchParams(window.location.search);
        if (params.has('tearOffId')) {
            existingId = crypto.randomUUID();
            sessionStorage.setItem('quilix_windowId', existingId);
        } else if (!existingId) {
            existingId = crypto.randomUUID();
            sessionStorage.setItem('quilix_windowId', existingId);
        }

        this.windowSessionId = existingId;
    }

    // ── Load tabs for a workspace ──

    async loadTabs(workspaceId: string): Promise<void> {
        this.currentWorkspaceId = workspaceId;

        // Ensure we load strictly tabs mapped to this physical Window scope
        let existing = await db.tabs
            .where('[workspaceId+windowId]')
            .equals([workspaceId, this.windowSessionId])
            .sortBy('order');

        // Check if this Window was spawned as a Tear-off!
        const urlParams = new URLSearchParams(window.location.search);
        const tearOffId = urlParams.get('tearOffId');

        if (tearOffId) {
            const rawPayload = localStorage.getItem(`quilix_tearoff_${tearOffId}`);
            if (rawPayload) {
                const parsedTearOff = JSON.parse(rawPayload);

                // Construct strictly localized Tab physically bound here now
                // We generate the UUID immediately to map the history perfectly explicitly.
                const newTabId = crypto.randomUUID();
                const tornTab: Tab = {
                    id: newTabId,
                    workspaceId,
                    windowId: this.windowSessionId,
                    label: parsedTearOff.tabState.label,
                    icon: parsedTearOff.tabState.icon,
                    route: parsedTearOff.tabState.route,
                    order: 0
                };

                await db.tabs.add(tornTab);
                existing = [tornTab];

                // Remove the URL param cleanly without reloading
                window.history.replaceState(null, '', window.location.pathname);
                // Wipe the handoff transfer file 
                localStorage.removeItem(`quilix_tearoff_${tearOffId}`);

                // Inform the caller this happened so NavigationControlService can pick up its history payload later
                setTimeout(() => {
                    const navService = (window as any)._quilix_nav_service_bootstrapper;
                    if (navService && parsedTearOff.historyPayload) {
                        navService.injectSingleTabHistory(newTabId, parsedTearOff.historyPayload);
                    }
                }, 100);
            }
        }

        // First login or blank launch → auto-create a standard empty Home tab
        if (existing.length === 0) {
            const homeTab = this.buildTab(workspaceId, './', 'Home', 'bi bi-house', 0);
            await db.tabs.add(homeTab);
            existing = [homeTab];
        }

        this.tabs.set(existing);

        // Restore last active tab scoped to this window, or default to first
        const activeId = await this.getSetting(`activeTab:${workspaceId}:${this.windowSessionId}`);
        const active = existing.find(t => t.id === activeId) ?? existing[0];
        this.activeTab.set(active);
    }

    // ── Create a new tab (always Home) ──

    async createTab(): Promise<Tab> {
        if (!this.currentWorkspaceId) throw new Error('No active workspace');

        const current = this.tabs();
        const order = current.length > 0
            ? Math.max(...current.map(t => t.order)) + 1
            : 0;

        const tab = this.buildTab(this.currentWorkspaceId, './', 'Home', 'bi bi-house', order);
        await db.tabs.add(tab);

        const updated = [...current, tab];
        this.tabs.set(updated);

        // Activate the new tab
        await this.activateTab(tab.id);

        return tab;
    }

    // ── Activate a tab (state only — navigation handled by routerLink) ──

    async activateTab(tabId: string): Promise<void> {
        const tab = this.tabs().find(t => t.id === tabId);
        if (!tab) return;

        this.activeTab.set(tab);

        // Persist active tab strictly mapped to this specific Window scope
        if (this.currentWorkspaceId) {
            await this.setSetting(`activeTab:${this.currentWorkspaceId}:${this.windowSessionId}`, tabId);
        }
    }

    // ── Close a tab ──

    async closeTab(tabId: string): Promise<string | null> {
        const current = this.tabs();

        // Can't close the last tab
        if (current.length <= 1) return null;

        const idx = current.findIndex(t => t.id === tabId);
        if (idx === -1) return null;

        await db.tabs.delete(tabId);
        const updated = current.filter(t => t.id !== tabId);
        this.tabs.set(updated);

        // If closing the active tab, activate the nearest one and return its route
        if (this.activeTab()?.id === tabId) {
            const newIdx = Math.min(idx, updated.length - 1);
            const newTab = updated[newIdx];
            await this.activateTab(newTab.id);
            return newTab.route; // Caller navigates via routerLink
        }

        return null; // No navigation needed
    }

    // ── Update the active tab's route (called by sidebar nav) ──

    async updateActiveTabRoute(route: string, label: string, icon: string): Promise<void> {
        const tab = this.activeTab();
        if (!tab) return;

        const updated: Tab = { ...tab, route, label, icon };

        // Optimistically update signals synchronously so Angular Router NavigationEnd captures precise state
        this.tabs.update(tabs =>
            tabs.map(t => t.id === tab.id ? updated : t)
        );
        this.activeTab.set(updated);

        // Background persist to IndexedDB
        await db.tabs.update(tab.id, { route, label, icon });
    }

    /**
     * Update the label of any tab whose route contains the given spaceId.
     * Used when a space is renamed to keep tab labels in sync.
     */
    async updateTabLabelBySpaceId(spaceId: string, newLabel: string): Promise<void> {
        const routeFragment = `./spaces/${spaceId}`;
        const current = this.tabs();
        let changed = false;

        for (const tab of current) {
            if (tab.route === routeFragment) {
                await db.tabs.update(tab.id, { label: newLabel });
                changed = true;
            }
        }

        if (changed) {
            this.tabs.update(tabs =>
                tabs.map(t => t.route === routeFragment ? { ...t, label: newLabel } : t)
            );

            // Also update activeTab if it matches
            const active = this.activeTab();
            if (active && active.route === routeFragment) {
                this.activeTab.set({ ...active, label: newLabel });
            }
        }
    }

    // ── Reorder Tabs ──
    async updateTabOrders(orderedTabs: Tab[]): Promise<void> {
        // Re-assign order properties based on their new cleanly organized index
        const updatedTabs = orderedTabs.map((tab, index) => ({ ...tab, order: index }));

        // Optimistically update the UI Signal
        this.tabs.set(updatedTabs);

        // Batch persist the order values to Dexie asynchronously
        await db.tabs.bulkPut(updatedTabs);
    }

    // ── Helpers ──

    private buildTab(workspaceId: string, route: string, label: string, icon: string, order: number): Tab {
        return {
            id: crypto.randomUUID(),
            workspaceId,
            windowId: this.windowSessionId,
            label,
            icon,
            route,
            order,
        };
    }

    private async getSetting(key: string): Promise<string | null> {
        const row = await db.settings.get(key);
        return row?.value ?? null;
    }

    private async setSetting(key: string, value: string): Promise<void> {
        await db.settings.put({ key, value });
    }
}
