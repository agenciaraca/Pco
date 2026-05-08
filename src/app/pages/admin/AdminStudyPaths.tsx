import { useState } from 'react';
import { Route, Plus, Trash2, Pencil, X, Save, GripVertical, Eye, EyeOff } from 'lucide-react';
import {
  useStudyPaths,
  useCreateStudyPath,
  useUpdateStudyPath,
  useDeleteStudyPath,
  useCourses,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { StudyPathDto } from '../../data/api';
import { useT } from '../../i18n';

interface EditState {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  coverColor: string;
  courseIds: string[];
  active: boolean;
  publicVisible: boolean;
}

const EMPTY_EDIT: EditState = {
  id: null,
  slug: '',
  title: '',
  description: '',
  coverColor: 'from-pco-blue to-pco-cyan',
  courseIds: [],
  active: true,
  publicVisible: true,
};

const COVER_PRESETS = [
  { value: 'from-pco-blue to-pco-cyan', label: 'Azul/Ciano' },
  { value: 'from-pco-deep to-pco-blue', label: 'Profundo' },
  { value: 'from-pco-orange to-pco-cyan', label: 'Laranja' },
  { value: 'from-purple-600 to-pink-500', label: 'Roxo' },
  { value: 'from-emerald-600 to-cyan-500', label: 'Esmeralda' },
];

export default function AdminStudyPaths() {
  const t = useT();
  useDocumentMeta({ title: 'Trilhas de estudo — Admin' });
  const pathsQ = useStudyPaths();
  const coursesQ = useCourses();
  const createMut = useCreateStudyPath();
  const updateMut = useUpdateStudyPath();
  const deleteMut = useDeleteStudyPath();
  const toast = useToast();

  const [editing, setEditing] = useState<EditState | null>(null);

  const paths = pathsQ.data?.paths ?? [];
  const courses = coursesQ.data ?? [];

  function openCreate() {
    setEditing({ ...EMPTY_EDIT });
  }

  function openEdit(p: StudyPathDto) {
    setEditing({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      coverColor: p.coverColor,
      courseIds: [...p.courseIds],
      active: p.active,
      publicVisible: p.publicVisible,
    });
  }

  function close() {
    setEditing(null);
  }

  function toggleCourse(id: string) {
    if (!editing) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const has = prev.courseIds.includes(id);
      return {
        ...prev,
        courseIds: has ? prev.courseIds.filter((x) => x !== id) : [...prev.courseIds, id],
      };
    });
  }

  function moveCourse(idx: number, dir: -1 | 1) {
    if (!editing) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const arr = [...prev.courseIds];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...prev, courseIds: arr };
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error('Título obrigatório');
      return;
    }
    const payload = {
      title: editing.title.trim(),
      description: editing.description.trim(),
      coverColor: editing.coverColor,
      courseIds: editing.courseIds,
      active: editing.active,
      publicVisible: editing.publicVisible,
    };
    try {
      if (editing.id) {
        await updateMut.mutateAsync({ id: editing.id, patch: payload });
        toast.success('Trilha atualizada');
      } else {
        if (!editing.slug.trim()) {
          toast.error('Slug obrigatório para novas trilhas');
          return;
        }
        await createMut.mutateAsync({ slug: editing.slug.trim(), ...payload });
        toast.success('Trilha criada');
      }
      close();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete(p: StudyPathDto) {
    if (!confirm(`Excluir trilha "${p.title}"? Permanente.`)) return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success('Trilha removida');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Route size={20} className="text-pco-blue" strokeWidth={1.75} />
            {t('admin.nav.studyPaths')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Crie sequências guiadas de cursos. Aluno vê o "próximo passo"
            automaticamente conforme conclui os cursos da trilha.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Nova trilha
        </button>
      </header>

      {pathsQ.isLoading ? (
        <div className="text-sm text-ink-muted">Carregando…</div>
      ) : paths.length === 0 ? (
        <div className="pco-card p-6 text-center text-sm text-ink-muted">
          Nenhuma trilha cadastrada.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {paths.map((p) => (
            <li
              key={p.id}
              className={`pco-card overflow-hidden p-0 ${!p.active ? 'opacity-60' : ''}`}
            >
              <div
                className={`relative h-24 bg-gradient-to-br ${p.coverColor}`}
              >
                <div className="absolute inset-0 p-4 text-white flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <code className="text-[10px] bg-white/20 backdrop-blur px-1.5 py-0.5 rounded">
                      {p.slug}
                    </code>
                    {!p.publicVisible && (
                      <span className="text-[10px] bg-white/20 backdrop-blur px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        <EyeOff size={10} strokeWidth={2} />
                        oculta
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold leading-tight">{p.title}</h3>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {p.description && (
                  <p className="text-xs text-ink-muted line-clamp-2">{p.description}</p>
                )}
                <div className="text-[11px] text-ink-subtle">
                  {p.courseIds.length} curso{p.courseIds.length === 1 ? '' : 's'}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="pco-btn-ghost text-xs"
                  >
                    <Pencil size={11} strokeWidth={2} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    className="pco-btn-ghost text-xs text-status-danger"
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-label={editing.id ? 'Editar trilha' : 'Nova trilha'}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
          >
            <header className="flex items-center justify-between p-4 border-b border-pco-border">
              <h2 className="text-lg font-bold text-pco-deep">
                {editing.id ? 'Editar trilha' : 'Nova trilha'}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-ink-muted hover:text-pco-deep"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Slug (URL)
                  </span>
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing((p) => (p ? { ...p, slug: e.target.value } : p))
                    }
                    disabled={!!editing.id}
                    placeholder="ex: fundamentos-psicanalise"
                    className="pco-input text-sm mt-1 disabled:opacity-60 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Título
                  </span>
                  <input
                    type="text"
                    value={editing.title}
                    onChange={(e) =>
                      setEditing((p) => (p ? { ...p, title: e.target.value } : p))
                    }
                    placeholder="ex: Fundamentos da Psicanálise"
                    className="pco-input text-sm mt-1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Descrição
                </span>
                <textarea
                  value={editing.description}
                  onChange={(e) =>
                    setEditing((p) =>
                      p ? { ...p, description: e.target.value } : p,
                    )
                  }
                  rows={2}
                  placeholder="Pra quem é a trilha? Objetivo geral?"
                  className="pco-input text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Cor de capa
                </span>
                <select
                  value={editing.coverColor}
                  onChange={(e) =>
                    setEditing((p) =>
                      p ? { ...p, coverColor: e.target.value } : p,
                    )
                  }
                  className="pco-input text-sm mt-1"
                >
                  {COVER_PRESETS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm">Ativa (pode ser cursada)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.publicVisible}
                    onChange={(e) =>
                      setEditing((p) =>
                        p ? { ...p, publicVisible: e.target.checked } : p,
                      )
                    }
                    className="accent-pco-blue"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <Eye size={12} strokeWidth={2} />
                    Visível no catálogo
                  </span>
                </label>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-2">
                  Cursos da trilha — ordem de estudo
                </div>
                {editing.courseIds.length === 0 ? (
                  <p className="text-xs text-ink-subtle mb-3">
                    Nenhum curso adicionado ainda. Selecione abaixo.
                  </p>
                ) : (
                  <ol className="space-y-1 mb-3">
                    {editing.courseIds.map((cid, idx) => {
                      const co = courses.find((c) => c.id === cid);
                      return (
                        <li
                          key={cid}
                          className="flex items-center gap-2 bg-surface-off rounded-lg p-2"
                        >
                          <GripVertical
                            size={14}
                            className="text-ink-subtle shrink-0"
                            strokeWidth={2}
                          />
                          <span className="text-[11px] font-bold text-pco-deep w-5">
                            {idx + 1}.
                          </span>
                          <span className="flex-1 text-sm text-ink-strong truncate">
                            {co?.title ?? cid}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveCourse(idx, -1)}
                            disabled={idx === 0}
                            className="text-xs text-pco-blue hover:underline disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCourse(idx, 1)}
                            disabled={idx === editing.courseIds.length - 1}
                            className="text-xs text-pco-blue hover:underline disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCourse(cid)}
                            className="text-status-danger text-xs hover:underline"
                            title="Remover"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">
                  Adicionar curso
                </div>
                <div className="grid gap-1 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1 border border-pco-border rounded-lg p-2">
                  {courses.length === 0 ? (
                    <p className="text-xs text-ink-subtle">Sem cursos cadastrados.</p>
                  ) : (
                    courses
                      .filter((c) => !editing.courseIds.includes(c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCourse(c.id)}
                          className="text-xs text-left p-1.5 rounded hover:bg-surface-mute"
                        >
                          + {c.title}
                        </button>
                      ))
                  )}
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
                {editing.id ? 'Salvar' : 'Criar trilha'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
