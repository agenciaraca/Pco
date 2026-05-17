// Forum por curso: lista threads + criar nova + ver detalhe.
// Aluno matriculado pode criar/responder. Autor/admin podem marcar resolvido e excluir.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  ThumbsUp,
  HelpCircle,
  Lightbulb,
  MessagesSquare,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  Plus,
  Send,
  Loader2,
} from 'lucide-react';
import { http } from '../data/client';
import { useAuth } from '../auth/AuthContext';
import { useCourses } from '../data/hooks';
import { useToast } from '../components/Toast';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

type ThreadKind = 'pergunta' | 'dica' | 'discussao';

interface Thread {
  id: string;
  courseId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  kind: ThreadKind;
  status: 'aberta' | 'resolvida' | 'arquivada';
  reactions: { likes: number; likedBy: string[] };
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Reply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  isAccepted: boolean;
  reactions: { likes: number; likedBy: string[] };
  createdAt: string;
}

const KIND_ICON: Record<ThreadKind, React.ReactNode> = {
  pergunta: <HelpCircle size={14} strokeWidth={1.75} className="text-pco-blue" />,
  dica: <Lightbulb size={14} strokeWidth={1.75} className="text-pco-orange" />,
  discussao: <MessagesSquare size={14} strokeWidth={1.75} className="text-pco-cyan" />,
};

const KIND_LABEL: Record<ThreadKind, string> = {
  pergunta: 'Pergunta',
  dica: 'Dica',
  discussao: 'Discussão',
};

export default function CourseForum() {
  const { courseId } = useParams<{ courseId: string }>();
  useDocumentMeta({ title: 'Fórum do curso — AVA PCO' });
  const qc = useQueryClient();
  const auth = useAuth();
  const toast = useToast();
  const coursesQ = useCourses();
  const course = coursesQ.data?.find((c) => c.id === courseId);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  const threadsQ = useQuery({
    queryKey: ['forum', 'threads', courseId],
    queryFn: () => http.get<Thread[]>(`/courses/${encodeURIComponent(courseId!)}/forum/threads`),
    enabled: !!courseId,
  });

  const createMut = useMutation({
    mutationFn: (input: { title: string; body: string; kind: ThreadKind }) =>
      http.post<Thread>(`/courses/${encodeURIComponent(courseId!)}/forum/threads`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum', 'threads', courseId] }),
  });

  const likeMut = useMutation({
    mutationFn: (id: string) => http.post<Thread>(`/forum/threads/${encodeURIComponent(id)}/like`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum', 'threads', courseId] }),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      http.post<Thread>(`/forum/threads/${encodeURIComponent(id)}/resolve`, { resolved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum', 'threads', courseId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => http.delete<{ ok: true }>(`/forum/threads/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forum', 'threads', courseId] });
      setSelectedThread(null);
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link
            to={`/curso/${courseId}`}
            className="text-xs font-medium text-pco-blue inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft size={12} /> Voltar ao curso
          </Link>
          <h1 className="pco-section-title mt-2">Fórum</h1>
          <p className="pco-section-subtitle mt-1">
            {course?.title ?? 'Curso'} · Tire dúvidas, compartilhe dicas, discuta com colegas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Nova publicação
        </button>
      </header>

      {threadsQ.isLoading ? (
        <CardListSkeleton count={3} />
      ) : !threadsQ.data || threadsQ.data.length === 0 ? (
        <div className="pco-card">
          <EmptyState
            icon={<MessageSquare size={26} className="text-pco-blue" strokeWidth={1.5} />}
            title="Nenhuma publicação ainda"
            description="Seja o primeiro a iniciar uma conversa neste curso."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {threadsQ.data.map((t) => (
            <li key={t.id} className="pco-card">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-surface-off grid place-items-center shrink-0">
                  {KIND_ICON[t.kind]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="pco-badge bg-surface-gray text-ink-muted">
                      {KIND_LABEL[t.kind]}
                    </span>
                    {t.status === 'resolvida' && (
                      <span className="pco-badge bg-status-success/10 text-status-success inline-flex items-center gap-1">
                        <CheckCircle2 size={10} strokeWidth={2.5} /> Resolvida
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedThread(t.id === selectedThread ? null : t.id)}
                    className="text-left w-full"
                  >
                    <h3 className="text-base font-semibold text-pco-deep hover:text-pco-blue">
                      {t.title}
                    </h3>
                  </button>
                  <p className="text-xs text-ink-muted mt-1 line-clamp-2">{t.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-subtle">
                    <span>{t.authorName.split('@')[0]}</span>
                    <span>·</span>
                    <span>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                    <span>·</span>
                    <span>{t.replyCount} resposta{t.replyCount === 1 ? '' : 's'}</span>
                    <button
                      type="button"
                      onClick={() => likeMut.mutate(t.id)}
                      className={`inline-flex items-center gap-1 hover:text-pco-blue ${
                        t.reactions.likedBy.includes(auth.user?.id ?? '') ? 'text-pco-blue' : ''
                      }`}
                      aria-label={`Curtir (${t.reactions.likes})`}
                    >
                      <ThumbsUp size={11} strokeWidth={2} />
                      {t.reactions.likes}
                    </button>
                    {(t.authorId === auth.user?.id || auth.user?.role !== 'student') && (
                      <>
                        {t.kind === 'pergunta' && (
                          <button
                            type="button"
                            onClick={() =>
                              resolveMut.mutate({
                                id: t.id,
                                resolved: t.status !== 'resolvida',
                              })
                            }
                            className="hover:text-status-success"
                          >
                            {t.status === 'resolvida' ? 'Reabrir' : 'Marcar resolvida'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Excluir publicação e todas as respostas?')) {
                              deleteMut.mutate(t.id);
                            }
                          }}
                          className="hover:text-status-danger"
                          aria-label="Excluir"
                        >
                          <Trash2 size={11} strokeWidth={2} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedThread === t.id && (
                <ThreadDetail
                  threadId={t.id}
                  currentUserId={auth.user?.id ?? ''}
                  isAdmin={auth.user?.role !== 'student'}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <NewThreadModal
          submitting={createMut.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={async (input) => {
            try {
              await createMut.mutateAsync(input);
              toast.success('Publicação criada');
              setShowCreate(false);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
        />
      )}
    </div>
  );
}

function ThreadDetail({
  threadId,
  currentUserId,
  isAdmin,
}: {
  threadId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const detailQ = useQuery({
    queryKey: ['forum', 'thread', threadId],
    queryFn: () =>
      http.get<{ thread: Thread; replies: Reply[] }>(
        `/forum/threads/${encodeURIComponent(threadId)}`,
      ),
  });
  const [replyBody, setReplyBody] = useState('');
  const replyMut = useMutation({
    mutationFn: (body: string) =>
      http.post<Reply>(`/forum/threads/${encodeURIComponent(threadId)}/replies`, { body }),
    onSuccess: () => {
      setReplyBody('');
      qc.invalidateQueries({ queryKey: ['forum', 'thread', threadId] });
    },
  });
  const likeReplyMut = useMutation({
    mutationFn: (id: string) => http.post<Reply>(`/forum/replies/${encodeURIComponent(id)}/like`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum', 'thread', threadId] }),
  });
  const deleteReplyMut = useMutation({
    mutationFn: (id: string) =>
      http.delete<{ ok: true }>(`/forum/replies/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum', 'thread', threadId] }),
  });

  return (
    <div className="mt-4 border-t border-surface-gray pt-4 space-y-3">
      {detailQ.isLoading ? (
        <div className="text-xs text-ink-muted">Carregando...</div>
      ) : (
        <>
          <p className="text-sm text-ink-base whitespace-pre-line">{detailQ.data?.thread.body}</p>
          {(detailQ.data?.replies.length ?? 0) > 0 && (
            <div className="space-y-2 pl-3 border-l-2 border-surface-gray">
              {detailQ.data?.replies.map((r) => (
                <div key={r.id} className="text-xs">
                  <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
                    <span className="font-semibold text-pco-deep">
                      {r.authorName.split('@')[0]}
                    </span>
                    <span>·</span>
                    <span>{new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                    <button
                      onClick={() => likeReplyMut.mutate(r.id)}
                      className={`inline-flex items-center gap-1 hover:text-pco-blue ${
                        r.reactions.likedBy.includes(currentUserId) ? 'text-pco-blue' : ''
                      }`}
                    >
                      <ThumbsUp size={10} strokeWidth={2} />
                      {r.reactions.likes}
                    </button>
                    {(r.authorId === currentUserId || isAdmin) && (
                      <button
                        onClick={() => {
                          if (confirm('Excluir resposta?')) deleteReplyMut.mutate(r.id);
                        }}
                        className="hover:text-status-danger"
                        aria-label="Excluir resposta"
                      >
                        <Trash2 size={10} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <p className="text-ink-base mt-1 whitespace-pre-line">{r.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && replyBody.trim().length >= 3) {
                  replyMut.mutate(replyBody.trim());
                }
              }}
              className="pco-input flex-1 text-xs"
              placeholder="Escreva uma resposta..."
            />
            <button
              type="button"
              onClick={() => {
                if (replyBody.trim().length >= 3) {
                  replyMut
                    .mutateAsync(replyBody.trim())
                    .catch((err) => toast.error('Falha', err instanceof Error ? err.message : 'Erro'));
                }
              }}
              disabled={replyBody.trim().length < 3 || replyMut.isPending}
              className="pco-btn-primary text-xs"
            >
              {replyMut.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Send size={11} />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NewThreadModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; body: string; kind: ThreadKind }) => Promise<void>;
}) {
  const [kind, setKind] = useState<ThreadKind>('pergunta');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const canSubmit = title.trim().length >= 3 && body.trim().length >= 5;

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
          <h2 className="text-lg font-bold text-pco-deep">Nova publicação</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-pco-deep">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs font-medium text-ink-muted mb-1.5">Tipo</div>
            <div className="flex gap-2">
              {(['pergunta', 'dica', 'discussao'] as ThreadKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`pco-btn-ghost text-xs ${
                    kind === k ? 'bg-pco-blue/10 text-pco-blue ring-1 ring-pco-blue/40' : ''
                  }`}
                >
                  {KIND_ICON[k]}
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pco-input"
              placeholder="Ex: Como interpretar o conceito de transferência?"
              maxLength={140}
              autoFocus
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-ink-muted mb-1.5">Conteúdo</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="pco-input min-h-[120px]"
              placeholder="Detalhe sua pergunta, dica ou tópico de discussão..."
              maxLength={3000}
            />
            <p className="text-[10px] text-ink-subtle mt-1">{body.length}/3000</p>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-gray">
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
              onClick={() => onSubmit({ title: title.trim(), body: body.trim(), kind })}
              disabled={!canSubmit || submitting}
              className="pco-btn-primary text-xs"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
