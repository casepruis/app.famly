// --- bump version so the new SW takes over ---
const SW_VERSION = 'v9';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch {}

    const suppress = !!data.suppressIfOpen;
    let convoId = data.conversationId || null;

    if (!convoId && data.url) {
      try { convoId = new URL(data.url, self.location.origin).searchParams.get('id'); } catch {}
    }

    if (suppress && convoId) {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If any client already shows /chat?id=<same>, skip showing a system notification
      const alreadyOpen = clientsList.some(c => {
        try {
          const u = new URL(c.url);
          return u.pathname.replace(/\/+$/, '') === '/chat' &&
                 new URLSearchParams(u.search).get('id') === convoId;
        } catch { return false; }
      });
      if (alreadyOpen) return;  // 👈 suppress
    }

    // show the notification
    const opts = {
      body: data.body || '',
      tag: data.tag,                  // unique => never “only once”
      renotify: !!data.renotify,
      timestamp: data.timestamp,
      icon: data.icon,
      badge: data.badge,
      vibrate: data.vibrate,
      data: { url: data.url || '/' },
    };
    await self.registration.showNotification(data.title || 'Notification', opts);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification?.data?.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      try {
        const u = new URL(c.url);
        const t = new URL(targetUrl, self.location.origin);
        if (u.pathname === t.pathname && u.search === t.search) return c.focus();
      } catch {}
    }
    return self.clients.openWindow(targetUrl);
  })());
});
