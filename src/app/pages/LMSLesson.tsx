import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  StickyNote,
  HelpCircle,
  Clock,
  Languages,
  Copy,
  Loader2,
  Download,
} from 'lucide-react';
import {
  useCourses,
  useMyProgress,
  useMarkLessonCompleted,
  useUnmarkLessonCompleted,
  useLessonNote,
  useSaveLessonNote,
  useCurrentStudent,
  useLessonTranscript,
  useConteudoDaAula,
} from '../data/hooks';
import { TRANSCRIPT_LOCALE_LABELS } from '../../../shared/schemas';
import { useT } from '../i18n';
import { useToast } from '../components/Toast';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import LessonComments from '../components/LessonComments';
import AchievementCelebration from '../components/AchievementCelebration';
import MarkdownLite from '../components/MarkdownLite';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { useLessonWatchHeartbeat } from '../hooks/useLessonWatchHeartbeat';
import { useState, useEffect, useMemo } from 'react';
import type { NewAchievementDto } from '../data/api';

export default function LMSLesson() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useCourses();
  const progressQ = useMyProgress();
  const markMut = useMarkLessonCompleted();
  const unmarkMut = useUnmarkLessonCompleted();
  const noteQ = useLessonNote(lessonId);
  const saveNote = useSaveLessonNote();
  const { data: student } = useCurrentStudent();
  const toast = useToast();
  const [noteDraft, setNoteDraft] = useState('');
  const [notePreview, setNotePreview] = useState(false);
  const [newAchievements, setNewAchievements] = useState<NewAchievementDto[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (noteQ.data?.content !== undefined) setNoteDraft(noteQ.data.content);
    else setNoteDraft('');
  }, [noteQ.data]);

  const isEnrolled =
    (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds?.includes(
      courseId ?? '',
    ) ?? false;

  // O conteúdo é buscado à parte, por rota autenticada. `lesson.content` não
  // existe mais na resposta do catálogo — ver server/access/conteudo-aula.ts.
  const conteudoQ = useConteudoDaAula(courseId, lessonId, isEnrolled);
  const corpoDaAula = conteudoQ.data?.content ?? null;
  useLessonWatchHeartbeat({
    lessonId,
    courseId,
    enabled: isEnrolled,
  });

  // Lookup course/module/lesson + adjacents — antes do early return pra
  // que useEffect de shortcuts veja valores estáveis
  const lookup = useMemo(() => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return null;
    for (const m of course.modules) {
      const l = m.lessons.find((x) => x.id === lessonId);
      if (l) {
        const idx = m.lessons.findIndex((x) => x.id === l.id);
        return {
          course,
          module: m,
          lesson: l,
          prev: m.lessons[idx - 1] ?? null,
          next: m.lessons[idx + 1] ?? null,
        };
      }
    }
    return null;
  }, [courses, courseId, lessonId]);

  const isCompleted =
    lookup && progressQ.data?.completedLessonIds.includes(lookup.lesson.id)
      ? true
      : false;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      )
        return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
        return;
      }
      if (!lookup) return;
      if (e.key === 'j' && lookup.next) {
        e.preventDefault();
        navigate(`/curso/${courseId}/modulo/${lookup.module.id}/aula/${lookup.next.id}`);
      } else if (e.key === 'k' && lookup.prev) {
        e.preventDefault();
        navigate(`/curso/${courseId}/modulo/${lookup.module.id}/aula/${lookup.prev.id}`);
      } else if (e.key === 'c') {
        e.preventDefault();
        void handleToggleCompleted();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lookup?.module.id, lookup?.prev?.id, lookup?.next?.id, isCompleted, showShortcuts]);

  if (isLoading) return <CardListSkeleton count={3} />;
  if (!lookup) return <Navigate to="/cursos" replace />;
  const { course, module, lesson, prev, next } = lookup;

  async function handleToggleCompleted() {
    try {
      if (isCompleted) {
        await unmarkMut.mutateAsync(lesson!.id);
        toast.info('Aula desmarcada');
      } else {
        const r = await markMut.mutateAsync({
          lessonId: lesson!.id,
          courseId: course!.id,
          moduleId: module!.id,
        });
        toast.success('Aula marcada como concluída');
        if (r.newAchievements && r.newAchievements.length > 0) {
          setNewAchievements(r.newAchievements);
        }
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

      {lesson.videoUrl ? (
        <div className="pco-card p-0 overflow-hidden">
          <div className="aspect-video bg-pco-deep">
            <iframe
              src={lesson.videoUrl}
              title={lesson.title}
              className="w-full h-full"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      <TranscriptPanel lessonId={lesson.id} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/*
            O corpo da aula vinha de `useCourses()`, que consome o catálogo
            público — e por isso o material pago saía num `curl` sem token.
            Agora vem de uma rota que verifica matrícula e prazo de acesso.
          */}
          {conteudoQ.isLoading ? (
            <div className="pco-card">
              <p className="text-sm text-ink-subtle">Carregando o conteúdo da aula…</p>
            </div>
          ) : corpoDaAula ? (
            <div className="pco-card">
              <div
                className="pco-prose text-sm text-pco-deep leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(corpoDaAula) }}
              />
            </div>
          ) : lesson.description ? (
            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-3">Sobre esta aula</h3>
              <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                {lesson.description}
              </p>
            </div>
          ) : (
            <div className="pco-card">
              <h3 className="text-base font-semibold text-pco-deep mb-3">Sobre esta aula</h3>
              <p className="text-sm text-ink-subtle italic">
                Conteúdo desta aula ainda não disponível.
              </p>
            </div>
          )}


          <div className="pco-card p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
                <StickyNote size={16} className="text-pco-blue" strokeWidth={1.75} />
                Minhas anotações
              </h3>
              <div className="flex rounded-lg border border-pco-border overflow-hidden text-[10px]">
                <button
                  type="button"
                  onClick={() => setNotePreview(false)}
                  className={`px-2 py-1 ${
                    !notePreview
                      ? 'bg-pco-blue/10 text-pco-blue font-semibold'
                      : 'text-ink-muted'
                  }`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setNotePreview(true)}
                  className={`px-2 py-1 ${
                    notePreview
                      ? 'bg-pco-blue/10 text-pco-blue font-semibold'
                      : 'text-ink-muted'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>
            {notePreview ? (
              noteDraft.trim() ? (
                <div className="border border-pco-border rounded-lg p-3 min-h-[110px] bg-white">
                  <MarkdownLite source={noteDraft} />
                </div>
              ) : (
                <div className="text-xs text-ink-subtle italic min-h-[110px] grid place-items-center border border-pco-border rounded-lg">
                  Sem anotações ainda.
                </div>
              )
            ) : (
              <>
                <textarea
                  rows={5}
                  placeholder="Use **bold**, *italic*, # cabeçalho, - lista, ``` código..."
                  className="pco-input resize-none font-mono text-[12px]"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  maxLength={10000}
                />
                <p className="text-[10px] text-ink-subtle mt-1">
                  Suporta markdown: **bold**, *italic*, `code`, # H1, - lista, &gt; quote, [link](url), ```code block```
                </p>
              </>
            )}
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

      {newAchievements.length > 0 && (
        <AchievementCelebration
          achievements={newAchievements}
          onClose={() => setNewAchievements([])}
        />
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="pco-card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-pco-deep mb-3">
              Atalhos de teclado
            </h3>
            <ul className="space-y-2 text-sm">
              <ShortcutRow keyLabel="J" desc="Próxima aula" />
              <ShortcutRow keyLabel="K" desc="Aula anterior" />
              <ShortcutRow keyLabel="C" desc="Marcar/desmarcar concluída" />
              <ShortcutRow keyLabel="?" desc="Mostrar/esconder este painel" />
              <ShortcutRow keyLabel="Esc" desc="Fechar painel" />
            </ul>
            <p className="text-[11px] text-ink-subtle mt-3">
              Atalhos não funcionam enquanto digita em inputs ou textareas.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-4 right-4 h-9 w-9 rounded-full bg-pco-blue/10 text-pco-blue grid place-items-center text-sm font-bold hover:bg-pco-blue/20 z-40"
        title="Atalhos de teclado (?)"
      >
        ?
      </button>
    </div>
  );
}

const TRANSCRIPT_LANG_KEY = 'ava-pco-transcript-lang';

function readPreferredLang(): string | undefined {
  try {
    const v = localStorage.getItem(TRANSCRIPT_LANG_KEY);
    return v ?? undefined;
  } catch {
    return undefined;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) => ({ text: p, match: i % 2 === 1 }));
}

function TranscriptPanel({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<string | undefined>(() => readPreferredLang());
  const [search, setSearch] = useState('');
  const transcriptQ = useLessonTranscript(open ? lessonId : undefined, lang);
  const toast = useToast();
  const t = useT();

  function setLangPersisted(l: string) {
    setLang(l);
    try {
      localStorage.setItem(TRANSCRIPT_LANG_KEY, l);
    } catch {
      /* ignora */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pco-card flex items-center justify-between w-full text-left hover:bg-surface-off transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
          <Languages size={16} className="text-pco-blue" strokeWidth={1.75} />
          {t('lesson.transcript')}
        </span>
        <span className="text-xs text-ink-muted">{t('common.show')}</span>
      </button>
    );
  }

  const data = transcriptQ.data;
  const available = data?.availableLocales ?? [];
  const noTranscript = !transcriptQ.isLoading && available.length === 0;

  async function handleCopy() {
    if (!data?.text) return;
    try {
      await navigator.clipboard.writeText(data.text);
      toast.success(t('lesson.transcriptCopied'));
    } catch {
      toast.error(t('common.error'));
    }
  }

  async function handleDownload(format: 'txt' | 'md') {
    if (!data?.locale) return;
    try {
      const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
      const token = session?.token;
      const res = await fetch(
        `/api/lessons/${encodeURIComponent(lessonId)}/transcript.${format}?lang=${encodeURIComponent(data.locale)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Pega nome do arquivo do header se possível
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      a.download = m?.[1] ?? `transcricao-${data.locale}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} baixado`);
    } catch (err) {
      toast.error(t('common.error'), err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="pco-card">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
          <Languages size={16} className="text-pco-blue" strokeWidth={1.75} />
          {t('lesson.transcript')}
        </h3>
        <div className="flex items-center gap-2">
          {available.length > 1 && (
            <select
              value={data?.locale ?? ''}
              onChange={(e) => setLangPersisted(e.target.value)}
              className="pco-input text-xs py-1"
              aria-label={t('lesson.transcriptLanguage')}
            >
              {available.map((l) => (
                <option key={l} value={l}>
                  {TRANSCRIPT_LOCALE_LABELS[l as keyof typeof TRANSCRIPT_LOCALE_LABELS] ?? l}
                </option>
              ))}
            </select>
          )}
          {data?.text && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="pco-btn-ghost text-xs"
                title={t('common.copy')}
              >
                <Copy size={12} strokeWidth={2} />
                {t('common.copy')}
              </button>
              <button
                type="button"
                onClick={() => handleDownload('txt')}
                className="pco-btn-ghost text-xs"
                title="Baixar TXT"
              >
                <Download size={12} strokeWidth={2} />
                TXT
              </button>
              <button
                type="button"
                onClick={() => handleDownload('md')}
                className="pco-btn-ghost text-xs"
                title="Baixar Markdown"
              >
                <Download size={12} strokeWidth={2} />
                MD
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="pco-btn-ghost text-xs"
          >
            {t('common.hide')}
          </button>
        </div>
      </div>
      {transcriptQ.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 size={12} className="animate-spin" />
          {t('lesson.transcriptLoading')}
        </div>
      ) : noTranscript ? (
        <div className="text-xs text-ink-subtle italic">
          {t('lesson.transcriptNone')}
        </div>
      ) : data?.text ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="pco-input text-xs py-1 flex-1"
              aria-label={t('common.search')}
            />
            {search && (
              <span className="text-[11px] text-ink-muted whitespace-nowrap">
                {(() => {
                  const re = new RegExp(escapeRegex(search.trim()), 'gi');
                  const m = data.text.match(re);
                  return `${m?.length ?? 0} ${m && m.length === 1 ? 'match' : 'matches'}`;
                })()}
              </span>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto border border-surface-gray rounded-lg p-3 bg-white">
            <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-pco-deep leading-relaxed">
              {highlightText(data.text, search).map((part, i) =>
                part.match ? (
                  <mark
                    key={i}
                    className="bg-pco-orange/30 text-pco-deep rounded px-0.5"
                  >
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </article>
          </div>
        </>
      ) : (
        <div className="text-xs text-ink-subtle italic">{t('common.empty')}</div>
      )}
    </div>
  );
}

function ShortcutRow({ keyLabel, desc }: { keyLabel: string; desc: string }) {
  return (
    <li className="flex items-center gap-3">
      <kbd className="px-2 py-1 text-[11px] font-mono bg-surface-mute text-pco-deep rounded border border-pco-border min-w-8 text-center">
        {keyLabel}
      </kbd>
      <span className="text-ink-muted">{desc}</span>
    </li>
  );
}
