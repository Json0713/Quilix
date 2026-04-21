import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-personal-clock-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-card clock-date" (click)="toggleSeconds()">
      <div class="time-display">
        {{ currentTime() | date:'h:mm' }}<span class="seconds" *ngIf="showSeconds()">{{ currentTime() | date:'ss' }}</span><span class="period">{{ currentTime() | date:'a' }}</span>
      </div>
      <div class="date-display">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
    </div>
  `,
  styles: [`
    .widget-card {
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover {
        background: var(--bg-hover);
      }
    }

    .clock-date {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;

        .time-display {
            font-size: 2.2rem;
            font-weight: 700;
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            letter-spacing: -1px;
            line-height: 1;
            margin-bottom: 4px;
            user-select: none;

            .seconds {
                font-size: 1rem;
                color: var(--text-muted);
                margin-left: 4px;
                font-weight: 500;
            }

            .period {
              font-size: 0.8rem;
              text-transform: uppercase;
              margin-left: 4px;
              color: var(--accent);
              font-weight: 700;
            }
        }

        .date-display {
            font-size: 0.72rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            user-select: none;
        }
    }
  `]
})
export class ClockWidget implements OnInit, OnDestroy {
  currentTime = signal(new Date());
  showSeconds = signal(true);
  private timer: any;

  ngOnInit() {
    this.timer = setInterval(() => this.currentTime.set(new Date()), 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  toggleSeconds() {
    this.showSeconds.update(v => !v);
  }
}
