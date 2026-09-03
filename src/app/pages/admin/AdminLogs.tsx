import { useState, useMemo } from 'react';
import {
  ScrollText,
  Search,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Download,
  Pause,
  Play,
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
  useDocumentMeta({ title: 'Logs — Admin' });
  const [level, setLevel] = useState<LogLevelDto | ''>('');
  const [q, setQ] = useState('');
  const [paused, setPaused] = useState(false);

  const filter = useMemo(
    () => ({
      level: level || undefined,
      q: q.trim() || undefined,
      limit: 500,
    }),
    [level, q],
  );

  const { data, isLoading, isFetching, refetch } = useLogs(filter, {
    refetchInterval: paused ? false : 5_000,
  });

  const counters = useMemo(() => {
    const lines = data?.lines ?? [];
    const c: Record<LogLevelDto, number> = {
      log: 0,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };
    for (const l of lines) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [data]);

  function downloadLogs() {
    const lines = data?.lines ?? [];
    const txt = lines
      .map(
        (l) =>
          `${l.ts}\t${l.level.padEnd(6)}\t${l.message.replace(/\n/g, ' \\ ')}`,
      )
      .join('\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ava-pco-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <ScrollText size={20} className="text-pco-blue" strokeWidth={1.75} />
            Logs
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Últimas 5000 linhas de console capturadas em memória. Auto-refresh 5s.
            <br />
            Para retenção longa, use journalctl ou Sentry no servidor.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={`text-xs ${paused ? 'pco-btn-primary' : 'pco-btn-ghost'}`}
            title={paused ? 'Auto-refresh pausado — clique pra retomar' : 'Pausar auto-refresh'}
          >
            {paused ? (
              <>
                <Play size={11} strokeWidth={2} />
                Pausado
              </>
            ) : (
              <>
                <Pause size={11} strokeWidth={2} />
                Pausar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={downloadLogs}
            disabled={(data?.lines.length ?? 0) === 0}
            className="pco-btn-ghost text-xs"
            title="Baixar logs filtrados como .log"
          >
            <Download size={11} strokeWidth={2} />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="pco-btn-ghost text-xs"
          >
            <RefreshCw size={11} strokeWidth={2} className={isFetching ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-5">
        {(['error', 'warn', 'info', 'log', 'debug'] as LogLevelDto[]).map(
          (lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevel(level === lvl ? '' : lvl)}
              className={`pco-card p-3 text-left hover:bg-surface-mute/50 transition-colors ${
                level === lvl ? 'ring-2 ring-pco-blue border-pco-blue' : ''
              }`}
            >
              <div className={`text-xs uppercase font-bold ${LEVEL_COLORS[lvl]}`}>
                {lvl}
              </div>
              <div className="text-2xl font-bold text-pco-deep mt-1">
                {counters[lvl]}
              </div>
            </button>
          ),
        )}
      </div>

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
          <ul className="divide-y divide-pco-border max-h-[70vh] overflow-y-auto font-mono text-xs">
            {(data?.lines ?? []).map((l, i) => (
              <li key={`${l.ts}-${i}`} className="px-3 py-1.5 flex gap-3 items-start">
                <span className="text-xs text-ink-subtle shrink-0 w-32">
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
