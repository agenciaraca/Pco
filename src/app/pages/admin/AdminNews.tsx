import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Star,
  Eye,
  Calendar,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  useCourses,
  useNews,
  useCreateNews,
  useUpdateNews,
  useDeleteNews,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { createNewsSchema, type CreateNewsInput } from '../../../../shared/schemas';
import { z } from 'zod';
import type { NewsArticle } from '../../types/schema';
import { useT } from '../../i18n';
import SortableTh from '../../components/SortableTh';
import { useTableSort } from '../../hooks/useTableSort';

const coverPresets = [
  { label: 'Azul PCO → Ciano', value: 'from-pco-blue to-pco-cyan' },
  { label: 'Ciano → Ciano claro', value: 'from-pco-cyan to-pco-cyan-light' },
  { label: 'Laranja PCO', value: 'from-pco-orange to-[#FFC76A]' },
  { label: 'Azul profundo → Azul PCO', value: 'from-pco-deep to-pco-blue' },
];

export default function AdminNews() {
  const t = useT();
  const toast = useToast();
  const newsQ = useNews();
  const { data: courses } = useCourses();
  const createMut = useCreateNews();
  const updateMut = useUpdateNews();
  const deleteMut = useDeleteNews();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [editing, setEditing] = useState<NewsArticle | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<NewsArticle | null>(null);

  const categories = useMemo(
    () => Array.from(new Set((newsQ.data ?? []).map((a) => a.category))),
    [newsQ.data],
  );

  const filtered = useMemo(() => {
    let list = newsQ.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'todos') list = list.filter((a) => a.category === categoryFilter);
    if (featuredOnly) list = list.filter((a) => a.featured);
    return list;
  }, [newsQ.data, search, categoryFilter, featuredOnly]);

  const courseTitleById = useMemo(() => {
    const m = new Map<string, string>();
    (courses ?? []).forEach((c) => m.set(c.id, c.shortTitle));
    return m;
  }, [courses]);

  const { rows: sortedFiltered, field: sortField, direction: sortDirection, toggleSort } = useTableSort(
    filtered,
    (row, field) => {
      switch (field) {
        case 'title': return row.title;
        case 'category': return row.category;
        case 'course': return row.relatedCourseIds?.[0] ? courseTitleById.get(row.relatedCourseIds[0]) : '';
        case 'author': return row.authorName ?? '';
        case 'publishedAt': return row.publishedAt;
        default: return null;
      }
    },
    'publishedAt',
    'desc',
  );

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Artigo excluído', confirmDelete.title);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.news')}</h1>
          <p className="pco-section-subtitle mt-1">
            Criação, curadoria e agendamento de artigos.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo artigo
        </button>
      </header>

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
            placeholder="Buscar título..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas destaques
        </label>
      </div>

      {newsQ.isLoading && <CardListSkeleton count={3} />}
      {newsQ.isError && (
        <div className="pco-card">
          <ErrorState action={
            <button onClick={() => newsQ.refetch()} className="pco-btn-primary text-xs">
              Tentar novamente
            </button>
          } />
        </div>
      )}

      {!newsQ.isLoading && !newsQ.isError && filtered.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Nenhum artigo"
            description="Clique em Novo artigo para criar o primeiro."
            action={
              <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
                <Plus size={12} strokeWidth={2} />
                Novo artigo
              </button>
            }
          />
        </div>
      )}

      {!newsQ.isLoading && filtered.length > 0 && (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <SortableTh field="title" current={sortField} direction={sortDirection} onSort={toggleSort}>Artigo</SortableTh>
                  <SortableTh field="category" current={sortField} direction={sortDirection} onSort={toggleSort}>Categoria</SortableTh>
                  <SortableTh field="course" current={sortField} direction={sortDirection} onSort={toggleSort}>Curso</SortableTh>
                  <SortableTh field="author" current={sortField} direction={sortDirection} onSort={toggleSort}>Autor</SortableTh>
                  <SortableTh field="publishedAt" current={sortField} direction={sortDirection} onSort={toggleSort}>Publicação</SortableTh>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((a) => (
                  <tr key={a.id} className="border-t border-surface-gray hover:bg-surface-off">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${a.coverColor} shrink-0`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-pco-deep">{a.title}</span>
                            {a.featured && (
                              <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                                <Star size={10} strokeWidth={2} />
                                Destaque
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ink-subtle line-clamp-1 max-w-md">
                            {a.excerpt}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="pco-badge bg-pco-blue/10 text-pco-blue">{a.category}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {a.relatedCourseIds && a.relatedCourseIds.length > 0
                        ? (courses ?? []).find((c) => c.id === a.relatedCourseIds![0])?.shortTitle ?? '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{a.authorName}</td>
                    <td className="px-4 py-3 text-ink-muted text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(a.publishedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditing(a)}
                          className="pco-btn-ghost text-xs px-2.5"
                          title="Editar"
                        >
                          <Edit3 size={12} strokeWidth={1.75} />
                        </button>
                        <button
                          className="pco-btn-ghost text-xs px-2.5"
                          title="Pré-visualizar"
                        >
                          <Eye size={12} strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a)}
                          className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                          title="Excluir"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <NewsEditor
          article={editing === 'new' ? null : editing}
          courses={(courses ?? []).map((c) => ({ id: c.id, shortTitle: c.shortTitle }))}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            try {
              if (editing === 'new') {
                await createMut.mutateAsync(data);
                toast.success('Artigo criado', data.title);
              } else {
                await updateMut.mutateAsync({ id: editing.id, patch: data });
                toast.success('Artigo atualizado', data.title);
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
        title="Excluir artigo?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.title}</span> será
              removido permanentemente. Esta ação não pode ser desfeita.
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

interface NewsEditorProps {
  article: NewsArticle | null;
  courses: Array<{ id: string; shortTitle: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateNewsInput) => Promise<void>;
}

function NewsEditor({ article, courses, submitting, onClose, onSubmit }: NewsEditorProps) {
  const isNew = article === null;
  const today = new Date().toISOString().slice(0, 10);

  type FormInput = z.input<typeof createNewsSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormInput, unknown, CreateNewsInput>({
    resolver: zodResolver(createNewsSchema),
    defaultValues: {
      title: article?.title ?? '',
      excerpt: article?.excerpt ?? '',
      body: article?.body ?? '',
      category: article?.category ?? 'Estudos',
      tags: article?.tags ?? [],
      coverColor: article?.coverColor ?? coverPresets[0].value,
      authorName: article?.authorName ?? 'Equipe PCO',
      publishedAt: article?.publishedAt ?? today,
      featured: article?.featured ?? false,
      relatedCourseIds: article?.relatedCourseIds ?? [],
    },
  });

  const tagsValue = watch('tags');
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
      <div className="relative pco-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              {isNew ? 'Novo artigo' : 'Editar artigo'}
            </div>
            <h2 className="text-lg font-bold text-pco-deep">PCO News</h2>
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

          <Field label="Resumo" error={errors.excerpt?.message}>
            <textarea {...register('excerpt')} rows={3} className="pco-input resize-none" />
          </Field>

          <Field label="Corpo (opcional)">
            <textarea {...register('body')} rows={6} className="pco-input resize-none text-sm" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria" error={errors.category?.message}>
              <input {...register('category')} className="pco-input" />
            </Field>
            <Field label="Autor">
              <input {...register('authorName')} className="pco-input" />
            </Field>
            <Field label="Data publicação">
              <input type="date" {...register('publishedAt')} className="pco-input" />
            </Field>
            <Field label="Tags (separadas por vírgula)">
              <input
                value={(tagsValue ?? []).join(', ')}
                onChange={(e) =>
                  setValue(
                    'tags',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
                className="pco-input"
                placeholder="psicanálise, clínica"
              />
            </Field>
          </div>

          <Field label="Capa (gradiente)">
            <div className="grid grid-cols-2 gap-2">
              {coverPresets.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setValue('coverColor', p.value)}
                  className={`rounded-xl overflow-hidden border text-left ${
                    coverColor === p.value ? 'border-pco-blue ring-1 ring-pco-blue' : 'border-surface-gray'
                  }`}
                >
                  <div className={`h-10 bg-gradient-to-br ${p.value}`} />
                  <div className="px-2 py-1 text-[10px] text-pco-deep">{p.label}</div>
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

          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
            <input
              type="checkbox"
              {...register('featured')}
              className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
            />
            <span className="text-sm text-pco-deep font-medium">Destaque</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
            <button type="button" onClick={onClose} className="pco-btn-ghost text-xs" disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isNew ? 'Criar artigo' : 'Salvar alterações'}
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
