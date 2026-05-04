import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useImportJob } from '../../../data/hooks';
import { useDocumentMeta } from '../../../hooks/useDocumentMeta';

export default function ImportJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useImportJob(id);
  useDocumentMeta({ title: data?.id ? `${data.id} — Imports` : 'Import job' });

  if (isLoading || !data) {
    return (
      <div className="pco-card p-6 flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 size={16} className="animate-spin" />
        Carregando job...
      </div>
    );
  }

  const totalProcessed =
    data.stats.valid + data.stats.invalid + data.stats.created + data.stats.updated;
  const progress =
    data.stats.totalRead > 0
      ? Math.min(100, Math.round((totalProcessed / data.stats.totalRead) * 100))
      : 0;

  const isRunning = data.status === 'running' || data.status === 'pending';

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/admin/imports"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-1">Importação {data.id}</h1>
        <div className="text-xs text-ink-muted mt-1">
          {data.source} · {data.mode} · {data.dryRun ? 'dry-run' : 'execução real'} ·{' '}
          iniciada por {data.startedBy} em{' '}
          {new Date(data.startedAt).toLocaleString('pt-BR')}
          {data.finishedAt && (
            <> · finalizada em {new Date(data.finishedAt).toLocaleString('pt-BR')}</>
          )}
        </div>
      </header>

      <div className="pco-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-pco-deep">Status</h3>
          <StatusBadge status={data.status} />
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-pco-blue">
            <Loader2 size={12} className="animate-spin" />
            Atualizando a cada 2s...
          </div>
        )}
        <div className="mt-3 h-2 rounded-full bg-surface-gray overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-ink-subtle">
          {data.stats.totalRead} lidos · {progress}% processado · {data.stats.durationMs}ms
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Lidos" value={data.stats.totalRead} icon={<Clock size={12} />} />
        <Stat
          label="Válidos"
          value={data.stats.valid}
          icon={<CheckCircle2 size={12} />}
          color="text-status-success"
        />
        <Stat
          label="Inválidos"
          value={data.stats.invalid}
          icon={<AlertTriangle size={12} />}
          color="text-pco-orange"
        />
        <Stat label="Criados" value={data.stats.created} color="text-pco-blue" />
        <Stat label="Atualizados" value={data.stats.updated} color="text-pco-cyan" />
        <Stat
          label="Erros"
          value={data.stats.errors}
          icon={<AlertCircle size={12} />}
          color="text-status-danger"
        />
      </div>

      {Object.keys(data.perEntity).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-pco-deep mb-2">Por entidade</h3>
          <div className="pco-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Entidade</th>
                  <th className="text-left px-3 py-2 font-medium">Lidos</th>
                  <th className="text-left px-3 py-2 font-medium">Válidos</th>
                  <th className="text-left px-3 py-2 font-medium">Inválidos</th>
                  <th className="text-left px-3 py-2 font-medium">Criados</th>
                  <th className="text-left px-3 py-2 font-medium">Atualizados</th>
                  <th className="text-left px-3 py-2 font-medium">Ignorados</th>
                  <th className="text-left px-3 py-2 font-medium">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {Object.entries(data.perEntity).map(([entity, stats]) => {
                  const s = stats as Record<string, number>;
                  return (
                    <tr key={entity} className="hover:bg-surface-mute/40">
                      <td className="px-3 py-2 font-semibold text-pco-deep">{entity}</td>
                      <td className="px-3 py-2">{s.read ?? 0}</td>
                      <td className="px-3 py-2 text-status-success">{s.valid ?? 0}</td>
                      <td className="px-3 py-2 text-pco-orange">{s.invalid ?? 0}</td>
                      <td className="px-3 py-2 text-pco-blue">{s.created ?? 0}</td>
                      <td className="px-3 py-2 text-pco-cyan">{s.updated ?? 0}</td>
                      <td className="px-3 py-2 text-ink-muted">{s.ignored ?? 0}</td>
                      <td className="px-3 py-2 text-status-danger">{s.errors ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.notes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-pco-deep mb-2">Logs</h3>
          <div className="pco-card p-3 max-h-60 overflow-auto font-mono text-[11px] space-y-0.5">
            {data.notes.map((n, i) => (
              <div
                key={i}
                className={
                  n.level === 'error'
                    ? 'text-status-danger'
                    : n.level === 'warn'
                      ? 'text-pco-orange'
                      : 'text-ink-muted'
                }
              >
                <span className="text-ink-subtle">
                  [{new Date(n.ts).toLocaleTimeString('pt-BR')}]
                </span>{' '}
                {n.message}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.errorsLog.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-pco-deep mb-2">
            Erros ({data.errorsLog.length})
          </h3>
          <div className="pco-card overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Linha</th>
                  <th className="text-left px-3 py-2 font-medium">Entidade</th>
                  <th className="text-left px-3 py-2 font-medium">Campo</th>
                  <th className="text-left px-3 py-2 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {data.errorsLog.map((err, i) => (
                  <tr key={i} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 text-ink-muted">{err.rowIndex}</td>
                    <td className="px-3 py-2 text-pco-deep font-semibold">{err.entity}</td>
                    <td className="px-3 py-2 text-ink-muted">{err.field ?? '—'}</td>
                    <td className="px-3 py-2 text-status-danger">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color = 'text-pco-deep',
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="pco-card p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-surface-gray text-ink-muted',
    running: 'bg-pco-blue/10 text-pco-blue',
    completed: 'bg-status-success/10 text-status-success',
    completed_with_errors: 'bg-pco-orange/10 text-pco-orange',
    failed: 'bg-status-danger/15 text-status-danger',
    canceled: 'bg-surface-gray text-ink-muted',
    rolled_back: 'bg-pco-cyan/15 text-pco-cyan',
  };
  return (
    <span className={`pco-badge ${map[status] ?? 'bg-surface-gray text-ink-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
