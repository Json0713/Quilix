import { Component, OnInit, OnDestroy, signal, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DexieService, WidgetAlarm } from '../../core/database/dexie.service';
import { ModalService } from '../../services/ui/common/modal/modal';

@Component({
  selector: 'app-shared-clock-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clock-hub" [class.modal-view]="isModal">
      
      <!-- SIDEBAR VIEW -->
      @if (!isModal) {
          <div class="clock-display">
            <div class="time-main">
              {{ currentTime() | date:'h:mm' }}<span class="seconds" *ngIf="showSeconds()">{{ currentTime() | date:'ss' }}</span><span class="period">{{ currentTime() | date:'a' }}</span>
            </div>
            <div class="date-sub">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
          </div>
      }

      <!-- MODAL VIEW (Native Pattern) -->
      @if (isModal) {
          <div class="widget-modal-wrapper">
                <div class="widget-modal-header">
                    <div class="header-left">
                        <i class="bi bi-clock header-icon"></i>
                        <h2>Time Hub</h2>
                    </div>
                    <button class="close-btn" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
                </div>

                <div class="hub-tabs-container">
                    <div class="hub-tabs">
                        <button (click)="activeTab.set('clock')" [class.active]="activeTab() === 'clock'"><i class="bi bi-clock"></i></button>
                        <button (click)="activeTab.set('alarm')" [class.active]="activeTab() === 'alarm'"><i class="bi bi-alarm"></i></button>
                        <button (click)="activeTab.set('timer')" [class.active]="activeTab() === 'timer'"><i class="bi bi-hourglass-split"></i></button>
                        <button (click)="activeTab.set('stopwatch')" [class.active]="activeTab() === 'stopwatch'"><i class="bi bi-stopwatch"></i></button>
                    </div>
                </div>

                <div class="widget-modal-body">
                    <div class="hub-content">
                        
                        <!-- MODE: CLOCK -->
                        @if (activeTab() === 'clock') {
                            <div class="clock-display modal-mode">
                                <div class="time-main">
                                    {{ currentTime() | date:'h:mm' }}<span class="seconds" *ngIf="showSeconds()">{{ currentTime() | date:'ss' }}</span><span class="period">{{ currentTime() | date:'a' }}</span>
                                </div>
                                <div class="date-sub">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
                            </div>
                        }

                        <!-- MODE: ALARM -->
                        @if (activeTab() === 'alarm') {
                            <div class="alarm-manager">
                                <div class="alarm-header-sub">
                                    <h3>Active Alarms</h3>
                                    <span class="alarm-count">{{ alarms().length }} Set</span>
                                </div>
                                
                                <div class="alarm-list">
                                    @for (alarm of alarms(); track alarm.id) {
                                        <div class="alarm-item" [class.enabled]="alarm.enabled">
                                            <div class="alarm-info">
                                                <span class="alarm-time">{{ alarm.time }}</span>
                                                <span class="alarm-label">{{ alarm.label || 'Daily Alarm' }}</span>
                                            </div>
                                            <div class="alarm-actions">
                                                <div class="toggle-switch" (click)="toggleAlarm(alarm)">
                                                    <div class="switch-handle"></div>
                                                </div>
                                                <button class="delete-btn" (click)="deleteAlarm(alarm)"><i class="bi bi-trash3"></i></button>
                                            </div>
                                        </div>
                                    } @empty {
                                        <div class="empty-alarms">No alarms scheduled.</div>
                                    }
                                </div>

                                <div class="add-alarm-form">
                                    <div class="input-group">
                                        <input type="time" [(ngModel)]="newAlarmTime" class="time-input">
                                        <input type="text" [(ngModel)]="newAlarmLabel" placeholder="Label (e.g. Work)" class="label-input">
                                    </div>
                                    <button (click)="addAlarm()" class="add-btn" [disabled]="!newAlarmTime">
                                        <i class="bi bi-plus-lg"></i> Add Alarm
                                    </button>
                                </div>
                            </div>
                        }

                        <!-- MODE: TIMER -->
                        @if (activeTab() === 'timer') {
                            <div class="timer-display">
                                <div class="timer-visual">
                                    <svg viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" class="bg"></circle>
                                        <circle cx="50" cy="50" r="45" class="progress" [style.stroke-dashoffset]="45 * 2 * 3.14159 * (1 - timerProgress())"></circle>
                                    </svg>
                                    <div class="timer-digits">{{ formatTimer(timerValue()) }}</div>
                                </div>
                                
                                <div class="timer-controls">
                                    @if (!timerRunning()) {
                                        <div class="timer-presets">
                                            <button (click)="setTimer(60)">1m</button>
                                            <button (click)="setTimer(300)">5m</button>
                                            <button (click)="setTimer(600)">10m</button>
                                            <button (click)="setTimer(1500)" class="pomo">25m</button>
                                        </div>
                                        <button class="main-btn start" (click)="startTimer()">Start Timer</button>
                                    } @else {
                                        <button class="main-btn stop" (click)="stopTimer()">Stop Countdown</button>
                                    }
                                    <button class="main-btn reset" (click)="resetTimer()">Reset</button>
                                </div>
                            </div>
                        }

                        <!-- MODE: STOPWATCH -->
                        @if (activeTab() === 'stopwatch') {
                            <div class="stopwatch-display">
                                <div class="sw-time">{{ formatStopwatch(swTime()) }}</div>
                                <div class="sw-controls">
                                    @if (!swRunning()) {
                                        <button class="main-btn start" (click)="startSW()">Start</button>
                                    } @else {
                                        <button class="main-btn stop" (click)="stopSW()">Stop</button>
                                        <button class="main-btn lap" (click)="lapSW()">Lap</button>
                                    }
                                    <button class="main-btn reset" (click)="resetSW()">Reset</button>
                                </div>
                                
                                <div class="lap-history">
                                    @for (lap of laps(); track $index) {
                                        <div class="lap-item">
                                            <span class="lap-num">Lap {{ laps().length - $index }}</span>
                                            <span class="lap-val">{{ formatStopwatch(lap) }}</span>
                                        </div>
                                    }
                                </div>
                            </div>
                        }

                    </div>
                </div>
          </div>
      }

      <!-- BREEZE ALERT OVERLAY -->
      @if (isAlerting()) {
        <div class="alert-overlay" (click)="stopAlert()">
            <div class="alert-card">
                <i class="bi bi-wind"></i>
                <h2>Breeze Alert</h2>
                <p>Time to take a breath.</p>
                <button class="dismiss-btn">Dismiss</button>
            </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .clock-hub { user-select: none; }

    /* SIDEBAR CLOCK */
    .clock-display {
        text-align: center;
        .time-main { font-size: 2.2rem; font-weight: 700; color: var(--text-main); letter-spacing: -1px; .seconds { font-size: 1rem; color: var(--text-muted); margin-left: 6px; } .period { font-size: 0.8rem; margin-left: 6px; color: var(--accent); font-weight: 800; } }
        .date-sub { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: -2px; }
    }

    /* WIDGET MODAL WRAPPER (480px NATIVE PATTERN) */
    .widget-modal-wrapper {
        width: 480px; max-width: 95vw; background: var(--surface-main); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        max-height: 85vh;
    }

    .widget-modal-header {
        display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); background: var(--surface-alt);
        .header-left { display: flex; align-items: center; gap: 12px; .header-icon { font-size: 1.25rem; color: var(--accent); opacity: 0.8; } h2 { font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0; } }
        .close-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--bg-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: var(--bg-hover); color: var(--text-main); } }
    }

    .hub-tabs-container { padding: 16px 24px; background: var(--surface-alt); border-bottom: 1px solid var(--border); }
    .hub-tabs {
        display: flex; gap: 8px; background: var(--bg-alt); padding: 5px; border-radius: 12px; border: 1px solid var(--border);
        button {
            flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-size: 1rem;
            &:hover { color: var(--text-main); }
            &.active { background: var(--bg-active); color: var(--accent); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        }
    }

    .widget-modal-body { flex: 1; overflow-y: auto; padding: 32px 24px; }
    .hub-content { display: flex; align-items: center; justify-content: center; width: 100%; }

    /* MODES */
    .clock-display.modal-mode { .time-main { font-size: 5.5rem; margin-bottom: 10px; } .date-sub { font-size: 1.3rem; } }

    .alarm-manager {
        width: 100%; display: flex; flex-direction: column; gap: 24px;
        .alarm-header-sub { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; h3 { font-size: 1rem; font-weight: 800; color: var(--text-main); } .alarm-count { font-size: 0.75rem; font-weight: 700; color: var(--accent); } }
        .alarm-list { display: flex; flex-direction: column; gap: 12px; }
        .alarm-item {
            display: flex; justify-content: space-between; padding: 16px; background: var(--surface-alt); border-radius: 16px; border: 1px solid var(--border); transition: all 0.2s;
            &.enabled { border-color: var(--accent); background: var(--bg-active); opacity: 1; }
            &:not(.enabled) { opacity: 0.6; }
            .alarm-info { display: flex; flex-direction: column; align-items: flex-start; .alarm-time { font-size: 1.5rem; font-weight: 800; color: var(--text-main); line-height: 1; } .alarm-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 4px; } }
            .alarm-actions { display: flex; align-items: center; gap: 16px; }
        }
        .add-alarm-form {
            display: flex; flex-direction: column; gap: 12px; padding-top: 24px; border-top: 1px solid var(--border);
            .input-group { display: flex; gap: 10px; input { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 12px; color: var(--text-main); font-weight: 600; font-size: 1rem; &:focus { border-color: var(--accent); outline: none; } } .time-input { width: 120px; } .label-input { flex: 1; } }
            .add-btn { background: var(--accent); color: white; border: none; border-radius: 12px; padding: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(var(--accent-rgb, 59, 130, 246), 0.3); } }
        }
    }

    .timer-display {
        display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%;
        .timer-visual {
            width: 200px; height: 200px; position: relative;
            svg { width: 100%; height: 100%; transform: rotate(-90deg); circle { fill: none; stroke-width: 4; &.bg { stroke: var(--border); } &.progress { stroke: var(--accent); stroke-linecap: round; stroke-dasharray: calc(45 * 2 * 3.14159); transition: stroke-dashoffset 0.1s linear; } } }
            .timer-digits { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3rem; font-weight: 900; color: var(--text-main); font-variant-numeric: tabular-nums; }
        }
        .timer-controls { display: flex; flex-direction: column; gap: 16px; width: 100%; }
        .timer-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; button { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; &.pomo { color: var(--accent); border-color: var(--accent); } &:hover { border-color: var(--accent); } } }
    }

    .stopwatch-display {
        display: flex; flex-direction: column; align-items: center; width: 100%; gap: 32px;
        .sw-time { font-size: 4.5rem; font-weight: 900; color: var(--text-main); font-variant-numeric: tabular-nums; letter-spacing: -1.5px; }
        .sw-controls { width: 100%; display: flex; gap: 12px; }
        .lap-history { width: 100%; display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 6px; }
        .lap-item { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--surface-alt); border-radius: 12px; font-size: 0.95rem; font-weight: 700; .lap-num { color: var(--accent); } }
    }

    .main-btn {
        flex: 1; padding: 14px; border-radius: 14px; border: none; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s;
        &.start { background: var(--accent); color: white; }
        &.stop { background: #ff4d4d; color: white; }
        &.reset { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
        &.lap { background: var(--bg-alt); color: var(--accent); border: 1px solid var(--border); }
        &:hover:not(.reset):not(.lap) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    }

    .alert-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center;
        .alert-card {
            background: var(--surface-main); padding: 48px; border-radius: 40px; border: 1px solid var(--accent); box-shadow: 0 30px 60px rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; gap: 20px;
            i { font-size: 4rem; color: var(--accent); animation: float 3s ease-in-out infinite; }
            h2 { font-size: 1.8rem; font-weight: 900; }
            p { font-size: 1.1rem; color: var(--text-muted); }
            .dismiss-btn { margin-top: 16px; background: var(--accent); color: white; padding: 14px 40px; border-radius: 16px; border: none; font-weight: 900; cursor: pointer; font-size: 1.1rem; transition: transform 0.2s; &:active { transform: scale(0.95); } }
        }
    }

    .toggle-switch { width: 44px; height: 24px; background: var(--border); border-radius: 20px; position: relative; cursor: pointer; transition: all 0.3s; .switch-handle { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: all 0.3s; } &.enabled { background: var(--accent); .switch-handle { transform: translateX(20px); } } }

    @keyframes slideUp { from { opacity: 0; transform: translateY(15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }

    @media (max-width: 600px) {
        .widget-modal-wrapper { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; }
        .clock-display.modal-mode { .time-main { font-size: 4rem; } }
    }
  `]
})
export class SharedClockWidget implements OnInit, OnDestroy {
  @Input() isModal = false;
  
  activeTab = signal<'clock' | 'alarm' | 'timer' | 'stopwatch'>('clock');
  currentTime = signal(new Date());
  showSeconds = signal(true);
  isAlerting = signal(false);
  
  // Timer State
  timerValue = signal(0);
  totalTimerTime = 0;
  timerRunning = signal(false);
  private timerInterval: any;

  // Stopwatch State
  swTime = signal(0);
  swRunning = signal(false);
  laps = signal<number[]>([]);
  private swInterval: any;
  private lastSwMark = 0;

  // Alarm State
  alarms = signal<WidgetAlarm[]>([]);
  newAlarmTime = '';
  newAlarmLabel = '';

  private db = inject(DexieService);
  private modalService = inject(ModalService);
  private clockInterval: any;
  private audioContext: AudioContext | null = null;

  async ngOnInit() {
    this.clockInterval = setInterval(() => {
        this.currentTime.set(new Date());
        this.checkAlarms();
    }, 1000);

    await this.loadAlarms();
  }

  ngOnDestroy() {
    this.stopAll();
  }

  private stopAll() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.swInterval) clearInterval(this.swInterval);
    this.stopAlert();
  }

  private triggerAlert() {
    this.isAlerting.set(true);
    this.startBreezeSound();
    if ('vibrate' in navigator) navigator.vibrate([100, 30, 100, 30, 100]);
  }

  stopAlert() {
    this.isAlerting.set(false);
    this.stopBreezeSound();
    if ('vibrate' in navigator) navigator.vibrate(0);
  }

  private startBreezeSound() {
    try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const masterGain = this.audioContext.createGain();
        masterGain.connect(this.audioContext.destination);
        masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 1);

        const playTone = (freq: number, delay: number) => {
            if (!this.audioContext) return;
            const osc = this.audioContext.createOscillator();
            const g = this.audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            osc.connect(g);
            g.connect(masterGain);
            g.gain.setValueAtTime(0, this.audioContext.currentTime + delay);
            g.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + delay + 0.5);
            g.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + delay + 3);
            osc.start(this.audioContext.currentTime + delay);
            osc.stop(this.audioContext.currentTime + delay + 4);
        };

        playTone(440, 0);   
        playTone(554.37, 0.5); 
        playTone(659.25, 1.0); 
        playTone(880, 1.5);   
    } catch(e) {}
  }

  private stopBreezeSound() {
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
  }

  private async loadAlarms() {
    const list = await this.db.widget_alarms.toArray();
    this.alarms.set(list.sort((a,b) => a.time.localeCompare(b.time)));
  }

  async addAlarm() {
    if (!this.newAlarmTime) return;
    const alarm: WidgetAlarm = {
        id: crypto.randomUUID(),
        time: this.newAlarmTime,
        enabled: true,
        label: this.newAlarmLabel,
        createdAt: Date.now()
    };
    await this.db.widget_alarms.put(alarm);
    await this.loadAlarms();
    this.newAlarmTime = '';
    this.newAlarmLabel = '';
  }

  async toggleAlarm(alarm: WidgetAlarm) {
    alarm.enabled = !alarm.enabled;
    await this.db.widget_alarms.put(alarm);
    await this.loadAlarms();
  }

  async deleteAlarm(alarm: WidgetAlarm) {
    await this.db.widget_alarms.delete(alarm.id);
    await this.loadAlarms();
  }

  private checkAlarms() {
    const now = new Date();
    const currentStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (now.getSeconds() === 0) {
        const active = this.alarms().find(a => a.enabled && a.time === currentStr);
        if (active) this.triggerAlert();
    }
  }

  setTimer(seconds: number) {
    this.timerValue.set(seconds);
    this.totalTimerTime = seconds;
  }

  startTimer() {
    if (this.timerValue() <= 0) return;
    if (this.totalTimerTime === 0) this.totalTimerTime = this.timerValue();
    this.timerRunning.set(true);
    this.timerInterval = setInterval(() => {
        this.timerValue.update(v => v - 1);
        if (this.timerValue() <= 0) {
            this.stopTimer();
            this.triggerAlert();
        }
    }, 1000);
  }

  stopTimer() {
    this.timerRunning.set(false);
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  resetTimer() {
    this.stopTimer();
    this.timerValue.set(0);
    this.totalTimerTime = 0;
  }

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  timerProgress(): number {
    if (this.totalTimerTime === 0) return 0;
    return (this.totalTimerTime - this.timerValue()) / this.totalTimerTime;
  }

  startSW() {
    this.swRunning.set(true);
    this.lastSwMark = performance.now();
    this.swInterval = setInterval(() => {
        const now = performance.now();
        this.swTime.update(v => v + (now - this.lastSwMark));
        this.lastSwMark = now;
    }, 10);
  }

  stopSW() {
    this.swRunning.set(false);
    if (this.swInterval) clearInterval(this.swInterval);
  }

  resetSW() {
    this.stopSW();
    this.swTime.set(0);
    this.laps.set([]);
  }

  lapSW() {
    this.laps.update(l => [this.swTime(), ...l]);
  }

  formatStopwatch(ms: number): string {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mm = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${mm.toString().padStart(2, '0')}`;
  }

  closeModal() {
    this.modalService.cancelResult(true);
  }
}
