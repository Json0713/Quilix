import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

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

    isMaximized = signal<boolean>(false);
    windowSize = signal<{ width: number, height: number }>({ width: 800, height: 580 });
    windowPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });
    
    isDragging = false;
    isResizing = false;
    private dragOffset = { x: 0, y: 0 };
    private initialSize = { width: 0, height: 0 };
    private initialPos = { x: 0, y: 0 };
    
    ngOnChanges(changes: SimpleChanges) {
        if (changes['visible']?.currentValue === true) {
            this.handleAutoMaximize();
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
    }

    close() {
        this.visible = false;
        this.visibleChange.emit(this.visible);
        if (!this.visible) {
            this.isMaximized.set(false);
        }
    }

    toggleMaximize() {
        this.isMaximized.update(v => !v);
    }

    // --- Window Interaction (Drag & Resize) ---
    onDragStart(event: MouseEvent) {
        if (this.isMaximized() || window.innerWidth < 768) return;
        
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
            this.windowPosition.set({
                x: event.clientX - this.dragOffset.x,
                y: event.clientY - this.dragOffset.y
            });
        });
    }

    onDragEnd = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', this.onDragMove);
        window.removeEventListener('mouseup', this.onDragEnd);
        this.saveWindowState();
    }

    // SE Corner Resizing
    onResizeStart(event: MouseEvent) {
        if (this.isMaximized() || window.innerWidth < 768) return;
        
        event.stopPropagation();
        event.preventDefault();
        
        this.isResizing = true;
        this.initialPos = { x: event.clientX, y: event.clientY };
        this.initialSize = { ...this.windowSize() };

        window.addEventListener('mousemove', this.onResizeMove);
        window.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (event: MouseEvent) => {
        if (!this.isResizing) return;

        requestAnimationFrame(() => {
            const deltaX = event.clientX - this.initialPos.x;
            const deltaY = event.clientY - this.initialPos.y;

            this.windowSize.set({
                width: Math.max(this.minWidth, this.initialSize.width + deltaX),
                height: Math.max(this.minHeight, this.initialSize.height + deltaY)
            });
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
}
