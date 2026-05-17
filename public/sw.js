// AVA PCO — Service worker (v3 — sprint 553).
// Estratégias:
// - /assets/* (Vite hash-versioned) → stale-while-revalidate
// - /api/v1/courses + /api/v1/me/* GET → SWR com TTL curto (offline browse)
// - /api/* (mutations + auth) → SEMPRE network. Sem cache.
// - Navegações HTML → network-only com fallback offline.html.
// - Outros (fonts/imgs públicas) → cache-first.
// - Push notifications: showNotification + click → focus/open URL.
// - Update flow: postMessage SKIP_WAITING + 'controllerchange' no client.

const VERSION = 'avapco-v4-pwa';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const CORE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icone-pco.png',
  '/logo-pco-dark.png',
];

// Endpoints GET seguros pra cachear curtinho (5 min) e servir offline.
const API_CACHEABLE_PATTERNS = [
  /^\/api\/v1\/courses(?:\/[^/]+)?$/,
  /^\/api\/me\/notes$/,
  /^\/api\/me\/heatmap$/,
  /^\/api\/health$/,
];
const API_CACHE_TTL_MS = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // API endpoints permitidos: SWR com TTL.
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHEABLE_PATTERNS.some((p) => p.test(url.pathname))) {
      event.respondWith(swrApi(req));
    }
    // outros /api/* — passa direto pro network sem cache.
    return;
  }

  // Assets versionados → stale-while-revalidate
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // Uploads (capas de curso, logos de certificado) → cache-first
  // (imutáveis: filename inclui hash). Permite UI instantânea offline.
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Navegação HTML → network-only com fallback offline.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/offline.html').then(
          (o) =>
            o ??
            new Response('Sem conexão.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
      ),
    );
    return;
  }

  // Outros (fonts, imagens públicas) → cache-first
  event.respondWith(cacheFirst(req, RUNTIME_CACHE));
});

// ---------- Strategies ----------

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetchPromise;
    }),
  );
}

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

/**
 * SWR para API: aceita TTL via header X-SW-Cached-At pra invalidar cache antigo.
 * Se rede falhar, cai pro cached mesmo que expirado (best-effort offline).
 */
function swrApi(req) {
  return caches.open(API_CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const cachedAt = cached?.headers.get('X-SW-Cached-At');
      const fresh =
        cachedAt && Date.now() - Number(cachedAt) < API_CACHE_TTL_MS;
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            // Clone + injeta header de timestamp pra TTL.
            const copy = res.clone();
            copy.headers; // no-op — Response headers são read-only
            const wrapped = new Response(copy.body, {
              status: copy.status,
              statusText: copy.statusText,
              headers: new Headers([
                ...copy.headers.entries(),
                ['X-SW-Cached-At', String(Date.now())],
              ]),
            });
            cache.put(req, wrapped.clone()).catch(() => {});
            return res;
          }
          return res;
        })
        .catch(() => cached || Response.error());
      // Se cache fresh, serve já. Se velho ou ausente, espera rede.
      return fresh ? cached : cached || fetchPromise;
    }),
  );
}

// ---------- Push Notifications ----------

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'AVA PCO', body: event.data.text() };
  }
  const title = payload.title || 'AVA PCO';
  const options = {
    body: payload.body || '',
    icon: '/icone-pco.png',
    badge: '/icone-pco.png',
    tag: payload.tag || 'avapco-default',
    data: { url: payload.url || '/' },
    requireInteraction: !!payload.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se já tem janela aberta, foca + navega
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate?.(url);
            return client.focus();
          }
        }
        // Senão, abre nova janela
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
