import { Injectable, inject, signal } from '@angular/core';
import { DexieService, WidgetAlarm, WidgetNote } from '../../database/dexie.service';

@Injectable({
  providedIn: 'root'
})
export class AlarmService {
  private db = inject(DexieService);
  
  activeAlarm = signal<WidgetAlarm | null>(null);
  activeReminder = signal<WidgetNote | null>(null);
  
  private triggeredAlarms = new Set<string>();
  private triggeredReminders = new Set<string>();
  private audioContext: AudioContext | null = null;
  private loopInterval: any;

  constructor() {
    this.startMonitor();
  }

  private startMonitor() {
    setInterval(() => {
      this.checkAlarms();
    }, 1000);

    setInterval(() => {
      this.checkReminders();
    }, 1000 * 30); // Check reminders every 30 seconds
    
    this.checkAlarms();
    this.checkReminders();
  }

  private async checkAlarms() {
    const now = new Date();
    const currentStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Reset triggered set every minute
    if (now.getSeconds() === 0) this.triggeredAlarms.clear();

    const alarms = await this.db.widget_alarms.toArray();
    const active = alarms.find(a => a.enabled && a.time === currentStr && !this.triggeredAlarms.has(a.id));
    
    if (active) {
      this.triggeredAlarms.add(active.id);
      this.triggerAlarm(active);
    }
  }

  private async checkReminders() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const notes = await this.db.widget_notes.toArray();
    const reminder = notes.find(n => 
        n.date === dateStr && 
        n.reminderEnabled && 
        n.reminderTime === timeStr && 
        !this.triggeredReminders.has(n.id)
    );

    if (reminder) {
        this.triggeredReminders.add(reminder.id);
        this.triggerReminder(reminder);
    }
  }

  private triggerAlarm(alarm: WidgetAlarm) {
    this.activeAlarm.set(alarm);
    this.playRingtone(alarm.ringtone || 'system', true);
    this.showSystemNotification('Alarm: ' + (alarm.label || 'Time Up!'), `It is ${this.format12h(alarm.time)}. High performance awaits.`);
  }

  private triggerReminder(note: WidgetNote) {
    this.activeReminder.set(note);
    this.playRingtone('chimes', false); // Gentle chime for reminders
    this.showSystemNotification('Reminder: ' + (note.title || 'Pinned Note'), note.content || 'Check your pinned note for today.');
  }

  stopAlert() {
    this.activeAlarm.set(null);
    this.activeReminder.set(null);
    this.stopAudio();
    if ('vibrate' in navigator) navigator.vibrate(0);
  }

  private showSystemNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 500]);
  }

  private format12h(timeStr: string): string {
    if (!timeStr) return '--:--';
    const [hours, mins] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
  }

  private playRingtone(type: string, loop: boolean) {
    if (type === 'system') return;
    this.stopAudio();
    
    try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const master = this.audioContext.createGain();
        master.connect(this.audioContext.destination);
        
        master.gain.setValueAtTime(0, this.audioContext.currentTime);
        master.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 15); // Faster ramp for global service

        const triggerSequence = () => {
            if (!this.audioContext) return;
            const now = this.audioContext.currentTime;

            if (type === 'digital') {
                for (let i = 0; i < 3; i++) this.playTone(880, now + (i * 0.15), 0.08, 'square', master);
            } else if (type === 'radar') {
                const osc = this.audioContext.createOscillator();
                const g = this.audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
                g.gain.setValueAtTime(0.3, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.connect(g); g.connect(master);
                osc.start(now); osc.stop(now + 0.4);
            } else if (type === 'chimes') {
                [440, 659.25, 880, 1108.73].forEach((f, i) => this.playTone(f, now + (i * 0.2), 1.5, 'triangle', master));
            } else if (type === 'classic') {
                this.playTone(600, now, 0.06, 'sawtooth', master);
                this.playTone(800, now + 0.1, 0.08, 'sawtooth', master);
            } else if (type === 'breeze') {
                [440, 554.37, 659.25, 880].forEach((f, i) => this.playTone(f, now + (i * 0.5), 3, 'sine', master));
            }
        };

        triggerSequence();
        if (loop) {
            let interval = 1000;
            if (type === 'radar') interval = 1200;
            if (type === 'chimes') interval = 2500;
            if (type === 'breeze') interval = 4000;
            this.loopInterval = setInterval(triggerSequence, interval);
        }
    } catch(e) {}
  }

  private playTone(freq: number, startTime: number, duration: number, type: OscillatorType, destination: AudioNode) {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const g = this.audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(g); g.connect(destination);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(0.4, startTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime); osc.stop(startTime + duration);
  }

  private stopAudio() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }
  }
}
