// AVA PCO — Service worker mínimo.
// Estratégia:
// - assets versionados (JS/CSS/imagens em /assets/*) → cache-first com cache versionado.
// - navegações HTML → network-first com fallback para offline.html.
// - /api/* → SEMPRE network. Não cacheia.

const VERSION = 'avapco-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const CORE = ['/', '/offline.html', '/manifest.webmanifest', '/icone-pco.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // /api/* — sempre network, sem cache (privacidade + frescor)
  if (url.pathname.startsWith('/api/')) return;

  // Assets versionados (Vite gera /assets/<hash>.js etc)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Navegação (HTML) → network-first com fallback offline
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) =>
              cached ||
              caches.match('/offline.html').then(
                (o) =>
                  o ??
                  new Response('Sem conexão.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' },
                  }),
              ),
          ),
        ),
    );
    return;
  }

  // Outros (favicon, fontes, etc)
  event.respondWith(cacheFirst(req, RUNTIME_CACHE));
});

function cacheFirst(req, cacheName) {
  return caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    });
  });
}
