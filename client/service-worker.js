/**
 * SARTHI — PWA Service Worker (App Shell Cache)
 * Version: 2.1.0
 * 
 * Scope & Limitations:
 * - Caches static application shell assets (CSS, JS, icons) for fast repeat loads.
 * - API requests (/api/*) and data mutations (POST, PUT, DELETE) always bypass the cache
 *   and require active connectivity. Offline mutation queueing is not supported.
 */

const CACHE_NAME = 'sarthi-shell-v2.1';
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/assets/css/variables.css',
  '/assets/css/reset.css',
  '/assets/css/typography.css',
  '/assets/css/components.css',
  '/assets/css/layout.css',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/nav.js',
  '/assets/js/toast.js',
  '/assets/js/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Safe asset caching with individual fallbacks
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SARTHI ServiceWorker] Could not pre-cache asset: ${asset}`, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  // Only intercept static GET requests; never cache API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('/'));
    })
  );
});
