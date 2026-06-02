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

import { PERSONAL_ROUTES } from '../../../private/pages/personal/personal.routes';
import { TEAM_ROUTES } from '../../../private/pages/team/team.routes';

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

// ─── Dynamic Route Parsing ────────────────────────────────────────────────────

function buildNavSuggestions(routes: any[], prefix: string): NavSuggestion[] {
    const suggestions: NavSuggestion[] = [];
    const children = routes[0]?.children || [];
    
    for (const route of children) {
        if (route.data && route.data.label) {
            const pathSuffix = route.path ? `/${route.path}` : '';
            suggestions.push({
                label: route.data.label as string,
                path: `/${prefix}${pathSuffix}`,
                icon: (route.data.icon as string) || 'bi bi-folder',
                type: 'page'
            });
        }
    }
    return suggestions;
}

// Automatically sync navigation bar with actual Angular Router configurations
const PERSONAL_PAGES: NavSuggestion[] = buildNavSuggestions(PERSONAL_ROUTES, 'personal');
const TEAM_PAGES: NavSuggestion[] = buildNavSuggestions(TEAM_ROUTES, 'team');

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
    editValue = signal('');
    highlightedIndex = -1;

    // ── Suggestions ──
    private spaces = signal<Space[]>([]);
    private context = signal<'personal' | 'team' | ''>('');

    filteredSuggestions = computed<NavSuggestion[]>(() => {
        const query = this.editValue().toLowerCase().trim();
        const ctx   = this.context();

        // When not searching, only show the default static pages for the current active context
        const localStaticPages = ctx === 'personal' ? PERSONAL_PAGES
                               : ctx === 'team'     ? TEAM_PAGES
                               : [...PERSONAL_PAGES, ...TEAM_PAGES];

        const localSpaceSuggestions: NavSuggestion[] = this.spaces().map(s => ({
            label: s.name,
            path:  `/${ctx}/spaces/${s.id}`,
            icon:  'bi bi-folder',
            type:  'space' as const,
        }));

        if (!query || query === '/' || query === `/${ctx}` || query === ctx) {
            return localStaticPages.slice(0, 6);
        }

        // Search strictly across the current active context to avoid mixing roles
        const contextAll = [...localStaticPages, ...localSpaceSuggestions];

        return contextAll
            .filter(s =>
                s.label.toLowerCase().includes(query) ||
                s.path.toLowerCase().replace(/^\//, '').includes(query) // strip slash to match "team/chat" queries perfectly
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
        this.isEditMode = true;
        
        let url = this.router.url;
        const parsed = this.router.parseUrl(url);
        
        // If we are in the browser component, pre-fill with the actual external URL
        if (parsed.root.children['primary']?.segments.some(s => s.path === 'browse') && parsed.queryParams['url']) {
            url = parsed.queryParams['url'];
        } else {
            url = url.split('?')[0];
            if (url.startsWith('/')) {
                url = url.substring(1);
            }
        }
        
        this.editValue.set(url);
        
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
        this.editValue.set('');
        this.highlightedIndex = -1;
    }

    onAddressInput(event: Event) {
        this.editValue.set((event.target as HTMLInputElement).value);
        this.highlightedIndex = -1;
    }

    onAddressKeydown(event: KeyboardEvent) {
        const suggestions = this.filteredSuggestions();

        switch (event.key) {
            case 'Enter': {
                event.preventDefault();
                if (this.highlightedIndex >= 0 && suggestions[this.highlightedIndex]) {
                    this.commitNavigation(suggestions[this.highlightedIndex].path, suggestions[this.highlightedIndex]);
                } else {
                    this.commitNavigation(this.editValue().trim());
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
        this.commitNavigation(suggestion.path, suggestion);
    }

    private commitNavigation(rawInput: string, suggestion?: NavSuggestion) {
        let path = rawInput.trim();
        if (!path) { this.exitEditMode(); return; }

        const ctx = this.context();
        
        // 1. Detect if this is an external web URL
        const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
        if (urlRegex.test(path) && !path.startsWith('/') && !path.startsWith('team') && !path.startsWith('personal')) {
            const fullUrl = path.startsWith('http') ? path : `https://${path}`;
            const browsePath = ctx ? `/${ctx}/browse` : `/team/browse`;
            
            this.exitEditMode();
            this.router.navigate([browsePath], { queryParams: { url: fullUrl } }).then(success => {
                if (success) {
                    try {
                        const host = new URL(fullUrl).hostname;
                        this.tabService.updateActiveTabRoute(`./browse?url=${encodeURIComponent(fullUrl)}`, host, 'bi bi-globe2');
                    } catch (e) {
                        this.tabService.updateActiveTabRoute(`./browse?url=${encodeURIComponent(fullUrl)}`, 'Browser', 'bi bi-globe2');
                    }
                }
            });
            return;
        }

        const validRoots = ['team', 'personal', 'meta'];
        
        // Normalize: If they typed a path without a slash but it starts with a known root context,
        // treat it as an absolute path by prepending a slash.
        // e.g., "team/workspaces" -> "/team/workspaces"
        const hasValidRootWithoutSlash = validRoots.some(root => path === root || path.startsWith(`${root}/`));
        if (!path.startsWith('/') && hasValidRootWithoutSlash) {
            path = `/${path}`;
        }

        if (path.startsWith('/')) {
            // Check if the absolute path is attempting to navigate to a known root context
            const hasValidRoot = validRoots.some(root => path === `/${root}` || path.startsWith(`/${root}/`));
            
            // If it's an unrecognized root (e.g. "/sample"), trap it inside the current context
            // so it renders the local 404 template instead of redirecting globally.
            if (!hasValidRoot && ctx) {
                path = `/${ctx}${path}`;
            }
        } else {
            // Allow shorthand like "chat" → resolves to /{context}/chat
            path = ctx ? `/${ctx}/${path}` : `/${path}`;
        }

        this.exitEditMode();
        this.router.navigateByUrl(path).then(success => {
            if (success) {
                let label = '';
                let icon = 'bi bi-folder';

                if (suggestion) {
                    label = suggestion.label;
                    icon = suggestion.icon;
                } else {
                    const metadata = this.resolveRouteMetadata(path);
                    label = metadata.label;
                    icon = metadata.icon;
                }

                // Strip root prefix for the relative route saved in the tab
                const stripped = path.replace(/^\/(personal|team)/, '') || '/';
                const route = stripped === '/' ? './' : '.' + stripped;

                this.tabService.updateActiveTabRoute(route, label, icon);
            }
        });
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
        const { icon } = this.resolveRouteMetadata(crumb.url);

        let route = crumb.url;
        if (crumb.url === '/personal' || crumb.url === '/team') {
            route = './';
        } else if (crumb.url.startsWith('/personal/') || crumb.url.startsWith('/team/')) {
            route = './' + crumb.url.split('/').slice(2).join('/');
        }

        this.tabService.updateActiveTabRoute(route, crumb.label, icon);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /** Resolves a human-readable label and icon from any absolute path using our constants as the single source of truth */
    private resolveRouteMetadata(path: string): { label: string, icon: string } {
        // 1. Check statically defined core pages
        const staticMatch = [...PERSONAL_PAGES, ...TEAM_PAGES].find(p => p.path === path);
        if (staticMatch) {
            return { label: staticMatch.label, icon: staticMatch.icon };
        }

        const parts = path.split('/').filter(p => p);

        // 2. Check dynamic spaces
        if (parts.length > 2 && parts[parts.length - 2] === 'spaces') {
            const spaceId = parts[parts.length - 1];
            const space = this.spaces().find(s => s.id === spaceId);
            return {
                label: space ? space.name : `Space ${spaceId.substring(0, 4)}`,
                icon: 'bi bi-folder'
            };
        }

        // 3. Fallback for unrecognized dynamic pages
        const last = parts[parts.length - 1] || 'Page';
        return {
            label: last.charAt(0).toUpperCase() + last.slice(1).replace('-', ' '),
            icon: 'bi bi-folder'
        };
    }

    private updateContext() {
        const url = this.router.url;
        if (url.startsWith('/personal')) this.context.set('personal');
        else if (url.startsWith('/team'))  this.context.set('team');
        else                               this.context.set('');
    }

    private generateBreadcrumbs() {
        const fullUrl = this.router.url;
        const parsed = this.router.parseUrl(fullUrl);
        const url   = fullUrl.split('?')[0];
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
                if (parts[1] === 'browse' && parsed.queryParams['url']) {
                    const browseUrl = parsed.queryParams['url'];
                    try {
                        const hostname = new URL(browseUrl).hostname;
                        this.defaultBreadcrumbs.push({
                            label: hostname,
                            url: fullUrl,
                            isLast: true
                        });
                    } catch (e) {
                        this.defaultBreadcrumbs.push({
                            label: 'Browser',
                            url: fullUrl,
                            isLast: true
                        });
                    }
                } else if (parts[1] === 'spaces' && parts.length > 2) {
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
