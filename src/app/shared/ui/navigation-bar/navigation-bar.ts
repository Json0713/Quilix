import {
    Component,
    inject,
    OnInit,
    OnDestroy,
    HostListener,
    ViewChild,
    ElementRef,
    signal,
    computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';

import { NavigationControlService } from '../../../core/services/ui/navigation-control.service';
import { SidebarService } from '../../../services/ui/common/sidebar/sidebar.service';
import { TabService } from '../../../core/services/ui/tab.service';
import { SpaceService } from '../../../core/services/components/space.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Space } from '../../../core/interfaces/space';
import { ModalService } from '../../../services/ui/common/modal/modal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Breadcrumb {
    label: string;
    url: string;
    isLast: boolean;
    isSpace?: boolean;
    isDeleted?: boolean;
}

interface NavSuggestion {
    label: string;
    path: string;   // absolute path e.g. /team/chat
    icon: string;
    type: 'page' | 'space';
}

// Static pages per context
const PERSONAL_PAGES: NavSuggestion[] = [
    { label: 'Home',       path: '/personal',            icon: 'bi bi-house',     type: 'page' },
    { label: 'Chat',       path: '/personal/chat',       icon: 'bi bi-chat-dots', type: 'page' },
    { label: 'Workspaces', path: '/personal/workspaces', icon: 'bi bi-archive',   type: 'page' },
    { label: 'Trash',      path: '/personal/trash',      icon: 'bi bi-trash3',    type: 'page' },
    { label: 'Settings',   path: '/personal/settings',   icon: 'bi bi-gear',      type: 'page' },
];

const TEAM_PAGES: NavSuggestion[] = [
    { label: 'Home',       path: '/team',            icon: 'bi bi-house',     type: 'page' },
    { label: 'Chat',       path: '/team/chat',        icon: 'bi bi-chat-dots', type: 'page' },
    { label: 'Workspaces', path: '/team/workspaces',  icon: 'bi bi-archive',   type: 'page' },
    { label: 'Trash',      path: '/team/trash',       icon: 'bi bi-trash3',    type: 'page' },
    { label: 'Settings',   path: '/team/settings',    icon: 'bi bi-gear',      type: 'page' },
];

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
    selector: 'app-navigation-bar',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './navigation-bar.html',
    styleUrls: ['./navigation-bar.scss']
})
export class NavigationBar implements OnInit, OnDestroy {
    private navControl   = inject(NavigationControlService);
    private sidebarService = inject(SidebarService);
    private tabService   = inject(TabService);
    private spaceService = inject(SpaceService);
    private authService  = inject(AuthService);
    private router       = inject(Router);
    private modal        = inject(ModalService);

    @ViewChild('searchInput')   searchInput!:   ElementRef<HTMLInputElement>;
    @ViewChild('navSearch')     navSearch!:     ElementRef<HTMLDivElement>;
    @ViewChild('addressInput')  addressInput!:  ElementRef<HTMLInputElement>;
    @ViewChild('addressBarEl')  addressBarEl!:  ElementRef<HTMLDivElement>;

    // Computed dropdown position (fixed, breaks out of stacking context)
    dropdownTop   = 0;
    dropdownLeft  = 0;
    dropdownWidth = 0;

    // ── Breadcrumbs (display mode) ──
    defaultBreadcrumbs: Breadcrumb[] = [];
    isMobileOpen = this.sidebarService.isMobileOpen;
    isMobileSearchActive = false;

    // ── Address bar state ──
    isEditMode = false;
    editValue  = '';
    highlightedIndex = -1;

    // ── Suggestions ──
    private spaces = signal<Space[]>([]);
    private context = signal<'personal' | 'team' | ''>('');

    filteredSuggestions = computed<NavSuggestion[]>(() => {
        const query = this.editValue.toLowerCase().trim();
        const ctx   = this.context();

        const staticPages = ctx === 'personal' ? PERSONAL_PAGES
                          : ctx === 'team'     ? TEAM_PAGES
                          : [...PERSONAL_PAGES, ...TEAM_PAGES];

        const spaceSuggestions: NavSuggestion[] = this.spaces().map(s => ({
            label: s.name,
            path:  `/${ctx}/spaces/${s.id}`,
            icon:  'bi bi-folder',
            type:  'space' as const,
        }));

        const all = [...staticPages, ...spaceSuggestions];

        if (!query || query === '/' || query === `/${ctx}`) {
            return staticPages.slice(0, 6);
        }

        return all
            .filter(s =>
                s.label.toLowerCase().includes(query) ||
                s.path.toLowerCase().includes(query)
            )
            .slice(0, 8);
    });

    private spaceSub?:    Subscription | any;
    private authSub?:     any;
    private routerSub?:   Subscription;

    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        this.routerSub = this.router.events.pipe(
            filter(e => e instanceof NavigationEnd)
        ).subscribe(() => {
            this.generateBreadcrumbs();
            this.updateContext();
        });
    }

    ngOnInit() {
        this.generateBreadcrumbs();
        this.updateContext();

        // Subscribe to the active workspace and load its spaces for suggestions
        this.authSub = this.authService.currentWorkspace$.subscribe(ws => {
            this.spaceSub?.unsubscribe?.();
            if (ws) {
                this.spaceSub = this.spaceService.liveSpaces$(ws.id)
                    .subscribe((list: Space[]) => this.spaces.set(list));
            } else {
                this.spaces.set([]);
            }
        });
    }

    ngOnDestroy() {
        this.spaceSub?.unsubscribe?.();
        this.authSub?.unsubscribe?.();
        this.routerSub?.unsubscribe();
        this.clearSpaceSub();
    }

    // ─── Address bar ─────────────────────────────────────────────────────────

    enterEditMode() {
        this.isEditMode       = true;
        this.editValue        = this.router.url.split('?')[0];
        this.highlightedIndex = -1;

        // Compute the fixed-position anchor for the dropdown on the next tick
        // (after Angular renders the input into the DOM)
        setTimeout(() => {
            if (this.addressBarEl) {
                const rect = this.addressBarEl.nativeElement.getBoundingClientRect();
                this.dropdownTop   = rect.bottom + 6;
                this.dropdownLeft  = rect.left;
                this.dropdownWidth = rect.width;
            }
            this.addressInput?.nativeElement?.select();
        }, 0);
    }

    exitEditMode() {
        this.isEditMode       = false;
        this.editValue        = '';
        this.highlightedIndex = -1;
    }

    onAddressInput(event: Event) {
        this.editValue        = (event.target as HTMLInputElement).value;
        this.highlightedIndex = -1;
    }

    onAddressKeydown(event: KeyboardEvent) {
        const suggestions = this.filteredSuggestions();

        switch (event.key) {
            case 'Enter': {
                event.preventDefault();
                if (this.highlightedIndex >= 0 && suggestions[this.highlightedIndex]) {
                    this.commitNavigation(suggestions[this.highlightedIndex].path);
                } else {
                    this.commitNavigation(this.editValue.trim());
                }
                break;
            }
            case 'Escape': {
                event.preventDefault();
                this.exitEditMode();
                break;
            }
            case 'ArrowDown': {
                event.preventDefault();
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, suggestions.length - 1);
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
                break;
            }
        }
    }

    onAddressBlur() {
        // Short delay so suggestion clicks register before blur closes the dropdown
        setTimeout(() => this.exitEditMode(), 150);
    }

    selectSuggestion(suggestion: NavSuggestion) {
        this.commitNavigation(suggestion.path);
    }

    private commitNavigation(rawInput: string) {
        let path = rawInput.trim();
        if (!path) { this.exitEditMode(); return; }

        // Allow shorthand like "chat" → resolves to /{context}/chat
        if (!path.startsWith('/')) {
            const ctx = this.context();
            path = ctx ? `/${ctx}/${path}` : `/${path}`;
        }

        this.exitEditMode();
        this.router.navigateByUrl(path);

        // Sync the tab state to the new URL
        this.tabService.syncActiveTabToCurrentUrl(path);
    }

    // ─── Navigation controls ──────────────────────────────────────────────────

    get canGoBack()    { return this.navControl.canGoBack; }
    get canGoForward() { return this.navControl.canGoForward; }
    goBack()           { this.navControl.goBack(); }
    goForward()        { this.navControl.goForward(); }
    refresh()          { this.navControl.refresh(); }

    // ─── Sidebar / search ────────────────────────────────────────────────────

    toggleMobileSidebar() { this.sidebarService.toggleMobile(); }

    toggleMobileSearch() {
        this.isMobileSearchActive = !this.isMobileSearchActive;
        if (this.isMobileSearchActive) {
            setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
        }
    }

    closeMobileSearch() { this.isMobileSearchActive = false; }

    openSearch() { this.modal.openGlobalSearch(); }

    // ─── Keyboard shortcuts ───────────────────────────────────────────────────

    @HostListener('window:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.openSearch();
        }
        // Ctrl+L — focus address bar (browser convention)
        if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
            event.preventDefault();
            this.enterEditMode();
        }
    }

    @HostListener('window:resize')
    onResize() {
        if (window.innerWidth > 768 && this.isMobileSearchActive) {
            this.closeMobileSearch();
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (this.isMobileSearchActive && this.navSearch) {
            if (!this.navSearch.nativeElement.contains(event.target as Node)) {
                this.closeMobileSearch();
            }
        }
    }

    // ─── Breadcrumbs ─────────────────────────────────────────────────────────

    onBreadcrumbClick(crumb: Breadcrumb) {
        let icon = 'bi bi-folder';
        if (crumb.label === 'Home')     icon = 'bi bi-house';
        else if (crumb.label === 'Settings') icon = 'bi bi-gear';
        else if (crumb.label === 'Trash')    icon = 'bi bi-trash3';

        let route = crumb.url;
        if (crumb.url === '/personal' || crumb.url === '/team') {
            route = './';
        } else if (crumb.url.startsWith('/personal/') || crumb.url.startsWith('/team/')) {
            route = './' + crumb.url.split('/').slice(2).join('/');
        }

        this.tabService.updateActiveTabRoute(route, crumb.label, icon);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private updateContext() {
        const url = this.router.url;
        if (url.startsWith('/personal')) this.context.set('personal');
        else if (url.startsWith('/team'))  this.context.set('team');
        else                               this.context.set('');
    }

    private generateBreadcrumbs() {
        const url   = this.router.url.split('?')[0];
        const parts = url.split('/').filter(p => p);

        this.defaultBreadcrumbs = [];
        this.clearSpaceSub();

        if (parts.length > 0) {
            const root = parts[0]; // personal or team
            this.defaultBreadcrumbs.push({
                label: 'Home',
                url:   `/${root}`,
                isLast: parts.length === 1
            });

            if (parts.length > 1) {
                if (parts[1] === 'spaces' && parts.length > 2) {
                    const spaceId = parts[2];

                    this.defaultBreadcrumbs.push({
                        label:   'Space ' + spaceId.substring(0, 4),
                        url:     `/${root}/spaces/${spaceId}`,
                        isLast:  true,
                        isSpace: true
                    });

                    this.monitorSpaceDetails(spaceId);

                } else {
                    let currentUrl = `/${root}`;
                    for (let i = 1; i < parts.length; i++) {
                        currentUrl += `/${parts[i]}`;
                        const label = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
                        this.defaultBreadcrumbs.push({
                            label,
                            url:    currentUrl,
                            isLast: i === parts.length - 1
                        });
                    }
                }
            }
        }
    }

    private _spaceBreadcrumbSub?: any;
    private clearSpaceSub() {
        if (this._spaceBreadcrumbSub) {
            this._spaceBreadcrumbSub.unsubscribe();
            this._spaceBreadcrumbSub = undefined;
        }
    }

    private monitorSpaceDetails(spaceId: string) {
        this._spaceBreadcrumbSub = this.spaceService.liveSpaceAnyStatus$(spaceId)
            .subscribe((space: Space | null) => {
                if (!space) return;
                const crumb = this.defaultBreadcrumbs.find(b => b.isSpace && b.url?.includes(spaceId));
                if (!crumb) return;

                crumb.label     = space.name;
                crumb.isDeleted = !!space.trashedAt;

                if (crumb.isLast) {
                    this.tabService.updateActiveTabRoute(
                        this.router.url.split('?')[0]
                            .replace('/personal/', './')
                            .replace('/team/', './'),
                        space.name,
                        'bi bi-folder'
                    );
                }
            });
    }
}
