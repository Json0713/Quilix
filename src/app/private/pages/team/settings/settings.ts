import { Component, inject, signal } from '@angular/core';
import { AppThemeService } from '../../../../core/theme/app-theme/app-theme.service';
import { OsNotificationService } from '../../../../core/notifications/os-notification.service';
import { Export } from '../../../../shared/components/export/export';
import { StorageToggleComponent } from '../../../../shared/ui/system/storage-toggle/storage-toggle';

@Component({
    selector: 'app-team-settings',
    standalone: true,
    imports: [Export, StorageToggleComponent],
    templateUrl: './settings.html',
    styleUrl: './settings.scss',
})
export class TeamSettings {
    private themeService = inject(AppThemeService);
    private osNotify = inject(OsNotificationService);

    currentTheme = this.themeService.theme;
    notificationPermission = signal<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'denied'
    );

    setTheme(mode: 'light' | 'dark' | 'system') {
        this.themeService.apply(mode);
    }

    async enableNotifications() {
        if (!('Notification' in window)) return;

        const permission = await Notification.requestPermission();
        this.notificationPermission.set(permission);

        if (permission === 'granted') {
            this.osNotify.notify({
                title: 'Notifications Enabled',
                body: 'You will now receive updates from Quilix (Team).',
                tag: 'notif-enabled-team',
            });
        }
    }
}
