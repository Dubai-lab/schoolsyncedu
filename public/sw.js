// SchoolSync School Site Service Worker
// Only registered on /school/* pages — not on the main SchoolSync app.

const CACHE = 'school-site-v2';
const STATIC_ASSETS = ['/', '/index.html'];

// Supabase storage origin for school images
const SUPABASE_STORAGE_HOST = 'supabase.co';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Navigation — network first, fall back to shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Supabase Storage images — stale-while-revalidate so logos/photos
  // load instantly from cache while a fresh copy is fetched in the background.
  if (url.hostname.includes(SUPABASE_STORAGE_HOST) && url.pathname.includes('/storage/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached);
        // Return cached immediately if available; otherwise wait for network
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // Same-origin static assets (JS, CSS, fonts, icons) — cache first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Everything else — network only (Supabase API calls, analytics, etc.)
  e.respondWith(fetch(e.request));
});
