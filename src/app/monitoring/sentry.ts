// Stub de monitoramento. Quando VITE_SENTRY_DSN for definido em build,
// inicializa Sentry. Caso contrário, fallback no console.
//
// Para habilitar:
// 1. npm install @sentry/react
// 2. Defina VITE_SENTRY_DSN no .env (ou nas envs do Vercel)
// 3. Descomente o bloco initSentry abaixo

// Captura erros não tratados do client e envia ao backend (/api/client-errors).
// Persiste em data/errors.json — visível em /admin/erros.

let initialized = false;

const STORAGE_KEY = 'ava-pco-auth';

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

const RECENT_HASHES = new Set<string>();

function hashOf(message: string, stack?: string | null): string {
  return `${message}|${(stack ?? '').slice(0, 200)}`;
}

function send(payload: { message: string; stack?: string | null; path?: string }) {
  const key = hashOf(payload.message, payload.stack);
  if (RECENT_HASHES.has(key)) return; // dedupe simples
  RECENT_HASHES.add(key);
  setTimeout(() => RECENT_HASHES.delete(key), 60_000);

  const token = getToken();
  fetch('/api/client-errors', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: payload.message,
      stack: payload.stack ?? null,
      path: payload.path ?? location.pathname,
      userAgent: navigator.userAgent,
    }),
    credentials: 'include',
  }).catch(() => {
    // Silently ignora — não vai criar feedback loop de erro
  });
}

// Detecta erros de chunk antigo após deploy e força reload uma vez (auto-healing)
const RELOAD_FLAG = 'ava-pco:chunk-reload-attempted';

function isStaleChunkError(message: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    // Chrome quando chunk retorna HTML em vez de JS (MIME mismatch + nosniff)
    /Failed to load module script/i.test(message) ||
    /expected a JavaScript module/i.test(message) ||
    /strict MIME type checking is enabled/i.test(message) ||
    // Firefox equivalente
    /Loading module from .* was blocked/i.test(message)
  );
}

function tryAutoReload(message: string): boolean {
  if (!isStaleChunkError(message)) return false;
  try {
    const flag = sessionStorage.getItem(RELOAD_FLAG);
    if (flag) return false; // já tentou nesta sessão; evita loop
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // sessionStorage indisponível — ainda assim tenta
  }
  // Hard reload bypassando cache
  location.reload();
  return true;
}

export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined') return;

  // Limpa flag em load bem-sucedido
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignora
  }

  window.addEventListener('error', (e) => {
    if (!e.message) return;
    if (tryAutoReload(e.message)) return;
    send({ message: e.message, stack: e.error?.stack ?? null });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'unhandled rejection';
    if (tryAutoReload(message)) return;
    send({ message, stack: reason instanceof Error ? reason.stack : null });
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;
  send({ message: `[reported] ${message}`, stack, path: location.pathname });
  // eslint-disable-next-line no-console
  console.error('[error]', error, context);
}
