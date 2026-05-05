import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useCourseStudents } from '../../data/hooks';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'em_risco' | 'bloqueado'>(
    'all',
  );

  const visible = useMemo(() => {
    const list = data?.students ?? [];
    return list.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [data, search, statusFilter]);

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
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as typeof statusFilter)
          }
          className="pco-input text-sm"
        >
          <option value="all">Todos status</option>
          <option value="ativo">Ativos</option>
          <option value="em_risco">Em risco</option>
          <option value="bloqueado">Bloqueados</option>
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
            <thead className="bg-surface-mute text-ink-muted text-[11px] uppercase">
              <tr>
                <th className="text-left px-3 py-2">Aluno</th>
                <th className="text-left px-3 py-2">Status</th>
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
                    <div className="text-[11px] text-ink-subtle">{s.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`pco-badge text-[10px] ${
                        s.status === 'ativo'
                          ? 'bg-status-success/10 text-status-success'
                          : s.status === 'em_risco'
                            ? 'bg-pco-orange/10 text-pco-orange'
                            : 'bg-status-danger/15 text-status-danger'
                      }`}
                    >
                      {s.status}
                    </span>
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
                    <div className="text-[10px] text-ink-subtle mt-0.5">
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
    </div>
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
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-pco-deep mt-1">{value}</div>
    </div>
  );
}
