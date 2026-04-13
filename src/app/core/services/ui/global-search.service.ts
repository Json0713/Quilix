import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TerminalService, TerminalTab } from './terminal.service';
import { SidebarService } from '../../../services/ui/common/sidebar/sidebar.service';
import { AppThemeService } from './app-theme.service';
import { TabService } from './tab.service';
import { ModalService } from '../../../services/ui/common/modal/modal';

export interface SearchItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'Navigation' | 'Terminal' | 'Actions' | 'Tools';
    action: () => void;
}

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
    private router = inject(Router);
    private terminal = inject(TerminalService);
    private sidebar = inject(SidebarService);
    private theme = inject(AppThemeService);
    private tabService = inject(TabService);
    private modal = inject(ModalService);
    private cachedItems: SearchItem[] | null = null;

    getSearchItems(): SearchItem[] {
        if (this.cachedItems) return this.cachedItems;

        const url = this.router.url;
        const prefix = url.includes('/team') ? 'team' : 'personal';
        const displayPrefix = prefix === 'team' ? 'Team' : 'Personal';

        this.cachedItems = [
            // Navigation
            {
                id: 'nav-home',
                title: 'Go to Home',
                description: `Navigate to your ${displayPrefix} dashboard`,
                icon: 'bi bi-house',
                category: 'Navigation',
                action: () => this.navigate(`/${prefix}`)
            },
            {
                id: 'nav-tasks',
                title: 'Go to Tasks',
                description: `View all tasks in ${displayPrefix} workspace`,
                icon: 'bi bi-check2-square',
                category: 'Navigation',
                action: () => this.navigate(`/${prefix}/tasks`)
            },
            {
                id: 'nav-settings',
                title: 'Go to Settings',
                description: `Manage ${displayPrefix} settings and preferences`,
                icon: 'bi bi-gear',
                category: 'Navigation',
                action: () => this.navigate(`/${prefix}/settings`)
            },
            {
                id: 'nav-trash',
                title: 'Go to Trash',
                description: `View deleted items in ${displayPrefix}`,
                icon: 'bi bi-trash3',
                category: 'Navigation',
                action: () => this.navigate(`/${prefix}/trash`)
            },

            // Terminal
            {
                id: 'term-open',
                title: 'Open Terminal',
                description: 'Open the integrated terminal emulator',
                icon: 'bi bi-terminal',
                category: 'Terminal',
                action: () => this.openTerminal('terminal')
            },
            {
                id: 'term-source',
                title: 'Source Control',
                description: 'View git changes and activity graph',
                icon: 'bi bi-git',
                category: 'Terminal',
                action: () => this.openTerminal('source-control')
            },
            {
                id: 'term-output',
                title: 'View Output',
                description: 'Check system and command logs',
                icon: 'bi bi-justify-left',
                category: 'Terminal',
                action: () => this.openTerminal('output')
            },
            {
                id: 'term-problems',
                title: 'View Problems',
                description: 'View static analysis and errors',
                icon: 'bi bi-exclamation-triangle',
                category: 'Terminal',
                action: () => this.openTerminal('problems')
            },

            // Actions
            {
                id: 'act-theme',
                title: 'Toggle Theme',
                description: 'Switch between light and dark mode',
                icon: 'bi bi-brightness-high',
                category: 'Actions',
                action: () => this.theme.toggleTheme()
            },
            {
                id: 'act-sidebar',
                title: 'Toggle Sidebar',
                description: 'Show or hide the main sidebar navigation',
                icon: 'bi bi-layout-sidebar',
                category: 'Actions',
                action: () => this.sidebar.toggleCollapsed()
            },
            {
                id: 'act-import',
                title: 'Import Backup',
                description: 'Restore data from a JSON backup file',
                icon: 'bi bi-cloud-arrow-up',
                category: 'Actions',
                action: () => this.modal.openImport()
            }
        ];

        return this.cachedItems;
    }

    search(query: string): SearchItem[] {
        const all = this.getSearchItems();
        if (!query) return all;

        const q = query.toLowerCase().trim();
        return all.filter(item => 
            item.title.toLowerCase().includes(q) || 
            item.description.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
        );
    }

    refreshCache() {
        this.cachedItems = null;
    }

    private navigate(path: string) {
        let label = 'Home';
        let icon = 'bi bi-house';
        if (path.endsWith('/tasks')) { label = 'Tasks'; icon = 'bi bi-check2-square'; }
        else if (path.endsWith('/settings')) { label = 'Settings'; icon = 'bi bi-gear'; }
        else if (path.endsWith('/trash')) { label = 'Trash'; icon = 'bi bi-trash3'; }

        this.tabService.updateActiveTabRoute(path.replace('/personal/', './').replace('/team/', './'), label, icon);
        this.router.navigate([path]);
    }

    private openTerminal(tab: TerminalTab) {
        if (!this.terminal.isOpen()) {
            this.terminal.toggle();
        }
        this.terminal.activeTab.set(tab);
        this.terminal.isMaximized.set(true); // Always maximize when opened via search as requested
    }
}
