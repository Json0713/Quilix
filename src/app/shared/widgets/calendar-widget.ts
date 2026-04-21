import { Component, OnInit, signal, Input, inject } from '@angular/core';
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
            <div class="widget-modal-wrapper">
                <div class="widget-modal-header">
                    <div class="header-left">
                        <i class="bi bi-calendar3 header-icon"></i>
                        <h2>Calendar Hub</h2>
                    </div>
                    <button class="close-btn" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
                </div>

                <div class="widget-modal-body">
                    <div class="modal-split-layout">
                        <!-- LEFT SIDE: Grid & History Toggle -->
                        <div class="layout-side left">
                            <div class="side-nav-header">
                                <div class="calendar-nav">
                                    <button class="nav-btn" (click)="prevMonth($event)"><i class="bi bi-chevron-left"></i></button>
                                    <span class="month-title-modal">{{ displayDate() | date:'MMMM yyyy' }}</span>
                                    <button class="nav-btn" (click)="nextMonth($event)"><i class="bi bi-chevron-right"></i></button>
                                </div>
                                <button class="history-toggle" (click)="historyVisible.set(!historyVisible())" [class.active]="historyVisible()">
                                    <i class="bi" [class.bi-journal-text]="!historyVisible()" [class.bi-calendar3]="historyVisible()"></i>
                                    {{ historyVisible() ? 'Back to Calendar' : 'See All Notes' }}
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
                                <div class="notes-history-list">
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

                        <!-- RIGHT SIDE: Editor -->
                        <div class="layout-side right">
                            <div class="editor-header">
                                <span class="selected-date">{{ getSelectedDateString() | date:'fullDate' }}</span>
                                @if (activeNote()) {
                                    <button class="delete-btn" title="Delete Note" (click)="deleteSelectedNote()"><i class="bi bi-trash3"></i></button>
                                }
                            </div>

                            <div class="note-editor">
                                <div class="field-group">
                                    <label>Title</label>
                                    <input type="text" [(ngModel)]="noteTitle" placeholder="Give this note a title..." class="title-input">
                                </div>
                                
                                <div class="field-group expand">
                                    <label>Notes</label>
                                    <textarea [(ngModel)]="noteContent" placeholder="What's happening on this day?" rows="8"></textarea>
                                </div>
                                
                                <div class="editor-footer">
                                    <div class="priority-selector">
                                        <span (click)="notePriority = 'low'" [class.active]="notePriority === 'low'" class="low" title="Low Priority"></span>
                                        <span (click)="notePriority = 'medium'" [class.active]="notePriority === 'medium'" class="medium" title="Medium Priority"></span>
                                        <span (click)="notePriority = 'high'" [class.active]="notePriority === 'high'" class="high" title="High Priority"></span>
                                    </div>
                                    <button class="save-btn" (click)="saveSelectedNote()" [disabled]="!noteContent && !noteTitle">
                                        <i class="bi bi-check-lg"></i> Save Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .calendar-container { user-select: none; }

    /* SHARED SIDEBAR STYLES */
    .calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .month-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-main); }
    .nav-btn { 
        width: 28px; height: 28px; border-radius: 8px; border: none; background: var(--surface-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        &:hover { color: var(--accent); background: var(--bg-hover); } 
    }
    
    .calendar-grid {
        display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;
        .day-name { font-size: 0.6rem; font-weight: 800; color: var(--accent); opacity: 0.6; margin-bottom: 4px; }
        .day-cell {
            position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.72rem; font-weight: 600; color: var(--text-alt); cursor: pointer;
            &.today { background: var(--accent); color: white; }
            &.selected:not(.today) { box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
            &.empty { pointer-events: none; opacity: 0; }
            .note-dot { position: absolute; bottom: 3px; width: 3px; height: 3px; border-radius: 50%; &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } }
        }
    }

    /* WIDGET MODAL WRAPPER (750px NATIVE PATTERN) */
    .widget-modal-wrapper {
        width: 750px; max-width: 95vw; background: var(--surface-main); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        height: 600px;
        max-height: 85vh;
    }

    .widget-modal-header {
        display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface-alt);
        .header-left { display: flex; align-items: center; gap: 10px; .header-icon { font-size: 1.1rem; color: var(--accent); opacity: 0.8; } h2 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0; } }
        .close-btn { width: 30px; height: 30px; border-radius: 50%; border: none; background: var(--bg-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: var(--bg-hover); color: var(--text-main); } }
    }

    .widget-modal-body { flex: 1; overflow: hidden; padding: 0; }

    .modal-split-layout {
        display: flex; gap: 0; height: 100%;
        .layout-side { flex: 1; display: flex; flex-direction: column; padding: 24px; }
        .layout-side.left { border-right: 1px solid var(--border); overflow-y: auto; &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; } }
        .layout-side.right { background: var(--surface-alt); overflow-y: auto; }
    }

    /* MODAL GRID & NAV */
    .side-nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .month-title-modal { font-size: 0.9rem; font-weight: 800; color: var(--text-main); }
    .modal-grid { gap: 8px; .day-name { font-size: 0.65rem; font-weight: 800; margin-bottom: 10px; } .day-cell { font-size: 0.9rem; border-radius: 10px; } }

    .history-toggle {
        padding: 6px 12px; border-radius: 8px; background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-alt); font-size: 0.7rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
        &:hover { border-color: var(--accent); color: var(--accent); }
        &.active { background: var(--accent); color: white; border-color: var(--accent); }
    }

    /* HISTORY */
    .notes-history-list {
        display: flex; flex-direction: column; gap: 12px;
        .history-item {
            padding: 14px; border-radius: 14px; background: var(--surface-alt); border: 1px solid var(--border); cursor: pointer; transition: all 0.2s;
            &:hover { border-color: var(--accent); transform: translateX(5px); }
            .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; .item-date { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; } }
            .item-title { font-size: 0.95rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        }
        .empty-state { padding: 40px 0; text-align: center; color: var(--text-muted); font-weight: 600; opacity: 0.6; }
    }

    /* EDITOR */
    .selected-date { font-size: 0.9rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .delete-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s; &:hover { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); } }
    
    .note-editor {
        display: flex; flex-direction: column; gap: 16px; flex: 1;
        .field-group { display: flex; flex-direction: column; gap: 8px; &.expand { flex: 1; } }
        label { font-size: 0.7rem; font-weight: 900; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; }
        .title-input { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text-main); font-weight: 700; font-size: 1rem; &:focus { outline: none; border-color: var(--accent); } }
        textarea { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 16px; padding: 16px; color: var(--text-main); font-size: 1rem; line-height: 1.6; resize: none; flex: 1; &:focus { outline: none; border-color: var(--accent); } }
        .editor-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
        .priority-selector {
            display: flex; gap: 12px;
            span { width: 14px; height: 14px; border-radius: 50%; cursor: pointer; opacity: 0.3; transition: all 0.2s; &.active { opacity: 1; transform: scale(1.3); } &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } }
        }
        .save-btn { padding: 9px 18px; border-radius: 10px; background: var(--accent); color: white; border: none; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; &:disabled { opacity: 0.5; cursor: not-allowed; } &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--accent-rgb, 59, 130, 246), 0.2); } }
    }

    @keyframes slideUp { from { opacity: 0; transform: translateY(15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* MOBILE RESPONSIVENESS */
    @media (max-width: 850px) {
        .widget-modal-wrapper { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; }
        .modal-split-layout { flex-direction: column; gap: 32px; .layout-side.left { border-right: none; padding-right: 0; border-bottom: 2px solid var(--surface-alt); padding-bottom: 32px; } }
        .widget-modal-body { padding: 20px; }
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
  
  // Editor State
  noteTitle = '';
  noteContent = '';
  notePriority: 'low' | 'medium' | 'high' = 'low';

  private db = inject(DexieService);
  private modalService = inject(ModalService);
  private readonly today = new Date();

  async ngOnInit() {
    this.generateCalendar();
    await this.loadAllNotes();
    this.updateActiveNote();
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
  }

  selectHistoryNote(note: WidgetNote) {
    const d = new Date(note.date + 'T00:00:00');
    this.displayDate.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.selectedDay.set(d.getDate());
    this.generateCalendar();
    this.updateActiveNote();
    this.historyVisible.set(false);
  }

  async saveSelectedNote() {
    const note: WidgetNote = {
      id: this.activeNote()?.id || crypto.randomUUID(),
      date: this.getSelectedDateString(),
      title: this.noteTitle,
      content: this.noteContent,
      priority: this.notePriority,
      createdAt: this.activeNote()?.createdAt || Date.now()
    };
    await this.db.widget_notes.put(note);
    await this.loadAllNotes();
    this.updateActiveNote();
  }

  async deleteSelectedNote() {
    if (!this.activeNote()) return;
    await this.db.widget_notes.delete(this.activeNote()!.id);
    await this.loadAllNotes();
    this.updateActiveNote();
  }

  closeModal() {
    this.modalService.cancelResult(true);
  }
}
