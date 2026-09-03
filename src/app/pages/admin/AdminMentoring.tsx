import { useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  useAdminMentoring,
  useCreateMentoring,
  useUpdateMentoring,
  useDeleteMentoring,
  useCourses,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import type { MentoringConfigDto } from '../../data/api';

export default function AdminMentoring() {
  useDocumentMeta({ title: 'Mentorias — Admin' });
  const mentoringQ = useAdminMentoring();
  const coursesQ = useCourses();
  const createMut = useCreateMentoring();
  const updateMut = useUpdateMentoring();
  const deleteMut = useDeleteMentoring();
  const toast = useToast();

  const [editing, setEditing] = useState<{
    id: string | null;
    courseId: string;
    instructorName: string;
    bookingUrl: string;
    description: string;
    durationMinutes: string;
  } | null>(null);

  const configs = mentoringQ.data?.configs ?? [];
  const courses = coursesQ.data ?? [];

  function openNew() {
    setEditing({
      id: null,
      courseId: courses[0]?.id ?? '',
      instructorName: '',
      bookingUrl: '',
      description: '',
      durationMinutes: '50',
    });
  }

  function openEdit(c: MentoringConfigDto) {
    setEditing({
      id: c.id,
      courseId: c.courseId,
      instructorName: c.instructorName,
      bookingUrl: c.bookingUrl,
      description: c.description ?? '',
      durationMinutes: String(c.durationMinutes ?? 50),
    });
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.instructorName.trim() || !editing.bookingUrl.trim()) {
      toast.error('Preencha nome do mentor e URL de booking');
      return;
    }
    try {
      if (editing.id) {
        await updateMut.mutateAsync({
          id: editing.id,
          patch: {
            instructorName: editing.instructorName.trim(),
            bookingUrl: editing.bookingUrl.trim(),
            description: editing.description.trim() || undefined,
            durationMinutes: Number(editing.durationMinutes) || 50,
          },
        });
        toast.success('Mentoria atualizada');
      } else {
        await createMut.mutateAsync({
          courseId: editing.courseId,
          instructorName: editing.instructorName.trim(),
          bookingUrl: editing.bookingUrl.trim(),
          description: editing.description.trim() || undefined,
          durationMinutes: Number(editing.durationMinutes) || 50,
        });
        toast.success('Mentoria criada');
      }
      setEditing(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta configuracao de mentoria?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Mentoria removida');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  if (mentoringQ.isLoading) return <CardListSkeleton count={3} />;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <CalendarCheck size={20} className="text-pco-blue" strokeWidth={1.75} />
            Mentorias
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Configure links de agendamento (Calendly, Cal.com, etc.) por curso.
          </p>
        </div>
        <button onClick={openNew} className="pco-btn-primary text-xs">
          <Plus size={12} /> Nova mentoria
        </button>
      </header>

      {configs.length === 0 && !editing ? (
        <EmptyState
          title="Nenhuma mentoria configurada"
          description="Adicione um link de agendamento para que alunos possam marcar sessoes de mentoria."
          icon={<CalendarCheck size={28} />}
        />
      ) : (
        <ul className="space-y-3">
          {configs.map((c) => {
            const course = courses.find((cr) => cr.id === c.courseId);
            return (
              <li key={c.id} className="pco-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-pco-deep">
                        {c.instructorName}
                      </span>
                      <span className="pco-badge bg-pco-blue/10 text-pco-blue text-xs">
                        {c.provider}
                      </span>
                      {!c.active && (
                        <span className="pco-badge bg-surface-gray text-ink-muted text-xs">
                          inativo
                        </span>
                      )}
                    </div>
                    {course && (
                      <p className="text-xs text-ink-muted">
                        Curso: {course.title}
                      </p>
                    )}
                    {c.description && (
                      <p className="text-xs text-ink-subtle mt-1">{c.description}</p>
                    )}
                    {c.durationMinutes && (
                      <p className="text-xs text-ink-subtle mt-0.5">
                        Duracao: {c.durationMinutes} min
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={c.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pco-btn-ghost text-xs"
                      title="Abrir link"
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => openEdit(c)} className="pco-btn-ghost text-xs">
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="pco-btn-ghost text-xs text-status-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.currentTarget === e.target) setEditing(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-pco-deep">
                {editing.id ? 'Editar mentoria' : 'Nova mentoria'}
              </h2>
              <button onClick={() => setEditing(null)} className="pco-btn-ghost text-xs">
                <X size={14} />
              </button>
            </div>

            {!editing.id && (
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">Curso</span>
                <select
                  value={editing.courseId}
                  onChange={(e) => setEditing({ ...editing, courseId: e.target.value })}
                  className="pco-input text-sm mt-1"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Nome do mentor</span>
              <input
                value={editing.instructorName}
                onChange={(e) => setEditing({ ...editing, instructorName: e.target.value })}
                className="pco-input text-sm mt-1"
                placeholder="Prof. Dr. Joao Silva"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">URL de agendamento</span>
              <input
                type="url"
                value={editing.bookingUrl}
                onChange={(e) => setEditing({ ...editing, bookingUrl: e.target.value })}
                className="pco-input text-sm mt-1"
                placeholder="https://calendly.com/seu-nome/mentoria"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">Duracao (min)</span>
                <input
                  type="number"
                  value={editing.durationMinutes}
                  onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })}
                  className="pco-input text-sm mt-1"
                  min={15}
                  max={180}
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">Descricao (opcional)</span>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="pco-input text-sm mt-1"
                  placeholder="Supervisao clinica individual"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="pco-btn-ghost text-xs">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
                className="pco-btn-primary text-xs"
              >
                {createMut.isPending || updateMut.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Save size={11} />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
