// Banner discreto que oferece instalar o PWA. So aparece em browsers
// que disparam beforeinstallprompt (Chrome/Edge/Opera). Persiste dismiss
// por 14 dias.

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  isAvailable,
  markDismissed,
  promptInstall,
  subscribe,
  watchInstallPrompt,
} from '../pwa/install-prompt';

export default function PwaInstallBanner() {
  const [available, setAvailable] = useState(isAvailable());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = watchInstallPrompt();
    const unsub = subscribe(setAvailable);
    return () => {
      stop();
      unsub();
    };
  }, []);

  if (!available) return null;

  return (
    <div
      role="region"
      aria-label="Instalar AVA PCO"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pco-blue/20 bg-white shadow-lg p-3 sm:p-4 flex items-center gap-3"
    >
      <Download className="text-pco-blue shrink-0" size={18} strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-pco-deep">
          Instalar AVA PCO
        </p>
        <p className="text-xs text-ink-muted truncate">
          Acesse mais rapido pela tela inicial.
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          await promptInstall();
          setBusy(false);
        }}
        disabled={busy}
        className="pco-btn-primary text-xs disabled:opacity-50 shrink-0"
      >
        {busy ? '...' : 'Instalar'}
      </button>
      <button
        type="button"
        onClick={() => {
          markDismissed();
          setAvailable(false);
        }}
        className="text-ink-subtle hover:text-pco-deep p-1 shrink-0"
        aria-label="Dispensar"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
