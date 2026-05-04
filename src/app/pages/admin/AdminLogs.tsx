import { useState, useMemo } from 'react';
import {
  ScrollText,
  Search,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { useLogs } from '../../data/hooks';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { LogLevelDto } from '../../data/api';

const LEVEL_COLORS: Record<LogLevelDto, string> = {
  log: 'text-ink-muted',
  info: 'text-pco-blue',
  warn: 'text-pco-orange',
  error: 'text-status-danger',
  debug: 'text-ink-subtle',
};

export default function AdminLogs() {
  useDocumentMeta({ title: 'Logs do servidor — Admin' });
  const [level, setLevel] = useState<LogLevelDto | ''>('');
  const [q, setQ] = useState('');

  const filter = useMemo(
    () => ({
      level: level || undefined,
      q: q.trim() || undefined,
      limit: 500,
    }),
    [level, q],
  );

  const { data, isLoading, isFetching, refetch } = useLogs(filter);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <ScrollText size={20} className="text-pco-blue" strokeWidth={1.75} />
            Logs do servidor
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Últimas 5000 linhas de console capturadas em memória. Auto-refresh 5s.
            <br />
            Para retenção longa, use journalctl ou Sentry no servidor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="pco-btn-ghost text-xs"
        >
          <RefreshCw size={11} strokeWidth={2} className={isFetching ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar substring na mensagem..."
            className="pco-input pl-9 text-sm"
          />
        </div>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as LogLevelDto | '')}
          className="pco-input w-auto text-sm"
        >
          <option value="">Todos os níveis</option>
          <option value="log">log</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="debug">debug</option>
        </select>
      </div>

      <div className="text-xs text-ink-muted">
        {isLoading
          ? 'Carregando...'
          : `${data?.lines.length ?? 0} linha(s) — buffer total: ${data?.total ?? 0}`}
      </div>

      <div className="pco-card p-0 overflow-hidden">
        {(data?.lines ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-muted">Sem logs.</div>
        ) : (
          <ul className="divide-y divide-pco-border max-h-[70vh] overflow-y-auto font-mono text-[11px]">
            {(data?.lines ?? []).map((l, i) => (
              <li key={`${l.ts}-${i}`} className="px-3 py-1.5 flex gap-3 items-start">
                <span className="text-[10px] text-ink-subtle shrink-0 w-32">
                  {new Date(l.ts).toLocaleString('pt-BR', {
                    hour12: false,
                  })}
                </span>
                <span
                  className={`${LEVEL_COLORS[l.level]} shrink-0 w-12 uppercase font-semibold`}
                >
                  {l.level === 'error' ? (
                    <AlertCircle size={11} className="inline mr-0.5" />
                  ) : l.level === 'warn' ? (
                    <AlertTriangle size={11} className="inline mr-0.5" />
                  ) : l.level === 'info' ? (
                    <Info size={11} className="inline mr-0.5" />
                  ) : null}
                  {l.level}
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all text-pco-deep">
                  {l.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
