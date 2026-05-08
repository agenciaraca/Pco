import { Link } from 'react-router-dom';
import { useState } from 'react';
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
  ArrowUpDown,
  X,
  Save,
  Loader2,
  Trash2,
} from 'lucide-react';
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

export default function AdminUsers() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.students')} — Admin AVA PCO` });
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<NonNullable<StudentsFilter['status']>>('todos');
  const [courseFilter, setCourseFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<NonNullable<StudentsFilter['sortBy']>>('name');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminStudentRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const filtered = studentsQ.data ?? [];
  const isLoading = studentsQ.isLoading;
  const isFetching = studentsQ.isFetching && !isLoading;
  const isError = studentsQ.isError;

  const totals = {
    total: filtered.length,
    ativos: filtered.filter((s) => s.status === 'ativo').length,
    em_risco: filtered.filter((s) => s.status === 'em_risco').length,
    bloqueados: filtered.filter((s) => s.status === 'bloqueado').length,
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

      <div className="pco-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              size={14}
              strokeWidth={1.75}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pco-input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as NonNullable<StudentsFilter['status']>)
            }
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
            onChange={(e) => setCourseFilter(e.target.value)}
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
          <span className="text-xs text-ink-subtle ml-auto">
            <Filter size={12} className="inline mr-1" />
            {filtered.length} resultado(s)
            {isFetching && <span className="ml-2 text-pco-blue">atualizando…</span>}
          </span>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="pco-card p-3 flex items-center justify-between flex-wrap gap-3 bg-pco-blue/5 border-pco-blue/30">
          <div className="text-sm text-pco-deep">
            <strong>{selectedIds.size}</strong> aluno{selectedIds.size === 1 ? '' : 's'} selecionado{selectedIds.size === 1 ? '' : 's'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const rows = filtered.filter((s) => selectedIds.has(s.id));
                if (rows.length === 0) return;
                const headers = ['id', 'name', 'email', 'status', 'riskScore', 'lastAccessAt'];
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
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
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
              className="pco-btn-secondary text-xs"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={async () => {
                const rows = filtered.filter((s) => selectedIds.has(s.id));
                if (
                  !confirm(`Bloquear ${rows.length} aluno(s) selecionado(s)?`)
                )
                  return;
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
                toast.success(`${ok} aluno(s) bloqueado(s)`);
                setSelectedIds(new Set());
              }}
              className="pco-btn-secondary text-xs"
            >
              Bloquear
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="pco-btn-ghost text-xs"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-3 py-3 text-left font-medium w-8">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((s) => selectedIds.has(s.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filtered.map((s) => s.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Aluno</th>
                  <th className="px-4 py-3 text-left font-medium">Cursos</th>
                  <th className="px-4 py-3 text-left font-medium">Progresso</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => setSortBy('risk')}
                      className="inline-flex items-center gap-1 hover:text-pco-deep"
                    >
                      Risco
                      <ArrowUpDown size={10} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const initials = s.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('');
                  const enrolledCourses = s.enrolledCourseIds
                    .map((id) => (courses ?? []).find((c) => c.id === id))
                    .filter(Boolean);
                  const avgProgress =
                    Object.values(s.progressByCourse).reduce((a, b) => a + b, 0) /
                    Math.max(1, Object.keys(s.progressByCourse).length);
                  return (
                    <tr key={s.id} className="border-t border-surface-gray hover:bg-surface-off">
                      <td className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            setSelectedIds(next);
                          }}
                          className="h-3.5 w-3.5 rounded text-pco-blue focus:ring-pco-blue"
                          aria-label={`Selecionar ${s.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-xs font-semibold text-white">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-pco-deep truncate">{s.name}</div>
                            <div className="text-[11px] text-ink-subtle truncate">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {enrolledCourses.map((c) => (
                            <span
                              key={c!.id}
                              className="pco-badge bg-pco-blue/10 text-pco-blue"
                            >
                              {c!.shortTitle}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-ink-muted mb-1">
                          {Math.round(avgProgress)}% médio
                        </div>
                        <div className="h-1.5 w-24 rounded-full bg-surface-gray overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                            style={{ width: `${avgProgress}%` }}
                          />
                        </div>
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
