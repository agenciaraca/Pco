import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Layers, PlayCircle } from 'lucide-react';
import { useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../components/EmptyState';

export default function Courses() {
  const { data: courses, isLoading, isError } = useCourses();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Meus Cursos</h1>
        <p className="pco-section-subtitle mt-1">
          Continue estudando ou explore outros cursos da PCO.
        </p>
      </header>

      {isLoading && <CardListSkeleton count={3} />}
      {isError && (
        <div className="pco-card">
          <ErrorState />
        </div>
      )}
      {!isLoading && !isError && courses?.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Você ainda não tem cursos"
            description="Quando um curso for vinculado ao seu perfil, ele aparecerá aqui."
          />
        </div>
      )}

      {!isLoading && !isError && courses && courses.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
            const done = course.modules.reduce(
              (s, m) => s + m.lessons.filter((l) => l.status === 'completed').length,
              0,
            );
            const pct = Math.round((done / totalLessons) * 100);

            return (
              <article key={course.id} className="pco-card pco-card-hover overflow-hidden p-0">
                <div className={`relative h-40 bg-gradient-to-br ${course.coverColor} p-5`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                  <div className="relative flex flex-col justify-between h-full text-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-wider">
                        {course.shortTitle}
                      </span>
                      <PlayCircle size={28} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold leading-tight max-w-xs">{course.title}</h3>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-ink-muted line-clamp-2">{course.description}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers size={13} strokeWidth={1.75} className="text-pco-blue" />
                      {course.modules.length} módulos
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} strokeWidth={1.75} className="text-pco-blue" />
                      {course.totalHours}h
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-ink-muted mb-1">
                      <span>Progresso</span>
                      <span className="font-semibold text-pco-deep">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-500 ease-smooth"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/curso/${course.id}`} className="pco-btn-primary flex-1 justify-center text-xs">
                      {pct === 0 ? 'Começar' : pct === 100 ? 'Revisar' : 'Continuar'}
                      <ArrowRight size={12} strokeWidth={2} />
                    </Link>
                    <Link to={`/jornada`} className="pco-btn-secondary text-xs">
                      Jornada
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
