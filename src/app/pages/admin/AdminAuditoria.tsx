import { useMemo, useState } from 'react';
import {
  Filter,
  Search,
  RefreshCw,
  ShieldCheck,
  UserCog,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { useAuditLog } from '../../data/hooks';
import { downloadAuditLogCsv } from '../../data/api';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import type { AuditEntryDto, AuditFilter } from '../../data/api';

const roleIcon: Record<string, React.ReactNode> = {
  superadmin: <ShieldCheck size={12} strokeWidth={2} />,
  admin: <UserCog size={12} strokeWidth={2} />,
  student: <GraduationCap size={12} strokeWidth={2} />,
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actionLabel(a: string): string {
  return a
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' › ');
}

export default function AdminAuditoria() {
  useDocumentMeta({ title: 'Auditoria — Admin AVA PCO' });
  const [actionFilter, setActionFilter] = useState('');
  const [targetType, setTargetType] = useState('');
  const [search, setSearch] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const filter = useMemo<AuditFilter>(
    () => ({
      action: actionFilter || undefined,
      targetType: targetType || undefined,
      // ISO 8601 — datepicker dá formato YYYY-MM-DD, expande pra meia-noite/fim do dia
      since: since ? `${since}T00:00:00.000Z` : undefined,
      until: until ? `${until}T23:59:59.999Z` : undefined,
      limit: 500,
    }),
    [actionFilter, targetType, since, until],
  );

  const { data, isLoading, isError, refetch, isFetching } = useAuditLog(filter);
  const toast = useToast();

  const filtered = useMemo<AuditEntryDto[]>(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((e) => {
      return (
        (e.actorEmail ?? '').toLowerCase().includes(q) ||
        (e.action ?? '').toLowerCase().includes(q) ||
        (e.targetId ?? '').toLowerCase().includes(q) ||
        (e.targetType ?? '').toLowerCase().includes(q) ||
        (e.ip ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const targetTypes = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((e) => e.targetType && set.add(e.targetType));
    return Array.from(set).sort();
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">Auditoria</h1>
          <p className="text-sm text-ink-muted">
            Registro de ações administrativas (criação, edição, remoção). Mantém os últimos 5.000
            eventos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await downloadAuditLogCsv(filter);
                toast.success('Download iniciado');
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            className="pco-btn-secondary text-xs"
          >
            <Download size={12} strokeWidth={2} />
            Exportar CSV
          </button>
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

      <div className="pco-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Ação contém</span>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="ex: news, users.delete"
              className="pco-input mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Tipo de alvo</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="pco-input mt-1 text-sm"
            >
              <option value="">Todos</option>
              {targetTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Buscar (autor / IP / ID)
            </span>
            <div className="relative mt-1">
              <Search
                size={14}
                strokeWidth={2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="palavra-chave..."
                className="pco-input pl-9 text-sm w-full"
              />
            </div>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3 border-t border-surface-mute pt-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">De</span>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="pco-input mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Até</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="pco-input mt-1 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSince('');
                setUntil('');
                setActionFilter('');
                setTargetType('');
                setSearch('');
              }}
              className="pco-btn-ghost text-xs"
            >
              Limpar filtros
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Filter size={12} strokeWidth={2} />
          {filtered.length} evento{filtered.length === 1 ? '' : 's'} exibido
          {filtered.length === 1 ? '' : 's'}
          {data && data.length !== filtered.length ? ` (de ${data.length})` : ''}
        </div>
      </div>

      {isLoading ? (
        <CardListSkeleton count={6} />
      ) : isError ? (
        <ErrorState
          action={
            <button type="button" onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum evento"
          description="Quando você ou outros administradores fizerem mudanças, elas aparecerão aqui."
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Quando</th>
                  <th className="text-left px-3 py-2 font-medium">Autor</th>
                  <th className="text-left px-3 py-2 font-medium">Ação</th>
                  <th className="text-left px-3 py-2 font-medium">Alvo</th>
                  <th className="text-left px-3 py-2 font-medium">IP</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                      {formatTs(e.ts)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {e.actorRole && roleIcon[e.actorRole]}
                        <span className="font-medium text-pco-deep">
                          {e.actorEmail ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <code className="text-[11px] text-pco-blue">{actionLabel(e.action)}</code>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.targetType ? (
                        <span>
                          <span className="text-ink-muted">{e.targetType}</span>
                          {e.targetId ? (
                            <code className="ml-1 text-[11px]">{e.targetId}</code>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-muted">{e.ip ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {e.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] text-status-success">
                          <CheckCircle2 size={10} strokeWidth={2} /> ok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/15 px-2 py-0.5 text-[10px] text-status-danger">
                          <AlertTriangle size={10} strokeWidth={2} /> erro
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
