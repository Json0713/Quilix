import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    // Register custom notification SW after app bootstrap
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/assets/notif-sw.js')
        .then(() => console.log('OS Notification SW registered'))
        .catch(err => console.error('OS Notification SW registration failed', err));
    }
  })
  .catch(err => console.error(err));
