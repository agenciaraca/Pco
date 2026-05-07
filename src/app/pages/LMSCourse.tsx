import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, Clock, Layers, Lock, PlayCircle } from 'lucide-react';
import { useCourses, useMyProgress, useCurrentStudent } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import CourseReviews from '../components/CourseReviews';

export default function LMSCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: courses = [], isLoading } = useCourses();
  const progress = useMyProgress();
  const { data: student } = useCurrentStudent();

  if (isLoading) return <CardListSkeleton count={3} />;
  const course = courses.find((c) => c.id === courseId);
  if (!course) return <Navigate to="/cursos" replace />;

  const doneIds = new Set(progress.data?.completedLessonIds ?? []);
  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const done = course.modules.reduce(
    (s, m) =>
      s + m.lessons.filter((l) => doneIds.has(l.id) || l.status === 'completed').length,
    0,
  );
  const pct = totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0;
  const nextModule =
    course.modules.find((m) => m.status === 'in_progress') ??
    course.modules.find((m) => m.status === 'available');

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-pco-blue">
          Curso
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">{course.title}</h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">{course.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Layers size={13} strokeWidth={1.75} className="text-pco-blue" />
            {course.modules.length} módulos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} strokeWidth={1.75} className="text-pco-blue" />
            {course.totalHours}h
          </span>
        </div>
      </header>

      <div className="pco-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-[11px] text-ink-muted mb-1">
              <span>Progresso</span>
              <span className="font-semibold text-pco-deep">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {nextModule && (
            <Link
              to={`/curso/${course.id}/modulo/${nextModule.id}`}
              className="pco-btn-primary"
            >
              Continuar módulo
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          )}
          <Link
            to={`/curso/${course.id}/quiz`}
            className="pco-btn-ghost text-xs"
            title="Pratique com 10 questões aleatórias do banco"
          >
            Praticar com quiz →
          </Link>
        </div>
      </div>

      {(course.changelog?.length ?? 0) > 0 && (
        <section className="pco-card p-5 bg-pco-blue/5 border-pco-blue/30">
          <h2 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
            ✨ Novidades neste curso
          </h2>
          <ul className="space-y-3">
            {course.changelog!.slice(0, 5).map((c, idx) => (
              <li key={idx} className="text-sm">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-bold text-pco-deep">{c.version}</span>
                  <span className="text-[11px] text-ink-subtle">
                    {new Date(c.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-ink-strong whitespace-pre-line">{c.notes}</p>
              </li>
            ))}
          </ul>
          {course.changelog!.length > 5 && (
            <div className="text-[11px] text-ink-subtle mt-3">
              + {course.changelog!.length - 5} entry(ies) anteriores
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-4">Conteúdo do curso</h2>
        <div className="space-y-3">
          {course.modules.map((module, i) => {
            const moduleDone = module.lessons.filter(
              (l) => doneIds.has(l.id) || l.status === 'completed',
            ).length;
            const moduleTotal = module.lessons.length;
            const modulePct =
              moduleTotal > 0 ? Math.round((moduleDone / moduleTotal) * 100) : 0;
            const isComplete = modulePct === 100;
            const isLocked = module.locked === true;
            const lockedDateLabel = module.lockedUntil
              ? new Date(module.lockedUntil).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })
              : '';
            const containerCls = isLocked
              ? 'pco-card flex items-center gap-4 opacity-60 cursor-not-allowed'
              : 'pco-card pco-card-hover flex items-center gap-4';
            const inner = (
              <>
                <div
                  className={`h-12 w-12 rounded-xl grid place-items-center font-bold shrink-0 ${
                    isLocked
                      ? 'bg-surface-mute text-ink-muted'
                      : isComplete
                        ? 'bg-status-success/15 text-status-success'
                        : modulePct > 0
                          ? 'bg-pco-blue/15 text-pco-blue'
                          : 'bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 text-pco-deep'
                  }`}
                >
                  {isLocked ? <Lock size={18} strokeWidth={2} /> : isComplete ? '✓' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-pco-deep">
                      {module.title}
                    </h3>
                    <span className="text-[11px] font-bold text-pco-deep">
                      {isLocked ? `Libera ${lockedDateLabel}` : `${modulePct}%`}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-1">
                    {module.description}
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-surface-gray overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isLocked
                          ? 'bg-surface-mute'
                          : isComplete
                            ? 'bg-status-success'
                            : 'bg-gradient-to-r from-pco-blue to-pco-cyan'
                      }`}
                      style={{ width: `${isLocked ? 0 : modulePct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-subtle">
                    {isLocked
                      ? `Disponível em ${new Date(module.lockedUntil ?? '').toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                      : `${moduleDone}/${moduleTotal} aulas concluídas`}
                  </div>
                </div>
                {isLocked ? (
                  <Lock
                    size={20}
                    className="text-ink-muted shrink-0"
                    strokeWidth={1.75}
                  />
                ) : (
                  <PlayCircle
                    size={20}
                    className="text-pco-blue shrink-0"
                    strokeWidth={1.75}
                  />
                )}
              </>
            );
            return isLocked ? (
              <div
                key={module.id}
                className={containerCls}
                aria-disabled="true"
                title={`Disponível em ${module.lockedUntil}`}
              >
                {inner}
              </div>
            ) : (
              <Link
                key={module.id}
                to={`/curso/${course.id}/modulo/${module.id}`}
                className={containerCls}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      <CourseReviews
        courseId={course.id}
        canReview={
          (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds?.includes(
            course.id,
          ) ?? false
        }
      />
    </div>
  );
}
