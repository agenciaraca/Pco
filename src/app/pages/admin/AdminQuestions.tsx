import { useMemo, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  CheckCircle2,
  Circle,
  HelpCircle,
} from 'lucide-react';
import {
  useCourse,
  useCourseQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import type { QuestionDto, QuestionTypeDto } from '../../data/api';
import { useT } from '../../i18n';

interface EditState {
  id: string | null;
  type: QuestionTypeDto;
  prompt: string;
  options: { text: string; correct: boolean }[];
  expectedAnswer: string;
  explanation: string;
  tags: string[];
  difficulty: number;
  active: boolean;
  moduleId: string;
}

function emptyEdit(): EditState {
  return {
    id: null,
    type: 'multiple_choice',
    prompt: '',
    options: [
      { text: '', correct: true },
      { text: '', correct: false },
    ],
    expectedAnswer: '',
    explanation: '',
    tags: [],
    difficulty: 3,
    active: true,
    moduleId: '',
  };
}

export default function AdminQuestions() {
  const t = useT();
  const { courseId } = useParams<{ courseId: string }>();
  useDocumentMeta({ title: 'Banco de questões — Admin' });
  const courseQ = useCourse(courseId);
  const questionsQ = useCourseQuestions(courseId);
  const createMut = useCreateQuestion(courseId ?? '');
  const updateMut = useUpdateQuestion(courseId ?? '');
  const deleteMut = useDeleteQuestion(courseId ?? '');
  const toast = useToast();

  const [editing, setEditing] = useState<EditState | null>(null);
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | QuestionTypeDto>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [tagInput, setTagInput] = useState('');

  const course = courseQ.data;
  const questions = questionsQ.data?.questions ?? [];
  const filtered = useMemo(() => {
    let list = questions;
    if (filterModule === 'no-module') list = list.filter((q) => !q.moduleId);
    else if (filterModule !== 'all')
      list = list.filter((q) => q.moduleId === filterModule);
    if (filterType !== 'all') list = list.filter((q) => q.type === filterType);
    if (filterStatus === 'active') list = list.filter((q) => q.active);
    else if (filterStatus === 'inactive') list = list.filter((q) => !q.active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (x) =>
          x.prompt.toLowerCase().includes(q) ||
          x.tags.some((t) => t.includes(q)),
      );
    }
    return list;
  }, [questions, filterModule, filterType, filterStatus, search]);

  if (!courseId) return <Navigate to="/admin/cursos" replace />;
  if (courseQ.isLoading) return <CardListSkeleton count={3} />;
  if (!course) return <Navigate to="/admin/cursos" replace />;

  function openCreate() {
    setEditing(emptyEdit());
  }

  function openEdit(q: QuestionDto) {
    setEditing({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
      expectedAnswer: q.expectedAnswer ?? '',
      explanation: q.explanation ?? '',
      tags: [...q.tags],
      difficulty: q.difficulty,
      active: q.active,
      moduleId: q.moduleId ?? '',
    });
  }

  function close() {
    setEditing(null);
    setTagInput('');
  }

  function setOptionText(idx: number, text: string) {
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            options: prev.options.map((o, i) =>
              i === idx ? { ...o, text } : o,
            ),
          }
        : prev,
    );
  }

  function setOptionCorrect(idx: number, correct: boolean) {
    setEditing((prev) => {
      if (!prev) return prev;
      // true_false: apenas uma correta
      if (prev.type === 'true_false') {
        return {
          ...prev,
          options: prev.options.map((o, i) => ({
            ...o,
            correct: i === idx ? correct : !correct,
          })),
        };
      }
      return {
        ...prev,
        options: prev.options.map((o, i) => (i === idx ? { ...o, correct } : o)),
      };
    });
  }

  function addOption() {
    setEditing((prev) =>
      prev && prev.options.length < 6
        ? {
            ...prev,
            options: [...prev.options, { text: '', correct: false }],
          }
        : prev,
    );
  }

  function removeOption(idx: number) {
    setEditing((prev) =>
      prev && prev.options.length > 2
        ? { ...prev, options: prev.options.filter((_, i) => i !== idx) }
        : prev,
    );
  }

  function changeType(newType: QuestionTypeDto) {
    setEditing((prev) => {
      if (!prev) return prev;
      if (newType === 'true_false') {
        return {
          ...prev,
          type: newType,
          options: [
            { text: 'Verdadeiro', correct: true },
            { text: 'Falso', correct: false },
          ],
        };
      }
      if (newType === 'open_ended') {
        return { ...prev, type: newType, options: [] };
      }
      if (prev.type === 'open_ended') {
        return {
          ...prev,
          type: newType,
          options: [
            { text: '', correct: true },
            { text: '', correct: false },
          ],
        };
      }
      return { ...prev, type: newType };
    });
  }

  function addTag() {
    const v = tagInput.trim().toLowerCase();
    if (!v || !editing || editing.tags.includes(v)) return;
    setEditing({ ...editing, tags: [...editing.tags, v] });
    setTagInput('');
  }

  async function save() {
    if (!editing) return;
    if (!editing.prompt.trim()) {
      toast.error('Enunciado obrigatório');
      return;
    }
    if (editing.type !== 'open_ended') {
      if (editing.options.some((o) => !o.text.trim())) {
        toast.error('Todas as opções precisam ter texto');
        return;
      }
      if (!editing.options.some((o) => o.correct)) {
        toast.error('Marque pelo menos uma opção como correta');
        return;
      }
    }
    const payload = {
      moduleId: editing.moduleId || undefined,
      type: editing.type,
      prompt: editing.prompt.trim(),
      options: editing.type === 'open_ended'
        ? []
        : editing.options.map((o) => ({
            text: o.text.trim(),
            correct: o.correct,
          })),
      expectedAnswer: editing.type === 'open_ended' ? editing.expectedAnswer.trim() || undefined : undefined,
      explanation: editing.explanation.trim() || undefined,
      tags: editing.tags,
      difficulty: editing.difficulty,
      active: editing.active,
    };
    try {
      if (editing.id) {
        await updateMut.mutateAsync({ id: editing.id, patch: payload });
        toast.success('Questão atualizada');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Questão criada');
      }
      close();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete(q: QuestionDto) {
    if (!confirm(`Excluir questão "${q.prompt.slice(0, 60)}…"?`)) return;
    try {
      await deleteMut.mutateAsync(q.id);
      toast.success('Questão removida');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            to={`/admin/cursos/${course.id}`}
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={11} strokeWidth={2} />
            Voltar ao curso
          </Link>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2 mt-1">
            <HelpCircle size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.questions')} — {course.shortTitle}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            {questions.length} questão(ões) no banco. Múltipla escolha (2-6
            opções) ou Verdadeiro/Falso.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Nova questão
        </button>
      </header>

      <div className="pco-card p-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por enunciado ou tag…"
          className="pco-input text-sm flex-1 min-w-[180px]"
        />
        {course.modules.length > 0 && (
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="pco-input text-xs w-auto"
          >
            <option value="all">Todos os módulos</option>
            <option value="no-module">Sem módulo</option>
            {course.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as 'all' | QuestionTypeDto)
          }
          className="pco-input text-xs w-auto"
        >
          <option value="all">Todos os tipos</option>
          <option value="multiple_choice">Múltipla escolha</option>
          <option value="true_false">Verdadeiro/Falso</option>
          <option value="open_ended">Dissertativa (IA)</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')
          }
          className="pco-input text-xs w-auto"
        >
          <option value="all">Todos</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
        <span className="text-[11px] text-ink-subtle ml-auto">
          {filtered.length} de {questions.length}
        </span>
      </div>

      {questionsQ.isLoading ? (
        <CardListSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={questions.length === 0 ? 'Sem questões ainda' : 'Nenhuma questão no filtro'}
          description={
            questions.length === 0
              ? 'Crie a primeira questão pra começar a montar avaliações.'
              : 'Mude o filtro pra ver outras questões.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((q) => {
            const moduleTitle = q.moduleId
              ? course.modules.find((m) => m.id === q.moduleId)?.title
              : null;
            return (
              <li
                key={q.id}
                className={`pco-card p-4 ${!q.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className={`pco-badge ${
                          q.type === 'true_false'
                            ? 'bg-pco-cyan/10 text-pco-cyan'
                            : q.type === 'open_ended'
                              ? 'bg-pco-orange/10 text-pco-orange'
                              : 'bg-pco-blue/10 text-pco-blue'
                        }`}
                      >
                        {q.type === 'true_false' ? 'V/F' : q.type === 'open_ended' ? 'Dissertativa' : 'Múltipla'}
                      </span>
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Dif. {q.difficulty}/5
                      </span>
                      {moduleTitle && (
                        <span className="pco-badge bg-surface-mute text-ink-muted">
                          {moduleTitle}
                        </span>
                      )}
                      {!q.active && (
                        <span className="pco-badge bg-status-danger/10 text-status-danger">
                          inativa
                        </span>
                      )}
                      {q.tags.map((t) => (
                        <code
                          key={t}
                          className="text-[10px] bg-surface-off px-1.5 py-0.5 rounded text-ink-muted"
                        >
                          {t}
                        </code>
                      ))}
                    </div>
                    <p className="text-sm text-ink-strong font-medium mb-2">
                      {q.prompt}
                    </p>
                    <ul className="space-y-1">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          {o.correct ? (
                            <CheckCircle2
                              size={12}
                              className="text-status-success shrink-0"
                              strokeWidth={2}
                            />
                          ) : (
                            <Circle
                              size={12}
                              className="text-ink-subtle shrink-0"
                              strokeWidth={2}
                            />
                          )}
                          <span className={o.correct ? 'text-status-success' : 'text-ink-muted'}>
                            {o.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(q)}
                      className="pco-btn-ghost text-xs"
                    >
                      <Pencil size={11} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      className="pco-btn-ghost text-xs text-status-danger"
                    >
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-label={editing.id ? 'Editar questão' : 'Nova questão'}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
          >
            <header className="flex items-center justify-between p-4 border-b border-pco-border">
              <h2 className="text-lg font-bold text-pco-deep">
                {editing.id ? 'Editar questão' : 'Nova questão'}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-ink-muted hover:text-pco-deep"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Tipo
                  </span>
                  <select
                    value={editing.type}
                    onChange={(e) => changeType(e.target.value as QuestionTypeDto)}
                    className="pco-input text-sm mt-1"
                  >
                    <option value="multiple_choice">Múltipla escolha</option>
                    <option value="true_false">Verdadeiro / Falso</option>
                    <option value="open_ended">Dissertativa (IA)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Módulo (opcional)
                  </span>
                  <select
                    value={editing.moduleId}
                    onChange={(e) =>
                      setEditing((p) =>
                        p ? { ...p, moduleId: e.target.value } : p,
                      )
                    }
                    className="pco-input text-sm mt-1"
                  >
                    <option value="">Sem módulo (geral)</option>
                    {course.modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Enunciado
                </span>
                <textarea
                  value={editing.prompt}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, prompt: e.target.value } : p))
                  }
                  rows={3}
                  placeholder="Pergunta clara e específica…"
                  className="pco-input text-sm mt-1"
                  maxLength={2000}
                />
              </label>

              {editing.type === 'open_ended' ? (
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Resposta esperada / rubrica (usada pela IA para corrigir)
                  </span>
                  <textarea
                    value={editing.expectedAnswer}
                    onChange={(e) =>
                      setEditing((p) => (p ? { ...p, expectedAnswer: e.target.value } : p))
                    }
                    rows={4}
                    placeholder="Descreva a resposta ideal ou os pontos-chave que o aluno deve abordar..."
                    className="pco-input text-sm mt-1"
                    maxLength={4000}
                  />
                  <p className="text-[11px] text-ink-subtle mt-1">
                    A IA compara a resposta do aluno com esta rubrica e atribui nota de 0-100.
                  </p>
                </label>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                      Opções ({editing.options.length}{editing.type === 'multiple_choice' ? '/6' : ''})
                    </span>
                    {editing.type === 'multiple_choice' && (
                      <button
                        type="button"
                        onClick={addOption}
                        disabled={editing.options.length >= 6}
                        className="text-xs text-pco-blue hover:underline disabled:opacity-30"
                      >
                        + Adicionar opção
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {editing.options.map((o, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 bg-surface-off rounded-lg p-2"
                      >
                        <input
                          type={editing.type === 'true_false' ? 'radio' : 'checkbox'}
                          name="correct-option"
                          checked={o.correct}
                          onChange={(e) => setOptionCorrect(idx, e.target.checked)}
                          className="accent-pco-blue"
                          title="Marcar como correta"
                        />
                        <input
                          value={o.text}
                          onChange={(e) => setOptionText(idx, e.target.value)}
                          disabled={editing.type === 'true_false'}
                          placeholder={`Opção ${idx + 1}`}
                          className="pco-input text-sm flex-1 disabled:opacity-60"
                          maxLength={500}
                        />
                        {editing.type === 'multiple_choice' && editing.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="text-status-danger text-xs hover:underline"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-ink-subtle mt-2">
                    {editing.type === 'multiple_choice'
                      ? 'Marque uma OU mais opções como corretas (multi-select).'
                      : 'V/F: marque a opção correta. Apenas uma pode ser correta.'}
                  </p>
                </div>
              )}

              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Explicação (mostrada após resposta)
                </span>
                <textarea
                  value={editing.explanation}
                  onChange={(e) =>
                    setEditing((p) =>
                      p ? { ...p, explanation: e.target.value } : p,
                    )
                  }
                  rows={2}
                  placeholder="Por que a resposta certa é essa? Aparece após o aluno responder."
                  className="pco-input text-sm mt-1"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Dificuldade ({editing.difficulty}/5)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={editing.difficulty}
                    onChange={(e) =>
                      setEditing((p) =>
                        p ? { ...p, difficulty: Number(e.target.value) } : p,
                      )
                    }
                    className="w-full mt-2 accent-pco-blue"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) =>
                      setEditing((p) =>
                        p ? { ...p, active: e.target.checked } : p,
                      )
                    }
                    className="accent-pco-blue"
                  />
                  <span className="text-sm">
                    Ativa (entra em sorteios de quiz)
                  </span>
                </label>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.tags.map((t) => (
                    <span
                      key={t}
                      className="pco-badge bg-pco-blue/10 text-pco-blue inline-flex items-center gap-1"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() =>
                          setEditing((p) =>
                            p
                              ? { ...p, tags: p.tags.filter((x) => x !== t) }
                              : p,
                          )
                        }
                        className="hover:text-status-danger"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {editing.tags.length === 0 && (
                    <span className="text-xs text-ink-subtle">Nenhuma tag</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="pco-input text-sm flex-1"
                    placeholder="Tag (Enter)"
                    maxLength={40}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="pco-btn-ghost text-xs"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-2 p-4 border-t border-pco-border">
              <button type="button" onClick={close} className="pco-btn-ghost text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={createMut.isPending || updateMut.isPending}
                className="pco-btn-primary text-xs"
              >
                <Save size={11} strokeWidth={2} />
                {editing.id ? 'Salvar' : 'Criar questão'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
