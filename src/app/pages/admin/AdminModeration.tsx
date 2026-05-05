import { useMemo, useState } from 'react';
import {
  Shield,
  MessageSquare,
  Star,
  Eye,
  EyeOff,
  Trash2,
  Search,
  Loader2,
  Filter,
} from 'lucide-react';
import {
  useAdminComments,
  useBulkCommentAction,
  useAdminReviews,
  useDeleteAdminReview,
  useCourses,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type {
  AdminCommentDto,
  AdminReviewDto,
  ListCommentsFilter,
  ListReviewsFilter,
} from '../../data/api';

type Tab = 'comments' | 'reviews';

export default function AdminModeration() {
  useDocumentMeta({ title: 'Moderação — Admin AVA PCO' });
  const [tab, setTab] = useState<Tab>('comments');

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Shield size={20} className="text-pco-blue" strokeWidth={1.75} />
          Moderação
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Gerencie comentários de aulas e avaliações de cursos. Esconder, mostrar
          ou apagar conteúdos inapropriados.
        </p>
      </header>

      <div className="flex gap-1 border-b border-pco-border">
        <TabButton
          active={tab === 'comments'}
          onClick={() => setTab('comments')}
          icon={<MessageSquare size={13} />}
          label="Comentários"
        />
        <TabButton
          active={tab === 'reviews'}
          onClick={() => setTab('reviews')}
          icon={<Star size={13} />}
          label="Avaliações"
        />
      </div>

      {tab === 'comments' ? <CommentsPanel /> : <ReviewsPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
        active
          ? 'border-pco-blue text-pco-blue'
          : 'border-transparent text-ink-muted hover:text-pco-deep'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CommentsPanel() {
  const courses = useCourses();
  const [filter, setFilter] = useState<ListCommentsFilter>({ hidden: 'all' });
  const [search, setSearch] = useState('');
  const list = useAdminComments(filter);
  const bulk = useBulkCommentAction();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(
    () => new Set((list.data ?? []).map((c) => c.id)),
    [list.data],
  );
  const allSelected = useMemo(
    () =>
      visibleIds.size > 0 &&
      Array.from(visibleIds).every((id) => selected.has(id)),
    [visibleIds, selected],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  }

  async function applyAction(action: 'hide' | 'show' | 'delete') {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error('Selecione', 'Marque ao menos 1 comentário.');
      return;
    }
    if (action === 'delete' && !confirm(`Apagar ${ids.length} comentário(s)?`)) {
      return;
    }
    try {
      const r = await bulk.mutateAsync({ ids, action });
      toast.success(
        action === 'delete'
          ? `${r.removed} apagados`
          : `${r.updated} atualizados`,
      );
      setSelected(new Set());
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  function handleSearch() {
    setFilter({ ...filter, search: search.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar no texto..."
            className="pco-input text-sm flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="pco-btn-ghost text-xs"
          >
            Buscar
          </button>
        </div>
        <select
          value={filter.hidden ?? 'all'}
          onChange={(e) =>
            setFilter({
              ...filter,
              hidden: e.target.value as ListCommentsFilter['hidden'],
            })
          }
          className="pco-input text-sm"
        >
          <option value="all">Todos</option>
          <option value="false">Visíveis</option>
          <option value="true">Escondidos</option>
        </select>
        <select
          value={filter.courseId ?? ''}
          onChange={(e) =>
            setFilter({ ...filter, courseId: e.target.value || undefined })
          }
          className="pco-input text-sm"
        >
          <option value="">Todos cursos</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-pco-deep">
            {selected.size} selecionado(s)
          </span>
          <button
            type="button"
            onClick={() => applyAction('hide')}
            disabled={bulk.isPending}
            className="pco-btn-ghost text-xs"
          >
            <EyeOff size={11} strokeWidth={2} />
            Esconder
          </button>
          <button
            type="button"
            onClick={() => applyAction('show')}
            disabled={bulk.isPending}
            className="pco-btn-ghost text-xs"
          >
            <Eye size={11} strokeWidth={2} />
            Mostrar
          </button>
          <button
            type="button"
            onClick={() => applyAction('delete')}
            disabled={bulk.isPending}
            className="pco-btn-ghost text-xs text-status-danger"
          >
            <Trash2 size={11} strokeWidth={2} />
            Apagar
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="pco-btn-ghost text-xs ml-auto"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {list.isLoading ? (
        <CardListSkeleton count={3} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          title="Sem comentários"
          description="Nenhum comentário corresponde aos filtros."
          icon={<MessageSquare size={28} className="text-pco-blue" />}
        />
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-mute text-ink-muted">
              <tr>
                <th className="w-8 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-pco-blue"
                  />
                </th>
                <th className="text-left px-3 py-2 font-medium">Autor</th>
                <th className="text-left px-3 py-2 font-medium">Comentário</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {(list.data ?? []).map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  selected={selected.has(comment.id)}
                  onToggle={() => toggleSelect(comment.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  selected,
  onToggle,
}: {
  comment: AdminCommentDto;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      className={`hover:bg-surface-mute/40 ${selected ? 'bg-pco-blue/5' : ''}`}
    >
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="accent-pco-blue"
        />
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-pco-deep">{comment.authorName}</div>
        <div className="text-[10px] text-ink-subtle">{comment.authorRole}</div>
      </td>
      <td className="px-3 py-2 max-w-md">
        <div className={comment.hidden ? 'text-ink-subtle line-through' : ''}>
          {comment.body}
        </div>
        {comment.parentId && (
          <div className="text-[10px] text-ink-subtle mt-0.5">↳ resposta</div>
        )}
      </td>
      <td className="px-3 py-2">
        {comment.hidden ? (
          <span className="pco-badge text-[10px] bg-surface-gray text-ink-muted">
            <EyeOff size={9} className="inline" /> escondido
          </span>
        ) : (
          <span className="pco-badge text-[10px] bg-status-success/10 text-status-success">
            <Eye size={9} className="inline" /> visível
          </span>
        )}
        {comment.pinned && (
          <span className="pco-badge text-[10px] bg-pco-blue/10 text-pco-blue ml-1">
            fixado
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-ink-subtle whitespace-nowrap">
        {new Date(comment.createdAt).toLocaleDateString('pt-BR')}
      </td>
    </tr>
  );
}

function ReviewsPanel() {
  const courses = useCourses();
  const [filter, setFilter] = useState<ListReviewsFilter>({});
  const [search, setSearch] = useState('');
  const list = useAdminReviews(filter);
  const del = useDeleteAdminReview();
  const toast = useToast();

  function handleSearch() {
    setFilter({ ...filter, search: search.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar autor / comentário..."
            className="pco-input text-sm flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="pco-btn-ghost text-xs"
          >
            Buscar
          </button>
        </div>
        <select
          value={filter.minRating ?? ''}
          onChange={(e) =>
            setFilter({
              ...filter,
              minRating: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="pco-input text-sm"
          title="Rating mínimo"
        >
          <option value="">Min ★</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}★+
            </option>
          ))}
        </select>
        <select
          value={filter.courseId ?? ''}
          onChange={(e) =>
            setFilter({ ...filter, courseId: e.target.value || undefined })
          }
          className="pco-input text-sm"
        >
          <option value="">Todos cursos</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {list.isLoading ? (
        <CardListSkeleton count={3} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          title="Sem avaliações"
          description="Nenhuma avaliação corresponde aos filtros."
          icon={<Star size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              onDelete={async () => {
                if (!confirm('Apagar avaliação?')) return;
                try {
                  await del.mutateAsync({ courseId: r.courseId, reviewId: r.id });
                  toast.success('Removida');
                } catch (err) {
                  toast.error(
                    'Falha',
                    err instanceof Error ? err.message : 'Erro',
                  );
                }
              }}
              isPending={del.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  onDelete,
  isPending,
}: {
  review: AdminReviewDto;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <li className="pco-card p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-pco-deep">
              {review.userName}
            </span>
            <span className="text-[11px] text-ink-subtle">
              {review.userEmail}
            </span>
            <span className="ml-auto flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={10}
                  className={
                    i < review.rating
                      ? 'fill-status-gold text-status-gold'
                      : 'text-surface-gray'
                  }
                />
              ))}
            </span>
          </div>
          {review.comment && (
            <p className="text-xs text-ink-muted mt-2 whitespace-pre-wrap">
              {review.comment}
            </p>
          )}
          <div className="text-[11px] text-ink-subtle mt-1">
            {new Date(review.createdAt).toLocaleDateString('pt-BR')} · curso{' '}
            <code>{review.courseId}</code>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="pco-btn-ghost text-xs text-status-danger"
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} strokeWidth={2} />}
          Apagar
        </button>
      </div>
    </li>
  );
}
