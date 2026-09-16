/**
 * Service Worker for FF-SHARING-COMMUNITY
 * Caches static shell assets for fast load and offline shell display.
 */

const CACHE_NAME = 'ff-sharing-cache-v1.0.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/post.html',
  '/admin.html',
  '/css/style.css',
  '/js/utils.js',
  '/js/app.js',
  '/js/post.js',
  '/js/admin.js',
  '/manifest.json',
  '/assets/favicon.svg'
];

// Install Event - Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for navigation and cache-first for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Do NOT cache Netlify functions or dynamic API requests
  if (url.pathname.startsWith('/.netlify/functions') || url.pathname.startsWith('/api')) {
    return;
  }

  // Non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an HTML page, return cached index or post.html
          if (request.headers.get('accept')?.includes('text/html')) {
            return cachedResponse || caches.match('/index.html');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
