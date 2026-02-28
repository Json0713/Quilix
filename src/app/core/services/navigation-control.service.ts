import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class NavigationControlService {
    private router = inject(Router);

    // Maintain our own distinct history stack
    private historyStack: string[] = [];
    private forwardStack: string[] = [];

    // Track if a navigation is user-initiated vs back/forward action
    private isTravelingHistory = false;

    constructor() {
        // Listen to router events and build history naturally
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            const url = event.urlAfterRedirects || event.url;

            if (!this.isTravelingHistory) {
                // Normal navigation: add to history, clear forward stack
                if (this.historyStack.length === 0 || this.historyStack[this.historyStack.length - 1] !== url) {
                    this.historyStack.push(url);
                    // Optional: Limit history stack size if needed (e.g., max 50 items)
                    if (this.historyStack.length > 50) {
                        this.historyStack.shift();
                    }
                }
                this.forwardStack = [];
            } else {
                // Reset flag after history travel resolves
                this.isTravelingHistory = false;
            }
        });
    }

    get canGoBack(): boolean {
        return this.historyStack.length > 1;
    }

    get canGoForward(): boolean {
        return this.forwardStack.length > 0;
    }

    goBack(): void {
        if (this.canGoBack) {
            this.isTravelingHistory = true;
            const currentUrl = this.historyStack.pop()!;
            this.forwardStack.push(currentUrl);

            const previousUrl = this.historyStack[this.historyStack.length - 1];
            this.router.navigateByUrl(previousUrl);
        }
    }

    goForward(): void {
        if (this.canGoForward) {
            this.isTravelingHistory = true;
            const nextUrl = this.forwardStack.pop()!;
            this.historyStack.push(nextUrl);

            this.router.navigateByUrl(nextUrl);
        }
    }

    refresh(): void {
        window.location.reload();
    }
}
