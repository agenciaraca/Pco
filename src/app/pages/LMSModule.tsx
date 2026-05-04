import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clock, PlayCircle, ScrollText } from 'lucide-react';
import { useCourses, useMyProgress } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';

export default function LMSModule() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const { data: courses = [], isLoading } = useCourses();
  const progress = useMyProgress();
  if (isLoading) return <CardListSkeleton count={3} />;
  const course = courses.find((c) => c.id === courseId);
  const module = course?.modules.find((m) => m.id === moduleId);
  if (!course || !module) return <Navigate to="/cursos" replace />;

  const doneIds = new Set(progress.data?.completedLessonIds ?? []);
  const completed = module.lessons.filter(
    (l) => doneIds.has(l.id) || l.status === 'completed',
  ).length;
  const pct = Math.round((completed / module.lessons.length) * 100);

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/curso/${course.id}`}
          className="text-xs font-medium text-pco-blue hover:underline"
        >
          ← {course.shortTitle}
        </Link>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Módulo {module.order}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">{module.title}</h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">{module.description}</p>
      </header>

      <div className="pco-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-[11px] text-ink-muted mb-1">
              <span>Aulas concluídas</span>
              <span className="font-semibold text-pco-deep">
                {completed}/{module.lessons.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {module.assessment && (
            <Link
              to={`/curso/${course.id}/avaliacao/${module.assessment.id}`}
              className="pco-btn-secondary text-xs"
            >
              <ScrollText size={14} strokeWidth={2} />
              Avaliação do módulo
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-3">Aulas</h2>
        <div className="space-y-2">
          {module.lessons.map((lesson) => {
            const isCompleted = doneIds.has(lesson.id) || lesson.status === 'completed';
            const isInProgress = !isCompleted && lesson.status === 'in_progress';
            return (
              <Link
                key={lesson.id}
                to={`/curso/${course.id}/aula/${lesson.id}`}
                className="pco-card pco-card-hover flex items-center gap-4 py-4"
              >
                {isCompleted ? (
                  <CheckCircle2 size={20} className="text-status-success shrink-0" strokeWidth={2} />
                ) : isInProgress ? (
                  <PlayCircle size={20} className="text-pco-blue shrink-0" strokeWidth={2} />
                ) : (
                  <Circle size={20} className="text-ink-subtle shrink-0" strokeWidth={2} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep">{lesson.title}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} strokeWidth={2} />
                      {lesson.durationMinutes} min
                    </span>
                    {lesson.isMandatory && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Obrigatória
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} className="text-ink-subtle" strokeWidth={2} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
