import { useState } from 'react';
import { Eye, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

/**
 * Banner permanente exibido enquanto admin está visualizando como aluno.
 * Aparece no topo de toda a app (acima de Topbar). Tem botão de "Sair" que
 * restaura a sessão original.
 */
export default function ImpersonationBanner() {
  const { impersonation, exitImpersonation } = useAuth();
  const [exiting, setExiting] = useState(false);

  if (!impersonation) return null;

  async function handleExit() {
    if (exiting) return;
    setExiting(true);
    try {
      await exitImpersonation();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[impersonation] exit failed:', err);
      setExiting(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-40 w-full bg-amber-500 text-amber-950 border-b border-amber-600 shadow-sm"
    >
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-2 flex flex-wrap items-center gap-3">
        <Eye size={16} strokeWidth={2} className="shrink-0" />
        <p className="text-sm font-medium flex-1 min-w-0">
          <span className="font-semibold">Visualizando como aluno:</span>{' '}
          <span className="truncate">{impersonation.target.email}</span>
          <span className="hidden sm:inline mx-2 opacity-60">•</span>
          <span className="block sm:inline text-xs opacity-80">
            sessão de admin: {impersonation.actor.email}
          </span>
        </p>
        <button
          type="button"
          onClick={handleExit}
          disabled={exiting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-50 transition-colors"
        >
          <LogOut size={14} strokeWidth={2} />
          {exiting ? 'Saindo…' : 'Sair desta visão'}
        </button>
      </div>
    </div>
  );
}
