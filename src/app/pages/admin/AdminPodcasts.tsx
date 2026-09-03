import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Mic2,
  Edit3,
  Trash2,
  PlayCircle,
  Clock,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  useCourses,
  usePodcasts,
  useCreatePodcast,
  useUpdatePodcast,
  useDeletePodcast,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { createPodcastSchema, type CreatePodcastInput } from '../../../../shared/schemas';
import type { PodcastEpisode } from '../../types/schema';
import { useT } from '../../i18n';

const coverPresets = [
  { label: 'Azul → Ciano', value: 'from-pco-blue to-pco-cyan' },
  { label: 'Ciano → Ciano claro', value: 'from-pco-cyan to-pco-cyan-light' },
  { label: 'Laranja PCO', value: 'from-pco-orange to-[#FFC76A]' },
  { label: 'Profundo', value: 'from-pco-deep to-pco-blue' },
];

export default function AdminPodcasts() {
  const t = useT();
  const toast = useToast();
  const podsQ = usePodcasts();
  const { data: courses } = useCourses();
  const createMut = useCreatePodcast();
  const updateMut = useUpdatePodcast();
  const deleteMut = useDeletePodcast();

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [editing, setEditing] = useState<PodcastEpisode | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<PodcastEpisode | null>(null);

  const filtered = useMemo(() => {
    let list = podsQ.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    if (courseFilter !== 'todos')
      list = list.filter((p) => p.relatedCourseIds?.includes(courseFilter));
    return list;
  }, [podsQ.data, search, courseFilter]);

  const totalMinutes = useMemo(
    () => (podsQ.data ?? []).reduce((s, p) => s + p.durationMinutes, 0),
    [podsQ.data],
  );

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Episódio excluído', confirmDelete.title);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.podcasts')}</h1>
          <p className="pco-section-subtitle mt-1">
            Gestão dos episódios do podcast pedagógico.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo episódio
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Episódios" value={(podsQ.data ?? []).length.toString()} />
        <Stat
          label="Duração total"
          value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}min`}
        />
        <Stat
          label="Cursos cobertos"
          value={new Set((podsQ.data ?? []).flatMap((p) => p.relatedCourseIds ?? [])).size.toString()}
        />
      </div>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            size={14}
            strokeWidth={1.75}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar episódio..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os cursos</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortTitle}
            </option>
          ))}
        </select>
      </div>

      {podsQ.isLoading && <CardListSkeleton count={3} />}
      {podsQ.isError && (
        <div className="pco-card">
          <ErrorState
            action={
              <button onClick={() => podsQ.refetch()} className="pco-btn-primary text-xs">
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {!podsQ.isLoading && filtered.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Nenhum episódio"
            description="Clique em Novo episódio para começar."
            action={
              <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
                <Plus size={12} strokeWidth={2} />
                Novo episódio
              </button>
            }
          />
        </div>
      )}

      {!podsQ.isLoading && filtered.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => (
            <article key={p.id} className="pco-card pco-card-hover">
              <div className="flex gap-4">
                <div
                  className={`h-20 w-20 rounded-xl bg-gradient-to-br ${p.coverColor} grid place-items-center shrink-0`}
                >
                  <Mic2 size={26} className="text-white" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {p.relatedCourseIds?.map((cid) => {
                      const c = (courses ?? []).find((co) => co.id === cid);
                      return c ? (
                        <span key={cid} className="pco-badge bg-pco-blue/10 text-pco-blue">
                          {c.shortTitle}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <h3 className="text-base font-semibold text-pco-deep line-clamp-1">{p.title}</h3>
                  <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{p.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {p.durationMinutes} min
                    </span>
                    <span>{new Date(p.publishedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="pco-btn-secondary text-xs flex-1 justify-center">
                  <PlayCircle size={12} strokeWidth={2} />
                  Pré-ouvir
                </button>
                <button onClick={() => setEditing(p)} className="pco-btn-ghost text-xs">
                  <Edit3 size={12} strokeWidth={1.75} />
                  Editar
                </button>
                <button
                  onClick={() => setConfirmDelete(p)}
                  className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                  title="Excluir"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <PodcastEditor
          episode={editing === 'new' ? null : editing}
          courses={(courses ?? []).map((c) => ({ id: c.id, shortTitle: c.shortTitle }))}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            try {
              if (editing === 'new') {
                await createMut.mutateAsync(data);
                toast.success('Episódio criado', data.title);
              } else {
                await updateMut.mutateAsync({ id: editing.id, patch: data });
                toast.success('Episódio atualizado', data.title);
              }
              setEditing(null);
            } catch (err) {
              toast.error(
                editing === 'new' ? 'Falha ao criar' : 'Falha ao atualizar',
                err instanceof Error ? err.message : 'Erro',
              );
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir episódio?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.title}</span> será
              removido do PCO POD.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pco-card">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
    </div>
  );
}

interface PodcastEditorProps {
  episode: PodcastEpisode | null;
  courses: Array<{ id: string; shortTitle: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePodcastInput) => Promise<void>;
}

function PodcastEditor({ episode, courses, submitting, onClose, onSubmit }: PodcastEditorProps) {
  const isNew = episode === null;
  const today = new Date().toISOString().slice(0, 10);

  type FormInput = z.input<typeof createPodcastSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormInput, unknown, CreatePodcastInput>({
    resolver: zodResolver(createPodcastSchema),
    defaultValues: {
      title: episode?.title ?? '',
      description: episode?.description ?? '',
      durationMinutes: episode?.durationMinutes ?? 30,
      publishedAt: episode?.publishedAt ?? today,
      coverColor: episode?.coverColor ?? coverPresets[0].value,
      audioUrl: episode?.audioUrl ?? '',
      relatedCourseIds: episode?.relatedCourseIds ?? [],
      relatedModuleIds: episode?.relatedModuleIds ?? [],
    },
  });

  const coverColor = watch('coverColor');
  const relatedCourseIds = watch('relatedCourseIds') ?? [];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {isNew ? 'Novo episódio' : 'Editar episódio'}
            </div>
            <h2 className="text-lg font-bold text-pco-deep">PCO POD</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
            disabled={submitting}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
          <Field label="Título" error={errors.title?.message}>
            <input {...register('title')} className="pco-input" />
          </Field>

          <Field label="Descrição" error={errors.description?.message}>
            <textarea {...register('description')} rows={4} className="pco-input resize-none" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Duração (min)" error={errors.durationMinutes?.message}>
              <input
                type="number"
                min={1}
                max={600}
                {...register('durationMinutes', { valueAsNumber: true })}
                className="pco-input"
              />
            </Field>
            <Field label="Publicação">
              <input type="date" {...register('publishedAt')} className="pco-input" />
            </Field>
          </div>

          <Field label="URL do áudio (opcional)" error={errors.audioUrl?.message}>
            <input
              {...register('audioUrl')}
              className="pco-input font-mono text-xs"
              placeholder="https://..."
            />
          </Field>

          <Field label="Capa (gradiente)">
            <div className="grid grid-cols-2 gap-2">
              {coverPresets.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setValue('coverColor', p.value)}
                  className={`rounded-xl overflow-hidden border text-left ${
                    coverColor === p.value
                      ? 'border-pco-blue ring-1 ring-pco-blue'
                      : 'border-surface-gray'
                  }`}
                >
                  <div className={`h-10 bg-gradient-to-br ${p.value}`} />
                  <div className="px-2 py-1 text-xs text-pco-deep">{p.label}</div>
                </button>
              ))}
            </div>
          </Field>

          {courses.length > 0 && (
            <Field label="Cursos relacionados">
              <div className="flex flex-wrap gap-1.5">
                {courses.map((c) => {
                  const active = relatedCourseIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(relatedCourseIds);
                        if (set.has(c.id)) set.delete(c.id);
                        else set.add(c.id);
                        setValue('relatedCourseIds', Array.from(set));
                      }}
                      className={`pco-badge cursor-pointer ${
                        active
                          ? 'bg-pco-blue text-white'
                          : 'bg-pco-blue/10 text-pco-blue hover:bg-pco-blue/20'
                      }`}
                    >
                      {c.shortTitle}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              className="pco-btn-ghost text-xs"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isNew ? 'Criar episódio' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
    </label>
  );
}

