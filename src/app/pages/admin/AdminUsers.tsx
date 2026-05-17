import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Eye,
  Mail,
  Lock,
  Unlock,
  X,
  Save,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import SortableTh from '../../components/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';
import { useAuth } from '../../auth/AuthContext';
import {
  useAdminStudents,
  useCourses,
  useCreateAdminStudent,
  useBlockStudent,
  useUnblockStudent,
  useDeleteAdminStudent,
} from '../../data/hooks';
import {
  createStudentSchema,
  type CreateStudentInput,
  type StudentsFilter,
} from '../../../../shared/schemas';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import type { AdminStudentRow } from '../../data/seed';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

const statusStyles: Record<AdminStudentRow['status'], string> = {
  ativo: 'bg-status-success/10 text-status-success',
  em_risco: 'bg-pco-orange/10 text-pco-orange',
  bloqueado: 'bg-status-danger/15 text-status-danger',
  inativo: 'bg-surface-gray text-ink-muted',
};

const statusLabel: Record<AdminStudentRow['status'], string> = {
  ativo: 'Ativo',
  em_risco: 'Em risco',
  bloqueado: 'Bloqueado',
  inativo: 'Inativo',
};

type PageSize = 20 | 50 | 100 | 200 | 'all';

export default function AdminUsers() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.students')} — Admin AVA PCO` });
  const toast = useToast();
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<NonNullable<StudentsFilter['status']>>('todos');
  const [courseFilter, setCourseFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<NonNullable<StudentsFilter['sortBy']>>('name');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminStudentRow | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [riskMin, setRiskMin] = useState<number>(0);
  const [riskMax, setRiskMax] = useState<number>(100);
  const [progressMin, setProgressMin] = useState<number>(0);
  const [progressMax, setProgressMax] = useState<number>(100);
  const [lastAccessWithin, setLastAccessWithin] = useState<'any' | '7d' | '30d' | '90d' | '180d' | '365d' | 'never180'>('any');
  const [enrolledMin, setEnrolledMin] = useState<number>(0);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const { data: courses } = useCourses();
  const studentsQ = useAdminStudents({
    search,
    status: statusFilter,
    courseId: courseFilter,
    sortBy,
  });

  const createMut = useCreateAdminStudent();
  const blockMut = useBlockStudent();
  const unblockMut = useUnblockStudent();
  const deleteMut = useDeleteAdminStudent();

  const baseRows = studentsQ.data ?? [];
  const isLoading = studentsQ.isLoading;
  const isFetching = studentsQ.isFetching && !isLoading;
  const isError = studentsQ.isError;

  const filtered = useMemo(() => {
    const now = Date.now();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
    return baseRows.filter((s) => {
      if (s.riskScore < riskMin || s.riskScore > riskMax) return false;
      const progresses = Object.values(s.progressByCourse);
      const avg = progresses.length
        ? progresses.reduce((a, b) => a + b, 0) / progresses.length
        : 0;
      if (avg < progressMin || avg > progressMax) return false;
      if (s.enrolledCourseIds.length < enrolledMin) return false;
      if (lastAccessWithin !== 'any') {
        const last = new Date(s.lastAccessAt).getTime();
        const diffDays = (now - last) / 86_400_000;
        if (lastAccessWithin === 'never180') {
          if (!(diffDays > 180)) return false;
        } else {
          const cap = daysMap[lastAccessWithin];
          if (diffDays > cap) return false;
        }
      }
      return true;
    });
  }, [baseRows, riskMin, riskMax, progressMin, progressMax, enrolledMin, lastAccessWithin]);

  const {
    rows: sortedFiltered,
    field: sortField,
    direction: sortDirection,
    toggleSort,
  } = useTableSort(
    filtered,
    (row, field) => {
      switch (field) {
        case 'name':
          return row.name;
        case 'email':
          return row.email;
        case 'courses':
          return row.enrolledCourseIds.length;
        case 'progress': {
          const vals = Object.values(row.progressByCourse);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
        case 'status':
          return row.status;
        case 'risk':
          return row.riskScore;
        case 'lastAccess':
          return row.lastAccessAt;
        default:
          return null;
      }
    },
    'name',
  );

  const totalRows = sortedFiltered.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(totalRows, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * effectivePageSize;
  const endIdx = Math.min(startIdx + effectivePageSize, totalRows);
  const pageRows = pageSize === 'all' ? sortedFiltered : sortedFiltered.slice(startIdx, endIdx);

  const totals = {
    total: baseRows.length,
    ativos: baseRows.filter((s) => s.status === 'ativo').length,
    em_risco: baseRows.filter((s) => s.status === 'em_risco').length,
    bloqueados: baseRows.filter((s) => s.status === 'bloqueado').length,
  };

  const activeFiltersCount =
    (riskMin > 0 || riskMax < 100 ? 1 : 0) +
    (progressMin > 0 || progressMax < 100 ? 1 : 0) +
    (lastAccessWithin !== 'any' ? 1 : 0) +
    (enrolledMin > 0 ? 1 : 0);

  const resetExtraFilters = () => {
    setRiskMin(0);
    setRiskMax(100);
    setProgressMin(0);
    setProgressMax(100);
    setLastAccessWithin('any');
    setEnrolledMin(0);
  };

  const handleImpersonate = async (s: AdminStudentRow) => {
    if (impersonatingId) return;
    setImpersonatingId(s.id);
    try {
      await auth.startImpersonation(s.id);
    } catch (err) {
      setImpersonatingId(null);
      toast.error('Falha ao entrar como aluno', err instanceof Error ? err.message : 'Erro');
    }
  };

  const toggleBlock = async (s: AdminStudentRow) => {
    try {
      if (s.status === 'bloqueado') {
        await unblockMut.mutateAsync(s.id);
        toast.success('Aluno desbloqueado', s.name);
      } else {
        await blockMut.mutateAsync(s.id);
        toast.success('Aluno bloqueado', s.name);
      }
    } catch (err) {
      toast.error('Falha ao mudar status', err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Aluno excluído', confirmDelete.name);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.students')}</h1>
          <p className="pco-section-subtitle mt-1">
            Listagem, filtros, importação e gestão acadêmica.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              toast.info('Importar CSV', 'Em desenvolvimento — usar criação manual por enquanto.')
            }
            className="pco-btn-secondary text-xs"
          >
            <Upload size={12} strokeWidth={2} />
            Importar CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="pco-btn-primary text-xs">
            <Plus size={12} strokeWidth={2} />
            Novo aluno
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total" value={totals.total} />
        <SummaryCard label="Ativos" value={totals.ativos} accent="green" />
        <SummaryCard label="Em risco" value={totals.em_risco} accent="orange" />
        <SummaryCard label="Bloqueados" value={totals.bloqueados} accent="danger" />
      </div>

      <div className="pco-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              size={14}
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome ou e-mail..."
              className="pco-input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as NonNullable<StudentsFilter['status']>);
              setPage(1);
            }}
            className="pco-input w-auto"
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="em_risco">Em risco</option>
            <option value="bloqueado">Bloqueados</option>
            <option value="inativo">Inativos</option>
          </select>
          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            className="pco-input w-auto"
          >
            <option value="todos">Todos os cursos</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortTitle}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="pco-input w-auto"
          >
            <option value="name">Ordenar: Nome</option>
            <option value="risk">Ordenar: Risco</option>
            <option value="lastAccess">Ordenar: Último acesso</option>
          </select>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="pco-btn-ghost text-xs inline-flex items-center gap-1"
            aria-expanded={filtersOpen}
          >
            <Filter size={12} strokeWidth={1.75} />
            Filtros avançados
            {activeFiltersCount > 0 && (
              <span className="pco-badge bg-pco-blue text-white text-[10px] px-1.5 py-0">
                {activeFiltersCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <span className="text-xs text-ink-subtle ml-auto">
            <Filter size={12} className="inline mr-1" />
            {filtered.length} resultado(s)
            {filtered.length !== baseRows.length && (
              <span className="ml-1 text-ink-subtle/70">de {baseRows.length}</span>
            )}
            {isFetching && <span className="ml-2 text-pco-blue">atualizando…</span>}
          </span>
        </div>

        {filtersOpen && (
          <div className="pt-3 border-t border-surface-gray grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle mb-1.5">
                Risco entre
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={riskMin}
                  onChange={(e) => {
                    setRiskMin(Number(e.target.value));
                    setPage(1);
                  }}
                  className="pco-input w-20"
                />
                <span className="text-xs text-ink-subtle">e</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={riskMax}
                  onChange={(e) => {
                    setRiskMax(Number(e.target.value));
                    setPage(1);
                  }}
                  className="pco-input w-20"
                />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle mb-1.5">
                Progresso médio (%)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressMin}
                  onChange={(e) => {
                    setProgressMin(Number(e.target.value));
                    setPage(1);
                  }}
                  className="pco-input w-20"
                />
                <span className="text-xs text-ink-subtle">e</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressMax}
                  onChange={(e) => {
                    setProgressMax(Number(e.target.value));
                    setPage(1);
                  }}
                  className="pco-input w-20"
                />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle mb-1.5">
                Último acesso
              </div>
              <select
                value={lastAccessWithin}
                onChange={(e) => {
                  setLastAccessWithin(e.target.value as typeof lastAccessWithin);
                  setPage(1);
                }}
                className="pco-input"
              >
                <option value="any">Qualquer</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="180d">Últimos 180 dias</option>
                <option value="365d">Últimos 365 dias</option>
                <option value="never180">Sem acesso há +180 dias</option>
              </select>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle mb-1.5">
                Matriculado em ≥
              </div>
              <input
                type="number"
                min={0}
                value={enrolledMin}
                onChange={(e) => {
                  setEnrolledMin(Number(e.target.value));
                  setPage(1);
                }}
                className="pco-input w-24"
                placeholder="curso(s)"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="button"
                onClick={resetExtraFilters}
                className="pco-btn-ghost text-xs"
                disabled={activeFiltersCount === 0}
              >
                Limpar filtros avançados
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra de ações em massa — sempre visível no topo, contagem 0 quando vazio */}
      <div
        className={`pco-card p-3 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10 ${
          selectedIds.size > 0
            ? 'bg-pco-blue/5 border-pco-blue/30'
            : 'bg-surface-soft/60 border-surface-gray'
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          {selectedIds.size > 0 ? (
            <>
              <span className="font-semibold text-pco-deep">
                {selectedIds.size}
              </span>
              <span className="text-ink-muted">
                aluno{selectedIds.size === 1 ? '' : 's'} selecionado
                {selectedIds.size === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">
              Selecione alunos abaixo para ações em massa
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={() => {
              const rows = filtered.filter((s) => selectedIds.has(s.id));
              if (rows.length === 0) return;
              const headers = [
                'id',
                'name',
                'email',
                'status',
                'riskScore',
                'lastAccessAt',
              ];
              const csv = [
                headers.join(','),
                ...rows.map((r) =>
                  headers
                    .map(
                      (h) =>
                        `"${String((r as unknown as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`,
                    )
                    .join(','),
                ),
              ].join('\r\n');
              const blob = new Blob([csv], {
                type: 'text/csv;charset=utf-8',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `alunos-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success(`${rows.length} aluno(s) exportados`);
            }}
            className="pco-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={async () => {
              const rows = filtered.filter((s) => selectedIds.has(s.id));
              if (!confirm(`Bloquear ${rows.length} aluno(s) selecionado(s)?`))
                return;
              setBulkBusy(true);
              let ok = 0;
              for (const r of rows) {
                if (r.status === 'bloqueado') continue;
                try {
                  await blockMut.mutateAsync(r.id);
                  ok++;
                } catch {
                  // continua
                }
              }
              setBulkBusy(false);
              toast.success(`${ok} aluno(s) bloqueado(s)`);
              setSelectedIds(new Set());
            }}
            className="pco-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Bloquear
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={async () => {
              const rows = filtered.filter((s) => selectedIds.has(s.id));
              if (
                !confirm(`Desbloquear ${rows.length} aluno(s) selecionado(s)?`)
              )
                return;
              setBulkBusy(true);
              let ok = 0;
              for (const r of rows) {
                if (r.status !== 'bloqueado') continue;
                try {
                  await unblockMut.mutateAsync(r.id);
                  ok++;
                } catch {
                  // continua
                }
              }
              setBulkBusy(false);
              toast.success(`${ok} aluno(s) desbloqueado(s)`);
              setSelectedIds(new Set());
            }}
            className="pco-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Desbloquear
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={() => setConfirmBulkDelete(true)}
            className="pco-btn-danger text-xs disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Trash2 size={12} strokeWidth={2} />
            Excluir
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkBusy}
            onClick={() => setSelectedIds(new Set())}
            className="pco-btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBulkDelete}
        variant="danger"
        title={`Excluir ${selectedIds.size} aluno${selectedIds.size === 1 ? '' : 's'}?`}
        description={
          <div className="space-y-2 text-sm">
            <p>
              Esta ação <strong>não pode ser desfeita</strong>. Os{' '}
              {selectedIds.size} alunos selecionados serão removidos
              permanentemente, incluindo:
            </p>
            <ul className="list-disc list-inside text-xs text-ink-muted ml-2">
              <li>Conta de acesso (não poderão mais fazer login)</li>
              <li>Histórico de progresso</li>
              <li>Anotações pessoais</li>
              <li>Matrículas em cursos</li>
            </ul>
            <p className="text-xs text-ink-muted">
              Pedidos e certificados emitidos são preservados (referência
              histórica), mas órfãos.
            </p>
          </div>
        }
        confirmLabel={`Excluir ${selectedIds.size}`}
        loading={bulkBusy}
        onConfirm={async () => {
          const rows = filtered.filter((s) => selectedIds.has(s.id));
          setBulkBusy(true);
          let ok = 0;
          let fail = 0;
          for (const r of rows) {
            try {
              await deleteMut.mutateAsync(r.id);
              ok++;
            } catch {
              fail++;
            }
          }
          setBulkBusy(false);
          setConfirmBulkDelete(false);
          setSelectedIds(new Set());
          if (fail > 0) {
            toast.info(`${ok} aluno(s) excluído(s), ${fail} falharam`);
          } else {
            toast.success(`${ok} aluno(s) excluído(s)`);
          }
        }}
        onCancel={() => setConfirmBulkDelete(false)}
      />


      {isLoading && <TableSkeleton rows={5} />}

      {isError && (
        <div className="pco-card">
          <ErrorState
            title="Não foi possível carregar a lista"
            action={
              <button onClick={() => studentsQ.refetch()} className="pco-btn-primary text-xs">
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Nenhum aluno encontrado"
            description="Ajuste os filtros ou faça uma nova busca."
          />
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="pco-card p-0 overflow-hidden">
          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRows={totalRows}
            startIdx={startIdx}
            endIdx={endIdx}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            position="top"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-3 py-3 text-left font-medium w-8">
                    <input
                      type="checkbox"
                      checked={
                        pageRows.length > 0 &&
                        pageRows.every((s) => selectedIds.has(s.id))
                      }
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) {
                          pageRows.forEach((s) => next.add(s.id));
                        } else {
                          pageRows.forEach((s) => next.delete(s.id));
                        }
                        setSelectedIds(next);
                      }}
                      className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue"
                      aria-label="Selecionar todos na página"
                    />
                  </th>
                  <SortableTh field="name" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Aluno
                  </SortableTh>
                  <SortableTh field="courses" current={sortField} direction={sortDirection} onSort={toggleSort} align="center">
                    Cursos
                  </SortableTh>
                  <SortableTh field="progress" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Progresso
                  </SortableTh>
                  <SortableTh field="status" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Status
                  </SortableTh>
                  <SortableTh field="risk" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Risco
                  </SortableTh>
                  <SortableTh field="lastAccess" current={sortField} direction={sortDirection} onSort={toggleSort}>
                    Último acesso
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => {
                  const initials = s.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('');
                  const courseCount = s.enrolledCourseIds.length;
                  const avgProgress =
                    Object.values(s.progressByCourse).reduce((a, b) => a + b, 0) /
                    Math.max(1, Object.keys(s.progressByCourse).length);
                  const progressHref = `/admin/alunos/${s.id}?tab=progresso`;
                  return (
                    <tr key={s.id} className="border-t border-surface-gray hover:bg-surface-off">
                      <td className="px-3 py-3 w-8 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            setSelectedIds(next);
                          }}
                          className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue mt-1"
                          aria-label={`Selecionar ${s.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-pco-deep whitespace-normal break-words leading-snug">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-ink-subtle break-all">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={progressHref}
                          className="inline-block text-sm font-medium text-ink-muted hover:text-pco-blue tabular-nums"
                          title={`Ver ${courseCount} curso(s) matriculados`}
                        >
                          {courseCount}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={progressHref}
                          className="block hover:opacity-80"
                          title="Ver progresso detalhado"
                        >
                          <div className="text-xs text-ink-muted mb-1">
                            {Math.round(avgProgress)}% médio
                          </div>
                          <div className="h-1.5 w-24 rounded-full bg-surface-gray overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                              style={{ width: `${avgProgress}%` }}
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`pco-badge ${statusStyles[s.status]}`}>
                          {statusLabel[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-pco-deep">{s.riskScore}</span>
                          <div className="h-1.5 w-12 rounded-full bg-surface-gray overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.riskScore >= 75
                                  ? 'bg-status-danger'
                                  : s.riskScore >= 55
                                    ? 'bg-pco-orange'
                                    : s.riskScore >= 30
                                      ? 'bg-pco-blue'
                                      : 'bg-status-success'
                              }`}
                              style={{ width: `${s.riskScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {new Date(s.lastAccessAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/alunos/${s.id}`}
                            className="pco-btn-ghost text-xs px-2.5"
                            title="Ver perfil"
                          >
                            <Eye size={12} strokeWidth={1.75} />
                          </Link>
                          <button
                            onClick={() => handleImpersonate(s)}
                            disabled={!!impersonatingId}
                            className="pco-btn-ghost text-xs px-2.5 text-pco-blue hover:bg-pco-blue/10"
                            title="Entrar como este aluno"
                          >
                            {impersonatingId === s.id ? (
                              <Loader2 size={12} strokeWidth={1.75} className="animate-spin" />
                            ) : (
                              <UserCog size={12} strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            onClick={() => toast.info('E-mail', `Composição para ${s.name} será aberta.`)}
                            className="pco-btn-ghost text-xs px-2.5"
                            title="Enviar e-mail"
                          >
                            <Mail size={12} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => toggleBlock(s)}
                            disabled={blockMut.isPending || unblockMut.isPending}
                            className="pco-btn-ghost text-xs px-2.5"
                            title={s.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                          >
                            {s.status === 'bloqueado' ? (
                              <Unlock size={12} strokeWidth={1.75} className="text-status-success" />
                            ) : (
                              <Lock size={12} strokeWidth={1.75} className="text-status-danger" />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(s)}
                            className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                            title="Excluir"
                          >
                            <Trash2 size={12} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRows={totalRows}
            startIdx={startIdx}
            endIdx={endIdx}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            position="bottom"
          />
        </div>
      )}

      {showCreate && (
        <StudentEditor
          courses={(courses ?? []).map((c) => ({ id: c.id, shortTitle: c.shortTitle }))}
          submitting={createMut.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            try {
              await createMut.mutateAsync(data);
              toast.success('Aluno criado', data.name);
              setShowCreate(false);
            } catch (err) {
              toast.error('Falha ao criar', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir aluno?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.name}</span> e todas
              as suas matrículas e dados acadêmicos serão removidos. Esta ação é irreversível.
            </>
          )
        }
        confirmLabel="Excluir aluno"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

interface StudentEditorProps {
  courses: Array<{ id: string; shortTitle: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
}

function StudentEditor({ courses, submitting, onClose, onSubmit }: StudentEditorProps) {
  type FormInput = z.input<typeof createStudentSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormInput, unknown, CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      name: '',
      email: '',
      weeklyGoalMinutes: 180,
      status: 'ativo',
      enrolledCourseIds: [],
    },
  });

  const enrolled = watch('enrolledCourseIds') ?? [];

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
            <h2 className="text-lg font-bold text-pco-deep">Novo aluno</h2>
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

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
          <Field label="Nome completo" error={errors.name?.message}>
            <input {...register('name')} className="pco-input" />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <input {...register('email')} type="email" className="pco-input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Meta semanal (min)" error={errors.weeklyGoalMinutes?.message}>
              <input
                type="number"
                min={15}
                max={2400}
                {...register('weeklyGoalMinutes', { valueAsNumber: true })}
                className="pco-input"
              />
            </Field>
            <Field label="Status">
              <select {...register('status')} className="pco-input">
                <option value="ativo">Ativo</option>
                <option value="em_risco">Em risco</option>
                <option value="bloqueado">Bloqueado</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>
          </div>

          {courses.length > 0 && (
            <Field label="Matricular nos cursos">
              <div className="flex flex-wrap gap-1.5">
                {courses.map((c) => {
                  const active = enrolled.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(enrolled);
                        if (set.has(c.id)) set.delete(c.id);
                        else set.add(c.id);
                        setValue('enrolledCourseIds', Array.from(set));
                      }}
                      className={`pco-badge cursor-pointer ${
                        active
                          ? 'bg-pco-blue text-white'
                          : 'bg-pco-blue/10 text-pco-blue hover:bg-pco-blue/20'
                      }`}
                    >
                      {c.shortTitle}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              className="pco-btn-ghost text-xs"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Criar aluno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
    </label>
  );
}

function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalRows,
  startIdx,
  endIdx,
  onPageChange,
  onPageSizeChange,
  position,
}: {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  totalRows: number;
  startIdx: number;
  endIdx: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
  position: 'top' | 'bottom';
}) {
  const isAll = pageSize === 'all';
  const fromLabel = totalRows === 0 ? 0 : startIdx + 1;
  const toLabel = isAll ? totalRows : endIdx;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface-off ${
        position === 'top' ? 'border-b border-surface-gray' : 'border-t border-surface-gray'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span>Mostrando</span>
        <span className="font-semibold text-pco-deep tabular-nums">
          {fromLabel}–{toLabel}
        </span>
        <span>de</span>
        <span className="font-semibold text-pco-deep tabular-nums">{totalRows}</span>
        <span className="hidden sm:inline">aluno(s)</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Por página:</span>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              const v = e.target.value;
              onPageSizeChange((v === 'all' ? 'all' : (Number(v) as PageSize)));
            }}
            className="pco-input w-auto py-1 text-xs"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="all">Todos</option>
          </select>
        </label>
        {!isAll && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="pco-btn-ghost text-xs px-2 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Página anterior"
            >
              <ChevronLeft size={12} strokeWidth={1.75} />
            </button>
            <span className="text-xs text-ink-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="pco-btn-ghost text-xs px-2 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Próxima página"
            >
              <ChevronRight size={12} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'orange' | 'danger';
}) {
  const accentText =
    accent === 'green'
      ? 'text-status-success'
      : accent === 'orange'
        ? 'text-pco-orange'
        : accent === 'danger'
          ? 'text-status-danger'
          : 'text-pco-deep';
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${accentText}`}>{value}</div>
    </div>
  );
}
