import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlarmService } from '../../../core/services/ui/alarm.service';

@Component({
  selector: 'app-global-alarm-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (alarmService.activeAlarm() || alarmService.activeReminder()) {
      <div class="global-alert-overlay" (click)="stopAlert()">
        
        <!-- ALARM CARD -->
        @if (alarmService.activeAlarm(); as alarm) {
          <div class="alert-card animate-pop" (click)="$event.stopPropagation()">
            <div class="alert-icon-ring">
              <i class="bi bi-alarm-fill"></i>
            </div>
            <h2>{{ alarm.label || 'Alarm' }}</h2>
            <div class="alert-time">{{ format12h(alarm.time) }}</div>
            <p>Rising time. High Performance Awaits.</p>
            <button class="dismiss-btn" (click)="stopAlert()">Stop Alarm</button>
          </div>
        }

        <!-- REMINDER CARD -->
        @if (alarmService.activeReminder(); as note) {
          <div class="alert-card reminder animate-pop" (click)="$event.stopPropagation()">
            <div class="alert-icon-ring reminder">
              <i class="bi bi-calendar-check-fill"></i>
            </div>
            <h2>{{ note.title || 'Reminder' }}</h2>
            <p>{{ note.content || 'You have a scheduled note for today.' }}</p>
            <button class="dismiss-btn reminder" (click)="stopAlert()">Dismiss</button>
          </div>
        }

      </div>
    }
  `,
  styles: [`
    .global-alert-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(25px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .alert-card {
      background: var(--surface-main);
      padding: 40px;
      border-radius: 44px;
      border: 1px solid var(--accent);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
      width: 100%;
      max-width: 360px;
      
      &.reminder {
        border-color: var(--text-muted);
      }

      .alert-icon-ring {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(var(--accent-rgb, 79, 163, 168), 0.1);
        border: 2px solid var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        
        &.reminder {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--text-muted);
            i { color: var(--text-main); animation: none; }
        }

        i {
          font-size: 2.5rem;
          color: var(--accent);
          animation: shake 0.5s ease-in-out infinite;
        }
      }

      h2 {
        font-size: 2rem;
        font-weight: 950;
        color: var(--text-main);
        margin: 0;
        letter-spacing: -1px;
      }

      .alert-time {
        font-size: 1.2rem;
        font-weight: 800;
        color: var(--accent);
        background: var(--surface-alt);
        padding: 6px 16px;
        border-radius: 50px;
      }

      p {
        color: var(--text-muted);
        font-weight: 600;
        line-height: 1.6;
        margin: 0;
      }

      .dismiss-btn {
        width: 100%;
        margin-top: 10px;
        background: var(--accent);
        color: white;
        padding: 18px;
        border-radius: 50px;
        border: none;
        font-weight: 900;
        font-size: 1.1rem;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        
        &:hover { transform: translateY(-2px); filter: brightness(1.1); }
        &:active { transform: scale(0.98); }
        
        &.reminder {
            background: var(--surface-alt);
            color: var(--text-main);
            border: 1px solid var(--border);
        }
      }
    }

    @keyframes shake {
      0%, 100% { transform: rotate(0); }
      25% { transform: rotate(10deg); }
      75% { transform: rotate(-10deg); }
    }

    .animate-pop {
      animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `]
})
export class GlobalAlarmAlertComponent {
  protected alarmService = inject(AlarmService);

  stopAlert() {
    this.alarmService.stopAlert();
  }

  format12h(timeStr: string): string {
    if (!timeStr) return '--:--';
    const [hours, mins] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
  }
}
