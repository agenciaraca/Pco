import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight, Clock, Layers, PlayCircle } from 'lucide-react';
import { useCourses, useMyProgress } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';

export default function LMSCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: courses = [], isLoading } = useCourses();
  const progress = useMyProgress();

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
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-4">Conteúdo do curso</h2>
        <div className="space-y-3">
          {course.modules.map((module, i) => (
            <Link
              key={module.id}
              to={`/curso/${course.id}/modulo/${module.id}`}
              className="pco-card pco-card-hover flex items-center gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center font-bold text-pco-deep">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-pco-deep">{module.title}</h3>
                <p className="text-xs text-ink-muted line-clamp-1">{module.description}</p>
                <div className="mt-1 text-[11px] text-ink-subtle">
                  {module.lessons.length} aulas · 1 avaliação
                </div>
              </div>
              <PlayCircle size={20} className="text-pco-blue shrink-0" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
