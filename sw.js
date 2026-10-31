// Bump this version whenever any bundled application asset changes.
const CACHE = 'piano-pwa-v1';
const ROOTS = [21, ...Array.from({ length: 15 }, (_, i) => 24 + i * 6)];
const ASSETS = [
  './', './index.html', './style.css', './app.js', './model.js', './audio.js',
  './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  ...['piano', 'marimba', 'trumpet'].flatMap(instrument => ROOTS.map(root => `./assets/sounds/${instrument}/${root}.mp3`)),
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('piano-pwa-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match('./index.html');
    return fetch(event.request);
  })());
});
