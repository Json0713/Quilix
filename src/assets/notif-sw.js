self.addEventListener('message', event => {
  const msg = event.data;

  if (!msg || msg.type !== 'NOTIFY') return;

  const { title, body, icon, tag, data } = msg.payload || {};

  self.registration.showNotification(title || 'Quilix', {
    body,
    icon: icon || '/assets/icons/web-app-manifest-192x192.png',
    badge: '/assets/icons/web-app-manifest-192x192.png',
    tag,
    data,
    renotify: true
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow(targetUrl);
      })
  );
});
