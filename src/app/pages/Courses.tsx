import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Layers, PlayCircle, Tag, Heart } from 'lucide-react';
import {
  useCourses,
  useMyProgress,
  useProducts,
  useStartCheckout,
  useCurrentStudent,
  useMyWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
} from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';
import CheckoutDialog from '../components/CheckoutDialog';
import type { ProductDto } from '../data/api';

export default function Courses() {
  const t = useT();
  useDocumentMeta({ title: `${t('courses.title')} — AVA PCO` });
  const { data: courses, isLoading, isError } = useCourses();
  const { data: progress } = useMyProgress();
  const { data: products = [] } = useProducts();
  const { data: student } = useCurrentStudent();
  const checkout = useStartCheckout();
  const toast = useToast();
  const [pendingProduct, setPendingProduct] = useState<ProductDto | null>(null);
  const wishlistQ = useMyWishlist();
  const addWish = useAddToWishlist();
  const removeWish = useRemoveFromWishlist();
  const wishedIds = useMemo(
    () => new Set((wishlistQ.data ?? []).map((w) => w.courseId)),
    [wishlistQ.data],
  );

  async function toggleWish(courseId: string) {
    try {
      if (wishedIds.has(courseId)) {
        await removeWish.mutateAsync(courseId);
      } else {
        await addWish.mutateAsync(courseId);
        toast.success('Adicionado à lista de interesse');
      }
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }
  const doneIds = new Set(progress?.completedLessonIds ?? []);
  const enrolledIds = new Set(
    (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds ?? [],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses ?? []) {
      for (const t of c.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [courses]);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get('tag');

  function setActiveTag(tag: string | null) {
    if (tag) {
      setSearchParams({ tag }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  const visibleCourses = useMemo(() => {
    if (!courses) return [];
    if (!activeTag) return courses;
    return courses.filter((c) => (c.tags ?? []).includes(activeTag));
  }, [courses, activeTag]);

  function handleBuy(product: ProductDto) {
    setPendingProduct(product);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('courses.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Continue estudando ou explore outros cursos da PCO.
        </p>
      </header>

      {isLoading && <CardListSkeleton count={3} />}
      {isError && (
        <div className="pco-card">
          <ErrorState />
        </div>
      )}
      {!isLoading && !isError && courses?.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Você ainda não tem cursos"
            description="Quando um curso for vinculado ao seu perfil, ele aparecerá aqui."
          />
        </div>
      )}

      {!isLoading && !isError && allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag size={12} className="text-pco-blue" strokeWidth={1.75} />
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`pco-badge text-xs px-2 py-1 ${
              activeTag === null
                ? 'bg-pco-blue/10 text-pco-blue'
                : 'bg-surface-gray text-ink-muted'
            }`}
          >
            Todos
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              className={`pco-badge text-xs px-2 py-1 ${
                activeTag === t
                  ? 'bg-pco-blue/10 text-pco-blue'
                  : 'bg-surface-gray text-ink-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isError && courses && courses.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleCourses.map((course) => {
            const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
            const done = course.modules.reduce(
              (s, m) =>
                s +
                m.lessons.filter((l) => doneIds.has(l.id) || l.status === 'completed')
                  .length,
              0,
            );
            const pct = totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0;

            return (
              <article key={course.id} className="pco-card pco-card-hover overflow-hidden p-0">
                <div className={`relative h-40 bg-gradient-to-br ${course.coverColor} p-5`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                  <div className="relative flex flex-col justify-between h-full text-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-wider">
                        {course.shortTitle}
                      </span>
                      <PlayCircle size={28} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold leading-tight max-w-xs">{course.title}</h3>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-ink-muted line-clamp-2">{course.description}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers size={13} strokeWidth={1.75} className="text-pco-blue" />
                      {course.modules.length} módulos
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} strokeWidth={1.75} className="text-pco-blue" />
                      {course.totalHours}h
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-ink-muted mb-1">
                      <span>Progresso</span>
                      <span className="font-semibold text-pco-deep">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-500 ease-smooth"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {(() => {
                    const isEnrolled = enrolledIds.has(course.id);
                    const product = products.find(
                      (p) => p.kind === 'course' && p.refId === course.id && p.active,
                    );
                    if (!isEnrolled && product) {
                      const price = (product.priceCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: product.currency,
                      });
                      const isWished = wishedIds.has(course.id);
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleBuy(product)}
                              disabled={checkout.isPending}
                              className="pco-btn-primary flex-1 justify-center text-xs"
                            >
                              Comprar por {price}
                              <ArrowRight size={12} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWish(course.id)}
                              disabled={addWish.isPending || removeWish.isPending}
                              className="pco-btn-ghost text-xs"
                              title={isWished ? 'Remover da lista' : 'Tenho interesse'}
                            >
                              <Heart
                                size={13}
                                strokeWidth={1.75}
                                className={isWished ? 'fill-pco-orange text-pco-orange' : ''}
                              />
                            </button>
                          </div>
                          <p className="text-[10px] text-ink-subtle text-center">
                            Acesso liberado após confirmação do pagamento
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="flex gap-2">
                        <Link
                          to={`/curso/${course.id}`}
                          className="pco-btn-primary flex-1 justify-center text-xs"
                        >
                          {pct === 0 ? 'Começar' : pct === 100 ? 'Revisar' : 'Continuar'}
                          <ArrowRight size={12} strokeWidth={2} />
                        </Link>
                        <Link to={`/jornada`} className="pco-btn-secondary text-xs">
                          Jornada
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pendingProduct && (
        <CheckoutDialog
          product={pendingProduct}
          open={!!pendingProduct}
          onClose={() => setPendingProduct(null)}
          onSuccess={(order) => {
            if (order.checkoutUrl) {
              window.location.assign(order.checkoutUrl);
            } else {
              toast.info('Pedido criado', `ID ${order.id}`);
            }
          }}
        />
      )}
    </div>
  );
}
