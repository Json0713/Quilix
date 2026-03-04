import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-snackbar',
    standalone: true,
    imports: [CommonModule],
    template: `
        @if (isVisible()) {
        <div class="snackbar" [class.show]="isVisible()" [ngClass]="type()">
            <div class="snackbar-content">
                @if (type() === 'success') {
                <i class="bi bi-check-circle-fill"></i>
                } @else if (type() === 'error') {
                <i class="bi bi-exclamation-octagon-fill"></i>
                } @else if (type() === 'info') {
                <i class="bi bi-info-circle-fill"></i>
                }
                <span>{{ message() }}</span>
            </div>
            <button class="close-btn" (click)="hide()">
                <i class="bi bi-x"></i>
            </button>
        </div>
        }
    `,
    styles: [`
        .snackbar {
            position: fixed;
            bottom: -100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface-main, #fff);
            color: var(--text-main, #333);
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            min-width: 300px;
            max-width: 90vw;
            z-index: 9999;
            transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 1px solid var(--border, #eee);

            &.show {
                bottom: 24px;
            }

            &.success { border-left: 4px solid #22c55e; i { color: #22c55e; } }
            &.error { border-left: 4px solid #ef4444; i { color: #ef4444; } }
            &.info { border-left: 4px solid #3b82f6; i { color: #3b82f6; } }

            .snackbar-content {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-weight: 500;
            }

            .close-btn {
                background: none;
                border: none;
                color: var(--text-muted, #888);
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s ease;

                &:hover {
                    color: var(--text-main, #333);
                }
            }
        }
    `]
})
export class SnackbarComponent {
    isVisible = signal<boolean>(false);
    message = signal<string>('');
    type = signal<'success' | 'error' | 'info'>('info');
    private timeoutId: any;

    show(msg: string, messageType: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
        this.message.set(msg);
        this.type.set(messageType);
        this.isVisible.set(true);

        if (this.timeoutId) clearTimeout(this.timeoutId);

        if (duration > 0) {
            this.timeoutId = setTimeout(() => {
                this.hide();
            }, duration);
        }
    }

    hide() {
        this.isVisible.set(false);
    }
}
