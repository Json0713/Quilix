import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OsNotificationService {

  notify(payload: {
    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: any;
  }): void {
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;

    navigator.serviceWorker.controller?.postMessage({
      type: 'NOTIFY',
      payload
    });
  }

}
