import { Component, inject, OnInit, HostListener, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { NavigationControlService } from '../../../core/services/navigation-control.service';
import { SidebarService } from '../../../core/sidebar/sidebar.service';
import { TabService } from '../../../core/services/tab.service';
import { SpaceService } from '../../../core/services/space.service';
import { Space } from '../../../core/interfaces/space';
import { Subscription } from 'dexie';

interface Breadcrumb {
    label: string;
    url: string;
    isLast: boolean;
    isSpace?: boolean;
    isDeleted?: boolean;
}

@Component({
    selector: 'app-navigation-bar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './navigation-bar.html',
    styleUrls: ['./navigation-bar.scss']
})
export class NavigationBar implements OnInit, OnDestroy {
    private navControl = inject(NavigationControlService);
    private sidebarService = inject(SidebarService);
    private tabService = inject(TabService);
    private spaceService = inject(SpaceService);
    private router = inject(Router);

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
    @ViewChild('navSearch') navSearch!: ElementRef<HTMLDivElement>;

    breadcrumbs: Breadcrumb[] = [];
    isMobileOpen = this.sidebarService.isMobileOpen;
    isMobileSearchActive = false;

    private spaceSub?: Subscription;

    constructor() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            this.generateBreadcrumbs();
        });
    }

    ngOnInit() {
        this.generateBreadcrumbs();
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        // Catch Ctrl+K or Cmd+K
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault(); // Stop default browser behavior natively
            if (this.searchInput) {
                this.searchInput.nativeElement.focus();
            }
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

    get canGoBack() {
        return this.navControl.canGoBack;
    }

    get canGoForward() {
        return this.navControl.canGoForward;
    }

    goBack() {
        this.navControl.goBack();
    }

    goForward() {
        this.navControl.goForward();
    }

    refresh() {
        this.navControl.refresh();
    }

    toggleMobileSidebar() {
        this.sidebarService.toggleMobile();
    }

    toggleMobileSearch() {
        this.isMobileSearchActive = !this.isMobileSearchActive;
        if (this.isMobileSearchActive) {
            setTimeout(() => {
                if (this.searchInput) {
                    this.searchInput.nativeElement.focus();
                }
            }, 50);
        }
    }

    closeMobileSearch() {
        this.isMobileSearchActive = false;
    }

    private generateBreadcrumbs() {
        const url = this.router.url.split('?')[0];
        const parts = url.split('/').filter(p => p);

        this.breadcrumbs = [];
        this.clearSpaceSub();

        if (parts.length > 0) {
            const root = parts[0]; // personal or team
            this.breadcrumbs.push({
                label: 'Home',
                url: `/${root}`,
                isLast: parts.length === 1
            });

            if (parts.length > 1) {
                if (parts[1] === 'spaces' && parts.length > 2) {
                    const spaceId = parts[2];

                    // Pre-fill with placeholder until subscription resolves
                    this.breadcrumbs.push({
                        label: 'Space ' + spaceId.substring(0, 4),
                        url: `/${root}/spaces/${spaceId}`,
                        isLast: true,
                        isSpace: true
                    });

                    // Kick off the live space query to reactively update the breadcrumb name and status
                    this.monitorSpaceDetails(spaceId);

                } else {
                    // Other generic routes (Tasks, Settings, etc.)
                    let currentUrl = `/${root}`;
                    for (let i = 1; i < parts.length; i++) {
                        currentUrl += `/${parts[i]}`;
                        const label = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
                        this.breadcrumbs.push({
                            label: label,
                            url: currentUrl,
                            isLast: i === parts.length - 1
                        });
                    }
                }
            }
        }
    }

    onBreadcrumbClick(crumb: Breadcrumb) {
        let icon = 'bi bi-folder';
        if (crumb.label === 'Home') icon = 'bi bi-house';
        else if (crumb.label === 'Settings') icon = 'bi bi-gear';
        else if (crumb.label === 'Trash') icon = 'bi bi-trash3';

        let route = crumb.url;
        if (crumb.url === '/personal' || crumb.url === '/team') {
            route = './';
        } else if (crumb.url.startsWith('/personal/') || crumb.url.startsWith('/team/')) {
            route = './' + crumb.url.split('/').slice(2).join('/');
        }

        // Push precise metadata so History tracking captures label/icon dynamically!
        this.tabService.updateActiveTabRoute(route, crumb.label, icon);
    }

    private monitorSpaceDetails(spaceId: string) {
        // Observe the exact space for renames or trash status
        this.spaceSub = this.spaceService.liveSpaceAnyStatus$(spaceId).subscribe((space: Space | null) => {
            if (space) {
                const spaceCrumb = this.breadcrumbs.find(b => b.isSpace && b.url.includes(spaceId));
                if (spaceCrumb) {
                    spaceCrumb.label = space.name;
                    spaceCrumb.isDeleted = !!space.trashedAt;

                    // If it is the active tab and its label changed, sync it silently to the Tab System
                    if (spaceCrumb.isLast) {
                        this.tabService.updateActiveTabRoute(
                            this.router.url.split('?')[0].replace('/personal/', './').replace('/team/', './'),
                            space.name,
                            'bi bi-folder'
                        );
                    }
                }
            }
        });
    }

    private clearSpaceSub() {
        if (this.spaceSub) {
            this.spaceSub.unsubscribe();
            this.spaceSub = undefined;
        }
    }

    ngOnDestroy() {
        this.clearSpaceSub();
    }
}
