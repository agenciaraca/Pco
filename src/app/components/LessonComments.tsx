import { useState, useMemo } from 'react';
import {
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
  EyeOff,
  Eye,
  Reply,
  Send,
} from 'lucide-react';
import {
  useLessonComments,
  useCreateLessonComment,
  useUpdateLessonComment,
  useDeleteLessonComment,
} from '../data/hooks';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';
import type { LessonCommentDto } from '../data/api';

export default function LessonComments({
  lessonId,
  courseId,
  canPost,
}: {
  lessonId: string;
  courseId: string;
  canPost: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const { data: comments = [], isLoading } = useLessonComments(lessonId);
  const create = useCreateLessonComment();
  const updateMut = useUpdateLessonComment();
  const del = useDeleteLessonComment();
  const toast = useToast();

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const grouped = useMemo(() => {
    const roots = comments.filter((c) => c.parentId === null);
    const replies = new Map<string, LessonCommentDto[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = replies.get(c.parentId) ?? [];
        arr.push(c);
        replies.set(c.parentId, arr);
      }
    }
    return { roots, replies };
  }, [comments]);

  async function handlePost() {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({
        lessonId,
        courseId,
        body: draft.trim(),
      });
      setDraft('');
      toast.success('Comentário publicado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleReply(parentId: string) {
    if (!replyDraft.trim()) return;
    try {
      await create.mutateAsync({
        lessonId,
        courseId,
        parentId,
        body: replyDraft.trim(),
      });
      setReplyDraft('');
      setReplyingTo(null);
      toast.success('Resposta publicada');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <section className="pco-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <MessageSquare size={14} className="text-pco-blue" strokeWidth={1.75} />
        Discussão ({comments.filter((c) => !c.hidden).length})
      </h3>

      {canPost && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Compartilhe uma dúvida, reflexão ou contribuição..."
            rows={3}
            className="pco-input text-sm"
            maxLength={3000}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePost}
              disabled={!draft.trim() || create.isPending}
              className="pco-btn-primary text-xs"
            >
              <Send size={11} strokeWidth={2} />
              {create.isPending ? 'Enviando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-ink-muted">Carregando...</div>
      ) : grouped.roots.length === 0 ? (
        <div className="text-xs text-ink-muted text-center py-4">
          {canPost
            ? 'Seja o primeiro a comentar!'
            : 'Sem comentários ainda.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {grouped.roots.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg border p-3 ${
                c.pinned
                  ? 'border-pco-orange/30 bg-pco-orange/5'
                  : c.hidden
                    ? 'border-status-danger/30 bg-status-danger/5 opacity-70'
                    : 'border-pco-border bg-white'
              }`}
            >
              <CommentBody
                comment={c}
                isAdmin={isAdmin}
                canEdit={c.authorId === user?.id || isAdmin}
                onPin={(pinned) =>
                  updateMut.mutate({
                    lessonId,
                    commentId: c.id,
                    patch: { pinned },
                  })
                }
                onHide={(hidden) =>
                  updateMut.mutate({
                    lessonId,
                    commentId: c.id,
                    patch: { hidden },
                  })
                }
                onDelete={() => {
                  if (confirm('Excluir este comentário e suas respostas?')) {
                    del.mutate({ lessonId, commentId: c.id });
                  }
                }}
                onReply={() => {
                  setReplyingTo(replyingTo === c.id ? null : c.id);
                  setReplyDraft('');
                }}
                canPost={canPost}
              />

              {(grouped.replies.get(c.id) ?? []).map((r) => (
                <div
                  key={r.id}
                  className={`mt-2 ml-4 pl-3 border-l-2 ${
                    r.hidden ? 'opacity-60 border-status-danger/30' : 'border-pco-border'
                  }`}
                >
                  <CommentBody
                    comment={r}
                    isAdmin={isAdmin}
                    canEdit={r.authorId === user?.id || isAdmin}
                    onPin={() => {}}
                    onHide={(hidden) =>
                      updateMut.mutate({
                        lessonId,
                        commentId: r.id,
                        patch: { hidden },
                      })
                    }
                    onDelete={() => {
                      if (confirm('Excluir esta resposta?')) {
                        del.mutate({ lessonId, commentId: r.id });
                      }
                    }}
                    canPost={false}
                    isReply
                  />
                </div>
              ))}

              {replyingTo === c.id && canPost && (
                <div className="mt-2 ml-4 space-y-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Sua resposta..."
                    rows={2}
                    className="pco-input text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyDraft('');
                      }}
                      className="pco-btn-ghost text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReply(c.id)}
                      disabled={!replyDraft.trim()}
                      className="pco-btn-primary text-xs"
                    >
                      Responder
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentBody({
  comment,
  isAdmin,
  canEdit,
  canPost,
  onPin,
  onHide,
  onDelete,
  onReply,
  isReply,
}: {
  comment: LessonCommentDto;
  isAdmin: boolean;
  canEdit: boolean;
  canPost: boolean;
  onPin: (pinned: boolean) => void;
  onHide: (hidden: boolean) => void;
  onDelete: () => void;
  onReply?: () => void;
  isReply?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-pco-deep">
            {comment.authorName}
          </span>
          {comment.authorRole !== 'student' && (
            <span className="pco-badge bg-pco-blue/10 text-pco-blue text-xs">
              {comment.authorRole}
            </span>
          )}
          {comment.pinned && (
            <span className="pco-badge bg-pco-orange/10 text-pco-orange text-xs">
              fixado
            </span>
          )}
          {comment.hidden && isAdmin && (
            <span className="pco-badge bg-status-danger/15 text-status-danger text-xs">
              oculto
            </span>
          )}
          <span className="text-xs text-ink-subtle">
            {new Date(comment.createdAt).toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
      <p className="text-sm text-pco-deep whitespace-pre-wrap">{comment.body}</p>
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {!isReply && canPost && onReply && (
          <button
            type="button"
            onClick={onReply}
            className="pco-btn-ghost text-xs"
          >
            <Reply size={11} strokeWidth={2} />
            Responder
          </button>
        )}
        {isAdmin && !isReply && (
          <button
            type="button"
            onClick={() => onPin(!comment.pinned)}
            className="pco-btn-ghost text-xs"
            title={comment.pinned ? 'Desafixar' : 'Fixar'}
          >
            {comment.pinned ? (
              <PinOff size={11} strokeWidth={2} />
            ) : (
              <Pin size={11} strokeWidth={2} />
            )}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onHide(!comment.hidden)}
            className="pco-btn-ghost text-xs"
            title={comment.hidden ? 'Exibir' : 'Ocultar'}
          >
            {comment.hidden ? (
              <Eye size={11} strokeWidth={2} />
            ) : (
              <EyeOff size={11} strokeWidth={2} />
            )}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="pco-btn-ghost text-xs text-status-danger"
            title="Excluir"
          >
            <Trash2 size={11} strokeWidth={2} />
          </button>
        )}
      </div>
    </>
  );
}
