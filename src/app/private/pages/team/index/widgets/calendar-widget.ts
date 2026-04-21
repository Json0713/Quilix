import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-team-calendar-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-card calendar-mini">
        <div class="calendar-header">
            <span>{{ now() | date:'MMMM yyyy' }}</span>
        </div>
        <div class="calendar-grid">
            <span class="day-name">S</span><span class="day-name">M</span><span class="day-name">T</span>
            <span class="day-name">W</span><span class="day-name">T</span><span class="day-name">F</span>
            <span class="day-name">S</span>
            
            @for (day of calendarDays(); track $index) {
                <span class="day-cell" 
                      [class.empty]="day === 0" 
                      [class.today]="day === now().getDate()"
                      [class.selected]="selectedDay() === day"
                      (click)="selectDay(day)">
                    {{ day !== 0 ? day : '' }}
                </span>
            }
        </div>
    </div>
  `,
  styles: [`
    .widget-card {
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 12px;
      transition: background-color 0.2s ease;

      &:hover {
        background: var(--bg-hover);
      }
    }

    .calendar-mini {
        .calendar-header {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 10px;
            text-align: center;
            text-transform: uppercase;
            user-select: none;
        }

        .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
            text-align: center;

            .day-name {
                font-size: 0.6rem;
                font-weight: 800;
                color: var(--accent);
                opacity: 0.7;
                margin-bottom: 4px;
                user-select: none;
            }

            .day-cell {
                font-size: 0.7rem;
                font-weight: 500;
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                color: var(--text-alt);
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;

                &:hover:not(.empty):not(.today) {
                    background: var(--bg-active);
                    color: var(--text-main);
                }

                &.today {
                    background: var(--accent);
                    color: white;
                    font-weight: 700;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                }

                &.selected:not(.today):not(.empty) {
                    background: var(--bg-active);
                    color: var(--accent);
                    font-weight: 700;
                    border: 1px solid var(--accent);
                }

                &.empty { 
                    cursor: default;
                    pointer-events: none; 
                }
            }
        }
    }
  `]
})
export class CalendarWidget implements OnInit {
  now = signal(new Date());
  calendarDays = signal<number[]>([]);
  selectedDay = signal<number | null>(null);

  ngOnInit() {
    this.updateCalendar();
  }

  private updateCalendar() {
    const date = this.now();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(0);
    for (let i = 1; i <= lastDate; i++) days.push(i);
    this.calendarDays.set(days);
  }

  selectDay(day: number) {
    if (day !== 0) {
      this.selectedDay.set(day);
    }
  }
}
