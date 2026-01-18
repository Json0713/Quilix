import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OsNotificationService {

  async notify(options: {
    title: string;
    body?: string;
    tag?: string;
    data?: any;
  }) 
  
  {
    if (!('serviceWorker' in navigator)) {
      console.warn('[OS NOTIF] SW not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[OS NOTIF] Permission not granted');
      return;
    }

    // WAIT until SW is fully ready
    const registration = await navigator.serviceWorker.ready;

    console.log('[OS NOTIF] Sending notification');

    await registration.showNotification(options.title, {
      body: options.body,
      tag: options.tag,
      data: options.data,
      icon: '/assets/icons/web-app-manifest-192x192.png',
      badge: '/assets/icons/web-app-manifest-192x192.png',
    });
  }

}
