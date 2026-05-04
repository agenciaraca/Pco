import { useState } from 'react';
import { RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useErrorLog } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export default function AdminErros() {
  const { data, isLoading, isError, refetch, isFetching } = useErrorLog(500);
  const [openId, setOpenId] = useState<string | null>(null);
  const [source, setSource] = useState<'all' | 'client' | 'server'>('all');

  const filtered = (data ?? []).filter((e) => {
    if (source === 'client') return e.method === 'CLIENT';
    if (source === 'server') return e.method !== 'CLIENT';
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">Erros do servidor</h1>
          <p className="text-sm text-ink-muted">
            Erros não tratados capturados pelo backend e pelo client. Mantém os últimos 2.000.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | 'client' | 'server')}
            className="pco-input w-auto text-xs"
          >
            <option value="all">Todos ({data?.length ?? 0})</option>
            <option value="server">
              Servidor ({(data ?? []).filter((e) => e.method !== 'CLIENT').length})
            </option>
            <option value="client">
              Client ({(data ?? []).filter((e) => e.method === 'CLIENT').length})
            </option>
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            className="pco-btn-secondary text-xs"
            disabled={isFetching}
          >
            <RefreshCw size={12} strokeWidth={2} className={isFetching ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      {isLoading ? (
        <CardListSkeleton count={5} />
      ) : isError ? (
        <ErrorState
          action={
            <button onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum erro registrado"
          description="O servidor não capturou erros não tratados ainda."
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <ul className="divide-y divide-surface-mute">
            {filtered.map((e) => (
              <li key={e.id} className="p-3 hover:bg-surface-off">
                <button
                  type="button"
                  onClick={() => setOpenId((cur) => (cur === e.id ? null : e.id))}
                  className="w-full flex items-start gap-2 text-left"
                >
                  {openId === e.id ? (
                    <ChevronDown size={14} strokeWidth={2} className="mt-1 shrink-0 text-ink-muted" />
                  ) : (
                    <ChevronRight size={14} strokeWidth={2} className="mt-1 shrink-0 text-ink-muted" />
                  )}
                  <AlertTriangle
                    size={14}
                    strokeWidth={2}
                    className="mt-1 shrink-0 text-status-danger"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pco-deep break-all">
                        {e.message}
                      </span>
                      <span className="text-[11px] text-ink-muted">{formatTs(e.ts)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-muted flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        <code className="text-pco-blue">{e.method}</code> {e.path}
                      </span>
                      <span>status {e.status}</span>
                      {e.actorEmail && <span>por {e.actorEmail}</span>}
                      {e.ip && <span>ip {e.ip}</span>}
                    </div>
                  </div>
                </button>
                {openId === e.id && e.stack && (
                  <pre className="ml-5 mt-2 text-[11px] bg-surface-mute/40 rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap break-all">
                    {e.stack}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
