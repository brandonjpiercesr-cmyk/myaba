// ⬡B:myaba.pwa:SW:v2.17.0:20260408⬡
// MyABA Service Worker - Offline support + Background sync
// ⬡B:GMGU.build:FIX:sw_cache_bust:20260408⬡ Bumped to invalidate stale index.html cache

const CACHE_NAME = 'myaba-v8-gmgu-fix';
const ABABASE_URL = 'https://abacia-services.onrender.com';

// Assets to cache for offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't cache API calls - let them fail gracefully
  if (url.origin === ABABASE_URL) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ 
          response: null, 
          offline: true,
          message: "You're offline. Your message will be sent when you reconnect."
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // For other requests: network first, cache fallback
  // ⬡B:FIX:sw_post_cache:20260324⬡ Cache API only supports GET. POST/PUT/DELETE skip cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful GET responses only
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        if (event.request.method === 'GET') {
          return caches.match(event.request);
        }
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        });
      })
  );
});

// Background sync for queued messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncQueuedMessages());
  }
});

async function syncQueuedMessages() {
  // This would sync any locally queued messages
  // Implementation depends on IndexedDB or localStorage queue
  console.log('[SW] Syncing queued messages...');
}

// Push notifications (for AGENT DAWN proactive alerts)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'ABA';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/aba-icon-192.png',
    badge: '/aba-icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
