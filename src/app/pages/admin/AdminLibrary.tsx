import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  BookOpen,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import {
  useCourses,
  useLibrary,
  useCreateLibrary,
  useUpdateLibrary,
  useDeleteLibrary,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { uploadFile } from '../../data/api';
import { useToast } from '../../components/Toast';
import { createLibrarySchema, type CreateLibraryInput } from '../../../../shared/schemas';
import { useT } from '../../i18n';
import { z } from 'zod';
import type { LibraryItem } from '../../types/schema';

const typeLabels: Record<string, string> = {
  pdf: 'PDF',
  apostila: 'Apostila',
  leitura: 'Leitura',
  artigo: 'Artigo',
};

export default function AdminLibrary() {
  const t = useT();
  const toast = useToast();
  const libQ = useLibrary();
  const { data: courses } = useCourses();
  const createMut = useCreateLibrary();
  const updateMut = useUpdateLibrary();
  const deleteMut = useDeleteLibrary();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [courseFilter, setCourseFilter] = useState('todos');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<LibraryItem | null>(null);

  const filtered = useMemo(() => {
    let list = libQ.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'todos') list = list.filter((i) => i.type === typeFilter);
    if (courseFilter !== 'todos')
      list = list.filter((i) => i.relatedCourseIds?.includes(courseFilter));
    if (mandatoryOnly) list = list.filter((i) => i.mandatory);
    return list;
  }, [libQ.data, search, typeFilter, courseFilter, mandatoryOnly]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Material excluído', confirmDelete.title);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.library')}</h1>
          <p className="pco-section-subtitle mt-1">
            Cadastro e curadoria de materiais, apostilas e leituras.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo material
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={(libQ.data ?? []).length} />
        <Stat
          label="Obrigatórios"
          value={(libQ.data ?? []).filter((i) => i.mandatory).length}
          accent="orange"
        />
        <Stat
          label="Apostilas"
          value={(libQ.data ?? []).filter((i) => i.type === 'apostila').length}
        />
        <Stat label="PDFs" value={(libQ.data ?? []).filter((i) => i.type === 'pdf').length} />
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
            placeholder="Buscar título ou autor..."
            className="pco-input pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="pco-input w-auto"
        >
          <option value="todos">Todos os tipos</option>
          <option value="pdf">PDF</option>
          <option value="apostila">Apostila</option>
          <option value="leitura">Leitura</option>
          <option value="artigo">Artigo</option>
        </select>
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
        <label className="inline-flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={mandatoryOnly}
            onChange={(e) => setMandatoryOnly(e.target.checked)}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          Apenas obrigatórios
        </label>
      </div>

      {libQ.isLoading && <CardListSkeleton count={3} />}
      {libQ.isError && (
        <div className="pco-card">
          <ErrorState action={
            <button onClick={() => libQ.refetch()} className="pco-btn-primary text-xs">
              Tentar novamente
            </button>
          } />
        </div>
      )}

      {!libQ.isLoading && filtered.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Nenhum material"
            description="Clique em Novo material para começar."
            action={
              <button onClick={() => setEditing('new')} className="pco-btn-primary text-xs">
                <Plus size={12} strokeWidth={2} />
                Novo material
              </button>
            }
          />
        </div>
      )}

      {!libQ.isLoading && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="pco-card pco-card-hover">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center shrink-0">
                  <BookOpen size={20} className="text-pco-blue" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue uppercase">
                      {typeLabels[item.type]}
                    </span>
                    {item.mandatory && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-pco-deep">{item.title}</h3>
                  <p className="text-xs text-ink-muted">por {item.author}</p>
                  {item.relatedCourseIds && item.relatedCourseIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.relatedCourseIds.map((cid) => {
                        const c = (courses ?? []).find((co) => co.id === cid);
                        return c ? (
                          <span key={cid} className="pco-badge bg-surface-gray text-ink-muted">
                            {c.shortTitle}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setEditing(item)}
                  className="pco-btn-secondary text-xs flex-1 justify-center"
                >
                  <Edit3 size={12} strokeWidth={1.75} />
                  Editar
                </button>
                {/*
                  Havia aqui dois botões sem ação: favoritar e baixar.
                  Favoritar é recurso do aluno, não da gestão; e o arquivo mora
                  em `fileMockUrl`, que vale literalmente '#' — não há para onde
                  baixar. Ícone que não faz nada é promessa quebrada em silêncio.
                */}
                <button
                  onClick={() => setConfirmDelete(item)}
                  className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LibraryEditor
          item={editing === 'new' ? null : editing}
          courses={(courses ?? []).map((c) => ({ id: c.id, shortTitle: c.shortTitle }))}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            try {
              if (editing === 'new') {
                await createMut.mutateAsync(data);
                toast.success('Material criado', data.title);
              } else {
                await updateMut.mutateAsync({ id: editing.id, patch: data });
                toast.success('Material atualizado', data.title);
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
        title="Excluir material?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.title}</span> será
              removido da biblioteca.
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'orange';
}) {
  return (
    <div className="pco-card">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent === 'orange' ? 'text-pco-orange' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

interface LibraryEditorProps {
  item: LibraryItem | null;
  courses: Array<{ id: string; shortTitle: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLibraryInput) => Promise<void>;
}

function LibraryEditor({ item, courses, submitting, onClose, onSubmit }: LibraryEditorProps) {
  const isNew = item === null;
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();

  type FormInput = z.input<typeof createLibrarySchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormInput, unknown, CreateLibraryInput>({
    resolver: zodResolver(createLibrarySchema),
    defaultValues: {
      title: item?.title ?? '',
      author: item?.author ?? '',
      type: item?.type ?? 'pdf',
      mandatory: item?.mandatory ?? false,
      fileMockUrl: item?.fileMockUrl ?? '#',
      relatedCourseIds: item?.relatedCourseIds ?? [],
      relatedModuleIds: item?.relatedModuleIds ?? [],
      theme: item?.theme ?? '',
    },
  });

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
              {isNew ? 'Novo material' : 'Editar material'}
            </div>
            <h2 className="text-lg font-bold text-pco-deep">Biblioteca PCO</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Autor" error={errors.author?.message}>
              <input {...register('author')} className="pco-input" />
            </Field>
            <Field label="Tipo">
              <select {...register('type')} className="pco-input">
                <option value="pdf">PDF</option>
                <option value="apostila">Apostila</option>
                <option value="leitura">Leitura</option>
                <option value="artigo">Artigo</option>
              </select>
            </Field>
            <Field label="Arquivo">
              {/*
                Havia só o campo de texto — e o nome dele era `fileMockUrl`, com
                padrão `'#'`. Ou seja: a biblioteca era um catálogo de links que
                alguém tinha de hospedar em outro lugar. O upload existe no
                servidor desde sempre (`POST /uploads`); faltava o botão.
              */}
              <div className="flex items-center gap-2">
                <input
                  {...register('fileMockUrl')}
                  placeholder="/uploads/arquivo.pdf ou https://..."
                  className="pco-input font-mono text-xs flex-1"
                />
                <label className="pco-btn-secondary text-xs cursor-pointer whitespace-nowrap">
                  {enviando ? 'Enviando…' : 'Enviar arquivo'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.epub,.mp3,.m4a,image/*"
                    disabled={enviando}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEnviando(true);
                      try {
                        const r = await uploadFile(file);
                        setValue('fileMockUrl', r.url, { shouldDirty: true });
                        toast.success('Arquivo enviado', r.filename);
                      } catch (err) {
                        // A mensagem do servidor é específica (tipo não
                        // permitido, tamanho); engoli-la deixaria o admin sem
                        // saber por que o arquivo não subiu.
                        toast.error(
                          'Não deu para enviar',
                          err instanceof Error ? err.message : 'Tente de novo.',
                        );
                      } finally {
                        setEnviando(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </Field>
            <Field label="Tema">
              <input {...register('theme')} className="pco-input" placeholder="Ex.: Fundamentos" />
            </Field>
          </div>

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
              {...register('mandatory')}
              className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
            />
            <span className="text-sm text-pco-deep font-medium">Material obrigatório</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
            <button type="button" onClick={onClose} className="pco-btn-ghost text-xs" disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isNew ? 'Criar material' : 'Salvar alterações'}
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
