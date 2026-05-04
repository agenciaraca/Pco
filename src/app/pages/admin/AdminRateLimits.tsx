import { useState } from 'react';
import {
  Gauge,
  AlertTriangle,
  Globe,
  Network,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useRateLimitSummary } from '../../data/hooks';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

const WINDOWS = [
  { ms: 60 * 60_000, label: '1h' },
  { ms: 6 * 60 * 60_000, label: '6h' },
  { ms: 24 * 60 * 60_000, label: '24h' },
  { ms: 7 * 24 * 60 * 60_000, label: '7 dias' },
];

export default function AdminRateLimits() {
  useDocumentMeta({ title: 'Rate limits — Admin' });
  const [windowMs, setWindowMs] = useState(24 * 60 * 60_000);
  const { data, isLoading, isFetching, refetch } = useRateLimitSummary(windowMs);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Gauge size={20} className="text-pco-blue" strokeWidth={1.75} />
            Rate limits
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Hits por endpoint, IPs com mais requisições, e bloqueios 429. Buffer
            in-memory de até 10k hits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={windowMs}
            onChange={(e) => setWindowMs(Number(e.target.value))}
            className="pco-input w-auto text-sm"
          >
            {WINDOWS.map((w) => (
              <option key={w.ms} value={w.ms}>
                Janela: {w.label}
              </option>
            ))}
          </select>
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

      {isLoading || !data ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total de hits"
              value={data.totalHits.toLocaleString('pt-BR')}
              icon={<Network size={14} className="text-pco-blue" />}
            />
            <StatCard
              label="Bloqueados (429)"
              value={data.blockedCount.toLocaleString('pt-BR')}
              icon={<AlertTriangle size={14} className="text-status-danger" />}
              accent={data.blockedCount > 0 ? 'text-status-danger' : undefined}
            />
            <StatCard
              label="% bloqueio"
              value={
                data.totalHits === 0
                  ? '0%'
                  : `${((data.blockedCount / data.totalHits) * 100).toFixed(1)}%`
              }
              icon={<Gauge size={14} className="text-pco-orange" />}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section>
              <h2 className="text-sm font-semibold text-pco-deep mb-2 flex items-center gap-2">
                <Globe size={14} className="text-pco-blue" />
                Top IPs
              </h2>
              <Table
                rows={data.topIps.map((r) => ({
                  primary: r.ip,
                  count: r.count,
                  blocked: r.blocked,
                }))}
                primaryLabel="IP"
              />
            </section>
            <section>
              <h2 className="text-sm font-semibold text-pco-deep mb-2 flex items-center gap-2">
                <Network size={14} className="text-pco-blue" />
                Top endpoints
              </h2>
              <Table
                rows={data.topPaths.map((r) => ({
                  primary: r.path,
                  count: r.count,
                  blocked: r.blocked,
                }))}
                primaryLabel="Endpoint"
              />
            </section>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-pco-deep mb-2 flex items-center gap-2">
              <Clock size={14} className="text-pco-orange" />
              Bloqueios recentes
            </h2>
            {data.recentBlocks.length === 0 ? (
              <div className="pco-card p-6 text-center text-sm text-ink-muted">
                Nenhum bloqueio na janela selecionada.
              </div>
            ) : (
              <div className="pco-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-mute text-ink-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Quando</th>
                      <th className="text-left px-3 py-2">IP</th>
                      <th className="text-left px-3 py-2">Método</th>
                      <th className="text-left px-3 py-2">Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-mute">
                    {data.recentBlocks.map((b, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                          {new Date(b.ts).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 font-mono">{b.ip}</td>
                        <td className="px-3 py-2 text-ink-muted">{b.method}</td>
                        <td className="px-3 py-2 font-mono">{b.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase text-ink-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? 'text-pco-deep'}`}>{value}</div>
    </div>
  );
}

function Table({
  rows,
  primaryLabel,
}: {
  rows: Array<{ primary: string; count: number; blocked: number }>;
  primaryLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="pco-card p-6 text-center text-xs text-ink-muted">Sem dados.</div>
    );
  }
  const max = rows[0]?.count ?? 1;
  return (
    <div className="pco-card overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-surface-mute text-ink-muted">
          <tr>
            <th className="text-left px-3 py-2">{primaryLabel}</th>
            <th className="text-right px-3 py-2">Hits</th>
            <th className="text-right px-3 py-2">429</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-mute">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-3 py-2 font-mono truncate max-w-[280px]" title={r.primary}>
                {r.primary}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex items-center gap-2">
                  <div className="h-1.5 w-16 bg-surface-gray rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pco-blue"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                  <span>{r.count}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                {r.blocked > 0 ? (
                  <span className="text-status-danger">{r.blocked}</span>
                ) : (
                  <span className="text-ink-subtle">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
