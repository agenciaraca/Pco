import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  StickyNote,
  HelpCircle,
  BookOpen,
  Clock,
} from 'lucide-react';
import {
  useCourses,
  useMyProgress,
  useMarkLessonCompleted,
  useUnmarkLessonCompleted,
  useLessonNote,
  useSaveLessonNote,
  useCurrentStudent,
} from '../data/hooks';
import { useToast } from '../components/Toast';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import LessonComments from '../components/LessonComments';
import { useState, useEffect } from 'react';

export default function LMSLesson() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { data: courses = [], isLoading } = useCourses();
  const progressQ = useMyProgress();
  const markMut = useMarkLessonCompleted();
  const unmarkMut = useUnmarkLessonCompleted();
  const noteQ = useLessonNote(lessonId);
  const saveNote = useSaveLessonNote();
  const { data: student } = useCurrentStudent();
  const toast = useToast();
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (noteQ.data?.content !== undefined) setNoteDraft(noteQ.data.content);
    else setNoteDraft('');
  }, [noteQ.data]);

  if (isLoading) return <CardListSkeleton count={3} />;
  const course = courses.find((c) => c.id === courseId);
  let lesson;
  let module;
  if (course) {
    for (const m of course.modules) {
      const l = m.lessons.find((x) => x.id === lessonId);
      if (l) {
        lesson = l;
        module = m;
        break;
      }
    }
  }
  if (!course || !lesson || !module) return <Navigate to="/cursos" replace />;

  const idxInModule = module.lessons.findIndex((l) => l.id === lesson!.id);
  const prev = module.lessons[idxInModule - 1];
  const next = module.lessons[idxInModule + 1];
  const isCompleted = progressQ.data?.completedLessonIds.includes(lesson!.id) ?? false;

  async function handleToggleCompleted() {
    try {
      if (isCompleted) {
        await unmarkMut.mutateAsync(lesson!.id);
        toast.info('Aula desmarcada');
      } else {
        await markMut.mutateAsync({
          lessonId: lesson!.id,
          courseId: course!.id,
          moduleId: module!.id,
        });
        toast.success('Aula marcada como concluída');
      }
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-muted flex items-center gap-1.5">
        <Link to={`/curso/${course.id}`} className="hover:text-pco-blue">
          {course.shortTitle}
        </Link>
        <span className="text-ink-subtle">/</span>
        <Link to={`/curso/${course.id}/modulo/${module.id}`} className="hover:text-pco-blue">
          {module.title}
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-pco-deep font-medium truncate">{lesson.title}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-pco-deep">{lesson.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} strokeWidth={2} />
            {lesson.durationMinutes} min
          </span>
          {lesson.isMandatory && (
            <span className="pco-badge bg-pco-orange/10 text-pco-orange">Aula obrigatória</span>
          )}
        </div>
      </header>

      <div className="pco-card p-0 overflow-hidden">
        <div className="aspect-video bg-pco-deep relative grid place-items-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(12,192,223,0.2),transparent_60%)]" />
          <button className="relative z-10 h-16 w-16 rounded-full bg-white/10 backdrop-blur grid place-items-center hover:bg-white/20 transition-colors border-2 border-white/30">
            <PlayCircle size={36} className="text-white" strokeWidth={1.5} />
          </button>
          <div className="absolute bottom-3 left-4 text-white/80 text-xs">
            Player de vídeo (mock)
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Resumo da aula</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Esta aula apresenta os conceitos centrais do tema, articulando teoria e clínica
              com exemplos comentados. Conteúdo de apoio mockado — será substituído por texto
              real ao integrar o backend.
            </p>
          </div>

          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-pco-blue" strokeWidth={1.75} />
              Materiais complementares
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between p-3 rounded-xl border border-surface-gray hover:bg-surface-off">
                <span>Apostila do módulo (PDF)</span>
                <button className="pco-btn-ghost text-xs">Baixar</button>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl border border-surface-gray hover:bg-surface-off">
                <span>Slides da aula</span>
                <button className="pco-btn-ghost text-xs">Abrir</button>
              </li>
            </ul>
          </div>

          <div className="pco-card p-4">
            <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
              <StickyNote size={16} className="text-pco-blue" strokeWidth={1.75} />
              Minhas anotações
            </h3>
            <textarea
              rows={4}
              placeholder="Suas anotações desta aula..."
              className="pco-input resize-none"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-1 text-[10px] text-ink-subtle text-right">
              {noteDraft.length}/10000
              {noteQ.data?.updatedAt && (
                <span className="ml-2">
                  · salvo em {new Date(noteQ.data.updatedAt).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  await saveNote.mutateAsync({ lessonId: lesson!.id, content: noteDraft });
                  toast.success('Anotação salva');
                } catch (err) {
                  toast.error('Falha', err instanceof Error ? err.message : 'Erro');
                }
              }}
              disabled={saveNote.isPending}
              className="mt-3 pco-btn-primary text-xs"
            >
              {saveNote.isPending ? 'Salvando...' : 'Salvar anotação'}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="pco-card p-4">
            <button
              onClick={handleToggleCompleted}
              disabled={markMut.isPending || unmarkMut.isPending}
              className={
                isCompleted
                  ? 'pco-btn-secondary w-full justify-center'
                  : 'pco-btn-primary w-full justify-center'
              }
            >
              <CheckCircle2 size={14} strokeWidth={2} />
              {isCompleted
                ? markMut.isPending || unmarkMut.isPending
                  ? 'Atualizando...'
                  : '✓ Concluída — desfazer'
                : markMut.isPending
                  ? 'Salvando...'
                  : 'Marcar como concluída'}
            </button>
            <Link
              to="/tutor"
              className="mt-2 pco-btn-secondary w-full justify-center text-xs"
            >
              <HelpCircle size={12} strokeWidth={2} />
              Tirar dúvida com Tutor
            </Link>
          </div>

          <div className="pco-card p-4 text-xs text-ink-muted">
            <div className="font-semibold text-pco-deep mb-1">Próxima ação</div>
            {next ? (
              <Link
                to={`/curso/${course.id}/aula/${next.id}`}
                className="text-pco-blue hover:underline"
              >
                Próxima aula: {next.title}
              </Link>
            ) : module.assessment ? (
              <Link
                to={`/curso/${course.id}/avaliacao/${module.assessment.id}`}
                className="text-pco-orange hover:underline"
              >
                Fazer avaliação do módulo
              </Link>
            ) : (
              <span>Você concluiu o módulo!</span>
            )}
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between pt-4">
        {prev ? (
          <Link
            to={`/curso/${course.id}/aula/${prev.id}`}
            className="pco-btn-secondary"
          >
            <ChevronLeft size={14} strokeWidth={2} />
            Aula anterior
          </Link>
        ) : (
          <div />
        )}
        {next && (
          <Link
            to={`/curso/${course.id}/aula/${next.id}`}
            className="pco-btn-primary"
          >
            Próxima aula
            <ChevronRight size={14} strokeWidth={2} />
          </Link>
        )}
      </div>

      <LessonComments
        lessonId={lesson.id}
        courseId={course.id}
        canPost={
          (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds?.includes(
            course.id,
          ) ?? false
        }
      />
    </div>
  );
}
