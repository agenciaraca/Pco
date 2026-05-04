import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  CheckCircle2,
  PlayCircle,
  Lock,
  Award,
  ArrowRight,
  Sparkles,
  Flag,
} from 'lucide-react';
import { useCourses, useMyProgress } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import type { LessonStatus } from '../types/schema';

export default function Jornada() {
  const { data: courses = [], isLoading } = useCourses();
  const { data: progress } = useMyProgress();
  const course = courses[0];
  const doneIds = new Set(progress?.completedLessonIds ?? []);

  // Calcula progresso real
  const totalLessons = course?.modules.reduce((s, m) => s + m.lessons.length, 0) ?? 0;
  const doneLessons =
    course?.modules.reduce(
      (s, m) =>
        s + m.lessons.filter((l) => doneIds.has(l.id) || l.status === 'completed').length,
      0,
    ) ?? 0;
  const overallPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  if (isLoading) return <CardListSkeleton count={3} />;
  if (!course) return <EmptyState title="Sem cursos disponíveis" />;

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-pco-blue mb-2">
          <Sparkles size={14} strokeWidth={2} />
          Sua trilha de formação
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">Minha Jornada PCO</h1>
        <p className="mt-1 text-sm text-ink-muted max-w-2xl">
          Acompanhe seu caminho ao longo dos módulos. Conclua aulas e avaliações para liberar
          os próximos passos.
        </p>
      </header>

      <div className="pco-card p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <CourseSelector />
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-xs text-ink-muted mb-1">
              <span>Progresso geral</span>
              <span className="font-semibold text-pco-deep">
                {overallPct}% · {doneLessons}/{totalLessons} aulas
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-gray overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
          <Link to={`/curso/${course.id}`} className="pco-btn-primary">
            Continuar de onde parei
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <section className="relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-pco-blue/30 via-pco-cyan/30 to-transparent hidden md:block" />
        <ul className="relative space-y-4">
          {course.modules.map((module, idx) => {
            // Status real: completed se todas aulas concluídas, in_progress se alguma, etc.
            const moduleDone = module.lessons.every(
              (l) => doneIds.has(l.id) || l.status === 'completed',
            );
            const moduleStarted = module.lessons.some(
              (l) => doneIds.has(l.id) || l.status === 'completed',
            );
            const status: LessonStatus = moduleDone
              ? 'completed'
              : moduleStarted
                ? 'in_progress'
                : (module.status ?? 'available');
            const side = idx % 2 === 0 ? 'left' : 'right';
            return (
              <li
                key={module.id}
                className={clsx(
                  'md:grid md:grid-cols-2 gap-6 items-start',
                  side === 'right' && 'md:[&>:first-child]:order-2',
                )}
              >
                <div className={clsx(side === 'left' ? 'md:pr-12' : 'md:pl-12')}>
                  <NodeCard
                    module={module}
                    status={status}
                    order={idx + 1}
                    courseId={course.id}
                    doneIds={doneIds}
                  />
                </div>
                <div />
              </li>
            );
          })}

          <li className="md:grid md:grid-cols-2 gap-6 items-start md:[&>:first-child]:order-2">
            <div className="md:pl-12">
              <div className="pco-card p-5 border-2 border-dashed border-status-gold/40 bg-status-gold/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-status-gold/15 grid place-items-center">
                    <Award className="text-status-gold" size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-status-gold">
                      Final da jornada
                    </div>
                    <h3 className="text-base font-semibold text-pco-deep">Certificado disponível</h3>
                    <p className="text-xs text-ink-muted">
                      Conclua todos os módulos para emitir seu certificado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div />
          </li>
        </ul>
      </section>
    </div>
  );
}

function NodeCard({
  module,
  status,
  order,
  courseId,
  doneIds,
}: {
  module: import('../types/schema').Module;
  status: LessonStatus;
  order: number;
  courseId: string;
  doneIds: Set<string>;
}) {
  const isLocked = status === 'locked';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';

  const Icon = isCompleted ? CheckCircle2 : isInProgress ? PlayCircle : isLocked ? Lock : Flag;

  const tone = isCompleted
    ? 'bg-status-success/10 text-status-success'
    : isInProgress
      ? 'bg-pco-blue/10 text-pco-blue'
      : isLocked
        ? 'bg-surface-gray text-ink-subtle'
        : 'bg-pco-cyan/15 text-pco-deep';

  const label = isCompleted
    ? 'Concluído'
    : isInProgress
      ? 'Em andamento'
      : isLocked
        ? 'Bloqueado'
        : 'Disponível';

  const lessons = module.lessons.length;
  const completed = module.lessons.filter(
    (l) => doneIds.has(l.id) || l.status === 'completed',
  ).length;

  return (
    <div
      className={clsx(
        'pco-card p-5 transition-all duration-200 ease-smooth',
        !isLocked && 'pco-card-hover',
        isLocked && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={clsx(
            'h-10 w-10 rounded-xl grid place-items-center font-bold text-sm',
            isCompleted
              ? 'bg-gradient-to-br from-status-success to-emerald-500 text-white'
              : isInProgress
                ? 'bg-gradient-to-br from-pco-blue to-pco-cyan text-white'
                : isLocked
                  ? 'bg-surface-gray text-ink-subtle'
                  : 'bg-gradient-to-br from-pco-cyan to-pco-cyan-light text-white',
          )}
        >
          {order}
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Módulo {order}
          </div>
          <h3 className="text-base font-semibold text-pco-deep">{module.title}</h3>
        </div>
        <span className={clsx('pco-badge', tone)}>
          <Icon size={12} strokeWidth={2} />
          {label}
        </span>
      </div>

      <p className="text-xs text-ink-muted mb-4">{module.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <Stat label="Aulas" value={`${completed}/${lessons}`} />
        <Stat label="Avaliação" value={module.assessment ? '1' : '—'} />
        <Stat label="Status" value={label} />
      </div>

      {!isLocked && (
        <Link
          to={`/curso/${courseId}/modulo/${module.id}`}
          className={clsx(
            'pco-btn w-full justify-center text-xs',
            isInProgress
              ? 'bg-pco-blue text-white hover:bg-[#007a92]'
              : 'bg-white border border-surface-gray text-pco-deep hover:border-pco-blue hover:text-pco-blue',
          )}
        >
          {isInProgress ? 'Continuar módulo' : isCompleted ? 'Revisar módulo' : 'Iniciar módulo'}
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      )}

      {isLocked && (
        <div className="text-center text-xs text-ink-subtle italic">
          Conclua o módulo anterior para liberar
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-off py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-xs font-semibold text-pco-deep">{value}</div>
    </div>
  );
}

function CourseSelector() {
  const { data: courses = [] } = useCourses();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-ink-muted">Curso:</span>
      <select className="pco-input py-1.5 text-xs w-auto">
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
