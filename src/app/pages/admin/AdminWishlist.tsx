import { Heart, TrendingUp, Download } from 'lucide-react';
import { useWishlistAggregate, useCourses } from '../../data/hooks';
import { downloadWishlistCsv } from '../../data/api';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

export default function AdminWishlist() {
  useDocumentMeta({ title: 'Wishlist — Admin AVA PCO' });
  const wish = useWishlistAggregate();
  const courses = useCourses();
  const toast = useToast();

  async function handleExport() {
    try {
      await downloadWishlistCsv();
      toast.success('CSV baixado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const courseMap = new Map(
    (courses.data ?? []).map((c) => [c.id, c]),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Heart size={20} className="text-pco-orange" strokeWidth={1.75} />
            Wishlist de cursos
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Cursos mais desejados pelos alunos. Use como sinal de demanda para
            priorização de produção.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={(wish.data ?? []).length === 0}
          className="pco-btn-ghost text-xs"
          title="Exportar CSV"
        >
          <Download size={11} strokeWidth={2} />
          CSV
        </button>
      </header>

      {wish.fetchStatus === 'paused' ? (
        <SemConexao oQue="a lista de desejos" />
      ) : wish.isError ? (
        <FalhaAoCarregar
          erro={wish.error}
          oQue="a lista de desejos"
          aoTentarDeNovo={() => void wish.refetch()}
        />
      ) : wish.isPending ? (
        <CardListSkeleton count={3} />
      ) : (wish.data ?? []).length === 0 ? (
        <EmptyState
          title="Sem dados"
          description="Nenhum aluno marcou cursos como interesse ainda."
          icon={<Heart size={28} className="text-pco-blue" />}
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-ink-muted text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2">Curso</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">Última semana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {(wish.data ?? []).map((row, i) => {
                const course = courseMap.get(row.courseId);
                return (
                  <tr key={row.courseId} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 text-ink-muted font-mono">
                      #{i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-pco-deep">
                        {course?.title ?? `(curso removido)`}
                      </div>
                      <div className="text-xs text-ink-subtle font-mono">
                        {row.courseId}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-pco-deep">
                      {row.count}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.addedLastWeek > 0 ? (
                        <span className="inline-flex items-center gap-1 text-status-success font-semibold">
                          <TrendingUp size={11} />
                          +{row.addedLastWeek}
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
