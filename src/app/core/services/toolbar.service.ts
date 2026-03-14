import { Injectable, signal } from '@angular/core';

export interface ToolbarBreadcrumb {
    label: string;
    url?: string;
    isLast: boolean;
    isDeleted?: boolean;
    icon?: string;
    action?: () => void;
}

export interface ToolbarPill {
    id: string;
    icon: string;
    isActive: boolean;
    tooltip?: string;
    action: () => void;
}

export interface ToolbarPillGroup {
    id: string;
    pills: ToolbarPill[];
}

export interface ToolbarDropdownItem {
    id: string;
    label: string;
    icon?: string;
    action: () => void;
}

export interface ToolbarDropdown {
    id: string;
    icon: string;
    label?: string; // e.g. "Sort By"
    items: ToolbarDropdownItem[];
}

export interface ToolbarAction {
    id: string;
    label: string;
    icon: string;
    isPrimary: boolean;
    isDisabled?: boolean;
    action: () => void;
}

export interface ToolbarConfig {
    breadcrumbs?: ToolbarBreadcrumb[];
    pillGroups?: ToolbarPillGroup[];
    dropdowns?: ToolbarDropdown[];
    actions?: ToolbarAction[];
    navControls?: {
        canGoBack: boolean;
        canGoForward: boolean;
        onBack: () => void;
        onForward: () => void;
        onRefresh: () => void;
    };
}

@Injectable({
    providedIn: 'root'
})
export class ToolbarService {
    // Expose signals for the NavigationBar to consume
    config = signal<ToolbarConfig | null>(null);

    /**
     * Set the entire toolbar context for the active routed component.
     */
    setConfig(newConfig: ToolbarConfig) {
        this.config.set(newConfig);
    }

    /**
     * Clear the toolbar context when leaving a component.
     * Reverts Navigation Bar to its default routing state.
     */
    clearConfig() {
        this.config.set(null);
    }

    /**
     * Partially update the existing config (useful for reactive changes like sorting/views)
     */
    updateConfig(partialConfig: Partial<ToolbarConfig>) {
        const current = this.config() || {};
        this.config.set({ ...current, ...partialConfig });
    }
}
