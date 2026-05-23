import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { useCourse } from '../data/hooks';
import * as api from '../data/api';
import { useToast } from '../components/Toast';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import type { QuizQuestionPublicDto, QuizGradeResultDto } from '../data/api';

type Phase = 'loading' | 'taking' | 'submitting' | 'result' | 'empty' | 'error';

export default function Quiz() {
  const { courseId } = useParams<{ courseId: string }>();
  useDocumentMeta({ title: 'Quiz — AVA PCO' });
  const courseQ = useCourse(courseId);
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<QuizQuestionPublicDto[]>([]);
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizGradeResultDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    api
      .fetchQuiz(courseId, { max: 10 })
      .then((r) => {
        if (cancelled) return;
        if (r.questions.length === 0) {
          setPhase('empty');
        } else {
          setQuestions(r.questions);
          setAnswers(
            Object.fromEntries(r.questions.map((q) => [q.id, new Set<string>()])),
          );
          setPhase('taking');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar quiz.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!courseId) return <Navigate to="/cursos" replace />;
  if (courseQ.isLoading || phase === 'loading') {
    return <CardListSkeleton count={3} />;
  }

  const course = courseQ.data;
  if (!course) return <Navigate to="/cursos" replace />;

  function toggleOption(questionId: string, optionId: string, type: string) {
    setAnswers((prev) => {
      const next = { ...prev };
      const current = new Set(next[questionId] ?? []);
      if (type === 'true_false') {
        next[questionId] = new Set([optionId]);
      } else {
        if (current.has(optionId)) current.delete(optionId);
        else current.add(optionId);
        next[questionId] = current;
      }
      return next;
    });
  }

  async function submit() {
    if (!courseId) return;
    const unanswered = questions.filter((q) => {
      if (q.type === 'open_ended') return !(textAnswers[q.id]?.trim());
      return (answers[q.id]?.size ?? 0) === 0;
    });
    if (unanswered.length > 0) {
      const ok = confirm(
        `Você deixou ${unanswered.length} questão(ões) em branco. Enviar mesmo assim?`,
      );
      if (!ok) return;
    }
    setPhase('submitting');
    try {
      const payload: api.QuizAnswerInput[] = questions.map((q) => {
        if (q.type === 'open_ended') {
          return { questionId: q.id, textAnswer: textAnswers[q.id] ?? '' };
        }
        return {
          questionId: q.id,
          selectedOptionIds: Array.from(answers[q.id] ?? []),
        };
      });
      const r = await api.submitQuiz(courseId, payload);
      setResult(r);
      setPhase('result');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro ao enviar.');
      setPhase('taking');
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setPhase('loading');
    // Re-trigger effect
    setTimeout(() => {
      api.fetchQuiz(courseId!, { max: 10 }).then((r) => {
        if (r.questions.length === 0) {
          setPhase('empty');
        } else {
          setQuestions(r.questions);
          setAnswers(
            Object.fromEntries(r.questions.map((q) => [q.id, new Set<string>()])),
          );
          setPhase('taking');
        }
      });
    }, 50);
  }

  if (phase === 'error') {
    return (
      <div className="space-y-4">
        <Link
          to={`/curso/${courseId}`}
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar ao curso
        </Link>
        <EmptyState title="Erro ao carregar" description={errorMsg} />
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="space-y-4">
        <Link
          to={`/curso/${courseId}`}
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar ao curso
        </Link>
        <EmptyState
          title="Nenhuma questão disponível"
          description="Este curso ainda não tem questões cadastradas no banco."
          icon={<HelpCircle size={28} />}
        />
      </div>
    );
  }

  if (phase === 'result' && result) {
    const passed = result.pct >= 70;
    return (
      <div className="space-y-6">
        <Link
          to={`/curso/${courseId}`}
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar ao curso
        </Link>
        <section
          className={`pco-card p-6 text-center ${
            passed
              ? 'border-status-success/40 bg-status-success/5'
              : 'border-pco-orange/40 bg-pco-orange/5'
          }`}
        >
          <div className="text-6xl font-bold text-pco-deep">{result.pct}%</div>
          <div className="text-base text-ink-muted mt-2">
            {result.score} de {result.total} corretas
          </div>
          <p
            className={`text-sm font-semibold mt-3 ${
              passed ? 'text-status-success' : 'text-pco-orange'
            }`}
          >
            {passed ? '🎉 Aprovado!' : 'Quase lá — refaça pra fixar.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="pco-btn-primary text-xs mt-4"
          >
            <RotateCcw size={11} strokeWidth={2} />
            Refazer com novas questões
          </button>
        </section>
        <h2 className="text-lg font-bold text-pco-deep">Revisão</h2>
        <ul className="space-y-3">
          {questions.map((q, idx) => {
            const r = result.results.find((x) => x.questionId === q.id);
            const myAnswers = answers[q.id] ?? new Set();
            return (
              <li key={q.id} className="pco-card p-4">
                <div className="flex items-start gap-2 mb-2">
                  {r?.correct ? (
                    <CheckCircle2
                      size={18}
                      className="text-status-success shrink-0 mt-0.5"
                      strokeWidth={2}
                    />
                  ) : (
                    <XCircle
                      size={18}
                      className="text-status-danger shrink-0 mt-0.5"
                      strokeWidth={2}
                    />
                  )}
                  <p className="text-sm font-medium text-ink-strong">
                    <span className="text-ink-subtle text-xs">{idx + 1}.</span>{' '}
                    {q.prompt}
                  </p>
                </div>
                {q.type === 'open_ended' ? (
                  <div className="ml-6 space-y-2">
                    <div className="text-xs text-ink-muted bg-surface-off rounded p-2">
                      <strong>Sua resposta:</strong>{' '}
                      {textAnswers[q.id] || <em className="text-ink-subtle">Em branco</em>}
                    </div>
                    {r?.aiScore != null && (
                      <div className="text-xs">
                        <span className={`font-bold ${r.aiScore >= 70 ? 'text-status-success' : 'text-pco-orange'}`}>
                          Nota: {r.aiScore}/100
                        </span>
                      </div>
                    )}
                    {r?.aiFeedback && (
                      <div className="text-xs text-ink-muted bg-pco-cyan/5 border border-pco-cyan/20 rounded p-2">
                        <strong className="text-pco-blue">Feedback da IA:</strong> {r.aiFeedback}
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="ml-6 space-y-1 text-xs">
                    {q.options.map((o) => {
                      const wasMine = myAnswers.has(o.id);
                      const isCorrect = r?.correctOptionIds.includes(o.id) ?? false;
                      let cls = 'text-ink-muted';
                      if (isCorrect) cls = 'text-status-success font-semibold';
                      else if (wasMine) cls = 'text-status-danger line-through';
                      return (
                        <li key={o.id} className={`flex items-center gap-2 ${cls}`}>
                          <span>
                            {isCorrect ? '✓' : wasMine ? '✗' : '○'}
                          </span>
                          <span>{o.text}</span>
                          {wasMine && !isCorrect && (
                            <span className="text-[10px] text-ink-subtle">
                              (sua resposta)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {r?.explanation && (
                  <div className="ml-6 mt-2 text-xs text-ink-muted bg-pco-blue/5 border border-pco-blue/20 rounded p-2">
                    <strong className="text-pco-blue">Explicação:</strong> {r.explanation}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // phase === 'taking' ou 'submitting'
  const answered = questions.filter((q) => {
    if (q.type === 'open_ended') return !!(textAnswers[q.id]?.trim());
    return (answers[q.id]?.size ?? 0) > 0;
  }).length;
  const totalQ = questions.length;
  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/curso/${courseId}`}
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar ao curso
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep mt-2">
          Quiz — {course.shortTitle}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          {totalQ} questão(ões) · {answered} respondida(s)
        </p>
        <div className="mt-3 h-1.5 bg-surface-mute rounded-full overflow-hidden">
          <div
            className="h-full bg-pco-blue transition-all"
            style={{ width: `${(answered / totalQ) * 100}%` }}
          />
        </div>
      </header>

      <ul className="space-y-4">
        {questions.map((q, idx) => (
          <li key={q.id} className="pco-card p-4">
            <p className="text-sm font-medium text-ink-strong mb-3">
              <span className="text-ink-subtle text-xs">{idx + 1}.</span>{' '}
              {q.prompt}
            </p>
            {q.type === 'open_ended' ? (
              <textarea
                value={textAnswers[q.id] ?? ''}
                onChange={(e) =>
                  setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="Escreva sua resposta aqui..."
                rows={4}
                className="w-full rounded-lg border border-surface-gray p-3 text-sm focus:border-pco-blue focus:ring-1 focus:ring-pco-blue/30 outline-none resize-y"
              />
            ) : (
              <ul className="space-y-2">
                {q.options.map((o) => {
                  const checked = answers[q.id]?.has(o.id) ?? false;
                  return (
                    <li key={o.id}>
                      <label
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-surface-mute ${
                          checked ? 'bg-pco-blue/10 border border-pco-blue/30' : 'border border-transparent'
                        }`}
                      >
                        <input
                          type={q.type === 'true_false' ? 'radio' : 'checkbox'}
                          name={`q-${q.id}`}
                          checked={checked}
                          onChange={() => toggleOption(q.id, o.id, q.type)}
                          className="accent-pco-blue"
                        />
                        <span className="text-sm">{o.text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-4 pco-card p-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {answered} de {totalQ} respondidas
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={phase === 'submitting'}
          className="pco-btn-primary text-sm"
        >
          {phase === 'submitting' ? (
            <>
              <Loader2 size={14} className="animate-spin" strokeWidth={2} />
              Enviando…
            </>
          ) : (
            <>
              Enviar respostas
              <ArrowRight size={14} strokeWidth={2} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
