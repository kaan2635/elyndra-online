// Elyndra Online service worker: offline play + fast loads.
// Same-origin files: network-first (updates show up immediately) with cache fallback for offline play.
// Web fonts: cache-first.
const CACHE = 'elyndra-v2';
const CORE = ['./', './index.html', './css/style.css', './js/main.js', './lib/three.module.min.js', './lib/three.core.min.js', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  if (!sameOrigin && !fonts) return; // P2P relays etc. are never cached
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (fonts) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(req)) || fetch(req).then(res => { c.put(req, res.clone()); return res; })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
