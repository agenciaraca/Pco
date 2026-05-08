// Helper de registro do service worker + detecção de updates.
//
// Uso:
//   import { registerServiceWorker } from './pwa/sw-register';
//   registerServiceWorker({
//     onUpdateAvailable: (waitingWorker) => {
//       // Mostra UI "Nova versao — atualizar agora"
//       // ao clicar: waitingWorker.postMessage({ type: 'SKIP_WAITING' })
//     },
//   });

export interface SwRegisterOptions {
  /** Chamado quando ha um SW novo aguardando ativacao. */
  onUpdateAvailable?: (waiting: ServiceWorker) => void;
  /** Chamado quando ocorre o controllerchange (nova versao ativada). */
  onControllerChange?: () => void;
  /** Caminho do sw.js (default '/sw.js'). */
  scriptUrl?: string;
}

export interface SwRegisterResult {
  registration: ServiceWorkerRegistration;
  /** Pede ao SW em waiting pra ativar imediatamente. */
  activatePending: () => void;
}

/**
 * Registra o service worker. Em browsers sem suporte, retorna null.
 * Em ambientes nao-window (test/SSR) tambem retorna null.
 */
export async function registerServiceWorker(
  opts: SwRegisterOptions = {},
): Promise<SwRegisterResult | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const scriptUrl = opts.scriptUrl ?? '/sw.js';
  const reg = await navigator.serviceWorker.register(scriptUrl);

  // Listener de updates
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        // Tem SW novo aguardando ativar (alem do que ja esta controlando)
        if (reg.waiting && opts.onUpdateAvailable) {
          opts.onUpdateAvailable(reg.waiting);
        }
      }
    });
  });

  // Reload quando novo SW assume controle
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    opts.onControllerChange?.();
  });

  return {
    registration: reg,
    activatePending: () => {
      const w = reg.waiting;
      if (w) w.postMessage({ type: 'SKIP_WAITING' });
    },
  };
}

/**
 * Helper pra UI: detecta SW em waiting no momento do call.
 * Util pra mostrar indicador inicial (caso pagina foi recarregada com SW
 * ja em waiting state).
 */
export async function checkForWaitingWorker(): Promise<ServiceWorker | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg?.waiting ?? null;
}
