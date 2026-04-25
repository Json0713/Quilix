import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class PwaNavigationService {
    private router = inject(Router);

    /**
     * Initializes the persistent navigation listener and boot interceptor.
     * Ensures physical OS/Desktop-like retention. App relaunches boot 
     * directly into the last active Workspace instead of the Root Landing Page.
     */
    init(): void {
        // 1. Initial Boot Interceptor
        if (window.location.pathname === '/') {
            const params = new URLSearchParams(window.location.search);
            const lastRoute = localStorage.getItem('quilix_last_route');

            // DEVELOPER / MANUAL OVERRIDE: 
            // If explicitly requesting the home page via ?home=true, clear memory and stay here.
            if (params.has('home')) {
                localStorage.removeItem('quilix_last_route');
                return;
            }

            if (lastRoute && lastRoute !== '/') {
                this.router.navigateByUrl(lastRoute, { replaceUrl: true });
            }
        }

        // 2. Global Route Tracker
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd)
        ).subscribe((event: NavigationEnd) => {
            const url = event.urlAfterRedirects.split('?')[0]; // Strip tearOff parameters or query params

            // We only want to 'Remember' active workspace boundaries.
            // We explicitly ignore saving public entry points like /, /login, /create-workspace, or /meta/auth variants
            const isWorkspaceCore = url.startsWith('/personal') || url.startsWith('/team');
            const isMetaCore = url.startsWith('/meta') && !url.includes('/auth');

            if (isWorkspaceCore || isMetaCore) {
                localStorage.setItem('quilix_last_route', event.urlAfterRedirects);
            } else if (url === '/') {
                // If the user intentionally navigated back to the Home/Landing page,
                // clear the memory so the next boot acts cleanly as a fresh start.
                localStorage.removeItem('quilix_last_route');
            }
        });
    }
}
