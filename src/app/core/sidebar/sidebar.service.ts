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

    // Preserve desktop collapsed state when switching to mobile
    private previousCollapsed: boolean | null = null;

    constructor() {
        effect(() => {
            localStorage.setItem(this.STORAGE_KEY, String(this.isCollapsed()));
        });

        effect(() => {
            if (this.isMobileOpen()) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        this.initSwipeListener();
    }

    toggleCollapsed(): void {
        this.isCollapsed.update(v => !v);
    }

    setCollapsed(value: boolean): void {
        this.isCollapsed.set(value);
    }

    toggleMobile(): void {
        this.isMobileOpen() ? this.closeMobile() : this.openMobile();
    }

    openMobile(): void {
        if (!this.isMobileOpen()) {
            this.previousCollapsed = this.isCollapsed();
            this.isCollapsed.set(false); // Force expanded in mobile
            this.isMobileOpen.set(true);
        }
    }

    closeMobile(): void {
        if (this.isMobileOpen()) {
            this.isMobileOpen.set(false);

            // Restore previous desktop state
            if (this.previousCollapsed !== null) {
                this.isCollapsed.set(this.previousCollapsed);
                this.previousCollapsed = null;
            }
        }
    }

    // ----------------------------
    // Swipe Gesture Handling
    // ----------------------------
    private initSwipeListener(): void {
        let startX = 0;
        let startY = 0;
        let isTracking = false;
        let gestureLocked = false;

        const thresholdX = 90;
        const edgeThreshold = 70;
        const verticalLock = 25;

        const touchStart = (e: TouchEvent): void => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            gestureLocked = false;

            if (!this.isMobileOpen() && startX <= edgeThreshold) {
                isTracking = true;
            } else if (this.isMobileOpen()) {
                isTracking = true;
            } else {
                isTracking = false;
            }
        };

        const touchMove = (e: TouchEvent): void => {
            if (!isTracking || gestureLocked) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            if (Math.abs(deltaY) > verticalLock && Math.abs(deltaY) > Math.abs(deltaX)) {
                isTracking = false;
                return;
            }

            if (!this.isMobileOpen() && deltaX > thresholdX) {
                this.openMobile();
                gestureLocked = true;
                isTracking = false;
            }

            if (this.isMobileOpen() && deltaX < -thresholdX) {
                this.closeMobile();
                gestureLocked = true;
                isTracking = false;
            }
        };

        const touchEnd = (): void => {
            isTracking = false;
            gestureLocked = false;
        };

        document.addEventListener('touchstart', touchStart, { passive: true });
        document.addEventListener('touchmove', touchMove, { passive: true });
        document.addEventListener('touchend', touchEnd);
        document.addEventListener('touchcancel', touchEnd);
    }
}
