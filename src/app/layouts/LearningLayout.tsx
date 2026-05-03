import { Outlet, NavLink, useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
  Maximize2,
  Minimize2,
  Bot,
  BookOpen,
  Mic2,
  LifeBuoy,
  Menu,
  X,
} from 'lucide-react';
import { courses } from '../data/seed';

export default function LearningLayout() {
  const { courseId } = useParams<{ courseId: string }>();
  const [focusMode, setFocusMode] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completed = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.status === 'completed').length,
    0,
  );
  const progress = Math.round((completed / totalLessons) * 100);

  return (
    <div className="flex min-h-screen bg-surface-off">
      {!focusMode && (
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-surface-gray bg-white">
          <div className="px-5 py-4 border-b border-surface-gray">
            <Link
              to="/cursos"
              className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-pco-blue transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Voltar aos cursos
            </Link>
            <h2 className="mt-3 text-base font-semibold text-pco-deep leading-snug">
              {course.title}
            </h2>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                <span>Progresso</span>
                <span className="font-semibold text-pco-deep">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-500 ease-smooth"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            {course.modules.map((module, mi) => (
              <details
                key={module.id}
                open={module.status === 'in_progress' || module.status === 'available'}
                className="mb-1 rounded-xl"
              >
                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-xl hover:bg-surface-gray text-sm font-medium text-pco-deep">
                  {module.status === 'completed' && (
                    <CheckCircle2 size={16} className="text-status-success" strokeWidth={2} />
                  )}
                  {module.status === 'in_progress' && (
                    <PlayCircle size={16} className="text-pco-blue" strokeWidth={2} />
                  )}
                  {module.status === 'available' && (
                    <Circle size={16} className="text-ink-subtle" strokeWidth={2} />
                  )}
                  {module.status === 'locked' && (
                    <Lock size={14} className="text-ink-subtle" strokeWidth={2} />
                  )}
                  <span className="truncate flex-1">
                    {mi + 1}. {module.title}
                  </span>
                </summary>
                <ul className="ml-2 my-1 space-y-0.5">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <NavLink
                        to={`/curso/${course.id}/aula/${lesson.id}`}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors',
                            isActive
                              ? 'bg-pco-blue/10 text-pco-deep font-medium'
                              : 'text-ink-muted hover:bg-surface-gray hover:text-pco-deep',
                          )
                        }
                      >
                        {lesson.status === 'completed' ? (
                          <CheckCircle2 size={12} className="text-status-success" strokeWidth={2} />
                        ) : lesson.status === 'in_progress' ? (
                          <PlayCircle size={12} className="text-pco-blue" strokeWidth={2} />
                        ) : (
                          <Circle size={12} className="text-ink-subtle" strokeWidth={2} />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </NavLink>
                    </li>
                  ))}
                  {module.assessment && (
                    <li>
                      <NavLink
                        to={`/curso/${course.id}/avaliacao/${module.assessment.id}`}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-dashed border-surface-gray transition-colors',
                            isActive
                              ? 'bg-pco-orange/10 border-pco-orange/30 text-pco-deep font-medium'
                              : 'text-ink-muted hover:bg-surface-gray',
                          )
                        }
                      >
                        <Award size={12} className="text-pco-orange" strokeWidth={2} />
                        Avaliação do módulo
                      </NavLink>
                    </li>
                  )}
                </ul>
              </details>
            ))}
          </nav>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-surface-gray">
          <div className="flex items-center gap-2 px-4 lg:px-6 h-14">
            <button
              onClick={() => setTrackOpen(true)}
              className="lg:hidden h-9 w-9 rounded-lg text-ink-muted hover:bg-surface-gray inline-flex items-center justify-center"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
            <Link
              to="/cursos"
              className="text-xs text-ink-muted hover:text-pco-blue truncate max-w-[180px]"
            >
              {course.shortTitle}
            </Link>
            <span className="text-ink-subtle text-xs">/</span>
            <span className="text-xs font-medium text-pco-deep truncate flex-1">
              Modo de Estudo
            </span>
            <button
              onClick={() => setFocusMode((v) => !v)}
              className="hidden md:inline-flex pco-btn-ghost py-1.5 px-3 text-xs"
            >
              {focusMode ? (
                <>
                  <Minimize2 size={14} strokeWidth={2} />
                  Sair do Modo Foco
                </>
              ) : (
                <>
                  <Maximize2 size={14} strokeWidth={2} />
                  Modo Foco
                </>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 flex">
          <main className="flex-1 min-w-0 px-4 lg:px-8 py-6 lg:py-8 max-w-[1100px]">
            <Outlet />
          </main>

          {!focusMode && (
            <aside className="hidden xl:block w-80 shrink-0 px-5 py-6 border-l border-surface-gray bg-white/40">
              <div className="space-y-4">
                <div className="pco-card p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                    Próxima ação
                  </div>
                  <div className="text-sm font-semibold text-pco-deep mb-3">
                    Continue na próxima aula do módulo atual.
                  </div>
                  <Link
                    to={`/curso/${course.id}`}
                    className="pco-btn-primary w-full justify-center text-xs"
                  >
                    Continuar
                  </Link>
                </div>

                <div className="pco-card p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-3">
                    Apoio
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link
                        to="/tutor"
                        className="flex items-center gap-2 text-ink-muted hover:text-pco-blue"
                      >
                        <Bot size={15} strokeWidth={1.75} className="text-pco-blue" />
                        Tutor Virtual
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/podcasts"
                        className="flex items-center gap-2 text-ink-muted hover:text-pco-blue"
                      >
                        <Mic2 size={15} strokeWidth={1.75} className="text-pco-cyan" />
                        PCO POD relacionado
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/biblioteca"
                        className="flex items-center gap-2 text-ink-muted hover:text-pco-blue"
                      >
                        <BookOpen size={15} strokeWidth={1.75} className="text-pco-deep" />
                        Materiais rápidos
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/suporte"
                        className="flex items-center gap-2 text-ink-muted hover:text-pco-blue"
                      >
                        <LifeBuoy size={15} strokeWidth={1.75} className="text-pco-orange" />
                        Suporte
                      </Link>
                    </li>
                  </ul>
                </div>

                <div className="pco-card p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                    Meta semanal
                  </div>
                  <div className="text-2xl font-bold text-pco-deep">
                    2h <span className="text-sm font-normal text-ink-muted">/ 3h</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-gray overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-pco-orange" />
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>

        {trackOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setTrackOpen(false)}
          >
            <div className="absolute inset-0 bg-pco-deep/40 backdrop-blur-sm" />
            <aside
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 left-0 w-80 bg-white overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-gray">
                <span className="text-sm font-semibold text-pco-deep">{course.shortTitle}</span>
                <button
                  onClick={() => setTrackOpen(false)}
                  className="h-8 w-8 rounded-lg text-ink-muted hover:bg-surface-gray inline-flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-3">
                {course.modules.map((module, mi) => (
                  <div key={module.id} className="mb-3">
                    <div className="px-2 py-1 text-xs font-semibold text-pco-deep">
                      {mi + 1}. {module.title}
                    </div>
                    <ul className="space-y-0.5">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <NavLink
                            to={`/curso/${course.id}/aula/${lesson.id}`}
                            onClick={() => setTrackOpen(false)}
                            className="block px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-gray rounded-lg"
                          >
                            {lesson.title}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Award({
  size = 16,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="6" />
      <path d="m8.21 13.89-1.21 7.11 5-3 5 3-1.21-7.11" />
    </svg>
  );
}
