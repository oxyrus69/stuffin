// HOPE Offline Service Worker — cache shell + template for offline processing
const CACHE = 'hope-v3';
const CORE = [
  '/',
  '/dashboard',
  '/login',
  '/akumulasi-template.xlsx',
  '/hope.svg',
  '/hopev2.svg',
  '/manifest.json',
  '/version.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Skip non-GET and API error-archive (let it fail to queue when offline)
  if (req.method !== 'GET') return;

  // version.json: network-only, never cache stale
  if (url.pathname === '/version.json') {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Template & static: cache-first
  if (url.pathname === '/akumulasi-template.xlsx' || url.pathname.endsWith('.svg') || url.pathname === '/manifest.json') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Navigation: network-first, fallback to cache, then offline shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('/dashboard') || caches.match('/')))
    );
    return;
  }

  // Other GET (next static, fonts): cache-first with network update
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && url.origin === location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => hit))
  );
});