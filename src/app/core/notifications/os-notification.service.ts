import { Injectable } from '@angular/core';

export interface OsNotificationOptions {
  title: string;
  body?: string;
  tag?: string;
  data?: unknown;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OsNotificationService {

  private readonly defaultIcon = '/assets/icons/web-app-manifest-192x192.png';
  private readonly defaultBadge = '/assets/icons/notification-icon.png';

  async notify(options: OsNotificationOptions): Promise<void> {
    if (!this.isSupported()) return;
    if (!this.hasPermission()) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification(options.title, {
        body: options.body,
        tag: options.tag,
        data: options.data,
        icon: options.icon ?? this.defaultIcon,
        badge: options.badge ?? this.defaultBadge,
        requireInteraction: options.requireInteraction ?? false,
      });

    } catch (err) {
      console.warn('[OS NOTIF] Failed to show notification', err);
    }
  }

  private isSupported(): boolean {
    if (!('serviceWorker' in navigator)) {
      console.warn('[OS NOTIF] Service Worker not supported');
      return false;
    }

    if (!('Notification' in window)) {
      console.warn('[OS NOTIF] Notification API not supported');
      return false;
    }

    return true;
  }

  private hasPermission(): boolean {
    if (Notification.permission !== 'granted') {
      console.warn('[OS NOTIF] Permission not granted');
      return false;
    }
    return true;
  }

}
