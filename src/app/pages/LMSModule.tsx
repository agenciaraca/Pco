import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  ScrollText,
  StickyNote,
  Languages,
  Lock,
} from 'lucide-react';
import { useMemo } from 'react';
import { useCourses, useMyNotes, useMyProgress } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { SemConexao, FalhaAoCarregar, NaoEncontrado } from '../components/EstadosDeConsulta';
import CourseAccessNotice from '../components/CourseAccessNotice';

export default function LMSModule() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const coursesQ = useCourses();
  const courses = coursesQ.data ?? [];
  const progress = useMyProgress();
  const notesQ = useMyNotes();
  const lessonsWithNotes = useMemo(
    () => new Set((notesQ.data ?? []).map((n) => n.lessonId)),
    [notesQ.data],
  );
  if (coursesQ.fetchStatus === 'paused') return <SemConexao oQue="este módulo" />;
  if (coursesQ.isPending) return <CardListSkeleton count={3} />;
  if (coursesQ.isError)
    return (
      <FalhaAoCarregar
        erro={coursesQ.error}
        oQue="este módulo"
        aoTentarDeNovo={() => void coursesQ.refetch()}
      />
    );
  const course = courses.find((c) => c.id === courseId);
  const module = course?.modules.find((m) => m.id === moduleId);
  if (!course || !module)
    return (
      <NaoEncontrado titulo="Não achei este módulo" acao={<>
            <Link to="/cursos" className="pco-btn-primary text-sm inline-flex">
              Ver meus cursos
            </Link>
            <Link to="/suporte" className="pco-btn-ghost text-sm inline-flex">
              Falar com a secretaria
            </Link>
          </>}>
        Pode ser um link antigo, ou o módulo pode ter mudado de lugar no curso.
      </NaoEncontrado>
    );

  const doneIds = new Set(progress.data?.completedLessonIds ?? []);
  const completed = module.lessons.filter(
    (l) => doneIds.has(l.id),
  ).length;
  const pct = Math.round((completed / module.lessons.length) * 100);

  /*
    O lock é do **módulo**, e vem calculado do servidor em `GET /courses/:id`.
    Vale para todas as aulas dele — não há trava por aula.
  */
  const travado = module.locked === true;
  const abreEm = module.lockedUntil
    ? new Date(module.lockedUntil).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'breve';

  return (
    <div className="space-y-6">
      {/*
        O mesmo aviso que a página do curso mostra desde 2/set/2026.
        Ele faltava aqui, e esta é a tela de onde se clica para a aula: quem
        entrasse pelo módulo — que é o caminho de quem já está estudando, e o
        que os e-mails de retomada linkam — só descobria a matrícula suspensa
        ao bater no 403 da aula seguinte. São 376 pessoas em produção.
      */}
      <CourseAccessNotice courseId={course.id} />
      <header>
        <Link
          to={`/curso/${course.id}`}
          className="text-xs font-medium text-pco-blue hover:underline"
        >
          ← {course.shortTitle}
        </Link>
        <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Módulo {module.order}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">{module.title}</h1>
        <p className="mt-2 text-sm text-ink-muted max-w-2xl">{module.description}</p>
      </header>

      <div className="pco-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-xs text-ink-muted mb-1">
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

      {travado && (
        /*
          Fila de linhas apagadas sem uma frase é a tela não dizendo nada — e
          "não abriu ainda" se lê como "quebrou" quando ninguém explica.
        */
        <div className="pco-card border border-status-warning/30 bg-status-warning/5">
          <h2 className="text-base font-semibold text-pco-deep mb-1 flex items-center gap-2">
            <Lock size={15} strokeWidth={2} className="text-status-warning" />
            Este módulo abre em {abreEm}
          </h2>
          <p className="text-sm text-ink-muted">
            O curso libera os módulos aos poucos. Nada a fazer da sua parte — as aulas
            aparecem aqui na data.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-3">Aulas</h2>
        <div className="space-y-2">
          {module.lessons.map((lesson) => {
            const isCompleted = doneIds.has(lesson.id);
            const isInProgress = !isCompleted && lesson.status === 'in_progress';
            /*
              **Módulo trancado não vira link.**

              A página do curso já desenhava o módulo trancado sem link desde
              que o drip existe; esta tela — que é onde se clica para a aula, e
              para onde os e-mails de retomada apontam — não sabia do lock. O
              servidor agora responde 423 no conteúdo, então clicar levava a uma
              aula que abria e dizia que não estava liberada. Melhor não
              prometer o clique.
            */
            const conteudo = (
              <>
                {isCompleted ? (
                  <CheckCircle2 size={20} className="text-status-success shrink-0" strokeWidth={2} />
                ) : isInProgress ? (
                  <PlayCircle size={20} className="text-pco-blue shrink-0" strokeWidth={2} />
                ) : (
                  <Circle size={20} className="text-ink-subtle shrink-0" strokeWidth={2} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep flex items-center gap-1.5 flex-wrap">
                    {lesson.title}
                    {lessonsWithNotes.has(lesson.id) && (
                      <span
                        className="inline-flex items-center gap-1 pco-badge bg-pco-cyan/10 text-pco-cyan text-xs"
                        title="Você tem uma anotação nesta aula"
                      >
                        <StickyNote size={9} strokeWidth={2} />
                        Anotação
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} strokeWidth={2} />
                      {lesson.durationMinutes} min
                    </span>
                    {lesson.isMandatory && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Obrigatória
                      </span>
                    )}
                    {(() => {
                      const locales = lesson.transcripts
                        ? Object.entries(lesson.transcripts).filter(
                            ([, v]) => typeof v === 'string' && v.trim().length > 0,
                          )
                        : [];
                      if (locales.length === 0) return null;
                      return (
                        <span
                          className="pco-badge bg-pco-cyan/10 text-pco-blue inline-flex items-center gap-1"
                          title="Transcrição disponível"
                        >
                          <Languages size={9} strokeWidth={2} />
                          {locales.map(([k]) => k.toUpperCase()).join('/')}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {travado ? (
                  <Lock size={14} className="text-ink-subtle" strokeWidth={2} />
                ) : (
                  <ArrowRight size={14} className="text-ink-subtle" strokeWidth={2} />
                )}
              </>
            );

            if (travado) {
              return (
                <div
                  key={lesson.id}
                  aria-disabled="true"
                  className="pco-card flex items-center gap-4 py-4 opacity-60"
                  title={`Abre em ${abreEm}`}
                >
                  {conteudo}
                </div>
              );
            }

            return (
              <Link
                key={lesson.id}
                to={`/curso/${course.id}/aula/${lesson.id}`}
                className="pco-card pco-card-hover flex items-center gap-4 py-4"
              >
                {conteudo}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
