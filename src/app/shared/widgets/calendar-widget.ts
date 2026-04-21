import { Component, OnInit, signal, Input, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DexieService, WidgetNote } from '../../core/database/dexie.service';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../services/ui/common/modal/modal';

@Component({
  selector: 'app-shared-calendar-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calendar-container" [class.modal-view]="isModal">
        
        <!-- SIDEBAR VIEW (Vertical) -->
        @if (!isModal) {
            <div class="calendar-nav">
                <button class="nav-btn" (click)="prevMonth($event)"><i class="bi bi-chevron-left"></i></button>
                <span class="month-title">{{ displayDate() | date:'MMMM yyyy' }}</span>
                <button class="nav-btn" (click)="nextMonth($event)"><i class="bi bi-chevron-right"></i></button>
            </div>

            <div class="calendar-grid">
                @for (name of ['S','M','T','W','T','F','S']; track $index) { <span class="day-name">{{name}}</span> }
                @for (day of calendarDays(); track $index) {
                    <span class="day-cell" [class.empty]="day === 0" [class.today]="isToday(day)" [class.selected]="selectedDay() === day" (click)="selectDay(day, $event)">
                        {{ day !== 0 ? day : '' }}
                        @if (day !== 0 && hasNote(day)) { <span class="note-dot" [class]="getNotePriority(day)"></span> }
                    </span>
                }
            </div>
        }

        <!-- MODAL VIEW (Native Pattern) -->
        @if (isModal) {
            <div class="widget-modal-wrapper" [class.is-mobile]="isMobile()">
                <div class="widget-modal-header">
                    <div class="header-left">
                        <i class="bi bi-calendar3 header-icon"></i>
                        <h2>Calendar Hub</h2>
                    </div>
                    <button class="close-btn" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
                </div>

                <!-- MOBILE SEGMENTED CONTROL -->
                @if (isMobile()) {
                    <div class="mobile-tabs">
                        <button (click)="viewMode.set('grid')" [class.active]="viewMode() === 'grid'"><i class="bi bi-grid-3x3"></i> Calendar</button>
                        <button (click)="viewMode.set('history')" [class.active]="viewMode() === 'history'"><i class="bi bi-clock-history"></i> History</button>
                        <button (click)="viewMode.set('editor')" [class.active]="viewMode() === 'editor'"><i class="bi bi-pencil-square"></i> Note</button>
                    </div>
                }

                <div class="widget-modal-body">
                    
                    <!-- DESKTOP SPLIT LAYOUT -->
                    @if (!isMobile()) {
                        <div class="modal-split-layout">
                            <div class="layout-side left thin-scroll">
                                <div class="side-nav-header">
                                    <div class="calendar-nav">
                                        <button class="nav-btn" (click)="prevMonth($event)"><i class="bi bi-chevron-left"></i></button>
                                        <span class="month-title-modal">{{ displayDate() | date:'MMMM yyyy' }}</span>
                                        <button class="nav-btn" (click)="nextMonth($event)"><i class="bi bi-chevron-right"></i></button>
                                    </div>
                                    <button class="history-toggle" (click)="historyVisible.set(!historyVisible())" [class.active]="historyVisible()">
                                        <i class="bi" [class.bi-journal-text]="!historyVisible()" [class.bi-calendar3]="historyVisible()"></i>
                                        {{ historyVisible() ? 'Calendar' : 'History' }}
                                    </button>
                                </div>

                                @if (!historyVisible()) {
                                    <div class="calendar-grid modal-grid">
                                        @for (name of ['SUN','MON','TUE','WED','THU','FRI','SAT']; track $index) { <span class="day-name">{{name}}</span> }
                                        @for (day of calendarDays(); track $index) {
                                            <span class="day-cell" [class.empty]="day === 0" [class.today]="isToday(day)" [class.selected]="selectedDay() === day" (click)="selectDay(day, $event)">
                                                {{ day !== 0 ? day : '' }}
                                                @if (day !== 0 && hasNote(day)) { <span class="note-dot" [class]="getNotePriority(day)"></span> }
                                            </span>
                                        }
                                    </div>
                                } @else {
                                    <div class="notes-history-list thin-scroll">
                                        @if (notes().length === 0) { <div class="empty-state">No notes found.</div> }
                                        @for (note of sortedNotes; track note.id) {
                                            <div class="history-item" (click)="selectHistoryNote(note)">
                                                <div class="item-header">
                                                    <span class="item-date">{{ note.date | date:'mediumDate' }}</span>
                                                    <span class="note-dot small" [class]="note.priority"></span>
                                                </div>
                                                <div class="item-title">{{ note.title || 'Untitled Note' }}</div>
                                            </div>
                                        }
                                    </div>
                                }
                            </div>

                            <div class="layout-side right thin-scroll">
                                <div class="editor-header">
                                    <span class="selected-date">{{ getSelectedDateString() | date:'fullDate' }}</span>
                                    @if (activeNote()) {
                                        <button class="delete-btn" title="Delete" (click)="deleteSelectedNote()"><i class="bi bi-trash3"></i></button>
                                    }
                                </div>

                                <div class="note-editor">
                                    <div class="field-group">
                                        <label>Title</label>
                                        <input type="text" [(ngModel)]="noteTitle" placeholder="Title..." class="title-input">
                                    </div>
                                    <div class="field-group expand">
                                        <label>Content</label>
                                        <textarea [(ngModel)]="noteContent" placeholder="Write here..." rows="8"></textarea>
                                    </div>
                                    <div class="editor-footer">
                                        <div class="priority-selector">
                                            <span (click)="notePriority = 'low'" [class.active]="notePriority === 'low'" class="low"></span>
                                            <span (click)="notePriority = 'medium'" [class.active]="notePriority === 'medium'" class="medium"></span>
                                            <span (click)="notePriority = 'high'" [class.active]="notePriority === 'high'" class="high"></span>
                                        </div>
                                        <div class="reminder-zone">
                                            <div class="toggle-switch-mini" [class.enabled]="noteReminderEnabled()" (click)="noteReminderEnabled.set(!noteReminderEnabled())">
                                                <div class="switch-handle"></div>
                                            </div>
                                            <span class="label">Remind Me</span>
                                            @if (noteReminderEnabled()) {
                                                <input type="time" [(ngModel)]="noteReminderTime" class="reminder-input animate-fade">
                                            }
                                        </div>
                                        <button class="save-btn" (click)="saveSelectedNote()" [disabled]="!noteContent && !noteTitle">
                                            <i class="bi bi-check-lg"></i> Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }

                    <!-- MOBILE NATIVE LAYOUT -->
                    @if (isMobile()) {
                        <div class="mobile-viewport thin-scroll">
                            @switch (viewMode()) {
                                @case ('grid') {
                                    <div class="mobile-section">
                                        <div class="side-nav-header">
                                            <div class="calendar-nav">
                                                <button class="nav-btn" (click)="prevMonth($event)"><i class="bi bi-chevron-left"></i></button>
                                                <span class="month-title-modal">{{ displayDate() | date:'MMMM yyyy' }}</span>
                                                <button class="nav-btn" (click)="nextMonth($event)"><i class="bi bi-chevron-right"></i></button>
                                            </div>
                                        </div>
                                        <div class="calendar-grid modal-grid">
                                            @for (name of ['S','M','T','W','T','F','S']; track $index) { <span class="day-name">{{name}}</span> }
                                            @for (day of calendarDays(); track $index) {
                                                <span class="day-cell" [class.empty]="day === 0" [class.today]="isToday(day)" [class.selected]="selectedDay() === day" (click)="selectDay(day, $event)">
                                                    {{ day !== 0 ? day : '' }}
                                                    @if (day !== 0 && hasNote(day)) { <span class="note-dot" [class]="getNotePriority(day)"></span> }
                                                </span>
                                            }
                                        </div>
                                        <div class="mobile-selection-hint">
                                            Tapped: <strong>{{ getSelectedDateString() | date:'mediumDate' }}</strong>
                                        </div>
                                    </div>
                                }
                                @case ('history') {
                                    <div class="mobile-section">
                                        <h3>Note History</h3>
                                        <div class="notes-history-list thin-scroll">
                                            @if (notes().length === 0) { <div class="empty-state">No notes found.</div> }
                                            @for (note of sortedNotes; track note.id) {
                                                <div class="history-item" (click)="selectHistoryNote(note)">
                                                    <div class="item-header">
                                                        <span class="item-date">{{ note.date | date:'mediumDate' }}</span>
                                                        <span class="note-dot small" [class]="note.priority"></span>
                                                    </div>
                                                    <div class="item-title">{{ note.title || 'Untitled Note' }}</div>
                                                </div>
                                            }
                                        </div>
                                    </div>
                                }
                                @case ('editor') {
                                    <div class="mobile-section">
                                        <div class="editor-header">
                                            <span class="selected-date">{{ getSelectedDateString() | date:'mediumDate' }}</span>
                                            @if (activeNote()) {
                                                <button class="delete-btn" (click)="deleteSelectedNote()"><i class="bi bi-trash3"></i></button>
                                            }
                                        </div>
                                        <div class="note-editor">
                                            <input type="text" [(ngModel)]="noteTitle" placeholder="Title..." class="title-input">
                                            <textarea [(ngModel)]="noteContent" placeholder="Note content..." rows="12" class="thin-scroll"></textarea>
                                            
                                            <div class="mobile-editor-controls">
                                                <div class="priority-selector">
                                                    <span (click)="notePriority = 'low'" [class.active]="notePriority === 'low'" class="low"></span>
                                                    <span (click)="notePriority = 'medium'" [class.active]="notePriority === 'medium'" class="medium"></span>
                                                    <span (click)="notePriority = 'high'" [class.active]="notePriority === 'high'" class="high"></span>
                                                </div>
                                                <div class="reminder-zone-mobile">
                                                    <div class="toggle-switch-mini" [class.enabled]="noteReminderEnabled()" (click)="noteReminderEnabled.set(!noteReminderEnabled())">
                                                        <div class="switch-handle"></div>
                                                    </div>
                                                    @if (noteReminderEnabled()) {
                                                        <input type="time" [(ngModel)]="noteReminderTime" class="reminder-input-mobile">
                                                    }
                                                </div>
                                                <button class="save-btn-mobile" (click)="saveSelectedNote()" [disabled]="!noteContent && !noteTitle">
                                                    <i class="bi bi-check-lg"></i> Save Note
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                }
                            }
                        </div>
                    }

                </div>
            </div>
        }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .calendar-container { user-select: none; }

    /* THIN SCROLLBAR (Optimized) */
    .thin-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
    .thin-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .thin-scroll::-webkit-scrollbar-track { background: transparent; }
    .thin-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; border: 1px solid transparent; background-clip: padding-box; }
    .thin-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--text-muted); }

    /* DEFAULT SIDEBAR STYLES (RESTORED) */
    .calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .month-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-main); }
    .nav-btn { width: 28px; height: 28px; border-radius: 8px; border: none; background: var(--surface-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { color: var(--accent); background: var(--bg-hover); } }
    
    .calendar-grid {
        display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center;
        .day-name { font-size: 0.6rem; font-weight: 800; color: var(--accent); opacity: 0.6; margin-bottom: 4px; }
        .day-cell {
            position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.72rem; font-weight: 600; color: var(--text-alt); cursor: pointer; transition: all 0.2s;
            &.today { background: var(--accent); color: white; }
            &.selected:not(.today) { box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
            &.empty { pointer-events: none; opacity: 0; }
            .note-dot { position: absolute; bottom: 3px; width: 3px; height: 3px; border-radius: 50%; &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } }
        }
    }

    /* MODAL-VIEW SCOPED OVERRIDES (SAFE ISOLATION) */
    .calendar-container.modal-view {
        .widget-modal-wrapper {
            width: 750px; max-width: 95vw; background: var(--surface-main); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            height: 600px; max-height: 85vh;
        }

        .widget-modal-header {
            display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface-alt);
            .header-left { display: flex; align-items: center; gap: 10px; .header-icon { font-size: 1.1rem; color: var(--accent); opacity: 0.8; } h2 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0; } }
            .close-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--bg-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: var(--bg-hover); color: var(--text-main); } }
        }

        .widget-modal-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        .modal-split-layout { display: flex; height: 100%; .layout-side { flex: 1; display: flex; flex-direction: column; padding: 20px; overflow: hidden; position: relative; } .layout-side.left { border-right: 1px solid var(--border); overflow-x: hidden; } .layout-side.right { background: var(--surface-alt); } }

        .modal-grid { gap: 6px; .day-name { font-size: 0.65rem; margin-bottom: 8px; } .day-cell { font-size: 0.95rem; border-radius: 10px; } }
        .month-title-modal { font-size: 0.95rem; font-weight: 800; color: var(--text-main); }

        .notes-history-list { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box; padding-right: 12px;
            .history-item { padding: 12px; border-radius: 12px; background: var(--surface-main); border: 1px solid var(--border); cursor: pointer; transition: all 0.2s; width: 100%; box-sizing: border-box;
                &:hover { border-color: var(--accent); } 
                .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; .item-date { font-size: 0.75rem; color: var(--text-muted); font-weight: 700; } } 
                .item-title { font-size: 0.9rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
            } 
        }
    }

    /* ASSET STYLES */
    .side-nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .history-toggle { padding: 6px 12px; border-radius: 8px; background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-alt); font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; &:hover { border-color: var(--accent); color: var(--accent); } &.active { background: var(--accent); color: white; border-color: var(--accent); } }

    .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; .selected-date { font-size: 0.85rem; font-weight: 800; color: var(--text-muted); } .delete-btn { color: var(--text-muted); background: none; border: none; cursor: pointer; &:hover { color: #ff4d4d; } } }
    .note-editor { display: flex; flex-direction: column; gap: 16px; height: 100%; .field-group { display: flex; flex-direction: column; gap: 6px; &.expand { flex: 1; min-height: 0; } } label { font-size: 0.65rem; font-weight: 800; color: var(--accent); text-transform: uppercase; } .title-input { background: var(--surface-main); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text-main); font-weight: 700; &:focus { border-color: var(--accent); outline: none; } } textarea { background: var(--surface-main); border: 1px solid var(--border); border-radius: 12px; padding: 14px; color: var(--text-main); font-weight: 500; resize: none; flex: 1; &:focus { border-color: var(--accent); outline: none; } } }
    .editor-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
    .priority-selector { display: flex; gap: 10px; span { width: 12px; height: 12px; border-radius: 50%; cursor: pointer; opacity: 0.3; transition: all 0.2s; &.active { opacity: 1; transform: scale(1.2); } &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } } }
    .save-btn { padding: 8px 18px; border-radius: 8px; background: var(--accent); color: white; border: none; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; &:disabled { opacity: 0.5; cursor: not-allowed; } &:hover:not(:disabled) { background: var(--accent-hover, var(--accent)); filter: brightness(1.1); } }

    .reminder-zone {
        display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 15px;
        .label { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .reminder-input { background: var(--surface-main); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; color: var(--text-main); font-weight: 700; width: 100px; }
    }
    .reminder-zone-mobile { display: flex; align-items: center; gap: 10px; .reminder-input-mobile { background: var(--surface-main); border: 1px solid var(--border); border-radius: 8px; padding: 8px; font-size: 0.8rem; color: var(--text-main); width: 110px; } }

    .toggle-switch-mini { 
        width: 32px; height: 18px; background: var(--border); border-radius: 10px; position: relative; cursor: pointer; transition: all 0.3s; 
        .switch-handle { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: white; border-radius: 50%; transition: all 0.3s; } 
        &.enabled { background: var(--accent); .switch-handle { transform: translateX(14px); } } 
    }
    
    .animate-fade { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

    /* MOBILE NATIVE HUB - FIXED SCROLLING */
    .mobile-tabs {
        display: flex; padding: 8px 12px; background: var(--surface-alt); border-bottom: 1px solid var(--border); gap: 6px;
        button {
            flex: 1; padding: 8px; border: none; background: transparent; border-radius: 10px; color: var(--text-muted); font-size: 0.72rem; font-weight: 700; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 4px;
            i { font-size: 1.1rem; }
            &.active { background: var(--bg-active); color: var(--accent); }
        }
    }
    .mobile-viewport { 
        flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; padding: 20px; min-height: 0;
        scroll-behavior: smooth;
    }
    .mobile-section {
        display: flex; flex-direction: column; gap: 20px; width: 100%;
        h3 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: -10px; }
        .notes-history-list { overflow: visible; } /* Let viewport handle scrolling */
    }
    .mobile-selection-hint { padding: 14px; background: var(--surface-alt); border-radius: 12px; font-size: 0.8rem; color: var(--text-alt); text-align: center; margin-top: 10px; border: 1px dashed var(--border); }

    .mobile-editor-controls {
        display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--surface-alt); border-radius: 14px; margin-top: 10px;
        .save-btn-mobile { padding: 12px 24px; border-radius: 12px; background: var(--accent); color: white; border: none; font-weight: 800; font-size: 0.9rem; }
    }

    @keyframes slideUp { from { opacity: 0; transform: translateY(15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

    @media (max-width: 850px) {
        .widget-modal-wrapper { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; padding-bottom: env(safe-area-inset-bottom); }
        .widget-modal-header { padding: 12px 16px; }
        .calendar-container.modal-view .widget-modal-wrapper { height: 100dvh; }
    }
  `]
})
export class SharedCalendarWidget implements OnInit {
  @Input() isModal = false;

  displayDate = signal(new Date());
  calendarDays = signal<number[]>([]);
  selectedDay = signal<number>(new Date().getDate());
  
  // Note Data
  notes = signal<WidgetNote[]>([]);
  activeNote = signal<WidgetNote | null>(null);
  historyVisible = signal(false);
  
  // Mobile Support
  isMobile = signal(window.innerWidth < 850);
  viewMode = signal<'grid' | 'editor' | 'history'>('grid');

  // Editor State
  noteTitle = '';
  noteContent = '';
  notePriority: 'low' | 'medium' | 'high' = 'low';
  noteReminderEnabled = signal(false);
  noteReminderTime = '';

  private db = inject(DexieService);
  private modalService = inject(ModalService);
  private readonly today = new Date();
  private monitorInterval: any;
  private triggeredReminders = new Set<string>();

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < 850);
  }

  async ngOnInit() {
    this.generateCalendar();
    await this.loadAllNotes();
    this.updateActiveNote();
    this.startReminderMonitor();
  }

  ngOnDestroy() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
  }

  private startReminderMonitor() {
    this.monitorInterval = setInterval(() => {
        this.checkReminders();
    }, 1000 * 60); // Check every minute
    this.checkReminders(); // Initial check
  }

  private checkReminders() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const reminder = this.notes().find(n => 
        n.date === dateStr && 
        n.reminderEnabled && 
        n.reminderTime === timeStr && 
        !this.triggeredReminders.has(n.id)
    );

    if (reminder) {
        this.triggeredReminders.add(reminder.id);
        this.triggerSystemNotification(reminder);
    }
  }

  private triggerSystemNotification(note: WidgetNote) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Calendar Reminder: ' + (note.title || 'Pinned Note'), {
            body: note.content || 'Check your pinned note for today.',
            icon: '/favicon.ico',
            tag: 'quilix-reminder-' + note.id
        });
    }
  }

  private generateCalendar() {
    const d = this.displayDate();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const lastDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(0);
    for (let i = 1; i <= lastDate; i++) days.push(i);
    this.calendarDays.set(days);
  }

  private async loadAllNotes() {
    const allNotes = await this.db.widget_notes.toArray();
    this.notes.set(allNotes);
  }

  get sortedNotes(): WidgetNote[] {
    return [...this.notes()].sort((a,b) => b.date.localeCompare(a.date));
  }

  private updateActiveNote() {
    const dateStr = this.getSelectedDateString();
    const note = this.notes().find(n => n.date === dateStr) || null;
    this.activeNote.set(note);
    this.noteTitle = note?.title || '';
    this.noteContent = note?.content || '';
    this.notePriority = note?.priority || 'low';
    this.noteReminderEnabled.set(note?.reminderEnabled || false);
    this.noteReminderTime = note?.reminderTime || '';
  }

  isToday(day: number): boolean {
    const d = this.displayDate();
    return day === this.today.getDate() && d.getMonth() === this.today.getMonth() && d.getFullYear() === this.today.getFullYear();
  }

  hasNote(day: number): boolean { return this.notes().some(n => n.date === this.getDateStringForDay(day)); }
  getNotePriority(day: number): string { return this.notes().find(n => n.date === this.getDateStringForDay(day))?.priority || ''; }
  getSelectedDateString(): string { return this.getDateStringForDay(this.selectedDay()); }

  private getDateStringForDay(day: number): string {
    const d = this.displayDate();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  nextMonth(event: Event) { event.stopPropagation(); this.displayDate.set(new Date(this.displayDate().getFullYear(), this.displayDate().getMonth() + 1, 1)); this.generateCalendar(); }
  prevMonth(event: Event) { event.stopPropagation(); this.displayDate.set(new Date(this.displayDate().getFullYear(), this.displayDate().getMonth() - 1, 1)); this.generateCalendar(); }

  selectDay(day: number, event: Event) {
    if (day === 0) return;
    event.stopPropagation();
    this.selectedDay.set(day);
    this.updateActiveNote();
    if (this.isMobile()) {
        this.viewMode.set('editor'); // Automatic snap to editor on mobile
    }
  }

  selectHistoryNote(note: WidgetNote) {
    const d = new Date(note.date + 'T00:00:00');
    this.displayDate.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.selectedDay.set(d.getDate());
    this.generateCalendar();
    this.updateActiveNote();
    this.historyVisible.set(false);
    if (this.isMobile()) {
        this.viewMode.set('editor');
    }
  }

  async saveSelectedNote() {
    const note: WidgetNote = {
      id: this.activeNote()?.id || crypto.randomUUID(),
      date: this.getSelectedDateString(),
      title: this.noteTitle,
      content: this.noteContent,
      priority: this.notePriority,
      reminderEnabled: this.noteReminderEnabled(),
      reminderTime: this.noteReminderTime,
      createdAt: this.activeNote()?.createdAt || Date.now()
    };
    await this.db.widget_notes.put(note);
    await this.loadAllNotes();
    this.updateActiveNote();
    if (this.isMobile()) {
        this.viewMode.set('grid'); // Return to grid after save on mobile
    }
  }

  async deleteSelectedNote() {
    if (!this.activeNote()) return;
    await this.db.widget_notes.delete(this.activeNote()!.id);
    await this.loadAllNotes();
    this.updateActiveNote();
    if (this.isMobile()) {
        this.viewMode.set('grid');
    }
  }

  closeModal() {
    this.modalService.cancelResult(true);
  }
}
