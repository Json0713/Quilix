import { Injectable, signal } from '@angular/core';

export interface TooltipState {
    text: string;
    x: number;
    y: number;
    visible: boolean;
    position: 'top' | 'bottom';
    // Addition for edge adjustment
    shiftX: number; 
}

@Injectable({
    providedIn: 'root'
})
export class TooltipService {
    private readonly state = signal<TooltipState>({
        text: '',
        x: 0,
        y: 0,
        visible: false,
        position: 'top',
        shiftX: 0
    });

    readonly tooltipState = this.state.asReadonly();
    private hideTimeout: any;
    private showTimeout: any;
    private tooltipWidthCache: number = 0; // rough estimation cache or fixed max width 

    /**
     * Initializes global event listeners to hijack native title attributes.
     */
    init() {
        // Use pointer events to distinguish mouse from touch efficiently
        window.addEventListener('pointerover', (e: PointerEvent) => this.handlePointerOver(e));
        window.addEventListener('pointerout', (e: PointerEvent) => this.handlePointerOut(e));
        
        // Hide immediately on scroll or global click/touch
        window.addEventListener('scroll', () => this.hide(), true);
        window.addEventListener('pointerdown', () => this.hide(), true); 
    }

    private handlePointerOver(event: PointerEvent) {
        // Only trigger on mouse hover, completely ignore touch input for global title-based tooltips
        if (event.pointerType !== 'mouse') return;

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
            
            // Baseline center point
            let x = rect.left + rect.width / 2;
            let shiftX = 0;

            // Approximate the text width (Assume 13px font, ~7px per character + padding). 
            // Caching width prevents needing to flash the DOM or double render.
            // Using a max clamp because tooltips usually wrap or have max-width.
            const estimatedWidth = Math.min(text.length * 7 + 32, 300); 
            const halfWidth = estimatedWidth / 2;

            // Horizontal Edge Detection
            const paddingFromEdge = 16;
            const screenWidth = window.innerWidth;
            
            if (x - halfWidth < paddingFromEdge) {
                // Too far left - shift bubble right
                const deficit = paddingFromEdge - (x - halfWidth);
                shiftX = deficit;
            } else if (x + halfWidth > screenWidth - paddingFromEdge) {
                // Too far right - shift bubble left
                const excess = (x + halfWidth) - (screenWidth - paddingFromEdge);
                shiftX = -excess;
            }

            // Vertical Smart Positioning Check: 
            // If there's less than 60px space above the element, flip to bottom
            const enoughSpaceAbove = rect.top > 60;
            const position = enoughSpaceAbove ? 'top' : 'bottom';

            // If position is 'top', center is at rect.top
            // If position is 'bottom', center is at rect.bottom
            const y = enoughSpaceAbove ? rect.top : rect.bottom;

            this.state.set({
                text,
                x,
                y,
                visible: true,
                position,
                shiftX
            });
        }, 500);
    }

    private handlePointerOut(event: PointerEvent) {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(this.showTimeout);
        this.hideTimeout = setTimeout(() => this.hide(), 100);
    }

    hide() {
        if (this.state().visible) {
            this.state.update(s => ({ ...s, visible: false }));
        }
    }
}
