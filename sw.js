const CACHE_NAME = 'maviko-app-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://i.ibb.co/ymDcp5tf/logo.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Las consultas a Google Sheets y APIs de tasa cambian en tiempo real, van siempre por red
  if (e.request.url.includes('google') || e.request.url.includes('dolarvzla')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
