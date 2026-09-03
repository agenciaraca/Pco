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
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Trash2,
  CalendarOff,
  X,
} from 'lucide-react';
import { useCourses, useDeleteModule, useUpdateModule } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../components/Toast';
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

type TriFilter = 'qualquer' | 'com' | 'sem';
type StatusFilter = 'qualquer' | 'completed' | 'in_progress' | 'available' | 'locked';

interface ModuleFilters {
  search: string;
  courseId: string;
  status: StatusFilter;
  assessment: TriFilter;
  locked: TriFilter;
  minLessons: string;
}

const EMPTY_FILTERS: ModuleFilters = {
  search: '',
  courseId: 'todos',
  status: 'qualquer',
  assessment: 'qualquer',
  locked: 'qualquer',
  minLessons: '',
};

function applyTri(value: boolean, filter: TriFilter): boolean {
  if (filter === 'qualquer') return true;
  if (filter === 'com') return value;
  return !value;
}

export default function AdminModules() {
  const t = useT();
  const { data: courses, isLoading } = useCourses();
  const deleteMut = useDeleteModule();
  const updateMut = useUpdateModule();
  const toast = useToast();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState<ModuleFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    const minLessons = filters.minLessons ? Number(filters.minLessons) : null;
    return allModules.filter((m) => {
      if (filters.courseId !== 'todos' && m.courseId !== filters.courseId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !m.title.toLowerCase().includes(q) &&
          !(m.description ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.status !== 'qualquer' && m.status !== filters.status) return false;
      if (!applyTri(!!m.assessment, filters.assessment)) return false;
      if (!applyTri(!!m.locked, filters.locked)) return false;
      if (minLessons != null && !Number.isNaN(minLessons) && m.lessons.length < minLessons)
        return false;
      return true;
    });
  }, [allModules, filters]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search.trim()) n += 1;
    if (filters.courseId !== 'todos') n += 1;
    if (filters.status !== 'qualquer') n += 1;
    if (filters.assessment !== 'qualquer') n += 1;
    if (filters.locked !== 'qualquer') n += 1;
    if (filters.minLessons) n += 1;
    return n;
  }, [filters]);

  const visibleIds = useMemo(() => new Set(filtered.map((m) => m.id)), [filtered]);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const someVisibleSelected =
    !allVisibleSelected && filtered.some((m) => selected.has(m.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Apagar ${ids.length} módulo(s) selecionado(s)? As aulas e avaliações vinculadas também serão removidas. Não há desfazer.`,
      )
    )
      return;
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await deleteMut.mutateAsync(id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (fail === 0) {
      toast.success(`${ok} módulo(s) apagado(s)`);
    } else {
      toast.error('Bulk delete parcial', `${ok} ok · ${fail} falhou`);
    }
    setSelected(new Set());
  };

  const bulkClearDrip = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const targets = filtered.filter((m) => selected.has(m.id) && m.releaseAt);
    if (targets.length === 0) {
      toast.info('Nenhum dos selecionados tem data de drip pra limpar.');
      return;
    }
    if (
      !confirm(
        `Remover a data de release de ${targets.length} módulo(s)? O módulo passa a ficar disponível imediatamente.`,
      )
    )
      return;
    let ok = 0;
    let fail = 0;
    for (const m of targets) {
      try {
        await updateMut.mutateAsync({
          id: m.id,
          patch: { title: m.title, order: m.order, releaseAt: undefined },
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (fail === 0) {
      toast.success(`Drip removido em ${ok} módulo(s)`);
    } else {
      toast.error('Bulk update parcial', `${ok} ok · ${fail} falhou`);
    }
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.modules')}</h1>
          <p className="pco-section-subtitle mt-1">
            Visão cruzada dos módulos em todos os cursos.
          </p>
        </div>
        {/*
          Módulo se cria dentro do curso, no editor — esta tela só lista, edita
          e exclui. O botão não tinha ação nenhuma; agora leva para onde a ação
          existe, em vez de fingir que existe aqui.
        */}
        <Link
          to="/admin/cursos"
          title="Módulos são criados dentro do curso, no editor"
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo módulo
        </Link>
      </header>

      {/* Filtros avançados recolhíveis */}
      <div className="pco-card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-off"
          aria-expanded={filtersOpen}
          aria-controls="modulos-filtros-avancados"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-pco-deep">
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filtros avançados
            {activeFilterCount > 0 && (
              <span className="pco-badge bg-pco-blue/10 text-pco-blue text-xs">
                {activeFilterCount} ativo(s)
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-ink-subtle">
            {allModules.length > 0 ? `${filtered.length} de ${allModules.length}` : ''}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {filtersOpen && (
          <div
            id="modulos-filtros-avancados"
            className="border-t border-surface-gray p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4"
          >
            <label className="md:col-span-2 lg:col-span-2 text-xs text-ink-muted">
              Buscar (título ou descrição)
              <div className="relative mt-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                  size={14}
                  strokeWidth={1.75}
                />
                <input
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="ex: introdução, freud..."
                  className="pco-input pl-9"
                />
              </div>
            </label>
            <label className="text-xs text-ink-muted">
              Curso
              <select
                value={filters.courseId}
                onChange={(e) => setFilters((f) => ({ ...f, courseId: e.target.value }))}
                className="pco-input mt-1"
              >
                <option value="todos">Todos os cursos</option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Status
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="completed">Concluído</option>
                <option value="in_progress">Em andamento</option>
                <option value="available">Disponível</option>
                <option value="locked">Bloqueado</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Avaliação
              <select
                value={filters.assessment}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, assessment: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Com avaliação</option>
                <option value="sem">Sem avaliação</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Drip / lock
              <select
                value={filters.locked}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, locked: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Bloqueado (drip ativo)</option>
                <option value="sem">Liberado</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Mín. aulas
              <input
                type="number"
                min={0}
                value={filters.minLessons}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minLessons: e.target.value }))
                }
                className="pco-input mt-1"
                placeholder="ex: 3"
              />
            </label>
            <div className="md:col-span-3 lg:col-span-4 flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="pco-btn-ghost text-xs"
                disabled={activeFilterCount === 0}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar de ações em massa */}
      {selected.size > 0 && (
        <div className="pco-card p-3 flex items-center gap-3 flex-wrap bg-pco-blue/5 border border-pco-blue/20">
          <span className="text-xs font-semibold text-pco-deep">
            {selected.size} módulo(s) selecionado(s)
          </span>
          <div className="ml-auto inline-flex gap-2">
            <button
              type="button"
              onClick={bulkClearDrip}
              className="pco-btn-ghost text-xs"
              disabled={updateMut.isPending}
              title="Remover data de release dos selecionados"
            >
              <CalendarOff size={12} strokeWidth={2} />
              Liberar drip
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              className="pco-btn-ghost text-xs text-status-danger hover:bg-status-danger/10"
              disabled={deleteMut.isPending}
              title="Apagar todos os selecionados"
            >
              <Trash2 size={12} strokeWidth={2} />
              Apagar selecionados
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="pco-btn-ghost text-xs"
            >
              <X size={12} strokeWidth={2} />
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-surface-gray bg-surface-off flex items-center gap-3">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = someVisibleSelected;
              }}
              onChange={toggleAll}
              aria-label="Selecionar todos visíveis"
              className="ml-1"
            />
            <span className="text-xs uppercase tracking-wider text-ink-subtle font-medium">
              {filtered.length} módulo(s)
            </span>
          </div>
          <ul className="divide-y divide-surface-gray">
            {filtered.map((m) => (
              <li
                key={m.id}
                className={`flex items-center gap-3 p-4 hover:bg-surface-off ${
                  selected.has(m.id) ? 'bg-pco-blue/5' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleOne(m.id)}
                  aria-label={`Selecionar ${m.title}`}
                  className="ml-1"
                />
                <button className="text-ink-subtle hover:text-pco-deep cursor-grab">
                  <GripVertical size={14} strokeWidth={1.75} />
                </button>
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${m.courseColor}`} />
                <div className="h-7 w-7 rounded-lg bg-pco-blue/10 grid place-items-center text-xs font-bold text-pco-blue shrink-0">
                  {m.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-pco-deep">{m.title}</span>
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                      {m.courseShortTitle}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={10} />
                      {m.lessons.length} aulas
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ScrollText size={10} />
                      {m.assessment ? '1 avaliação' : 'sem avaliação'}
                    </span>
                    {m.releaseAt && (
                      <span
                        className="inline-flex items-center gap-1 text-pco-orange"
                        title="Drip ativo"
                      >
                        ⏳ libera {new Date(m.releaseAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
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
                {allModules.length === 0
                  ? 'Nenhum módulo cadastrado.'
                  : 'Nenhum módulo bate com os filtros aplicados.'}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="text-xs text-ink-subtle">
        A edição completa de cada módulo (aulas, materiais, avaliação, regras) é feita dentro
        do editor do curso correspondente.
      </div>
    </div>
  );
}
