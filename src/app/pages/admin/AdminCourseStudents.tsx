import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  Award,
  X,
  Loader2,
} from 'lucide-react';
import {
  useCourseStudents,
  useAdminStudents,
  useBulkEnrollInCourse,
  useBulkIssueCertsForCourse,
} from '../../data/hooks';
import type { CourseStudentDto } from '../../data/api';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function AdminCourseStudents() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, isLoading } = useCourseStudents(courseId);
  useDocumentMeta({
    title: data ? `Alunos — ${data.courseTitle}` : 'Alunos do curso',
  });

  const [search, setSearch] = useState('');
  // O filtro é por situação NO CURSO, não pelo status global da ficha. Filtrar
  // por 'ativo' global devolvia a base inteira — inclusive quem está vencido há
  // três anos e quem foi estornado.
  const [situacaoFilter, setSituacaoFilter] = useState<
    'todos' | 'ativos' | 'vencidos' | 'suspensa' | 'cancelada'
  >('todos');
  const [enrollOpen, setEnrollOpen] = useState(false);

  const visible = useMemo(() => {
    const list = data?.students ?? [];
    return list.filter((s) => {
      if (situacaoFilter === 'ativos' && !s.ativoNoCurso) return false;
      if (situacaoFilter === 'vencidos' && !(s.situacao === 'ativa' && !s.ativoNoCurso))
        return false;
      if (situacaoFilter === 'suspensa' && s.situacao !== 'suspensa') return false;
      if (situacaoFilter === 'cancelada' && s.situacao !== 'cancelada') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [data, search, situacaoFilter]);

  const stats = useMemo(() => {
    const list = data?.students ?? [];
    const completed = list.filter((s) => s.progressPct === 100).length;
    const inProgress = list.filter(
      (s) => s.progressPct > 0 && s.progressPct < 100,
    ).length;
    const notStarted = list.filter((s) => s.progressPct === 0).length;
    const avgPct =
      list.length > 0
        ? Math.round(
            list.reduce((sum, s) => sum + s.progressPct, 0) / list.length,
          )
        : 0;
    return { completed, inProgress, notStarted, avgPct };
  }, [data]);

  if (isLoading) return <CardListSkeleton count={5} />;
  if (!data) {
    return (
      <EmptyState
        title="Curso não encontrado"
        description="O curso pode ter sido removido."
        icon={<Users size={28} />}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            to="/admin/cursos"
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-pco-deep mt-1 flex items-center gap-2">
            <Users size={20} className="text-pco-blue" strokeWidth={1.75} />
            Alunos matriculados
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            {data.courseTitle} · {data.enrolledCount} matriculado(s) · {data.totalLessons} aulas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkIssueCertsButton
            courseId={courseId!}
            completedCount={
              data.students.filter((s) => s.progressPct === 100).length
            }
          />
          <button
            type="button"
            onClick={() => setEnrollOpen(true)}
            className="pco-btn-primary"
          >
            <UserPlus size={12} strokeWidth={2} />
            Matricular alunos
          </button>
        </div>
      </div>

      {/* Duas fileiras, e a de cima veio primeiro de propósito: a pergunta que a
          tela errava era "quem está ativo", não "quem concluiu". */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Ativos no curso"
          value={data?.ativosCount ?? 0}
          icon={<CheckCircle2 size={14} className="text-status-success" />}
        />
        <Stat
          label="Acesso vencido"
          value={data?.vencidosCount ?? 0}
          icon={<Clock size={14} className="text-ink-muted" />}
        />
        <Stat
          label="Fora de situação"
          value={data?.foraDeSituacaoCount ?? 0}
          icon={<AlertTriangle size={14} className="text-status-danger" />}
        />
        <Stat
          label={data?.accessMonths ? `Prazo do curso` : 'Prazo do curso'}
          value={data?.accessMonths ? `${data.accessMonths} meses` : '—'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Concluíram"
          value={stats.completed}
          icon={<CheckCircle2 size={14} className="text-status-success" />}
        />
        <Stat
          label="Em andamento"
          value={stats.inProgress}
          icon={<Clock size={14} className="text-pco-blue" />}
        />
        <Stat
          label="Não começaram"
          value={stats.notStarted}
          icon={<AlertTriangle size={14} className="text-pco-orange" />}
        />
        <Stat label="Progresso médio" value={`${stats.avgPct}%`} />
      </div>

      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="pco-input text-sm flex-1"
          />
        </div>
        <select
          value={situacaoFilter}
          onChange={(e) => setSituacaoFilter(e.target.value as typeof situacaoFilter)}
          className="pco-input text-sm"
          aria-label="Situação no curso"
        >
          <option value="todos">Toda a matrícula ({data?.enrolledCount ?? 0})</option>
          <option value="ativos">Ativos no curso ({data?.ativosCount ?? 0})</option>
          <option value="vencidos">Acesso vencido ({data?.vencidosCount ?? 0})</option>
          <option value="suspensa">Pagamento pendurado</option>
          <option value="cancelada">Estorno ou desistência</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhum aluno"
          description="Nenhum aluno corresponde aos filtros."
          icon={<Users size={28} className="text-pco-blue" />}
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-ink-muted text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Aluno</th>
                <th className="text-left px-3 py-2">Situação no curso</th>
                <th className="text-left px-3 py-2">Progresso</th>
                <th className="text-right px-3 py-2">Última atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {visible.map((s) => (
                <tr key={s.studentId} className="hover:bg-surface-mute/40">
                  <td className="px-3 py-2">
                    <Link
                      to={`/admin/usuarios/${s.studentId}`}
                      className="font-semibold text-pco-deep hover:text-pco-blue"
                    >
                      {s.name}
                    </Link>
                    <div className="text-xs text-ink-subtle">{s.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <SeloSituacao aluno={s} />
                  </td>
                  <td className="px-3 py-2 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-gray overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s.progressPct === 100
                              ? 'bg-status-success'
                              : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
                          }`}
                          style={{ width: `${s.progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-pco-deep min-w-[30px] text-right">
                        {s.progressPct}%
                      </span>
                    </div>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {s.lessonsCompleted}/{s.totalLessons} aulas
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted text-right whitespace-nowrap">
                    {s.lastCompletedAt
                      ? new Date(s.lastCompletedAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enrollOpen && courseId && (
        <BulkEnrollModal
          courseId={courseId}
          courseTitle={data.courseTitle}
          alreadyEnrolledIds={new Set(data.students.map((s) => s.studentId))}
          onClose={() => setEnrollOpen(false)}
        />
      )}
    </div>
  );
}

function BulkEnrollModal({
  courseId,
  courseTitle,
  alreadyEnrolledIds,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  alreadyEnrolledIds: Set<string>;
  onClose: () => void;
}) {
  const allStudents = useAdminStudents({ status: 'todos', sortBy: 'name' });
  const bulkMut = useBulkEnrollInCourse();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    return (allStudents.data ?? []).filter((s) => {
      if (alreadyEnrolledIds.has(s.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.email.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allStudents.data, alreadyEnrolledIds, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleSubmit(force = false) {
    if (selected.size === 0) return;
    try {
      const r = await bulkMut.mutateAsync({
        courseId,
        studentIds: Array.from(selected),
        force,
      });
      const ineligibleCount = r.ineligible?.length ?? 0;
      if (ineligibleCount > 0 && !force) {
        const ok = confirm(
          `${r.enrolled} matrícula(s) criada(s). ${ineligibleCount} aluno(s) NÃO foram matriculados porque não cumprem os pré-requisitos do curso. Deseja matricular mesmo assim (override)?`,
        );
        if (ok) {
          // Re-tenta apenas os ineligíveis com force=true
          const ineligibleIds = (r.ineligible ?? []).map((i) => i.studentId);
          if (ineligibleIds.length > 0) {
            const rForce = await bulkMut.mutateAsync({
              courseId,
              studentIds: ineligibleIds,
              force: true,
            });
            toast.success(
              'Matrículas concluídas com override',
              `${r.enrolled + rForce.enrolled} novo(s), ${r.alreadyEnrolled} já estavam, ${r.errors.length + rForce.errors.length} erro(s)`,
            );
          }
          onClose();
          return;
        }
      }
      toast.success(
        'Matrículas criadas',
        `${r.enrolled} novo(s), ${r.alreadyEnrolled} já estavam, ${r.errors.length} erro(s)${
          ineligibleCount > 0 ? `, ${ineligibleCount} sem pré-req` : ''
        }`,
      );
      onClose();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="pco-card w-full max-w-2xl p-5 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-pco-deep">Matricular alunos</h2>
            <p className="text-xs text-ink-muted">{courseTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="pco-btn-ghost text-xs">
            <X size={11} strokeWidth={2} />
          </button>
        </div>

        <div className="pco-card p-2 flex items-center gap-2 mb-3">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aluno..."
            className="pco-input text-sm flex-1"
          />
          <span className="text-xs text-ink-subtle">
            {selected.size} selecionado(s)
          </span>
        </div>

        {allStudents.isLoading ? (
          <div className="text-sm text-ink-muted">Carregando...</div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-ink-muted text-center py-8">
            {search ? 'Nenhum aluno corresponde à busca.' : 'Todos já matriculados.'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-pco-border rounded">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-surface-mute">
                {candidates.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`cursor-pointer hover:bg-surface-mute/40 ${
                      selected.has(s.id) ? 'bg-pco-blue/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-pco-blue"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-pco-deep">{s.name}</div>
                      <div className="text-xs text-ink-subtle">{s.email}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-2 justify-end mt-3">
          <button type="button" onClick={onClose} className="pco-btn-ghost text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={bulkMut.isPending || selected.size === 0}
            className="pco-btn-primary"
          >
            {bulkMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <UserPlus size={12} strokeWidth={2} />
            )}
            Matricular {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O selo diz uma coisa só: esta pessoa pode estudar este curso agora?
 *
 * São dois cortes, nesta ordem — é a ordem que o portão usa (`access/guard.ts`).
 * Primeiro a situação da matrícula: estorno, desistência e pagamento pendurado
 * tiram do ar. Depois o prazo. Quem passa nos dois é ativo; o resto ganha o
 * motivo, porque "inativo" sem motivo não ajuda ninguém a resolver.
 */
function SeloSituacao({ aluno }: { aluno: CourseStudentDto }) {
  if (aluno.situacao === 'cancelada') {
    return (
      <span className="pco-badge text-xs bg-status-danger/15 text-status-danger">
        Cancelada
      </span>
    );
  }
  if (aluno.situacao === 'suspensa') {
    return (
      <span className="pco-badge text-xs bg-pco-orange/15 text-pco-orange">
        Suspensa
      </span>
    );
  }
  if (aluno.ativoNoCurso) {
    const dias = aluno.acesso.diasRestantes;
    return (
      <span
        className="pco-badge text-xs bg-status-success/10 text-status-success"
        title={
          aluno.acesso.expiraEm
            ? `Acesso até ${new Date(aluno.acesso.expiraEm).toLocaleDateString('pt-BR')}`
            : 'Sem prazo declarado'
        }
      >
        {aluno.acesso.estado === 'expiring' && dias !== null
          ? `Ativo · ${dias}d`
          : 'Ativo'}
      </span>
    );
  }
  return (
    <span
      className="pco-badge text-xs bg-ink-muted/15 text-ink-muted"
      title={
        aluno.acesso.expiraEm
          ? `Venceu em ${new Date(aluno.acesso.expiraEm).toLocaleDateString('pt-BR')}`
          : 'Sem acesso'
      }
    >
      Vencido
    </span>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="pco-card p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-pco-deep mt-1">{value}</div>
    </div>
  );
}

function BulkIssueCertsButton({
  courseId,
  completedCount,
}: {
  courseId: string;
  completedCount: number;
}) {
  const mut = useBulkIssueCertsForCourse();
  const toast = useToast();
  if (completedCount === 0) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (
          !confirm(
            `Emitir certificados para todos que concluíram o curso?\n\n${completedCount} aluno(s) elegível(is). Apenas quem completou 100% recebe.`,
          )
        )
          return;
        try {
          const r = await mut.mutateAsync(courseId);
          toast.success(
            'Certificados emitidos',
            `${r.issued} novos · ${r.alreadyIssued} já tinham · ${r.notCompleted} não concluíram`,
          );
        } catch (err) {
          toast.error('Falha', err instanceof Error ? err.message : 'Erro');
        }
      }}
      disabled={mut.isPending}
      className="pco-btn-ghost text-xs"
      title="Emite certificados retroativos para alunos que concluíram"
    >
      {mut.isPending ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Award size={12} strokeWidth={2} />
      )}
      Emitir certs ({completedCount})
    </button>
  );
}
