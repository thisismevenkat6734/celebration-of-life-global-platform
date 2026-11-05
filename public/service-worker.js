const CACHE_NAME = 'col-app-shell-v2';

const APP_SHELL_URL = new URL('./', self.registration.scope).href;
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll([
        APP_SHELL_URL,
        OFFLINE_URL
      ]);
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith('col-') && name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Do not intercept external requests or authentication endpoints.
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.includes('/__/auth/') ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedPage = await caches.match(request);

        if (cachedPage) return cachedPage;

        const offlinePage = await caches.match(OFFLINE_URL);

        return offlinePage || new Response(
          'You are currently offline.',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
      })
    );

    return;
  }

  const appPath = new URL('./', self.registration.scope).pathname;

  if (url.pathname.startsWith(appPath)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return response;
        });
      })
    );
  }
});
