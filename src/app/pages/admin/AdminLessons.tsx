import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Clock,
  Video,
  CheckCircle2,
  Circle,
  Edit3,
} from 'lucide-react';
import { useCourses, useUpdateLesson } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../components/Toast';

export default function AdminLessons() {
  const [courseFilter, setCourseFilter] = useState<string>('todos');
  const [moduleFilter, setModuleFilter] = useState<string>('todos');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [search, setSearch] = useState('');
  const { data: courses, isLoading } = useCourses();
  const updateMut = useUpdateLesson();
  const toast = useToast();

  const allLessons = useMemo(() => {
    if (!courses) return [];
    return courses.flatMap((c) =>
      c.modules.flatMap((m) =>
        m.lessons.map((l) => ({
          ...l,
          courseTitle: c.title,
          courseShortTitle: c.shortTitle,
          courseColor: c.coverColor,
          moduleTitle: m.title,
          moduleOrder: m.order,
        })),
      ),
    );
  }, [courses]);

  const availableModules = useMemo(() => {
    if (courseFilter === 'todos' || !courses) return [];
    return courses.find((c) => c.id === courseFilter)?.modules ?? [];
  }, [courseFilter, courses]);

  const filtered = useMemo(() => {
    let list = [...allLessons];
    if (courseFilter !== 'todos') list = list.filter((l) => l.courseId === courseFilter);
    if (moduleFilter !== 'todos') list = list.filter((l) => l.moduleId === moduleFilter);
    if (mandatoryOnly) list = list.filter((l) => l.isMandatory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.title.toLowerCase().includes(q));
    }
    return list;
  }, [allLessons, courseFilter, moduleFilter, mandatoryOnly, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Aulas</h1>
          <p className="pco-section-subtitle mt-1">
            Cadastro e gestão de aulas em todos os cursos.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Nova aula
        </button>
      </header>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            size={14}
            strokeWidth={1.75}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aula..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => {
            setCourseFilter(e.target.value);
            setModuleFilter('todos');
          }}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os cursos</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          disabled={courseFilter === 'todos'}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os módulos</option>
          {availableModules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.order}. {m.title}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={mandatoryOnly}
            onChange={(e) => setMandatoryOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas obrigatórias
        </label>
        <span className="text-xs text-ink-subtle ml-auto">{filtered.length} aula(s)</span>
      </div>

      <div className="pco-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-off">
              <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <th className="px-4 py-3 text-left font-medium">Aula</th>
                <th className="px-4 py-3 text-left font-medium">Curso</th>
                <th className="px-4 py-3 text-left font-medium">Módulo</th>
                <th className="px-4 py-3 text-left font-medium">Duração</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-surface-gray hover:bg-surface-off">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {l.status === 'completed' ? (
                        <CheckCircle2 size={14} className="text-status-success" strokeWidth={2} />
                      ) : (
                        <Circle size={14} className="text-ink-subtle" strokeWidth={2} />
                      )}
                      <Video size={13} className="text-pco-blue" strokeWidth={1.75} />
                      <span className="font-medium text-pco-deep">{l.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                      {l.courseShortTitle}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs">
                    M{l.moduleOrder} · {l.moduleTitle}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {l.durationMinutes} min
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={updateMut.isPending}
                      onClick={async () => {
                        try {
                          await updateMut.mutateAsync({
                            id: l.id,
                            patch: { isMandatory: !l.isMandatory },
                          });
                          toast.success(
                            l.isMandatory ? 'Marcada como opcional' : 'Marcada como obrigatória',
                          );
                        } catch (err) {
                          toast.error(
                            'Falha ao atualizar',
                            err instanceof Error ? err.message : 'Erro',
                          );
                        }
                      }}
                      title="Clique para alternar"
                    >
                      {l.isMandatory ? (
                        <span className="pco-badge bg-pco-orange/10 text-pco-orange hover:bg-pco-orange/20">
                          Obrigatória
                        </span>
                      ) : (
                        <span className="pco-badge bg-surface-gray text-ink-muted hover:bg-surface-gray/70">
                          Opcional
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/cursos/${l.courseId}`}
                      className="pco-btn-ghost text-xs"
                    >
                      <Edit3 size={12} strokeWidth={1.75} />
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Nenhuma aula encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
