import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-space-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="space-card" [class.placeholder]="isPlaceholder" (click)="onCardClick()">
            <!-- Preview Area -->
            <div class="card-preview">
                <div class="preview-inner" [style.background]="previewBackground">
                    @if (icon) {
                        <i class="bi" [class]="icon"></i>
                    }
                </div>
            </div>

            <!-- Footer Details -->
            <div class="card-footer">
                <div class="footer-left">
                    <div class="icon-indicator" [style.background-color]="indicatorColor">
                        <i class="bi" [class]="icon"></i>
                    </div>
                    <div class="text-details">
                        <h3 class="card-title">{{ title }}</h3>
                        <p class="card-subtitle">{{ subtitle }}</p>
                    </div>
                </div>
                
                <div class="footer-right">
                    <button class="options-btn" (click)="$event.stopPropagation()">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
        }

        .space-card {
            background: var(--surface-main);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            height: 100%;
            display: flex;
            flex-direction: column;

            &:hover {
                border-color: var(--accent);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            }

            &.placeholder {
                opacity: 0.7;
                cursor: default;
                &:hover {
                    box-shadow: none;
                    border-color: var(--border);
                }
            }
        }

        .card-preview {
            aspect-ratio: 16 / 10;
            background: var(--surface-alt);
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-bottom: 1px solid var(--border);

            .preview-inner {
                width: 100%;
                height: 100%;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);

                i {
                    font-size: 3rem;
                    color: white;
                    opacity: 0.8;
                }
            }
        }

        .card-footer {
            padding: 12px 14px;
            background: var(--surface-main);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .footer-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            flex: 1;
        }

        .icon-indicator {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            
            i {
                color: white;
                font-size: 1.1rem;
            }
        }

        .text-details {
            min-width: 0;
            flex: 1;

            .card-title {
                font-size: 0.88rem;
                font-weight: 600;
                color: var(--text-main);
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .card-subtitle {
                font-size: 0.72rem;
                color: var(--text-muted);
                margin: 2px 0 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        }

        .options-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 6px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;

            &:hover {
                background: var(--bg-hover);
                color: var(--text-main);
            }
        }
    `]
})
export class SpaceCardComponent {
    @Input() title = '';
    @Input() subtitle = '';
    @Input() icon = '';
    @Input() isPlaceholder = false;
    @Input() previewBackground = 'var(--accent)';
    @Input() indicatorColor = 'var(--accent)';

    @Output() cardClick = new EventEmitter<void>();

    onCardClick() {
        if (!this.isPlaceholder) {
            this.cardClick.emit();
        }
    }
}
