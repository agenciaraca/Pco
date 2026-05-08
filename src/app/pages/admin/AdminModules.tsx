import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Layers,
  ScrollText,
  GripVertical,
  Edit3,
  ArrowRight,
} from 'lucide-react';
import { useCourses } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useT } from '../../i18n';

const statusStyles: Record<string, string> = {
  completed: 'bg-status-success/10 text-status-success',
  in_progress: 'bg-pco-blue/10 text-pco-blue',
  available: 'bg-pco-cyan/15 text-pco-cyan',
  locked: 'bg-surface-gray text-ink-muted',
};
const statusLabel: Record<string, string> = {
  completed: 'Concluído',
  in_progress: 'Em andamento',
  available: 'Disponível',
  locked: 'Bloqueado',
};

export default function AdminModules() {
  const t = useT();
  const [courseFilter, setCourseFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const { data: courses, isLoading } = useCourses();

  const allModules = useMemo(() => {
    if (!courses) return [];
    return courses.flatMap((c) =>
      c.modules.map((m) => ({
        ...m,
        courseTitle: c.title,
        courseShortTitle: c.shortTitle,
        courseColor: c.coverColor,
      })),
    );
  }, [courses]);

  const filtered = useMemo(() => {
    let list = [...allModules];
    if (courseFilter !== 'todos') list = list.filter((m) => m.courseId === courseFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allModules, courseFilter, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.modules')}</h1>
          <p className="pco-section-subtitle mt-1">
            Visão cruzada dos módulos em todos os cursos.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo módulo
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
            placeholder="Buscar módulo..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os cursos</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-subtle ml-auto">
          {filtered.length} módulo(s)
        </span>
      </div>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : (
      <div className="pco-card p-0 overflow-hidden">
        <ul className="divide-y divide-surface-gray">
          {filtered.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4 hover:bg-surface-off">
              <button className="text-ink-subtle hover:text-pco-deep cursor-grab">
                <GripVertical size={14} strokeWidth={1.75} />
              </button>
              <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${m.courseColor}`} />
              <div className="h-7 w-7 rounded-lg bg-pco-blue/10 grid place-items-center text-[11px] font-bold text-pco-blue shrink-0">
                {m.order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-pco-deep">{m.title}</span>
                  <span className="pco-badge bg-pco-blue/10 text-pco-blue">{m.courseShortTitle}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Layers size={10} />
                    {m.lessons.length} aulas
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ScrollText size={10} />
                    {m.assessment ? '1 avaliação' : 'sem avaliação'}
                  </span>
                </div>
              </div>
              {m.status && (
                <span className={`pco-badge ${statusStyles[m.status] ?? ''}`}>
                  {statusLabel[m.status] ?? m.status}
                </span>
              )}
              <Link
                to={`/admin/cursos/${m.courseId}`}
                className="pco-btn-ghost text-xs"
                title="Editar no curso"
              >
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
                <ArrowRight size={10} strokeWidth={2} />
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-12 text-center text-sm text-ink-muted">
              Nenhum módulo encontrado.
            </li>
          )}
        </ul>
      </div>
      )}

      <div className="text-[11px] text-ink-subtle">
        A edição completa de cada módulo (aulas, materiais, avaliação, regras) é feita dentro
        do editor do curso correspondente.
      </div>
    </div>
  );
}
