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

export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    if (!e.message) return;
    send({ message: e.message, stack: e.error?.stack ?? null });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'unhandled rejection';
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
