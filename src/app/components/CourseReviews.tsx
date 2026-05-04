import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import {
  useCourseRating,
  useCourseReviews,
  useMyCourseReview,
  useUpsertMyCourseReview,
} from '../data/hooks';
import { useToast } from './Toast';

export default function CourseReviews({
  courseId,
  canReview,
}: {
  courseId: string;
  canReview: boolean;
}) {
  const rating = useCourseRating(courseId);
  const reviews = useCourseReviews(courseId);
  const my = useMyCourseReview(canReview ? courseId : undefined);
  const upsert = useUpsertMyCourseReview();
  const toast = useToast();
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [editing, setEditing] = useState(false);

  const myRating = my.data?.rating ?? 0;
  const myComment = my.data?.comment ?? '';

  async function handleSubmit() {
    if (draftRating < 1) {
      toast.error('Selecione uma nota', '1 a 5 estrelas');
      return;
    }
    try {
      await upsert.mutateAsync({
        courseId,
        rating: draftRating,
        comment: draftComment.trim() || undefined,
      });
      setEditing(false);
      setDraftRating(0);
      setDraftComment('');
      toast.success('Avaliação registrada');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <section className="pco-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Star size={14} className="text-pco-orange" strokeWidth={1.75} />
          Avaliações
        </h3>
        {rating.data && rating.data.count > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={rating.data.avg} />
            <span className="text-sm font-bold text-pco-deep">
              {rating.data.avg.toFixed(1)}
            </span>
            <span className="text-xs text-ink-muted">
              ({rating.data.count} avaliação{rating.data.count !== 1 ? 'ões' : ''})
            </span>
          </div>
        )}
      </div>

      {canReview && (
        <div className="rounded-lg border border-pco-border p-3 space-y-2">
          {!editing && my.data ? (
            <div className="space-y-1">
              <div className="text-xs text-ink-muted">Sua avaliação:</div>
              <Stars value={myRating} />
              {myComment && (
                <p className="text-xs text-pco-deep mt-1 whitespace-pre-wrap">
                  {myComment}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setDraftRating(myRating);
                  setDraftComment(myComment);
                }}
                className="pco-btn-ghost text-xs"
              >
                Editar
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs text-ink-muted">
                {my.data ? 'Editar sua avaliação' : 'Avaliar este curso'}
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraftRating(n)}
                    className="p-1"
                    aria-label={`${n} estrela(s)`}
                  >
                    <Star
                      size={20}
                      strokeWidth={1.75}
                      className={
                        n <= draftRating
                          ? 'text-pco-orange fill-pco-orange'
                          : 'text-ink-subtle'
                      }
                      fill={n <= draftRating ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder="Comentário (opcional)"
                rows={3}
                className="pco-input text-sm"
                maxLength={2000}
              />
              <div className="flex items-center gap-2 justify-end">
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setDraftRating(0);
                      setDraftComment('');
                    }}
                    className="pco-btn-ghost text-xs"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={upsert.isPending || draftRating < 1}
                  className="pco-btn-primary text-xs"
                >
                  <Send size={11} strokeWidth={2} />
                  {upsert.isPending ? 'Enviando...' : 'Enviar avaliação'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(reviews.data ?? []).length === 0 ? (
        <div className="text-xs text-ink-muted text-center py-4">
          Ninguém avaliou ainda. Seja o primeiro!
        </div>
      ) : (
        <ul className="space-y-3">
          {(reviews.data ?? []).slice(0, 20).map((r) => (
            <li key={r.id} className="border-t border-pco-border pt-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold text-pco-deep">
                  {r.userName}
                </span>
                <Stars value={r.rating} />
              </div>
              {r.comment && (
                <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">
                  {r.comment}
                </p>
              )}
              <div className="text-[10px] text-ink-subtle mt-1">
                {new Date(r.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          strokeWidth={1.75}
          className={
            n <= Math.round(value)
              ? 'text-pco-orange fill-pco-orange'
              : 'text-ink-subtle'
          }
          fill={n <= Math.round(value) ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}
