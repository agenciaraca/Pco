import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Clock,
  Star,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { useCourseAnalytics } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

export default function AdminCourseAnalytics() {
  const t = useT();
  const { courseId } = useParams<{ courseId: string }>();
  useDocumentMeta({ title: 'Analytics — Admin' });
  const { data, isLoading } = useCourseAnalytics(courseId);

  if (isLoading) return <CardListSkeleton count={3} />;
  if (!data) return <Navigate to="/admin/cursos" replace />;

  const totalSeconds = data.watchTime.totalSeconds;
  const hoursWatched = Math.floor(totalSeconds / 3600);
  const minutesWatched = Math.floor((totalSeconds % 3600) / 60);

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/admin/cursos/${data.course.id}`}
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar para o editor
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-1 flex items-center gap-2">
          <BarChart3 size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.dashboard')}: {data.course.title}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          {data.course.totalModules} módulos · {data.course.totalLessons} aulas
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<Users size={14} className="text-pco-blue" />}
          label="Matriculados"
          value={String(data.enrollment.total)}
        />
        <Card
          icon={<TrendingUp size={14} className="text-pco-cyan" />}
          label="Taxa média de conclusão"
          value={`${data.enrollment.avgCompletionPct}%`}
        />
        <Card
          icon={<Clock size={14} className="text-pco-orange" />}
          label="Horas assistidas"
          value={`${hoursWatched}h ${minutesWatched}min`}
          hint={`${data.watchTime.uniqueLearners} aluno(s) únicos`}
        />
        <Card
          icon={<Star size={14} className="text-pco-orange" />}
          label="Avaliação média"
          value={
            data.rating.count === 0
              ? '—'
              : `${data.rating.avg.toFixed(1)} (${data.rating.count})`
          }
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-pco-deep mb-2">
          Distribuição de progresso
        </h2>
        <div className="pco-card p-4">
          <DistRow
            label="Concluíram o curso"
            value={data.enrollment.completed}
            total={data.enrollment.total}
            color="bg-status-success"
          />
          <DistRow
            label="Em progresso"
            value={data.enrollment.inProgress}
            total={data.enrollment.total}
            color="bg-pco-blue"
          />
          <DistRow
            label="Não começaram"
            value={data.enrollment.notStarted}
            total={data.enrollment.total}
            color="bg-surface-gray"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-pco-deep mb-2">Tempo por aula</h2>
        {data.watchTime.byLesson.length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Sem dados de watch-time ainda. O tracking começa quando alunos abrem aulas.
          </div>
        ) : (
          <div className="pco-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-2">ID da aula</th>
                  <th className="text-right px-3 py-2">Tempo total</th>
                  <th className="text-right px-3 py-2">Espectadores únicos</th>
                  <th className="text-right px-3 py-2">Média por aluno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {data.watchTime.byLesson
                  .sort((a, b) => b.totalSeconds - a.totalSeconds)
                  .map((row) => {
                    const avg =
                      row.viewers === 0 ? 0 : Math.round(row.totalSeconds / row.viewers);
                    return (
                      <tr key={row.lessonId}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.lessonId}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Math.round(row.totalSeconds / 60)} min
                        </td>
                        <td className="px-3 py-2 text-right">{row.viewers}</td>
                        <td className="px-3 py-2 text-right">
                          {Math.round(avg / 60)} min
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-pco-deep mb-2">
          Distribuição de notas
        </h2>
        <div className="pco-card p-4 space-y-1">
          {(['5', '4', '3', '2', '1'] as const).map((star) => (
            <DistRow
              key={star}
              label={`${star} estrela${star === '1' ? '' : 's'}`}
              value={data.rating.distribution[star]}
              total={data.rating.count || 1}
              color="bg-pco-orange"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
      {hint && <div className="text-xs text-ink-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

function DistRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total === 0 ? 0 : (value / total) * 100;
  return (
    <div className="text-xs py-1">
      <div className="flex justify-between mb-0.5">
        <span className="text-pco-deep">{label}</span>
        <span className="text-ink-muted">
          {value} <span className="text-ink-subtle">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-surface-gray rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
