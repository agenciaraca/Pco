import { BarChart3, Clock, Award, Star, BookOpen } from 'lucide-react';
import { useStudentAnalytics } from '../data/hooks';

export default function StudentAnalyticsPanel({ studentId }: { studentId: string }) {
  const { data, isLoading } = useStudentAnalytics(studentId);

  if (isLoading || !data) {
    return <div className="text-xs text-ink-muted">Carregando analytics...</div>;
  }

  const totalSeconds = data.watchTime.totalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<BookOpen size={14} className="text-pco-blue" />}
          label="Cursos matriculados"
          value={String(data.enrollment.total)}
        />
        <Stat
          icon={<BarChart3 size={14} className="text-pco-cyan" />}
          label="Aulas concluídas"
          value={String(data.enrollment.totalLessonsCompleted)}
        />
        <Stat
          icon={<Clock size={14} className="text-pco-orange" />}
          label="Horas assistidas"
          value={`${hours}h ${minutes}min`}
          hint={`${data.watchTime.lessonsTouched} aulas tocadas`}
        />
        <Stat
          icon={<Award size={14} className="text-pco-orange" />}
          label="Conquistas"
          value={String(data.engagement.achievementsEarned)}
          hint={`Streak: ${data.engagement.streak.current}d`}
        />
      </div>

      <section>
        <h3 className="text-sm font-semibold text-pco-deep mb-2">
          Progresso por curso
        </h3>
        {data.enrollment.courses.length === 0 ? (
          <div className="pco-card p-4 text-center text-xs text-ink-muted">
            Aluno sem cursos.
          </div>
        ) : (
          <div className="pco-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-mute text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-2">Curso</th>
                  <th className="text-right px-3 py-2">Aulas concluídas</th>
                  <th className="text-right px-3 py-2">Conclusão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {data.enrollment.courses.map((co) => (
                  <tr key={co.courseId}>
                    <td className="px-3 py-2 text-pco-deep">{co.title}</td>
                    <td className="px-3 py-2 text-right">
                      {co.completedLessons}/{co.totalLessons}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-surface-gray rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              co.completionPct >= 100
                                ? 'bg-status-success'
                                : 'bg-pco-blue'
                            }`}
                            style={{ width: `${co.completionPct}%` }}
                          />
                        </div>
                        <span className="font-semibold">{co.completionPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.engagement.streak.current > 0 && (
        <div className="pco-card p-3 flex items-center gap-3 bg-pco-orange/5 border-pco-orange/30">
          <span className="text-2xl">🔥</span>
          <div className="text-xs">
            <strong className="text-pco-deep">
              Sequência de {data.engagement.streak.current} dia(s)
            </strong>{' '}
            · recorde {data.engagement.streak.longest} dia(s)
            {data.engagement.streak.lastActiveDay && (
              <>
                {' '}
                · última atividade:{' '}
                {new Date(data.engagement.streak.lastActiveDay).toLocaleDateString(
                  'pt-BR',
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="pco-card p-3 flex items-center gap-2 text-xs text-ink-muted">
        <Star size={12} className="text-pco-orange" />
        Avaliações escritas:{' '}
        <strong>{data.engagement.reviewsWritten}</strong>
      </div>
    </div>
  );
}

function Stat({
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
    <div className="pco-card p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-pco-deep">{value}</div>
      {hint && <div className="text-xs text-ink-subtle mt-0.5">{hint}</div>}
    </div>
  );
}
