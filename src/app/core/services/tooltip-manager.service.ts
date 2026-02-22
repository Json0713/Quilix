import { Injectable, signal } from '@angular/core';

export interface TooltipState {
    text: string;
    x: number;
    y: number;
    visible: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class TooltipManagerService {
    private readonly state = signal<TooltipState>({
        text: '',
        x: 0,
        y: 0,
        visible: false
    });

    readonly tooltipState = this.state.asReadonly();
    private hideTimeout: any;
    private showTimeout: any;

    /**
     * Initializes global event listeners to hijack native title attributes.
     */
    init() {
        // We use capture phase for scroll to catch it everywhere
        window.addEventListener('mouseover', (e: MouseEvent) => this.handleMouseOver(e));
        window.addEventListener('mouseout', (e: MouseEvent) => this.handleMouseOut(e));
        window.addEventListener('scroll', () => this.hide(), true);
    }

    private handleMouseOver(event: MouseEvent) {
        const target = (event.target as HTMLElement).closest('[title], [data-title]') as HTMLElement;
        if (!target) return;

        // Move title to data-title to suppress browser default immediately
        const nativeTitle = target.getAttribute('title');
        if (nativeTitle) {
            target.setAttribute('data-title', nativeTitle);
            target.removeAttribute('title');
        }

        const text = target.getAttribute('data-title');
        if (!text) return;

        clearTimeout(this.hideTimeout);
        clearTimeout(this.showTimeout);

        // Show after a short delay for better UX
        this.showTimeout = setTimeout(() => {
            const rect = target.getBoundingClientRect();

            // Calculate horizontal center
            const x = rect.left + rect.width / 2;
            // Position above the element
            const y = rect.top;

            this.state.set({
                text,
                x,
                y,
                visible: true
            });
        }, 500);
    }

    private handleMouseOut(event: MouseEvent) {
        clearTimeout(this.showTimeout);
        this.hideTimeout = setTimeout(() => this.hide(), 100);
    }

    hide() {
        if (this.state().visible) {
            this.state.update(s => ({ ...s, visible: false }));
        }
    }
}
