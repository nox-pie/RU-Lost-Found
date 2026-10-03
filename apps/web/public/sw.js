/*
 * Service worker: makes the app installable and gives it an offline page.
 *
 * Deliberately small. It never touches the API (/api/...), and never serves a cached page, so a
 * new deploy is always picked up. Only the build's hashed files (/assets/..., which never change
 * under the same name) are kept, so repeat visits start faster.
 */
const ASSETS = 'assets-v1';
const SHELL = 'shell-v1';
const OFFLINE_PAGE = '/offline.html';
const MAX_ASSETS = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_PAGE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => ![ASSETS, SHELL].includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Always the network (fresh deploys); the offline page only when there is none.
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCacheOrNetwork(request));
  }
});

async function fromCacheOrNetwork(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    // Old deploys' files pile up otherwise; the oldest go first.
    await Promise.all(
      keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)),
    );
  }
  return response;
}
