import { Injectable, signal, effect } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SidebarService {
    private readonly STORAGE_KEY = 'sidebar_collapsed';

    // Desktop Collapsed State
    isCollapsed = signal(localStorage.getItem(this.STORAGE_KEY) === 'true');

    // Mobile Open State
    isMobileOpen = signal(false);

    constructor() {
        // Persist collapsed state
        effect(() => {
            localStorage.setItem(this.STORAGE_KEY, String(this.isCollapsed()));
        });

        // Lock body scroll when mobile sidebar is open
        effect(() => {
            if (this.isMobileOpen()) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });
    }

    toggleCollapsed() {
        this.isCollapsed.update(v => !v);
    }

    setCollapsed(value: boolean) {
        this.isCollapsed.set(value);
    }

    toggleMobile() {
        this.isMobileOpen.update(v => !v);
    }

    closeMobile() {
        this.isMobileOpen.set(false);
    }

    openMobile() {
        this.isMobileOpen.set(true);
    }
}
