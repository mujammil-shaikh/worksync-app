const CACHE_NAME = 'worksync-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://placehold.co/192x192/2563eb/ffffff.png?text=WS',
  'https://placehold.co/512x512/2563eb/ffffff.png?text=WS'
];

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Failed to cache some assets', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - claim clients to control them immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event - Network first strategy (best for dev/dynamic content), fall back to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});