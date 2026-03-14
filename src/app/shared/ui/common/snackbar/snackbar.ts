import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    action?: {
        label: string;
        callback: () => void;
    };
}

@Component({
    selector: 'app-snackbar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './snackbar.html',
    styleUrls: ['./snackbar.scss']
})
export class SnackbarComponent {
    notifications = signal<Notification[]>([]);
    private nextId = 0;

    show(msg: string, messageType: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 12000, action?: { label: string, callback: () => void }) {
        const id = this.nextId++;
        const newNotification: Notification = {
            id,
            message: msg,
            type: messageType,
            action
        };

        this.notifications.update(prev => [...prev, newNotification]);

        if (duration > 0) {
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }
    }

    hide(id: number) {
        this.notifications.update(prev => prev.filter(n => n.id !== id));
    }

    onActionClick(notification: Notification) {
        if (notification.action?.callback) {
            notification.action.callback();
        }
        this.hide(notification.id);
    }
}
