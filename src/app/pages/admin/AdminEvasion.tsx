import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Send,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import { useRetentionRisks, useBroadcastNotification, useRecomputeRetention } from '../../data/hooks';
import { RefreshCw, Loader2 } from 'lucide-react';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useT } from '../../i18n';

const levelStyles: Record<string, string> = {
  critico: 'bg-status-danger/15 text-status-danger',
  alto: 'bg-pco-orange/15 text-pco-orange',
  medio: 'bg-pco-blue/10 text-pco-blue',
  baixo: 'bg-status-success/10 text-status-success',
};

const LEVEL_ORDER = ['critico', 'alto', 'medio', 'baixo'] as const;
const LEVEL_LABEL: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};
const LEVEL_BG: Record<string, string> = {
  critico: 'bg-status-danger/5 border-status-danger/30',
  alto: 'bg-pco-orange/5 border-pco-orange/30',
  medio: 'bg-pco-blue/5 border-pco-blue/30',
  baixo: 'bg-status-success/5 border-status-success/30',
};

export default function AdminEvasion() {
  const t = useT();
  const [level, setLevel] = useState('todos');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const { data, isLoading, isError, refetch } = useRetentionRisks(level);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const broadcast = useBroadcastNotification();
  const recompute = useRecomputeRetention();
  const toast = useToast();

  async function handleRecompute() {
    try {
      const r = await recompute.mutateAsync();
      toast.success(
        'Risco recalculado',
        `${r.total} alunos · ${r.byLevel.critico} críticos · ${r.byLevel.alto} altos · ${r.updated} atualizados`,
      );
    } catch (err) {
      toast.error('Falha ao recalcular', err instanceof Error ? err.message : 'Erro');
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, typeof data> = {
      critico: [],
      alto: [],
      medio: [],
      baixo: [],
    };
    for (const r of data ?? []) {
      const key = r.level in map ? r.level : 'baixo';
      map[key]!.push(r);
    }
    return map;
  }, [data]);

  async function notifySelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const message = prompt(
      `Mensagem para ${ids.length} aluno(s):`,
      'Sentimos sua falta. Que tal retomar o curso essa semana?',
    );
    if (!message || message.trim().length < 2) return;
    try {
      const res = await broadcast.mutateAsync({
        audience: 'users',
        userIds: ids,
        title: 'Que tal retomar o curso?',
        body: message.trim(),
        category: 'warning',
        link: '/jornada',
      });
      toast.success(`Enviado para ${res.sent} aluno(s)`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.evasion')}</h1>
          <p className="pco-section-subtitle mt-1">
            Score de risco por aluno com motivos e ação recomendada.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label="Modo de visualização"
            className="inline-flex rounded-lg border border-pco-border bg-white overflow-hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'table'}
              onClick={() => setView('table')}
              className={`text-xs px-3 py-1.5 inline-flex items-center gap-1 ${
                view === 'table'
                  ? 'bg-pco-blue text-white'
                  : 'text-ink-muted hover:bg-surface-mute'
              }`}
            >
              <ListIcon size={12} strokeWidth={2} />
              Tabela
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'kanban'}
              onClick={() => setView('kanban')}
              className={`text-xs px-3 py-1.5 inline-flex items-center gap-1 ${
                view === 'kanban'
                  ? 'bg-pco-blue text-white'
                  : 'text-ink-muted hover:bg-surface-mute'
              }`}
            >
              <LayoutGrid size={12} strokeWidth={2} />
              Kanban
            </button>
          </div>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="pco-input w-auto py-2 text-xs"
          >
            <option value="todos">Todos os níveis</option>
            <option value="critico">Crítico</option>
            <option value="alto">Alto</option>
            <option value="medio">Médio</option>
            <option value="baixo">Baixo</option>
          </select>
          <button
            type="button"
            onClick={handleRecompute}
            disabled={recompute.isPending}
            className="pco-btn-secondary text-xs"
            title="Recalcula o risco de todos os alunos usando dados atuais"
          >
            {recompute.isPending ? (
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            ) : (
              <RefreshCw size={12} strokeWidth={2} />
            )}
            Recalcular
          </button>
          <Link to="/admin/plano-retomada-ia" className="pco-btn-primary text-xs">
            <Sparkles size={12} strokeWidth={2} />
            Plano de Retomada IA
          </Link>
        </div>
      </header>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState
          action={
            <button onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhum risco no filtro atual" />
      ) : (
      <>
      {selected.size > 0 && (
        <div className="pco-card p-3 flex items-center justify-between flex-wrap gap-3 bg-pco-blue/5 border-pco-blue/30">
          <div className="text-sm text-pco-deep">
            <strong>{selected.size}</strong> aluno{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={notifySelected}
              disabled={broadcast.isPending}
              className="pco-btn-primary text-xs"
            >
              <Send size={11} strokeWidth={2} />
              {broadcast.isPending ? 'Enviando...' : 'Notificar selecionados'}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="pco-btn-ghost text-xs"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
      {view === 'kanban' ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {LEVEL_ORDER.map((lvl) => {
            const items = grouped[lvl] ?? [];
            return (
              <div
                key={lvl}
                className={`rounded-lg border-2 ${LEVEL_BG[lvl]} p-3 min-h-[200px]`}
              >
                <header className="flex items-center justify-between mb-3 pb-2 border-b border-pco-border">
                  <span
                    className={`pco-badge ${levelStyles[lvl]} font-semibold`}
                  >
                    {LEVEL_LABEL[lvl]}
                  </span>
                  <span className="text-[11px] text-ink-subtle font-medium">
                    {items.length}
                  </span>
                </header>
                {items.length === 0 ? (
                  <p className="text-xs text-ink-subtle text-center py-4">
                    Nenhum aluno
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((r) => {
                      const checked = selected.has(r.studentId);
                      return (
                        <li
                          key={r.studentId}
                          className={`bg-white rounded-md p-2 border ${checked ? 'border-pco-blue ring-2 ring-pco-blue/30' : 'border-pco-border'}`}
                        >
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selected);
                                if (e.target.checked) next.add(r.studentId);
                                else next.delete(r.studentId);
                                setSelected(next);
                              }}
                              className="mt-0.5 accent-pco-blue"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-pco-deep truncate">
                                {r.studentName}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-ink-subtle mt-0.5">
                                <span>Score: <strong>{r.score}</strong></span>
                                <span>·</span>
                                <span>{Math.round((Date.now() - new Date(r.lastAccessAt).getTime()) / 86400000)}d inativo</span>
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-surface-gray overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-pco-blue"
                                  style={{ width: `${r.realProgress}%` }}
                                  title={`Progresso: ${r.realProgress}% (esperado: ${r.expectedProgress}%)`}
                                />
                              </div>
                              <div className="text-[9px] text-ink-subtle mt-0.5">
                                {r.realProgress}% / {r.expectedProgress}% esperado
                              </div>
                              {r.reasons && r.reasons.length > 0 && (
                                <div className="text-[10px] text-ink-muted mt-1 line-clamp-2">
                                  {r.reasons.slice(0, 2).join(' · ')}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <Link
                                  to={`/admin/plano-retomada-ia?studentId=${r.studentId}`}
                                  className="text-[10px] text-pco-blue hover:underline inline-flex items-center gap-0.5 font-medium"
                                >
                                  <Sparkles size={9} strokeWidth={2} />
                                  Plano IA
                                </Link>
                                <Link
                                  to={`/admin/alunos/${r.studentId}`}
                                  className="text-[10px] text-ink-muted hover:text-pco-blue hover:underline inline-flex items-center gap-0.5"
                                >
                                  Perfil
                                  <ArrowRight size={8} strokeWidth={2} />
                                </Link>
                              </div>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      <div className="pco-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-off">
              <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      data.length > 0 &&
                      data.every((r) => selected.has(r.studentId))
                    }
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(data.map((r) => r.studentId)));
                      else setSelected(new Set());
                    }}
                    className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Aluno</th>
                <th className="px-4 py-3 text-left font-medium">Score</th>
                <th className="px-4 py-3 text-left font-medium">Nível</th>
                <th className="px-4 py-3 text-left font-medium">Motivos</th>
                <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                <th className="px-4 py-3 text-left font-medium">Progresso</th>
                <th className="px-4 py-3 text-left font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const initials = r.studentName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('');
                const ratio = Math.round((r.realProgress / Math.max(1, r.expectedProgress)) * 100);
                return (
                  <tr key={r.studentId} className="border-t border-surface-gray hover:bg-surface-off">
                    <td className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.has(r.studentId)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.studentId);
                          else next.delete(r.studentId);
                          setSelected(next);
                        }}
                        className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue"
                        aria-label={`Selecionar ${r.studentName}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                          {initials}
                        </div>
                        <div className="font-semibold text-pco-deep">{r.studentName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pco-deep">{r.score}</span>
                        <div className="h-1.5 w-16 rounded-full bg-surface-gray overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.score >= 75
                                ? 'bg-status-danger'
                                : r.score >= 55
                                  ? 'bg-pco-orange'
                                  : r.score >= 30
                                    ? 'bg-pco-blue'
                                    : 'bg-status-success'
                            }`}
                            style={{ width: `${r.score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`pco-badge capitalize ${levelStyles[r.level]}`}>
                        {r.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {r.reasons.slice(0, 2).map((m) => (
                          <span key={m} className="pco-badge bg-surface-gray text-ink-muted">
                            {m}
                          </span>
                        ))}
                        {r.reasons.length > 2 && (
                          <span className="text-[11px] text-ink-subtle">
                            +{r.reasons.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {new Date(r.lastAccessAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-ink-muted">
                        {r.realProgress}% <span className="text-ink-subtle">/ {r.expectedProgress}% esperado</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-surface-gray overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            ratio >= 90
                              ? 'bg-status-success'
                              : ratio >= 60
                                ? 'bg-pco-blue'
                                : 'bg-pco-orange'
                          }`}
                          style={{ width: `${Math.min(100, ratio)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/plano-retomada-ia"
                        className="pco-btn-secondary text-xs whitespace-nowrap"
                      >
                        <AlertTriangle size={12} strokeWidth={2} />
                        Plano
                        <ArrowRight size={12} strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </>
      )}

      <div className="text-[11px] text-ink-subtle">
        Score calculado a partir de inatividade, progresso esperado vs real, avaliações pendentes
        e uso de Tutor/POD/Biblioteca.
      </div>
    </div>
  );
}
