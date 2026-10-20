/*
 * A minimal service worker for the standalone web build.
 *
 * The app is local-first: the timer, the task queue, the history and the
 * preferences all live in localStorage, so the only thing that has to come
 * from the network is the shell itself. That makes the caching strategy
 * simple and safe:
 *
 *  - navigations are served from the cache, and fall back to the network
 *    so a first visit still works;
 *  - static assets are cached as they are fetched, and served from the
 *    cache when the network is gone.
 *
 * A timer is a poor companion for a disconnected laptop, and this is what
 * makes the app installable and usable offline.
 */

const CACHE_NAME = 'pomodoro-v1';

/** The shell that must be available for the app to start at all. */
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      // A failed precache must not stop the worker from installing: the
      // runtime cache will fill the gap as the user visits the pages.
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only the app's own origin is cached. A cross-origin request is left to
  // the network, so the worker never interferes with anything else.
  if (url.origin !== self.location.origin) {
    return;
  }

  // A navigation is answered from the cache first, so the app opens
  // offline. The network is tried in the background to refresh the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached ?? network;
      }),
    );
    return;
  }

  // Everything else is cache-first, and is written to the cache as it is
  // fetched. The hashed asset names change on every build, so a stale
  // entry can never be served in place of a new one.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
