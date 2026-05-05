import { useMemo, useState } from 'react';
import {
  Video,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Calendar,
  Users,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  useAdminLiveSessions,
  useCreateLiveSession,
  useUpdateLiveSession,
  useDeleteLiveSession,
  useCourses,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { LiveSessionDto, LiveSessionStatusDto } from '../../data/api';

const STATUS_STYLES: Record<LiveSessionStatusDto, string> = {
  scheduled: 'bg-pco-blue/10 text-pco-blue',
  live: 'bg-status-success/10 text-status-success',
  ended: 'bg-surface-gray text-ink-muted',
  canceled: 'bg-status-danger/15 text-status-danger',
};

export default function AdminLiveSessions() {
  useDocumentMeta({ title: 'Sessões ao vivo — Admin' });
  const list = useAdminLiveSessions();
  const create = useCreateLiveSession();
  const updateMut = useUpdateLiveSession();
  const del = useDeleteLiveSession();
  const coursesQ = useCourses();
  const toast = useToast();

  const [editing, setEditing] = useState<LiveSessionDto | 'new' | null>(null);

  const sorted = useMemo(() => {
    return [...(list.data ?? [])].sort((a, b) =>
      a.startAt > b.startAt ? -1 : 1,
    );
  }, [list.data]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Video size={20} className="text-pco-blue" strokeWidth={1.75} />
            Sessões ao vivo
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Agende encontros via Zoom, Google Meet ou qualquer URL. O AVA mostra os
            próximos encontros aos alunos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Nova sessão
        </button>
      </header>

      {list.isLoading ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : sorted.length === 0 ? (
        <div className="pco-card p-6 text-center text-sm text-ink-muted">
          Nenhuma sessão agendada.
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => {
            const start = new Date(s.startAt);
            const courseTitle = coursesQ.data?.find((c) => c.id === s.courseId)?.title;
            return (
              <li key={s.id} className="pco-card p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pco-deep">
                        {s.title}
                      </span>
                      <span className={`pco-badge ${STATUS_STYLES[s.statusComputed]}`}>
                        {s.statusComputed}
                      </span>
                      {s.audience === 'enrolled' && (
                        <span className="pco-badge bg-pco-cyan/15 text-pco-cyan text-[10px]">
                          só matriculados
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-subtle mt-0.5 inline-flex items-center gap-2 flex-wrap">
                      <Calendar size={10} strokeWidth={2} />
                      {start.toLocaleString('pt-BR')} · {s.durationMinutes} min
                      {s.hostName && (
                        <>
                          {' · '}
                          <Users size={10} strokeWidth={2} />
                          {s.hostName}
                        </>
                      )}
                      {courseTitle && <> · curso: {courseTitle}</>}
                    </div>
                  </div>
                  <a
                    href={s.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pco-btn-ghost text-xs"
                  >
                    <ExternalLink size={11} strokeWidth={2} />
                    Abrir link
                  </a>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="pco-btn-ghost text-xs"
                  >
                    <Edit3 size={11} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Excluir sessão "${s.title}"?`)) return;
                      try {
                        await del.mutateAsync(s.id);
                        toast.success('Removida');
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs text-status-danger"
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <Editor
          editing={editing === 'new' ? null : editing}
          courses={coursesQ.data ?? []}
          submitting={create.isPending || updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            try {
              if (editing === 'new') {
                await create.mutateAsync(input);
                toast.success('Sessão criada');
              } else {
                await updateMut.mutateAsync({
                  id: (editing as LiveSessionDto).id,
                  patch: input,
                });
                toast.success('Sessão atualizada');
              }
              setEditing(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function Editor({
  editing,
  courses,
  submitting,
  onClose,
  onSubmit,
}: {
  editing: LiveSessionDto | null;
  courses: Array<{ id: string; title: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    description?: string;
    courseId?: string | null;
    hostName?: string;
    joinUrl: string;
    startAt: string;
    durationMinutes: number;
    audience: 'all' | 'enrolled';
  }) => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [courseId, setCourseId] = useState(editing?.courseId ?? '');
  const [hostName, setHostName] = useState(editing?.hostName ?? '');
  const [joinUrl, setJoinUrl] = useState(editing?.joinUrl ?? '');
  // datetime-local: YYYY-MM-DDTHH:mm
  const [startAt, setStartAt] = useState(
    editing?.startAt ? editing.startAt.slice(0, 16) : '',
  );
  const [durationMinutes, setDurationMinutes] = useState(
    editing?.durationMinutes ?? 60,
  );
  const [audience, setAudience] = useState<'all' | 'enrolled'>(
    editing?.audience ?? 'all',
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-pco-deep">
            {editing ? 'Editar sessão' : 'Nova sessão'}
          </h2>
          <button onClick={onClose} className="pco-btn-ghost text-xs">
            <X size={14} />
          </button>
        </div>
        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="pco-input text-sm"
            placeholder="Ex: Aula ao vivo de Edipiana"
          />
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="pco-input text-sm"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Início">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="pco-input text-sm"
            />
          </Field>
          <Field label="Duração (min)">
            <input
              type="number"
              min={5}
              max={720}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="pco-input text-sm"
            />
          </Field>
        </div>
        <Field label="URL para entrar (Zoom/Meet/etc)">
          <input
            type="url"
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            className="pco-input text-sm"
            placeholder="https://zoom.us/j/..."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Apresentador (opcional)">
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="pco-input text-sm"
              placeholder="Ex: Prof. João"
            />
          </Field>
          <Field label="Audiência">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as 'all' | 'enrolled')}
              className="pco-input text-sm"
            >
              <option value="all">Todos os alunos</option>
              <option value="enrolled">Só matriculados no curso vinculado</option>
            </select>
          </Field>
        </div>
        <Field label="Curso vinculado (opcional)">
          <select
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value)}
            className="pco-input text-sm"
          >
            <option value="">— sem curso específico —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="pco-btn-ghost text-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!title || !joinUrl || !startAt || !durationMinutes) return;
              onSubmit({
                title,
                description: description || undefined,
                courseId: courseId || null,
                hostName: hostName || undefined,
                joinUrl,
                startAt: new Date(startAt).toISOString(),
                durationMinutes,
                audience,
              });
            }}
            disabled={submitting || !title || !joinUrl || !startAt}
            className="pco-btn-primary text-xs"
          >
            {submitting ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
