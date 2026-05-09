// Helper pra capturar o evento beforeinstallprompt e expor um trigger
// imperativo. Funciona em browsers Chromium (Chrome/Edge/Opera) — Safari
// e Firefox nao disparam o evento mas tem PWA install via UI nativa.
//
// Persiste 'dismissed' em localStorage pra nao perturbar o usuario que
// disse nao. Reseta apos 14 dias.

const DISMISS_KEY = 'ava-pco-pwa-install-dismissed';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let cachedEvent: BeforeInstallPromptEvent | null = null;
let listeners: Array<(available: boolean) => void> = [];

function notify(available: boolean): void {
  for (const cb of listeners) cb(available);
}

/** Le timestamp do dismiss e checa TTL. */
export function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > DISMISS_TTL_MS) {
      window.localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage indisponivel
  }
}

/** Detecta se o app ja esta rodando standalone (instalado). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }
  return false;
}

/** Registra listener global para capturar o evento. Idempotente. */
export function watchInstallPrompt(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    e.preventDefault();
    cachedEvent = e as BeforeInstallPromptEvent;
    notify(true);
  };
  const installedHandler = () => {
    cachedEvent = null;
    notify(false);
  };
  window.addEventListener('beforeinstallprompt', handler);
  window.addEventListener('appinstalled', installedHandler);
  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
    window.removeEventListener('appinstalled', installedHandler);
  };
}

export function isAvailable(): boolean {
  return cachedEvent !== null && !isStandalone() && !isDismissed();
}

/** Subscreve mudancas. Retorna unsubscribe. */
export function subscribe(cb: (available: boolean) => void): () => void {
  listeners.push(cb);
  // Trigger sincrono pro caller saber estado atual.
  cb(isAvailable());
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

/** Triggera o prompt nativo. Resolve com 'accepted' | 'dismissed'. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!cachedEvent) return 'unavailable';
  try {
    await cachedEvent.prompt();
    const { outcome } = await cachedEvent.userChoice;
    cachedEvent = null;
    notify(false);
    if (outcome === 'dismissed') markDismissed();
    return outcome;
  } catch {
    return 'unavailable';
  }
}

/** Reset cache (apenas para tests). */
export function _resetForTesting(): void {
  cachedEvent = null;
  listeners = [];
}
