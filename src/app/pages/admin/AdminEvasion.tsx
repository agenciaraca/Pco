import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useRetentionRisks } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';

const levelStyles: Record<string, string> = {
  critico: 'bg-status-danger/15 text-status-danger',
  alto: 'bg-pco-orange/15 text-pco-orange',
  medio: 'bg-pco-blue/10 text-pco-blue',
  baixo: 'bg-status-success/10 text-status-success',
};

export default function AdminEvasion() {
  const [level, setLevel] = useState('todos');
  const { data, isLoading, isError, refetch } = useRetentionRisks(level);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Previsão de Evasão</h1>
          <p className="pco-section-subtitle mt-1">
            Score de risco por aluno com motivos e ação recomendada.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="pco-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-off">
              <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
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

      <div className="text-[11px] text-ink-subtle">
        Score calculado a partir de inatividade, progresso esperado vs real, avaliações pendentes
        e uso de Tutor/POD/Biblioteca.
      </div>
    </div>
  );
}
