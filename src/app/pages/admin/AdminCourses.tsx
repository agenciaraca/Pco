import { Link } from 'react-router-dom';
import { Plus, Edit3, Layers, Clock, Copy, Download } from 'lucide-react';
import { useCourses, useDuplicateCourse } from '../../data/hooks';
import { downloadCoursesCsv } from '../../data/api';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

export default function AdminCourses() {
  const { data, isLoading, isError, refetch } = useCourses();
  const duplicateMut = useDuplicateCourse();
  const toast = useToast();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Gestão de Cursos</h1>
          <p className="pco-section-subtitle mt-1">Liste, crie e edite cursos do AVA.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await downloadCoursesCsv();
                toast.success('CSV baixado');
              } catch (err) {
                toast.error('Falha', err instanceof Error ? err.message : 'Erro');
              }
            }}
            className="pco-btn-ghost text-xs"
          >
            <Download size={12} strokeWidth={2} />
            Exportar CSV
          </button>
          <button className="pco-btn-primary text-xs" disabled title="Em desenvolvimento">
            <Plus size={14} strokeWidth={2} />
            Novo curso
          </button>
        </div>
      </header>

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState
          action={
            <button onClick={() => refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhum curso cadastrado" />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-4 py-3 text-left font-medium">Curso</th>
                  <th className="px-4 py-3 text-left font-medium">Módulos</th>
                  <th className="px-4 py-3 text-left font-medium">Horas</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-surface-gray hover:bg-surface-off">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${c.coverColor}`} />
                        <div>
                          <div className="font-semibold text-pco-deep">{c.title}</div>
                          <div className="text-[11px] text-ink-subtle">/{c.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Layers size={12} className="text-pco-blue" />
                        {c.modules.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-pco-blue" />
                        {c.totalHours}h
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        Ativo
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Duplicar "${c.title}"? Cria nova cópia editável.`)) return;
                            try {
                              const r = await duplicateMut.mutateAsync(c.id);
                              toast.success('Curso duplicado', r.title);
                            } catch (err) {
                              toast.error(
                                'Falha',
                                err instanceof Error ? err.message : 'Erro',
                              );
                            }
                          }}
                          className="pco-btn-ghost text-xs"
                          title="Duplicar curso"
                        >
                          <Copy size={12} strokeWidth={2} />
                        </button>
                        <Link to={`/admin/cursos/${c.id}`} className="pco-btn-secondary text-xs">
                          <Edit3 size={12} strokeWidth={2} />
                          Editar
                        </Link>
                      </div>
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
