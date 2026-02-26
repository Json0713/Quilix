import { Injectable, signal } from '@angular/core';
import { db } from '../db/app-db';
import { Tab } from '../interfaces/tab';

@Injectable({ providedIn: 'root' })
export class TabService {
    /** All tabs for the active workspace */
    tabs = signal<Tab[]>([]);

    /** Currently active tab */
    activeTab = signal<Tab | null>(null);

    private currentWorkspaceId: string | null = null;

    // ── Load tabs for a workspace ──

    async loadTabs(workspaceId: string): Promise<void> {
        this.currentWorkspaceId = workspaceId;

        let existing = await db.tabs
            .where('workspaceId')
            .equals(workspaceId)
            .sortBy('order');

        // First login → auto-create a Home tab
        if (existing.length === 0) {
            const homeTab = this.buildTab(workspaceId, './', 'Home', 'bi bi-house', 0);
            await db.tabs.add(homeTab);
            existing = [homeTab];
        }

        this.tabs.set(existing);

        // Restore last active tab from settings, or default to first
        const activeId = await this.getSetting(`activeTab:${workspaceId}`);
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

        // Persist active tab for this workspace
        if (this.currentWorkspaceId) {
            await this.setSetting(`activeTab:${this.currentWorkspaceId}`, tabId);
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

        await db.tabs.update(tab.id, { route, label, icon });

        // Update signals
        this.tabs.update(tabs =>
            tabs.map(t => t.id === tab.id ? updated : t)
        );
        this.activeTab.set(updated);
    }

    // ── Helpers ──

    private buildTab(workspaceId: string, route: string, label: string, icon: string, order: number): Tab {
        return {
            id: crypto.randomUUID(),
            workspaceId,
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
