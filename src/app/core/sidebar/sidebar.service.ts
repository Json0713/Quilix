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

        // Left-edge swipe to open sidebar on mobile
        this.initSwipeListener();
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

    // ----------------------------
    // Swipe Gesture Handling
    // ----------------------------
    private initSwipeListener() {
        let startX = 0;
        let startY = 0;
        let isTracking = false;
        let gestureLocked = false;

        const thresholdX = 90;      // Require longer swipe distance
        const edgeThreshold = 70;   // Safe zone from left edge (avoid system back)
        const verticalLock = 25;    // Cancel if vertical movement too large

        const touchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            gestureLocked = false;

            // Opening gesture (only from left edge when closed)
            if (!this.isMobileOpen() && startX <= edgeThreshold) {
                isTracking = true;
            }
            // Closing gesture (only if sidebar already open)
            else if (this.isMobileOpen()) {
                isTracking = true;
            }
            else {
                isTracking = false;
            }
        };

        const touchMove = (e: TouchEvent) => {
            if (!isTracking || gestureLocked) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            // Cancel gesture if vertical scroll dominates
            if (Math.abs(deltaY) > verticalLock && Math.abs(deltaY) > Math.abs(deltaX)) {
                isTracking = false;
                return;
            }

            // OPEN SIDEBAR
            if (!this.isMobileOpen() && deltaX > thresholdX) {
                this.openMobile();
                gestureLocked = true;
                isTracking = false;
            }

            // CLOSE SIDEBAR
            if (this.isMobileOpen() && deltaX < -thresholdX) {
                this.closeMobile();
                gestureLocked = true;
                isTracking = false;
            }
        };

        const touchEnd = () => {
            isTracking = false;
            gestureLocked = false;
        };

        document.addEventListener('touchstart', touchStart, { passive: true });
        document.addEventListener('touchmove', touchMove, { passive: true });
        document.addEventListener('touchend', touchEnd);
        document.addEventListener('touchcancel', touchEnd);
    }
}
