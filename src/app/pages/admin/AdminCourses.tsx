import { Link } from 'react-router-dom';
import {
  Plus,
  Edit3,
  Layers,
  Clock,
  Copy,
  Download,
  Eye,
  Users,
  Lock,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useCourses,
  useDuplicateCourse,
  useAdminCoursesSummary,
  useUpdateCourse,
  useCreateCourse,
} from '../../data/hooks';
import SortableTh from '../../components/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';
import { useMemo, useState } from 'react';
import { downloadCoursesCsv } from '../../data/api';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useT } from '../../i18n';

type TriFilter = 'qualquer' | 'com' | 'sem';

interface AdvancedFilters {
  query: string;
  prerequisites: TriFilter;
  changelog: TriFilter;
  collaborators: TriFilter;
  previewLessons: TriFilter;
  certificate: TriFilter;
  minHours: string;
  minModules: string;
  minStudents: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  query: '',
  prerequisites: 'qualquer',
  changelog: 'qualquer',
  collaborators: 'qualquer',
  previewLessons: 'qualquer',
  certificate: 'qualquer',
  minHours: '',
  minModules: '',
  minStudents: '',
};

function applyTri(value: boolean, filter: TriFilter): boolean {
  if (filter === 'qualquer') return true;
  if (filter === 'com') return value;
  return !value;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AdminCourses() {
  const t = useT();
  const { data, isLoading, isError, refetch } = useCourses();
  const duplicateMut = useDuplicateCourse();
  const updateMut = useUpdateCourse();
  const createMut = useCreateCourse();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const summaryQ = useAdminCoursesSummary();
  const toast = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);
  const summaryMap = useMemo(
    () => new Map((summaryQ.data ?? []).map((s) => [s.courseId, s])),
    [summaryQ.data],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    if (!data) return [];
    const q = filters.query.trim().toLowerCase();
    const minHours = filters.minHours ? Number(filters.minHours) : null;
    const minModules = filters.minModules ? Number(filters.minModules) : null;
    const minStudents = filters.minStudents ? Number(filters.minStudents) : null;
    return data.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q))
        return false;
      const hasPrereq = (c.prerequisiteCourseIds?.length ?? 0) > 0;
      if (!applyTri(hasPrereq, filters.prerequisites)) return false;
      const hasChangelog = (c.changelog?.length ?? 0) > 0;
      if (!applyTri(hasChangelog, filters.changelog)) return false;
      const hasCollab = (c.collaborators?.length ?? 0) > 0;
      if (!applyTri(hasCollab, filters.collaborators)) return false;
      const hasPreview = c.modules.some((m) => m.lessons.some((l) => l.isPreview));
      if (!applyTri(hasPreview, filters.previewLessons)) return false;
      if (!applyTri(!!c.certificateAvailable, filters.certificate)) return false;
      if (minHours != null && !Number.isNaN(minHours) && c.totalHours < minHours) return false;
      if (minModules != null && !Number.isNaN(minModules) && c.modules.length < minModules)
        return false;
      const enrolled = summaryMap.get(c.id)?.enrolledCount ?? 0;
      if (minStudents != null && !Number.isNaN(minStudents) && enrolled < minStudents)
        return false;
      return true;
    });
  }, [data, filters, summaryMap]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.query.trim()) n += 1;
    for (const k of [
      'prerequisites',
      'changelog',
      'collaborators',
      'previewLessons',
      'certificate',
    ] as const) {
      if (filters[k] !== 'qualquer') n += 1;
    }
    if (filters.minHours) n += 1;
    if (filters.minModules) n += 1;
    if (filters.minStudents) n += 1;
    return n;
  }, [filters]);

  const {
    rows: sortedVisible,
    field: sortField,
    direction: sortDirection,
    toggleSort,
  } = useTableSort(
    visible,
    (row, field) => {
      switch (field) {
        case 'title':
          return row.title;
        case 'modules':
          return row.modules.length;
        case 'hours':
          return row.totalHours;
        case 'enrolled':
          return summaryMap.get(row.id)?.enrolledCount ?? 0;
        case 'progress':
          return summaryMap.get(row.id)?.avgProgressPct ?? 0;
        case 'status':
          return row.active === false ? 0 : 1;
        default:
          return null;
      }
    },
    'title',
  );

  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);
  const allVisibleSelected =
    visible.length > 0 && visible.every((c) => selected.has(c.id));
  const someVisibleSelected =
    !allVisibleSelected && visible.some((c) => selected.has(c.id));

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

  const bulkDuplicate = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Duplicar ${ids.length} curso(s) selecionado(s)?`)) return;
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await duplicateMut.mutateAsync(id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (fail === 0) {
      toast.success(`${ok} curso(s) duplicado(s)`);
    } else {
      toast.error('Bulk duplicate parcial', `${ok} ok · ${fail} falhou`);
    }
    setSelected(new Set());
  };

  const setBulkActive = async (active: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const action = active ? 'publicar' : 'despublicar';
    if (!confirm(`Tem certeza que deseja ${action} ${ids.length} curso(s)?`)) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await updateMut.mutateAsync({ id, patch: { active } });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkBusy(false);
    if (fail === 0) {
      toast.success(`${ok} curso(s) ${active ? 'publicado(s)' : 'despublicado(s)'}`);
    } else {
      toast.info(`Concluído`, `${ok} ok · ${fail} falhou`);
    }
    setSelected(new Set());
  };

  const bulkExport = () => {
    const rows = visible.filter((c) => selected.has(c.id));
    if (rows.length === 0) return;
    const header = [
      'id',
      'slug',
      'title',
      'modules',
      'totalHours',
      'enrolledCount',
      'avgProgressPct',
      'hasCertificate',
      'hasPrerequisites',
    ];
    const lines = [header.join(',')];
    for (const c of rows) {
      const sum = summaryMap.get(c.id);
      lines.push(
        [
          csvEscape(c.id),
          csvEscape(c.slug),
          csvEscape(c.title),
          c.modules.length,
          c.totalHours,
          sum?.enrolledCount ?? 0,
          sum?.avgProgressPct ?? 0,
          c.certificateAvailable ? 'sim' : 'nao',
          (c.prerequisiteCourseIds?.length ?? 0) > 0 ? 'sim' : 'nao',
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursos-selecionados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} curso(s) exportado(s)`);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.courses')}</h1>
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
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="pco-btn-primary text-xs"
          >
            <Plus size={14} strokeWidth={2} />
            Novo curso
          </button>
        </div>
      </header>

      {/* Filtros avançados recolhíveis */}
      <div className="pco-card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-off"
          aria-expanded={filtersOpen}
          aria-controls="cursos-filtros-avancados"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-pco-deep">
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filtros avançados
            {activeFilterCount > 0 && (
              <span className="pco-badge bg-pco-blue/10 text-pco-blue text-[10px]">
                {activeFilterCount} ativo(s)
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] text-ink-subtle">
            {data ? `${visible.length} de ${data.length}` : ''}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {filtersOpen && (
          <div
            id="cursos-filtros-avancados"
            className="border-t border-surface-gray p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4"
          >
            <label className="md:col-span-2 lg:col-span-2 text-[11px] text-ink-muted">
              Buscar (título ou slug)
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                className="pco-input mt-1"
                placeholder="ex: psicanálise, hipnoterapia, /slug"
              />
            </label>
            <label className="text-[11px] text-ink-muted">
              Pré-requisitos
              <select
                value={filters.prerequisites}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, prerequisites: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Com pré-req</option>
                <option value="sem">Sem pré-req</option>
              </select>
            </label>
            <label className="text-[11px] text-ink-muted">
              Changelog
              <select
                value={filters.changelog}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, changelog: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Com entries</option>
                <option value="sem">Sem entries</option>
              </select>
            </label>
            <label className="text-[11px] text-ink-muted">
              Colaboradores
              <select
                value={filters.collaborators}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, collaborators: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Com co-instrutores</option>
                <option value="sem">Só instrutor principal</option>
              </select>
            </label>
            <label className="text-[11px] text-ink-muted">
              Aulas em preview
              <select
                value={filters.previewLessons}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, previewLessons: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Com preview</option>
                <option value="sem">Sem preview</option>
              </select>
            </label>
            <label className="text-[11px] text-ink-muted">
              Certificado
              <select
                value={filters.certificate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, certificate: e.target.value as TriFilter }))
                }
                className="pco-input mt-1"
              >
                <option value="qualquer">Qualquer</option>
                <option value="com">Disponível</option>
                <option value="sem">Indisponível</option>
              </select>
            </label>
            <label className="text-[11px] text-ink-muted">
              Mín. horas
              <input
                type="number"
                min={0}
                value={filters.minHours}
                onChange={(e) => setFilters((f) => ({ ...f, minHours: e.target.value }))}
                className="pco-input mt-1"
                placeholder="ex: 10"
              />
            </label>
            <label className="text-[11px] text-ink-muted">
              Mín. módulos
              <input
                type="number"
                min={0}
                value={filters.minModules}
                onChange={(e) => setFilters((f) => ({ ...f, minModules: e.target.value }))}
                className="pco-input mt-1"
                placeholder="ex: 3"
              />
            </label>
            <label className="text-[11px] text-ink-muted">
              Mín. alunos
              <input
                type="number"
                min={0}
                value={filters.minStudents}
                onChange={(e) => setFilters((f) => ({ ...f, minStudents: e.target.value }))}
                className="pco-input mt-1"
                placeholder="ex: 50"
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

      {/* Toolbar de ações em massa (só aparece com seleção) */}
      {selected.size > 0 && (
        <div className="pco-card p-3 flex items-center gap-3 flex-wrap bg-pco-blue/5 border border-pco-blue/20">
          <span className="text-xs font-semibold text-pco-deep">
            {selected.size} curso(s) selecionado(s)
          </span>
          <div className="ml-auto inline-flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBulkActive(true)}
              disabled={bulkBusy}
              className="pco-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Publicar todos os selecionados"
            >
              {bulkBusy ? (
                <Loader2 size={12} strokeWidth={2} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} strokeWidth={2} />
              )}
              Publicar
            </button>
            <button
              type="button"
              onClick={() => setBulkActive(false)}
              disabled={bulkBusy}
              className="pco-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Despublicar todos os selecionados"
            >
              <EyeOff size={12} strokeWidth={2} />
              Despublicar
            </button>
            <button
              type="button"
              onClick={bulkExport}
              className="pco-btn-ghost text-xs"
              title="Exportar seleção como CSV"
            >
              <Download size={12} strokeWidth={2} />
              Exportar
            </button>
            <button
              type="button"
              onClick={bulkDuplicate}
              className="pco-btn-ghost text-xs"
              disabled={duplicateMut.isPending}
              title="Duplicar todos os selecionados"
            >
              <Copy size={12} strokeWidth={2} />
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="pco-btn-ghost text-xs"
              title="Limpar seleção"
            >
              <X size={12} strokeWidth={2} />
              Limpar
            </button>
          </div>
        </div>
      )}

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
      ) : visible.length === 0 ? (
        <EmptyState title="Nenhum curso bate com os filtros aplicados" />
      ) : (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="w-10 px-3 py-3 text-left font-medium">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Selecionar todos visíveis"
                    />
                  </th>
                  <SortableTh field="title" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Curso
                  </SortableTh>
                  <SortableTh field="modules" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Módulos
                  </SortableTh>
                  <SortableTh field="hours" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Horas
                  </SortableTh>
                  <SortableTh field="enrolled" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Alunos
                  </SortableTh>
                  <SortableTh field="progress" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Progresso
                  </SortableTh>
                  <SortableTh field="status" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Status
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedVisible.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-surface-gray hover:bg-surface-off ${
                      selected.has(c.id) ? 'bg-pco-blue/5' : ''
                    }`}
                  >
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        aria-label={`Selecionar ${c.title}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.coverImageUrl ? (
                          <img
                            src={c.coverImageUrl}
                            alt=""
                            className="h-9 w-9 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className={`h-9 w-9 rounded-lg bg-gradient-to-br ${c.coverColor} shrink-0`}
                          />
                        )}
                        <div>
                          <div className="font-semibold text-pco-deep flex items-center gap-1.5 flex-wrap">
                            {c.title}
                            {(c.prerequisiteCourseIds?.length ?? 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 pco-badge bg-pco-orange/10 text-pco-orange text-[10px]"
                                title={`Requer ${c.prerequisiteCourseIds!.length} curso(s) antes`}
                              >
                                <Lock size={9} strokeWidth={2} />
                                {c.prerequisiteCourseIds!.length} pré-req
                              </span>
                            )}
                            {c.modules.some((m) => m.lessons.some((l) => l.isPreview)) && (
                              <span
                                className="inline-flex items-center gap-1 pco-badge bg-pco-cyan/10 text-pco-cyan text-[10px]"
                                title="Tem aulas com preview livre"
                              >
                                ▶ preview
                              </span>
                            )}
                            {(c.changelog?.length ?? 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 pco-badge bg-pco-blue/10 text-pco-blue text-[10px]"
                                title={`${c.changelog!.length} entry(ies) no changelog`}
                              >
                                ✨ {c.changelog!.length}
                              </span>
                            )}
                            {(c.collaborators?.length ?? 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 pco-badge bg-status-success/10 text-status-success text-[10px]"
                                title={`${c.collaborators!.length} co-instrutor(es)`}
                              >
                                +{c.collaborators!.length} instrutores
                              </span>
                            )}
                          </div>
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
                    <td className="px-4 py-3 text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} className="text-pco-blue" />
                        {summaryMap.get(c.id)?.enrolledCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const sum = summaryMap.get(c.id);
                        if (!sum || sum.enrolledCount === 0) {
                          return <span className="text-[11px] text-ink-subtle">—</span>;
                        }
                        const pct = sum.avgProgressPct;
                        return (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-gray overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct === 100
                                    ? 'bg-status-success'
                                    : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-pco-deep w-8 text-right">
                              {pct}%
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {c.active === false ? (
                        <span className="pco-badge bg-surface-gray text-ink-muted">
                          Despublicado
                        </span>
                      ) : (
                        <span className="pco-badge bg-status-success/10 text-status-success">
                          Publicado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Link
                          to={`/admin/cursos/${c.id}/preview`}
                          className="pco-btn-ghost text-xs"
                          title="Preview como aluno"
                        >
                          <Eye size={12} strokeWidth={2} />
                        </Link>
                        <Link
                          to={`/admin/cursos/${c.id}/alunos`}
                          className="pco-btn-ghost text-xs"
                          title="Ver alunos matriculados"
                        >
                          <Users size={12} strokeWidth={2} />
                        </Link>
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

      {showCreate && (
        <NewCourseModal
          submitting={createMut.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={async (input) => {
            try {
              const created = await createMut.mutateAsync(input);
              toast.success('Curso criado', created.title);
              setShowCreate(false);
              navigate(`/admin/cursos/${created.id}`);
            } catch (err) {
              toast.error('Falha ao criar', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Azul PCO', value: 'from-pco-blue to-pco-cyan' },
  { label: 'Laranja', value: 'from-pco-orange to-pco-orange/70' },
  { label: 'Profundo', value: 'from-pco-deep to-pco-blue' },
  { label: 'Ciano claro', value: 'from-pco-cyan to-pco-blue/60' },
  { label: 'Verde', value: 'from-status-success to-pco-cyan' },
];

function NewCourseModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    slug: string;
    shortTitle: string;
    totalHours: number;
    certificateAvailable: boolean;
    coverColor: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortTitle, setShortTitle] = useState('');
  const [totalHours, setTotalHours] = useState(20);
  const [certificateAvailable, setCertificateAvailable] = useState(true);
  const [coverColor, setCoverColor] = useState(COLOR_PRESETS[0]!.value);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const effectiveShort =
    shortTitle.trim() || (title.length > 40 ? title.slice(0, 37) + '...' : title);
  const canSubmit = title.trim().length >= 2 && effectiveSlug.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Cadastro
            </div>
            <h2 className="text-lg font-bold text-pco-deep">Novo curso</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Título completo
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="pco-input"
              maxLength={200}
              placeholder="Ex: Psicanálise Avançada - Módulo II"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Título curto (até 60 caracteres)
            </div>
            <input
              type="text"
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              className="pco-input"
              maxLength={60}
              placeholder={effectiveShort || 'auto'}
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5 flex items-center gap-1.5">
              Slug (URL)
              {!slugTouched && title.length > 0 && (
                <span className="text-[10px] text-ink-subtle">auto</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-subtle">/curso/</span>
              <input
                type="text"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                className="pco-input font-mono text-xs"
                maxLength={80}
                pattern="[a-z0-9-]+"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="text-xs font-medium text-ink-muted mb-1.5">
                Carga horária (h)
              </div>
              <input
                type="number"
                min={0}
                max={10000}
                value={totalHours}
                onChange={(e) => setTotalHours(Number(e.target.value) || 0)}
                className="pco-input"
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={certificateAvailable}
                onChange={(e) => setCertificateAvailable(e.target.checked)}
                className="h-4 w-4 rounded text-pco-blue"
              />
              <span className="text-xs text-ink-muted">Emite certificado</span>
            </label>
          </div>

          <div>
            <div className="text-xs font-medium text-ink-muted mb-1.5">
              Cor da capa (até subir imagem)
            </div>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCoverColor(p.value)}
                  className={`h-10 rounded-lg bg-gradient-to-br ${p.value} ring-2 transition ${
                    coverColor === p.value ? 'ring-pco-deep' : 'ring-transparent'
                  }`}
                  title={p.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                onSubmit({
                  title: title.trim(),
                  slug: effectiveSlug,
                  shortTitle: effectiveShort,
                  totalHours,
                  certificateAvailable,
                  coverColor,
                })
              }
              disabled={!canSubmit || submitting}
              className="pco-btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '...' : 'Criar curso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
