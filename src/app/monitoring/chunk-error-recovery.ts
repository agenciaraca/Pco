// Recuperação automática de "Failed to fetch dynamically imported module".
//
// Causa: deploy nova substitui dist/assets/<page>-<hash>.js. Tabs antigas
// abertas no navegador têm o HTML cacheado apontando pra hashes velhos.
// Ao navegar pra rota lazy, fetch retorna 404, React quebra com Error.
//
// Solução: detectar o padrão da mensagem e fazer location.reload() uma vez
// por sessão (sessionStorage flag) — segura contra infinite loop. Reload
// pega index.html novo (não-cacheado pelo CSP/server), que aponta pra
// hashes atuais.

const RELOAD_FLAG = 'ava-chunk-reload-attempted';
const RELOAD_COOLDOWN_MS = 30_000; // só re-tenta após 30s pra evitar loop

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  let msg = '';
  if (reason instanceof Error) msg = reason.message;
  else if (typeof reason === 'string') msg = reason;
  else if (typeof reason === 'object' && reason && 'message' in reason) {
    msg = String((reason as { message: unknown }).message ?? '');
  }
  if (!msg) return false;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') || // padrão webpack/older bundlers
    msg.includes('Loading CSS chunk')
  );
}

function attemptReload(reason: unknown): void {
  // Anti-loop: se já tentamos recentemente, deixa o erro propagar pra UI
  // mostrar a tela de erro normal (RootError com botão "recarregar").
  try {
    const lastAttemptStr = sessionStorage.getItem(RELOAD_FLAG);
    const last = lastAttemptStr ? Number(lastAttemptStr) : 0;
    if (Date.now() - last < RELOAD_COOLDOWN_MS) {
      // eslint-disable-next-line no-console
      console.warn('[chunk-recovery] reload já tentado recentemente, ignorando.', reason);
      return;
    }
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage indisponível (modo privado etc.) — segue mesmo assim
  }
  // eslint-disable-next-line no-console
  console.info('[chunk-recovery] novo deploy detectado, recarregando…');
  location.reload();
}

export function installChunkErrorRecovery(): void {
  // 1) Promises rejeitadas (lazy import falhou em React.lazy)
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault?.();
      attemptReload(event.reason);
    }
  });

  // 2) Erros síncronos durante carregamento de <script type="module">
  window.addEventListener('error', (event) => {
    // event.error pode ser null pra erros de script load — usa message
    if (
      event.message &&
      isChunkLoadError({ message: event.message })
    ) {
      event.preventDefault?.();
      attemptReload(event.message);
    }
  });
}

/** Test-only helper. */
export const _internal = { isChunkLoadError };
