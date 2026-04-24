import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlarmService } from '../../../core/services/ui/alarm.service';

@Component({
  selector: 'app-global-alarm-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (alarmService.activeAlarm(); as alarm) {
      <div class="global-alert-overlay" (click)="stopAlert()">
        <div class="alert-card animate-pop" (click)="$event.stopPropagation()">
          <div class="alert-icon-ring">
            <i class="bi bi-alarm-fill"></i>
          </div>
          <h2>{{ alarm.label || 'Alarm' }}</h2>
          <div class="alert-time">{{ format12h(alarm.time) }}</div>
          <p>Rising time. High Performance Awaits.</p>
          <button class="dismiss-btn" (click)="stopAlert()">Stop Alarm</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .global-alert-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: none;
    }

    .alert-card {
      pointer-events: auto;
      background: var(--surface-main);
      padding: 40px;
      border-radius: 32px;
      border: 1px solid var(--border);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
      width: 100%;
      max-width: 360px;
      position: relative;
      overflow: hidden;

      .alert-icon-ring {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(var(--accent-rgb, 79, 163, 168), 0.1);
        border: 2px solid var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        
        i {
          font-size: 2.2rem;
          color: var(--accent);
          animation: shake 0.6s ease-in-out infinite;
        }
      }

      h2 {
        font-size: 1.8rem;
        font-weight: 850;
        color: var(--text-main);
        margin: 0;
        letter-spacing: -0.5px;
      }

      .alert-time {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--accent);
        background: var(--surface-alt);
        padding: 8px 20px;
        border-radius: 12px;
        border: 1px solid var(--border);
      }

      p {
        color: var(--text-muted);
        font-weight: 600;
        line-height: 1.6;
        margin: 0;
        font-size: 0.95rem;
      }

      .dismiss-btn {
        width: 100%;
        margin-top: 8px;
        background: var(--accent);
        color: white;
        padding: 18px;
        border-radius: 16px;
        border: none;
        font-weight: 800;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        
        &:hover { filter: brightness(1.1); }
        &:active { transform: scale(0.96); }
      }

      @media (max-width: 600px) {
        max-width: calc(100% - 40px);
        padding: 32px 24px;
        gap: 20px;
        border-radius: 24px;
        h2 { font-size: 1.5rem; }
        .alert-icon-ring { width: 70px; height: 70px; i { font-size: 1.8rem; } }
        .dismiss-btn { padding: 16px; }
      }
    }

    @keyframes shake {
      0%, 100% { transform: rotate(0); }
      20% { transform: rotate(8deg); }
      40% { transform: rotate(-8deg); }
      60% { transform: rotate(4deg); }
      80% { transform: rotate(-4deg); }
    }

    .animate-pop {
      animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.92) translateY(30px); }
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
