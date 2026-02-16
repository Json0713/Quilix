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

        const thresholdX = 50; // Minimum horizontal swipe distance
        const edgeThreshold = 20; // Only start swipe if near left edge
        const verticalLock = 30; // Max vertical movement allowed

        const touchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            if (startX <= edgeThreshold) {
                isTracking = true;
            }
        };

        const touchMove = (e: TouchEvent) => {
            if (!isTracking) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            // Ignore mostly vertical swipes
            if (Math.abs(deltaY) > verticalLock) {
                isTracking = false;
                return;
            }

            if (deltaX > thresholdX && !this.isMobileOpen()) {
                this.openMobile();
                isTracking = false;
            }

            if (deltaX < -thresholdX && this.isMobileOpen()) {
                this.closeMobile();
                isTracking = false;
            }
        };

        const touchEnd = () => {
            isTracking = false;
        };

        document.addEventListener('touchstart', touchStart, { passive: true });
        document.addEventListener('touchmove', touchMove, { passive: true });
        document.addEventListener('touchend', touchEnd);
        document.addEventListener('touchcancel', touchEnd);
    }
}
