import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-snackbar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './snackbar.html',
    styleUrls: ['./snackbar.scss']
})
export class SnackbarComponent {
    isVisible = signal<boolean>(false);
    message = signal<string>('');
    type = signal<'success' | 'error' | 'info' | 'warning'>('info');
    private timeoutId: any;

    show(msg: string, messageType: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 3000) {
        this.message.set(msg);
        this.type.set(messageType);
        this.isVisible.set(true);

        if (this.timeoutId) clearTimeout(this.timeoutId);

        if (duration > 0) {
            this.timeoutId = setTimeout(() => {
                this.hide();
            }, duration);
        }
    }

    hide() {
        this.isVisible.set(false);
    }
}
