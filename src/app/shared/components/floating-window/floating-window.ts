import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy, OnChanges, SimpleChanges, inject, computed, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService } from '../../../services/ui/window-manager/window-manager.service';

@Component({
    selector: 'app-floating-window',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './floating-window.html',
    styleUrl: './floating-window.scss',
})
export class FloatingWindowComponent implements OnInit, OnDestroy, OnChanges {
    @Input() storageKey!: string; // Must provide a unique key for persistence
    @Input() title: string = '';
    @Input() icon: string = 'bi-window';
    @Input() defaultWidth: number = 800;
    @Input() defaultHeight: number = 580;
    @Input() minWidth: number = 600;
    @Input() minHeight: number = 450;
    
    @Input() visible: boolean = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    @ViewChild('windowElement') windowElement!: ElementRef<HTMLDivElement>;
    @ViewChild('overlayElement') overlayElement!: ElementRef<HTMLDivElement>;

    isMaximized = signal<boolean>(false);
    isDetached = signal<boolean>(false);
    // Support PiP if available, otherwise allow standard popup windows for detachment
    canDetach = true; 

    windowSize = signal<{ width: number, height: number }>({ width: 800, height: 580 });
    windowPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });
    
    isDragging = false;
    isResizing = false;
    private resizeDirection: string = '';
    private dragOffset = { x: 0, y: 0 };
    private initialSize = { width: 0, height: 0 };
    private initialPos = { x: 0, y: 0 };
    private initialWindowPos = { x: 0, y: 0 };
    
    private windowManager = inject(WindowManagerService);
    private ngZone = inject(NgZone);
    private pipWindow: any = null;
    
    zIndex = computed(() => {
        if (this.isDetached()) return 9999;
        return this.windowManager.getZIndex(this.storageKey || 'default');
    });

    ngOnChanges(changes: SimpleChanges) {
        if (changes['visible']) {
            const isVisible = changes['visible'].currentValue;
            if (isVisible === true) {
                this.handleAutoMaximize();
                this.windowManager.register(this.storageKey || 'default');
            } else {
                // If the window is hidden from the outside, ensure the detached window is also closed
                if (this.isDetached() && this.pipWindow) {
                    this.pipWindow.close();
                }
                this.windowManager.unregister(this.storageKey || 'default');
            }
        }
    }

    ngOnInit() {
        this.windowSize.set({ width: this.defaultWidth, height: this.defaultHeight });
        this.loadWindowState();
        this.handleAutoMaximize();
    }

    private handleAutoMaximize() {
        // Auto maximize on mobile when opened
        if (window.innerWidth < 768) {
            this.isMaximized.set(true);
        }
    }

    ngOnDestroy() {
        this.saveWindowState();
        this.windowManager.unregister(this.storageKey || 'default');
    }

    close() {
        if (this.isDetached() && this.pipWindow) {
            this.pipWindow.close();
            // The pagehide listener will handle the cleanup
        }
        this.visible = false;
        this.visibleChange.emit(this.visible);
        this.windowManager.unregister(this.storageKey || 'default');
        if (!this.visible) {
            this.isMaximized.set(false);
            this.isDetached.set(false);
        }
    }

    toggleMaximize() {
        this.isMaximized.update(v => !v);
        this.focus();
    }

    focus() {
        this.windowManager.bringToFront(this.storageKey || 'default');
    }

    // --- Window Interaction (Drag & Resize) ---
    onDragStart(event: MouseEvent) {
        if (this.isMaximized() || this.isDetached() || window.innerWidth < 768) return;
        
        this.isDragging = true;
        this.dragOffset = {
            x: event.clientX - this.windowPosition().x,
            y: event.clientY - this.windowPosition().y
        };
        
        window.addEventListener('mousemove', this.onDragMove);
        window.addEventListener('mouseup', this.onDragEnd);
        event.preventDefault();
    }

    onDragMove = (event: MouseEvent) => {
        if (!this.isDragging) return;
        requestAnimationFrame(() => {
            const newX = event.clientX - this.dragOffset.x;
            const newY = event.clientY - this.dragOffset.y;
            
            // Viewport Containment
            const maxX = window.innerWidth - this.windowSize().width;
            const maxY = window.innerHeight - this.windowSize().height;
            
            this.windowPosition.set({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY))
            });
        });
    }

    onDragEnd = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
        this.saveWindowState();
    }

    // --- Resizing ---
    onResizeStart(event: MouseEvent, direction: string) {
        if (this.isMaximized() || this.isDetached() || window.innerWidth < 768) return;
        
        event.stopPropagation();
        event.preventDefault();
        
        this.isResizing = true;
        this.resizeDirection = direction;
        this.initialPos = { x: event.clientX, y: event.clientY };
        this.initialSize = { ...this.windowSize() };
        this.initialWindowPos = { ...this.windowPosition() };

        window.addEventListener('mousemove', this.onResizeMove);
        window.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (event: MouseEvent) => {
        if (!this.isResizing) return;

        requestAnimationFrame(() => {
            const deltaX = event.clientX - this.initialPos.x;
            const deltaY = event.clientY - this.initialPos.y;
            
            let newWidth = this.initialSize.width;
            let newHeight = this.initialSize.height;
            let newX = this.initialWindowPos.x;
            let newY = this.initialWindowPos.y;

            // Handle Horizontal Resize
            if (this.resizeDirection.includes('e')) {
                newWidth = Math.max(this.minWidth, this.initialSize.width + deltaX);
            } else if (this.resizeDirection.includes('w')) {
                const requestedWidth = this.initialSize.width - deltaX;
                if (requestedWidth >= this.minWidth) {
                    newWidth = requestedWidth;
                    newX = this.initialWindowPos.x + deltaX;
                } else {
                    newWidth = this.minWidth;
                    newX = this.initialWindowPos.x + (this.initialSize.width - this.minWidth);
                }
            }

            // Handle Vertical Resize
            if (this.resizeDirection.includes('s')) {
                newHeight = Math.max(this.minHeight, this.initialSize.height + deltaY);
            } else if (this.resizeDirection.includes('n')) {
                const requestedHeight = this.initialSize.height - deltaY;
                if (requestedHeight >= this.minHeight) {
                    newHeight = requestedHeight;
                    newY = this.initialWindowPos.y + deltaY;
                } else {
                    newHeight = this.minHeight;
                    newY = this.initialWindowPos.y + (this.initialSize.height - this.minHeight);
                }
            }

            // Viewport clamping during resize
            const maxX = window.innerWidth - newX;
            const maxY = window.innerHeight - newY;
            newWidth = Math.min(newWidth, maxX);
            newHeight = Math.min(newHeight, maxY);
            
            // Position clamping (prevent moving past 0 during n/w resize)
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);

            this.windowSize.set({ width: newWidth, height: newHeight });
            this.windowPosition.set({ x: newX, y: newY });
        });
    }

    onResizeEnd = () => {
        this.isResizing = false;
        window.removeEventListener('mousemove', this.onResizeMove);
        window.removeEventListener('mouseup', this.onResizeEnd);
        this.saveWindowState();
    }

    private saveWindowState() {
        if (!this.storageKey) return;
        const state = {
            width: this.windowSize().width,
            height: this.windowSize().height,
            x: this.windowPosition().x,
            y: this.windowPosition().y
        };
        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }

    private loadWindowState() {
        if (!this.storageKey) {
            this.centerWindow();
            return;
        }
        
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.windowSize.set({ width: state.width || this.defaultWidth, height: state.height || this.defaultHeight });
                
                // Keep window on screen
                let x = state.x || 0;
                let y = state.y || 0;
                if (x > window.innerWidth - 100) x = window.innerWidth - this.windowSize().width;
                if (y > window.innerHeight - 100) y = window.innerHeight - this.windowSize().height;
                if (x < 0) x = 0;
                if (y < 0) y = 0;
                
                this.windowPosition.set({ x, y });
                return;
            } catch (e) {
                console.error('[FloatingWindow] Failed to load window state:', e);
            }
        }
        
        this.centerWindow();
    }

    private centerWindow() {
        const size = this.windowSize();
        this.windowPosition.set({
            x: Math.max(0, (window.innerWidth - size.width) / 2),
            y: Math.max(0, (window.innerHeight - size.height) / 2)
        });
    }

    async toggleDetach() {
        if (!this.canDetach) return;

        if (this.isDetached()) {
            if (this.pipWindow) {
                this.pipWindow.close();
            }
            return;
        }

        try {
            const size = this.windowSize();
            const width = Math.max(size.width, 770);
            const height = size.height;

            const pipApi = (window as any).documentPictureInPicture;
            
            // Strategy: Use Document PiP for the first window (if supported), 
            // and fallback to window.open for subsequent windows or non-supported browsers.
            if (pipApi && !pipApi.window) {
                this.pipWindow = await pipApi.requestWindow({
                    width: width,
                    height: height,
                });
            } else {
                const left = window.screenX + (window.innerWidth - width) / 2;
                const top = window.screenY + (window.innerHeight - height) / 2;
                
                // Use a unique name per window storage key to allow multiple independent windows
                const windowName = `quilix_window_${this.storageKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
                this.pipWindow = window.open('', windowName, 
                    `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,location=no,toolbar=no`);
                
                if (!this.pipWindow) {
                    alert('Detachment blocked. Please allow popups for this site to enable multiple windows.');
                    return;
                }

                // Wait for the new window document to be ready
                if (this.pipWindow.document.readyState !== 'complete') {
                    await new Promise(resolve => {
                        this.pipWindow!.onload = resolve;
                        // Safety timeout
                        setTimeout(resolve, 500);
                    });
                }
            }

            this.isDetached.set(true);
            this.isMaximized.set(false);

            // Copy styles to PiP window
            this.copyStylesToPip(this.pipWindow);

            // Move the window element to the PiP window
            const windowEl = this.windowElement.nativeElement;
            if (windowEl) {
                this.pipWindow.document.body.append(windowEl);
            }

            // Handle PiP window closing
            this.pipWindow.addEventListener('pagehide', () => {
                this.ngZone.run(() => {
                    if (!this.isDetached()) return;

                    this.isDetached.set(false);
                    this.isDragging = false;
                    this.isResizing = false;
                    this.pipWindow = null;
                    
                    // Move back to original container if component is still active and visible
                    if (this.overlayElement && this.overlayElement.nativeElement && windowEl) {
                        this.overlayElement.nativeElement.append(windowEl);
                    }
                });
            });

        } catch (error) {
            console.error('[FloatingWindow] Failed to detach window:', error);
            this.isDetached.set(false);
        }
    }

    private copyStylesToPip(pipWindow: any) {
        const allStyleSheets = Array.from(document.styleSheets);
        
        allStyleSheets.forEach((styleSheet: any) => {
            try {
                if (styleSheet.cssRules) {
                    const newStyle = pipWindow.document.createElement('style');
                    const rules = Array.from(styleSheet.cssRules)
                        .map((rule: any) => rule.cssText)
                        .join('');
                    newStyle.textContent = rules;
                    pipWindow.document.head.appendChild(newStyle);
                } else if (styleSheet.href) {
                    const newLink = pipWindow.document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = styleSheet.href;
                    pipWindow.document.head.appendChild(newLink);
                }
            } catch (e) {
                // Fallback for cross-origin stylesheets
                if (styleSheet.href) {
                    const newLink = pipWindow.document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = styleSheet.href;
                    pipWindow.document.head.appendChild(newLink);
                }
            }
        });

        // Also copy body background and theme variables
        pipWindow.document.body.style.background = getComputedStyle(document.body).backgroundColor;
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.overflow = 'hidden';
        pipWindow.document.body.style.height = '100vh';
        pipWindow.document.body.style.display = 'flex';
        pipWindow.document.body.style.flexDirection = 'column';

        pipWindow.document.documentElement.className = document.documentElement.className;
        
        // Copy all CSS variables from root
        const rootStyles = getComputedStyle(document.documentElement);
        const pipRoot = pipWindow.document.documentElement.style;
        
        // This is a bit heavy, but ensures theme consistency
        for (let i = 0; i < rootStyles.length; i++) {
            const prop = rootStyles[i];
            if (prop.startsWith('--')) {
                pipRoot.setProperty(prop, rootStyles.getPropertyValue(prop));
            }
        }
    }
}
