import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shared-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-grid">
        <div class="app-tile active">
            <div class="tile-icon"><i class="bi bi-speedometer2"></i></div>
            <span class="tile-label">Overview</span>
        </div>
        <div class="app-tile">
            <div class="tile-icon"><i class="bi bi-bar-chart-line"></i></div>
            <span class="tile-label">Analytics</span>
        </div>
        <div class="app-tile">
            <div class="tile-icon"><i class="bi bi-shield-check"></i></div>
            <span class="tile-label">Security</span>
        </div>
    </div>
  `,
  styles: [`
    .app-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 4px;
    }

    .app-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px 8px;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        .tile-icon {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-hover);
            border-radius: 14px;
            font-size: 1.3rem;
            color: var(--text-muted);
            transition: all 0.2s ease;
        }

        .tile-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-alt);
            transition: color 0.2s ease;
            user-select: none;
        }

        &:hover {
            background: var(--bg-hover);
            transform: scale(1.02);
            .tile-icon {
                color: var(--text-main);
            }
        }

        &:active {
            transform: scale(0.96);
        }

        &.active {
            background: var(--bg-active);
            border-color: var(--accent);
            box-shadow: 0 4px 15px rgba(var(--accent-rgb, 59, 130, 246), 0.1);

            .tile-icon {
                background: var(--accent);
                color: white;
            }

            .tile-label {
                color: var(--accent);
                font-weight: 700;
            }
        }
    }

    @media (max-width: 770px) {
        .app-tile {
            padding: 20px 10px; // Larger touch targets
        }
    }
  `]
})
export class SharedAppGrid {}
