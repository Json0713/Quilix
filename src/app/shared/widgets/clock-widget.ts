import { Component, OnInit, OnDestroy, signal, Input, inject, HostListener } from '@angular/core';
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
      
      <!-- SIDEBAR VIEW (Vertical) -->
      @if (!isModal) {
          <div class="clock-display sidebar-mode">
            <div class="time-main">
              {{ currentTime() | date:'h:mm' }}<span class="seconds" *ngIf="showSeconds()">{{ currentTime() | date:'ss' }}</span><span class="period">{{ currentTime() | date:'a' }}</span>
            </div>
            <div class="date-sub">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
          </div>
      }

      <!-- MODAL VIEW (Native Pattern) -->
      @if (isModal) {
          <div class="widget-modal-wrapper" [class.is-mobile]="isMobile()">
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

                <div class="widget-modal-body thin-scroll">
                    <div class="hub-content" [class.centered]="activeTab() === 'clock'">
                        
                        <!-- MODE: CLOCK (CENTER-CENTER) -->
                        @if (activeTab() === 'clock') {
                            <div class="clock-display modal-mode" (click)="toggleClockType()">
                                @if (!isAnalog()) {
                                    <!-- DIGITAL VIEW -->
                                    <div class="digital-face animate-fade">
                                        <div class="time-main">
                                            {{ currentTime() | date:'h:mm' }}<span class="seconds-group" *ngIf="showSeconds()">:<span class="seconds">{{ currentTime() | date:'ss' }}</span></span><span class="period">{{ currentTime() | date:'a' }}</span>
                                        </div>
                                        <div class="date-sub">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
                                        <div class="toggle-hint">Tap for Analog</div>
                                    </div>
                                } @else {
                                    <!-- ANALOG VIEW -->
                                    <div class="analog-face animate-fade">
                                        <div class="clock-circle">
                                            <div class="ticks">
                                                @for (tick of [0,30,60,90,120,150,180,210,240,270,300,330]; track tick) {
                                                    <div class="tick" [style.transform]="'rotate(' + tick + 'deg) translateY(-85px)'"></div>
                                                }
                                            </div>
                                            <div class="hand hour" [style.transform]="'rotate(' + getRotation('h') + 'deg)'"></div>
                                            <div class="hand minute" [style.transform]="'rotate(' + getRotation('m') + 'deg)'"></div>
                                            <div class="hand second" [style.transform]="'rotate(' + getRotation('s') + 'deg)'"></div>
                                            <div class="center-dot"></div>
                                        </div>
                                        <div class="date-sub">{{ currentTime() | date:'EEEE, MMMM d' }}</div>
                                        <div class="toggle-hint">Tap for Digital</div>
                                    </div>
                                }
                            </div>
                        }

                        <!-- MODE: ALARM -->
                        @if (activeTab() === 'alarm') {
                            <div class="alarm-manager">
                                <div class="alarm-header-sub">
                                    <h3>Active Alarms</h3>
                                    <span class="alarm-count">{{ alarms().length }} Set</span>
                                </div>
                                
                                <div class="alarm-list thin-scroll">
                                    @for (alarm of alarms(); track alarm.id) {
                                        <div class="alarm-item" [class.enabled]="alarm.enabled">
                                            <div class="alarm-info">
                                                <span class="alarm-time">{{ alarm.time }}</span>
                                                <span class="alarm-label">{{ alarm.label || 'Daily Alarm' }}</span>
                                            </div>
                                            <div class="alarm-actions">
                                                <div class="toggle-switch" [class.enabled]="alarm.enabled" (click)="toggleAlarm(alarm)">
                                                    <div class="switch-handle"></div>
                                                </div>
                                                <button class="delete-btn" (click)="deleteAlarm(alarm)"><i class="bi bi-trash3"></i></button>
                                            </div>
                                        </div>
                                    } @empty {
                                        <div class="empty-state">No alarms scheduled.</div>
                                    }
                                </div>

                                <div class="add-alarm-form">
                                    <div class="input-group">
                                        <div class="field">
                                            <label>Time</label>
                                            <input type="time" [(ngModel)]="newAlarmTime" class="time-input">
                                        </div>
                                        <div class="field expand">
                                            <label>Label</label>
                                            <input type="text" [(ngModel)]="newAlarmLabel" placeholder="Alarm Label..." class="label-input">
                                        </div>
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
                                        <div class="timer-presets thin-scroll">
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
                                
                                <div class="lap-history thin-scroll">
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

    /* THIN SCROLLBAR */
    .thin-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
    .thin-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .thin-scroll::-webkit-scrollbar-track { background: transparent; }
    .thin-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; border: 1px solid transparent; background-clip: padding-box; }
    .thin-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--text-muted); }

    /* SIDEBAR MODE */
    .clock-display.sidebar-mode {
        text-align: center;
        .time-main { font-size: 2.2rem; font-weight: 700; color: var(--text-main); letter-spacing: -1px; .seconds { font-size: 1rem; color: var(--text-muted); margin-left: 2px; } .period { font-size: 0.8rem; margin-left: 6px; color: var(--accent); font-weight: 800; } }
        .date-sub { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: -2px; }
    }

    /* MODAL-VIEW SCOPED */
    .clock-hub.modal-view {
        .widget-modal-wrapper {
            width: 480px; max-width: 95vw; background: var(--surface-main); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            height: 580px; max-height: 85vh;
        }

        .widget-modal-header {
            display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface-alt);
            .header-left { display: flex; align-items: center; gap: 10px; .header-icon { font-size: 1.1rem; color: var(--accent); opacity: 0.8; } h2 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0; } }
            .close-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--bg-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: var(--bg-hover); color: var(--text-main); } }
        }

        .widget-modal-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px; display: flex; flex-direction: column; }
        .hub-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 100%; min-height: fit-content; &.centered { justify-content: center; } }
    }

    .hub-tabs-container { padding: 12px 20px; background: var(--surface-alt); border-bottom: 1px solid var(--border); }
    .hub-tabs {
        display: flex; gap: 8px; background: var(--bg-alt); padding: 5px; border-radius: 12px; border: 1px solid var(--border);
        button {
            flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 9px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-size: 1.1rem;
            &:hover { color: var(--text-main); }
            &.active { background: var(--bg-active); color: var(--accent); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        }
    }

    /* MODAL CLOCK DISPLAY - CENTER CENTER */
    .clock-display.modal-mode { 
        width: 100%; text-align: center; cursor: pointer; padding: 20px 0;
        .digital-face { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .time-main { font-size: 4.5rem; font-weight: 950; letter-spacing: -2px; font-variant-numeric: tabular-nums; line-height: 1; color: var(--text-main); .seconds-group { color: var(--text-muted); opacity: 0.6; } .period { font-size: 1.5rem; margin-left: 10px; color: var(--accent); } }
        .date-sub { font-size: 1.25rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
        .toggle-hint { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; opacity: 0.3; transition: all 0.2s; }
        &:hover .toggle-hint { opacity: 0.8; color: var(--accent); }
    }

    /* ANALOG CLOCK FACE */
    .analog-face { display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .clock-circle {
        width: 200px; height: 200px; border-radius: 50%; border: 6px solid var(--border); position: relative; background: var(--surface-alt); box-shadow: inset 0 10px 20px rgba(0,0,0,0.1);
        .ticks { position: absolute; inset: 0; .tick { position: absolute; top: 50%; left: 50%; width: 2px; height: 8px; background: var(--border); } }
        .hand { position: absolute; bottom: 50%; left: 50%; transform-origin: bottom center; border-radius: 10px; background: var(--text-main); transition: transform 0.1s cubic-bezier(0.4, 2.08, 0.55, 0.44); }
        .hand.hour { width: 5px; height: 55px; background: var(--text-main); z-index: 2; }
        .hand.minute { width: 4px; height: 80px; background: var(--text-muted); z-index: 1; opacity: 0.8; }
        .hand.second { width: 2px; height: 85px; background: var(--accent); z-index: 3; transition: transform 0.2s cubic-bezier(0.1, 2.7, 0.58, 1); }
        .center-dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: var(--accent); border-radius: 50%; z-index: 4; border: 2px solid white; }
    }

    .animate-fade { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

    /* LOADER/STATES */
    .empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; background: var(--surface-alt); border-radius: 14px; border: 1px dashed var(--border); width: 100%; box-sizing: border-box; }

    /* MODES */
    .alarm-manager { width: 100%; display: flex; flex-direction: column; gap: 20px; flex: 1; .alarm-header-sub { display: flex; justify-content: space-between; align-items: center; h3 { font-size: 0.85rem; font-weight: 800; color: var(--text-main); } .alarm-count { font-size: 0.7rem; font-weight: 700; color: var(--accent); } } .alarm-list { display: flex; flex-direction: column; gap: 10px; max-height: 220px; width: 100%; padding-right: 12px; box-sizing: border-box; } .alarm-item { display: flex; justify-content: space-between; padding: 14px; background: var(--surface-alt); border-radius: 14px; border: 1px solid var(--border); transition: all 0.2s; &:hover { border-color: var(--accent); } &.enabled { border-color: var(--accent); background: var(--bg-active); } .alarm-info { display: flex; flex-direction: column; .alarm-time { font-size: 1.6rem; font-weight: 800; color: var(--text-main); line-height: 1; font-variant-numeric: tabular-nums; } .alarm-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-top: 4px; } } .alarm-actions { display: flex; align-items: center; gap: 14px; } .delete-btn { color: var(--text-muted); background: none; border: none; cursor: pointer; &:hover { color: #ff4d4d; } } } .add-alarm-form { display: flex; flex-direction: column; gap: 12px; padding-top: 20px; border-top: 1px solid var(--border); margin-top: auto; .input-group { display: flex; gap: 10px; .field { display: flex; flex-direction: column; gap: 6px; &.expand { flex: 1; } } label { font-size: 0.65rem; font-weight: 800; color: var(--accent); text-transform: uppercase; } input { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: var(--text-main); font-weight: 700; font-size: 0.9rem; &:focus { border-color: var(--accent); outline: none; } } .time-input { width: 110px; } } .add-btn { background: var(--accent); color: white; border: none; border-radius: 10px; padding: 12px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; &:disabled { opacity: 0.5; cursor: not-allowed; } &:hover:not(:disabled) { filter: brightness(1.1); } } } }
    .timer-display { display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%; padding: 20px 0; .timer-visual { width: 200px; height: 200px; position: relative; svg { width: 100%; height: 100%; transform: rotate(-90deg); circle { fill: none; stroke-width: 4; &.bg { stroke: var(--border); } &.progress { stroke: var(--accent); stroke-linecap: round; stroke-dasharray: calc(45 * 2 * 3.14159); transition: stroke-dashoffset 0.5s ease-out; } } } .timer-digits { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3.5rem; font-weight: 900; color: var(--text-main); font-variant-numeric: tabular-nums; } } .timer-controls { display: flex; flex-direction: column; gap: 16px; width: 100%; } .timer-presets { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; width: 100%; justify-content: center; button { flex-shrink: 0; padding: 8px 16px; border-radius: 10px; background: var(--surface-alt); border: 1px solid var(--border); font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; &.pomo { border-color: var(--accent); color: var(--accent); } &:hover { border-color: var(--accent); color: var(--accent); } } } }
    .stopwatch-display { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 32px; padding: 20px 0; .sw-time { font-size: 5rem; font-weight: 900; color: var(--text-main); font-variant-numeric: tabular-nums; letter-spacing: -2px; } .sw-controls { width: 100%; display: flex; gap: 12px; } .lap-history { width: 100%; display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 12px; box-sizing: border-box; } .lap-item { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--surface-alt); border-radius: 12px; font-size: 0.95rem; font-weight: 700; border: 1px solid var(--border); transition: all 0.2s; &:hover { border-color: var(--accent); } .lap-num { color: var(--accent); font-size: 0.75rem; text-transform: uppercase; } .lap-val { font-variant-numeric: tabular-nums; } } }
    .main-btn { flex: 1; padding: 14px; border-radius: 12px; border: none; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; &.start { background: var(--accent); color: white; } &.stop { background: #ff4d4d; color: white; } &.reset { background: transparent; color: var(--text-muted); border: 1px solid var(--border); } &.lap { background: var(--bg-alt); color: var(--accent); border: 1px solid var(--border); } &:hover:not(.reset) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); } }
    .toggle-switch { width: 44px; height: 24px; background: var(--border); border-radius: 20px; position: relative; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); .switch-handle { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); } &.enabled { background: var(--accent); .switch-handle { transform: translateX(20px); } } }

    /* SHARED OVERLAYS */
    .alert-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; .alert-card { background: var(--surface-main); padding: 40px; border-radius: 32px; border: 1px solid var(--accent); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); i { font-size: 4rem; color: var(--accent); animation: float 3s ease-in-out infinite; } h2 { font-size: 1.8rem; font-weight: 900; color: var(--text-main); } p { color: var(--text-muted); font-weight: 600; } .dismiss-btn { margin-top: 15px; background: var(--accent); color: white; padding: 14px 40px; border-radius: 16px; border: none; font-weight: 900; cursor: pointer; transition: all 0.2s; &:hover { transform: scale(1.05); } } } }

    @keyframes slideUp { from { opacity: 0; transform: translateY(15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    @media (max-width: 600px) {
        .clock-hub.modal-view {
            .widget-modal-wrapper { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; padding-bottom: env(safe-area-inset-bottom); }
            .clock-display.modal-mode { 
                .time-main { font-size: 3.5rem; letter-spacing: -1px; } 
                .date-sub { font-size: 1rem; } 
                .clock-circle { width: 180px; height: 180px; }
            }
            .hub-tabs button { height: 55px; font-size: 1.4rem; }
            .widget-modal-body { padding: 16px; }
        }
    }
  `]
})
export class SharedClockWidget implements OnInit, OnDestroy {
  @Input() isModal = false;
  
  activeTab = signal<'clock' | 'alarm' | 'timer' | 'stopwatch'>('clock');
  currentTime = signal(new Date());
  showSeconds = signal(true);
  isAlerting = signal(false);
  isMobile = signal(window.innerWidth < 600);
  isAnalog = signal(false);
  
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

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < 600);
  }

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

  toggleClockType() {
    this.isAnalog.set(!this.isAnalog());
  }

  getRotation(unit: 'h' | 'm' | 's'): number {
    const now = this.currentTime();
    switch (unit) {
      case 'h': return (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
      case 'm': return now.getMinutes() * 6;
      case 's': return now.getSeconds() * 6;
    }
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
