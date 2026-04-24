import { Component, OnInit, signal, Input, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DexieService, WidgetNote } from '../../core/database/dexie.service';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../services/ui/common/modal/modal';
import { AlarmService } from '../../core/services/ui/alarm.service';

@Component({
    selector: 'app-shared-calendar-widget',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="calendar-container" [class.modal-view]="isModal">
        
        <!-- SIDEBAR VIEW (Compact Windows Style) -->
        @if (!isModal) {
            <div class="calendar-nav-sidebar">
                <span class="month-title" (click)="resetToToday()" title="Back to Today">{{ displayDate() | date:'MMMM yyyy' }}</span>
                <div class="nav-controls">
                    <button class="nav-btn" (click)="prevMonth($event)"><i class="bi bi-chevron-up"></i></button>
                    <button class="nav-btn" (click)="nextMonth($event)"><i class="bi bi-chevron-down"></i></button>
                </div>
            </div>

            <div class="calendar-grid sidebar-grid">
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
                                        <span class="month-title-modal" (click)="resetToToday()" title="Back to Today">{{ displayDate() | date:'MMMM yyyy' }}</span>
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
                                    <div class="priority-selector">
                                        <span (click)="notePriority = 'low'" [class.active]="notePriority === 'low'" class="low" title="Low Priority"></span>
                                        <span (click)="notePriority = 'medium'" [class.active]="notePriority === 'medium'" class="medium" title="Medium Priority"></span>
                                        <span (click)="notePriority = 'high'" [class.active]="notePriority === 'high'" class="high" title="High Priority"></span>
                                    </div>
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
                                                <span class="month-title-modal" (click)="resetToToday()" title="Back to Today">{{ displayDate() | date:'MMMM yyyy' }}</span>
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
                                                <div class="control-item">
                                                    <label>Priority</label>
                                                    <div class="priority-selector">
                                                        <span (click)="notePriority = 'low'" [class.active]="notePriority === 'low'" class="low"></span>
                                                        <span (click)="notePriority = 'medium'" [class.active]="notePriority === 'medium'" class="medium"></span>
                                                        <span (click)="notePriority = 'high'" [class.active]="notePriority === 'high'" class="high"></span>
                                                    </div>
                                                </div>
                                                
                                                <div class="control-item">
                                                    <label>Remind Me</label>
                                                    <div class="reminder-zone-mobile">
                                                        <div class="toggle-switch-mini" [class.enabled]="noteReminderEnabled()" (click)="noteReminderEnabled.set(!noteReminderEnabled())">
                                                            <div class="switch-handle"></div>
                                                        </div>
                                                        @if (noteReminderEnabled()) {
                                                            <input type="time" [(ngModel)]="noteReminderTime" class="reminder-input-mobile animate-fade">
                                                        }
                                                    </div>
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

    <!-- CUSTOM CONFIRMATION OVERLAY (STANDARD PRO) -->
    @if (confirmDeleteNote()) {
        <div class="hub-overlay-backdrop animate-fade" (click)="confirmDeleteNote.set(false)">
            <div class="hub-confirm-card animate-pop" (click)="$event.stopPropagation()">
                <div class="confirm-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
                <h3>Delete Note?</h3>
                <p>Are you sure you want to remove the note for <strong>{{ getSelectedDateString() | date:'mediumDate' }}</strong>? This action cannot be undone.</p>
                <div class="confirm-actions">
                    <button class="btn-confirm-pill" (click)="confirmedDelete()">Delete Note</button>
                    <button class="btn-cancel" (click)="confirmDeleteNote.set(false)">Cancel</button>
                </div>
            </div>
        </div>
    }
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

    /* SIDEBAR VIEW STYLES */
    .calendar-nav-sidebar { 
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; 
        .month-title { font-size: 0.85rem; font-weight: 800; color: var(--text-main); cursor: pointer; &:hover { color: var(--accent); } }
        .nav-controls { display: flex; gap: 4px; }
    }
    
    .calendar-grid {
        display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;
        .day-name { font-size: 0.6rem; font-weight: 800; color: var(--text-muted); opacity: 0.5; margin-bottom: 8px; }
        .day-cell {
            position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.75rem; font-weight: 700; color: var(--text-main); cursor: pointer; transition: all 0.2s;
            &.today { background: var(--accent); color: white; }
            &.selected:not(.today) { background: var(--bg-hover); box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
            &.empty { pointer-events: none; opacity: 0; }
            &:hover:not(.today):not(.empty) { background: var(--bg-hover); }
            .note-dot { position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%; &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } }
        }
    }

    /* MODAL-VIEW SCOPED OVERRIDES */
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
        .month-title-modal { font-size: 0.95rem; font-weight: 800; color: var(--text-main); cursor: pointer; transition: color 0.2s; &:hover { color: var(--accent); } }
    }

    .calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .nav-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: var(--surface-alt); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { color: var(--accent); background: var(--bg-hover); } }

    /* ASSET STYLES */
    .side-nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .history-toggle { padding: 8px 16px; border-radius: 50px; background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-alt); font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; &:hover { border-color: var(--accent); color: var(--accent); } &.active { background: var(--accent); color: white; border-color: var(--accent); } }
    
    .notes-history-list { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
    .history-item { 
        padding: 14px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 14px; cursor: pointer;
        &:hover { border-color: var(--accent); }
        .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .item-date { font-size: 0.72rem; font-weight: 800; color: var(--accent); text-transform: uppercase; }
        .item-title { font-size: 0.9rem; font-weight: 750; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .note-dot { width: 8px; height: 8px; border-radius: 50%; &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } }
    }
    .empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; background: var(--surface-alt); border-radius: 16px; border: 1px dashed var(--border); }

    .editor-header { 
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border);
        .selected-date { font-size: 0.85rem; font-weight: 800; color: var(--text-muted); } 
        .priority-selector { padding: 4px 10px; border-radius: 50px; }
        .delete-btn { color: var(--text-muted); background: none; border: none; cursor: pointer; &:hover { color: #ff4d4d; } } 
    }
    .note-editor { display: flex; flex-direction: column; gap: 16px; height: 100%; .field-group { display: flex; flex-direction: column; gap: 6px; &.expand { flex: 1; min-height: 0; } } label { font-size: 0.65rem; font-weight: 800; color: var(--accent); text-transform: uppercase; } .title-input { background: var(--surface-main); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text-main); font-weight: 700; &:focus { border-color: var(--accent); outline: none; } } textarea { background: var(--surface-main); border: 1px solid var(--border); border-radius: 12px; padding: 14px; color: var(--text-main); font-weight: 500; resize: none; flex: 1; &:focus { border-color: var(--accent); outline: none; } } }
    .editor-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
    .priority-selector { display: flex; gap: 10px; span { width: 12px; height: 12px; border-radius: 50%; cursor: pointer; opacity: 0.3; transition: all 0.2s; &.active { opacity: 1; transform: scale(1.2); } &.high { background: #ff4d4d; } &.medium { background: #ffaa00; } &.low { background: #00cc66; } } }
    .save-btn { padding: 8px 24px; border-radius: 50px; background: var(--accent); color: white; border: none; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; &:disabled { opacity: 0.5; cursor: not-allowed; } &:hover:not(:disabled) { background: var(--accent-hover, var(--accent)); filter: brightness(1.1); } }

    .reminder-zone {
        display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 15px;
        .label { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .reminder-input { background: var(--surface-main); border: 1px solid var(--border); border-radius: 50px; padding: 4px 12px; font-size: 0.75rem; color: var(--text-main); font-weight: 700; width: 100px; }
    }

    /* MOBILE EDITOR STYLES */
    .mobile-editor-controls {
        display: flex; flex-direction: column; gap: 20px; padding-top: 20px; border-top: 1px solid var(--border); margin-top: 20px;
        .control-item {
            display: flex; justify-content: space-between; align-items: center;
            label { font-size: 0.7rem; font-weight: 800; color: var(--accent); text-transform: uppercase; }
        }
    }
    .reminder-zone-mobile {
        display: flex; align-items: center; gap: 12px;
        .reminder-input-mobile { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text-main); font-size: 0.9rem; font-weight: 700; }
    }
    .save-btn-mobile {
        width: 100%; padding: 16px; border-radius: 16px; background: var(--accent); color: white; border: none; font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 10px; box-shadow: 0 8px 24px rgba(var(--accent-rgb, 79, 163, 168), 0.3);
        &:disabled { opacity: 0.5; box-shadow: none; }
        &:active { transform: scale(0.96); }
    }
    .mobile-selection-hint { font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 10px; background: var(--surface-alt); border-radius: 10px; }
    
    .toggle-switch-mini { 
        width: 32px; height: 18px; background: var(--border); border-radius: 10px; position: relative; cursor: pointer; transition: all 0.3s; 
        .switch-handle { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: white; border-radius: 50%; transition: all 0.3s; } 
        &.enabled { background: var(--accent); .switch-handle { transform: translateX(14px); } } 
    }
    
    .animate-fade { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

    /* MOBILE NATIVE HUB */
    .mobile-tabs {
        display: flex; padding: 8px 12px; background: var(--surface-alt); border-bottom: 1px solid var(--border); gap: 6px;
        button {
            flex: 1; padding: 8px; border: none; background: transparent; border-radius: 10px; color: var(--text-muted); font-size: 0.72rem; font-weight: 700; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 4px;
            i { font-size: 1.1rem; }
            &.active { background: var(--bg-active); color: var(--accent); }
        }
    }
    .mobile-viewport { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; padding: 20px; }
    .mobile-section { display: flex; flex-direction: column; gap: 20px; width: 100%; h3 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: -10px; } }

    /* HUB OVERLAY SYSTEM */
    .hub-overlay-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); z-index: 1010; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .hub-confirm-card { background: var(--surface-main); border: 1px solid var(--border); border-radius: 28px; padding: 30px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); .confirm-icon { font-size: 2.5rem; color: #ff4d4d; margin-bottom: 12px; } h3 { font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px; margin-top: 0; } p { font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 25px; } .confirm-actions { display: flex; flex-direction: column; gap: 12px; } .btn-cancel { background: transparent; border: none; color: var(--text-muted); font-weight: 700; font-size: 0.9rem; padding: 10px; cursor: pointer; &:hover { color: var(--text-main); } } .btn-confirm-pill { background: #ff4d4d; border: none; color: white; font-weight: 800; font-size: 0.95rem; padding: 16px; border-radius: 50px; cursor: pointer; box-shadow: 0 8px 16px rgba(255,77,77,0.3); transition: transform 0.2s; &:active { transform: scale(0.96); } } }

    @media (max-width: 850px) {
        .widget-modal-wrapper { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; padding-bottom: env(safe-area-inset-bottom); }
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
    activeNoteSidebar = signal<WidgetNote | null>(null);
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
    confirmDeleteNote = signal(false);

    private db = inject(DexieService);
    private modalService = inject(ModalService);
    private alarmService = inject(AlarmService); // Injected but unused here, logic is in service
    private readonly today = new Date();

    @HostListener('window:resize')
    onResize() {
        this.isMobile.set(window.innerWidth < 850);
    }

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

        // For sidebar, show today's note if exists
        const todayStr = `${this.today.getFullYear()}-${(this.today.getMonth() + 1).toString().padStart(2, '0')}-${this.today.getDate().toString().padStart(2, '0')}`;
        this.activeNoteSidebar.set(allNotes.find(n => n.date === todayStr) || null);
    }

    get sortedNotes(): WidgetNote[] {
        return [...this.notes()].sort((a, b) => b.date.localeCompare(a.date));
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

    resetToToday() {
    this.displayDate.set(new Date());
    this.selectedDay.set(new Date().getDate());
    this.generateCalendar();
    this.updateActiveNote();
  }

  selectDay(day: number, event: Event) {
        if (day === 0) return;
        event.stopPropagation();
        this.selectedDay.set(day);
        this.updateActiveNote();
        if (this.isMobile() && this.isModal) {
            this.viewMode.set('editor');
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
        if (this.isMobile() && this.isModal) {
            this.viewMode.set('grid');
        }
    }

    async deleteSelectedNote() {
        if (!this.activeNote()) return;
        this.confirmDeleteNote.set(true);
    }

    async confirmedDelete() {
        if (this.activeNote()) {
            await this.db.widget_notes.delete(this.activeNote()!.id);
            await this.loadAllNotes();
            this.updateActiveNote();
            if (this.isMobile() && this.isModal) {
                this.viewMode.set('grid');
            }
        }
        this.confirmDeleteNote.set(false);
    }

    openCalendarHub() {
        // If we click the note preview in sidebar, we can potentially trigger the modal if we want
        // But user mostly wants "Windows OS calendar" feel which often opens on click.
        // For now we keep it simple.
    }

    closeModal() {
        this.modalService.cancelResult(true);
    }
}
