import { useState } from 'react';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  useAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCourses,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { ProductDto, ProductKind } from '../../data/api';

const kindLabel: Record<ProductKind, string> = {
  course: 'Curso',
  bundle: 'Pacote de cursos',
  session_pack: 'Pacote de sessões',
  tutor_pack: 'Pacote Tutor',
};

export default function AdminProducts() {
  useDocumentMeta({ title: 'Produtos — Admin AVA PCO' });
  const productsQ = useAdminProducts();
  const coursesQ = useCourses();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();
  const toast = useToast();

  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductDto | null>(null);

  const products = productsQ.data ?? [];

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success('Produto removido');
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep">Produtos</h1>
          <p className="text-sm text-ink-muted">
            Cursos, pacotes de sessões e pacotes Tutor — define o catálogo de venda. Cada
            produto pode estar vinculado a um curso.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo produto
        </button>
      </header>

      {productsQ.isLoading ? (
        <CardListSkeleton count={3} />
      ) : productsQ.isError ? (
        <ErrorState
          action={
            <button onClick={() => productsQ.refetch()} className="pco-btn-secondary text-xs">
              Tentar novamente
            </button>
          }
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          description="Crie um produto para que alunos possam comprar."
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nome</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Vínculo</th>
                <th className="px-3 py-2 text-left font-medium">Preço</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-surface-mute/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag size={12} strokeWidth={2} className="text-pco-blue" />
                      <span className="font-semibold text-pco-deep">{p.name}</span>
                    </div>
                    {p.description && (
                      <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{kindLabel[p.kind]}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.refId ? (
                      <code className="text-[11px] text-pco-blue">{p.refId}</code>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold text-pco-deep">
                    {(p.priceCents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: p.currency,
                    })}
                  </td>
                  <td className="px-3 py-2">
                    {p.active ? (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        Ativo
                      </span>
                    ) : (
                      <span className="pco-badge bg-surface-gray text-ink-muted">Inativo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="pco-btn-ghost text-xs px-2.5"
                        title="Editar"
                      >
                        <Edit3 size={12} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
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
      )}

      {(creating || editing) && (
        <ProductEditor
          editing={editing}
          courses={coursesQ.data ?? []}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            try {
              if (editing) {
                await updateMut.mutateAsync({ id: editing.id, patch: input });
                toast.success('Produto atualizado');
              } else {
                await createMut.mutateAsync(input);
                toast.success('Produto criado');
              }
              setCreating(false);
              setEditing(null);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir produto?"
        description={
          confirmDelete && (
            <>
              <strong>{confirmDelete.name}</strong> será removido. Pedidos existentes mantêm
              snapshot histórico.
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

interface EditorProps {
  editing: ProductDto | null;
  courses: Array<{ id: string; title: string; shortTitle: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    kind: ProductKind;
    refId?: string | null;
    name: string;
    description?: string;
    priceCents: number;
    currency: string;
    active: boolean;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

function ProductEditor({ editing, courses, submitting, onClose, onSubmit }: EditorProps) {
  const [kind, setKind] = useState<ProductKind>(editing?.kind ?? 'course');
  const [refId, setRefId] = useState(editing?.refId ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [priceReais, setPriceReais] = useState(
    editing ? (editing.priceCents / 100).toFixed(2) : '0.00',
  );
  const [currency, setCurrency] = useState(editing?.currency ?? 'BRL');
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const initialBundle = (editing?.metadata as { courseIds?: unknown } | undefined)?.courseIds;
  const [bundleCourseIds, setBundleCourseIds] = useState<string[]>(
    Array.isArray(initialBundle)
      ? initialBundle.filter((x): x is string => typeof x === 'string')
      : [],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-pco-deep">
            {editing ? 'Editar produto' : 'Novo produto'}
          </h2>
          <button onClick={onClose} disabled={submitting} className="pco-btn-ghost text-xs">
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const cents = Math.round(parseFloat(priceReais.replace(',', '.')) * 100);
            if (!name.trim() || isNaN(cents) || cents < 0) {
              setError('Nome e preço válidos são obrigatórios.');
              return;
            }
            if (kind === 'bundle' && bundleCourseIds.length === 0) {
              setError('Selecione pelo menos um curso para o pacote.');
              return;
            }
            void onSubmit({
              kind,
              refId: kind === 'bundle' ? null : refId || null,
              name: name.trim(),
              description: description.trim() || undefined,
              priceCents: cents,
              currency,
              active,
              metadata:
                kind === 'bundle'
                  ? { courseIds: bundleCourseIds }
                  : undefined,
            });
          }}
          className="p-6 space-y-4"
        >
          <Field label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProductKind)}
              className="pco-input"
            >
              <option value="course">Curso</option>
              <option value="bundle">Pacote de cursos (bundle)</option>
              <option value="session_pack">Pacote de sessões</option>
              <option value="tutor_pack">Pacote Tutor</option>
            </select>
          </Field>

          {kind === 'bundle' && (
            <Field
              label="Cursos inclusos no pacote"
              hint="Todos esses cursos serão liberados quando o aluno comprar o pacote"
            >
              <div className="space-y-1 max-h-60 overflow-y-auto pco-card p-2">
                {courses.length === 0 && (
                  <div className="text-xs text-ink-muted p-2">Nenhum curso disponível.</div>
                )}
                {courses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-surface-mute cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={bundleCourseIds.includes(c.id)}
                      onChange={(e) => {
                        setBundleCourseIds((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((x) => x !== c.id),
                        );
                      }}
                      className="accent-pco-blue"
                    />
                    <span className="flex-1">{c.title}</span>
                    <span className="text-ink-subtle text-[10px]">{c.id}</span>
                  </label>
                ))}
              </div>
              {bundleCourseIds.length > 0 && (
                <div className="text-[11px] text-ink-muted mt-1">
                  {bundleCourseIds.length} curso(s) selecionado(s)
                </div>
              )}
            </Field>
          )}

          {kind === 'course' && (
            <Field label="Curso vinculado" hint="ID do curso que será liberado pós-pagamento">
              <select
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                className="pco-input"
              >
                <option value="">— selecione —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.id})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Nome">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pco-input"
              maxLength={120}
            />
          </Field>

          <Field label="Descrição (opcional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="pco-input resize-none text-sm"
              maxLength={2000}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Preço">
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceReais}
                onChange={(e) => setPriceReais(e.target.value)}
                className="pco-input"
              />
            </Field>
            <Field label="Moeda">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="pco-input"
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={active ? '1' : '0'}
                onChange={(e) => setActive(e.target.value === '1')}
                className="pco-input"
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
            </Field>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-gray">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="pco-btn-primary text-xs">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">
        {label}
        {hint && <span className="ml-1 text-[10px] text-ink-subtle">· {hint}</span>}
      </div>
      {children}
    </label>
  );
}
