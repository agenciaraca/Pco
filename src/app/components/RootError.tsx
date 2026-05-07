import { useEffect } from 'react';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, Home, LogIn, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const RELOAD_FLAG = 'ava-chunk-reload-attempted';
const RELOAD_COOLDOWN_MS = 30_000;

function isChunkLoadError(msg: string): boolean {
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

export default function RootError() {
  const error = useRouteError();
  const { user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  let title = 'Algo deu errado';
  let message = 'Ocorreu um erro inesperado nesta página.';
  let isChunkErr = false;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Página não encontrada';
      message = 'A rota que você acessou não existe ou foi movida.';
    } else {
      title = `${error.status} ${error.statusText}`;
      message = error.data?.message ?? message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    isChunkErr = isChunkLoadError(error.message);
  }

  // Auto-reload uma vez por sessão pra erros de chunk-loading (deploy novo
  // invalidou os hashes dos assets que a tab antiga ainda referencia).
  useEffect(() => {
    if (!isChunkErr) return;
    let alreadyTried = false;
    try {
      const lastStr = sessionStorage.getItem(RELOAD_FLAG);
      const last = lastStr ? Number(lastStr) : 0;
      if (Date.now() - last < RELOAD_COOLDOWN_MS) {
        alreadyTried = true;
      } else {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      }
    } catch {
      // sessionStorage indisponível — segue o reload mesmo assim
    }
    if (!alreadyTried) {
      setTimeout(() => location.reload(), 800);
    }
  }, [isChunkErr]);

  if (isChunkErr) {
    title = 'Atualização disponível';
    message = 'O AVA foi atualizado. Recarregando automaticamente…';
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-surface-off">
      <div className="max-w-md text-center">
        <div
          className={`mx-auto mb-6 h-14 w-14 rounded-2xl grid place-items-center ${
            isChunkErr ? 'bg-pco-blue/10' : 'bg-pco-orange/10'
          }`}
        >
          {isChunkErr ? (
            <RefreshCw className="text-pco-blue animate-spin" size={28} strokeWidth={1.75} />
          ) : (
            <AlertTriangle className="text-pco-orange" size={28} strokeWidth={1.75} />
          )}
        </div>
        <h1 className="text-2xl font-semibold text-pco-deep mb-2">{title}</h1>
        <p className="text-sm text-ink-muted mb-8">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => location.reload()}
            className="pco-btn-secondary text-xs"
          >
            <RefreshCw size={14} strokeWidth={2} />
            Recarregar página
          </button>
          {!user && (
            <Link to="/login" className="pco-btn-primary inline-flex">
              <LogIn size={14} strokeWidth={2} />
              Entrar
            </Link>
          )}
          {user && isAdmin && (
            <Link to="/admin/dashboard" className="pco-btn-primary inline-flex">
              <ShieldCheck size={14} strokeWidth={2} />
              Painel admin
            </Link>
          )}
          {user && !isAdmin && (
            <Link to="/dashboard" className="pco-btn-primary inline-flex">
              <Home size={14} strokeWidth={2} />
              Voltar ao início
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
