import { useMemo, useState } from 'react';
import { Package, ArrowRight, BookOpen, Star } from 'lucide-react';
import { useProducts, useCourses, useCurrentStudent } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useToast } from '../components/Toast';
import CheckoutDialog from '../components/CheckoutDialog';
import type { ProductDto } from '../data/api';
import { useT } from '../i18n';

export default function Bundles() {
  const t = useT();
  useDocumentMeta({ title: `${t('bundles.title')} — AVA PCO` });
  const { data: products = [], isLoading } = useProducts();
  const { data: courses = [] } = useCourses();
  const { data: student } = useCurrentStudent();
  const toast = useToast();
  const [pendingProduct, setPendingProduct] = useState<ProductDto | null>(null);

  const enrolledIds = useMemo(
    () =>
      new Set(
        (student as { enrolledCourseIds?: string[] })?.enrolledCourseIds ?? [],
      ),
    [student],
  );

  const bundles = useMemo(
    () => products.filter((p) => p.kind === 'bundle' && p.active),
    [products],
  );

  function getBundleCourses(bundle: ProductDto) {
    const ids = ((bundle.metadata as { courseIds?: string[] } | undefined)
      ?.courseIds ?? []) as string[];
    return ids
      .map((id) => courses.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c);
  }

  function calcSavings(bundle: ProductDto, bundleCourses: typeof courses) {
    let regularSum = 0;
    for (const c of bundleCourses) {
      const p = products.find(
        (pr) => pr.kind === 'course' && pr.refId === c.id && pr.active,
      );
      if (p) regularSum += p.priceCents;
    }
    if (regularSum <= bundle.priceCents) return null;
    const saved = regularSum - bundle.priceCents;
    return {
      regularSum,
      savedCents: saved,
      pct: Math.round((saved / regularSum) * 100),
    };
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title flex items-center gap-2">
          <Package size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('bundles.title')}
        </h1>
        <p className="pco-section-subtitle mt-1">
          Compre vários cursos juntos com desconto. Acesso liberado imediatamente
          após confirmação do pagamento.
        </p>
      </header>

      {isLoading && <CardListSkeleton count={2} />}
      {!isLoading && bundles.length === 0 && (
        <div className="pco-card">
          <EmptyState
            title="Sem pacotes ativos"
            description="No momento não temos combos. Confira os cursos individuais."
            icon={<Package size={28} className="text-pco-blue" />}
          />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {bundles.map((bundle) => {
          const bundleCourses = getBundleCourses(bundle);
          const savings = calcSavings(bundle, bundleCourses);
          const allEnrolled =
            bundleCourses.length > 0 &&
            bundleCourses.every((c) => enrolledIds.has(c.id));
          const price = (bundle.priceCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: bundle.currency,
          });

          return (
            <article
              key={bundle.id}
              className="pco-card pco-card-hover overflow-hidden p-0"
            >
              <div className="relative h-32 bg-gradient-to-br from-pco-blue to-pco-cyan p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                <div className="relative flex flex-col justify-between h-full text-white">
                  <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-wider gap-1">
                    <Package size={10} />
                    Pacote · {bundleCourses.length} cursos
                  </span>
                  <h3 className="text-xl font-bold leading-tight max-w-xs">
                    {bundle.name}
                  </h3>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {bundle.description && (
                  <p className="text-sm text-ink-muted">{bundle.description}</p>
                )}

                <div>
                  <h4 className="text-[11px] uppercase tracking-wide text-ink-muted mb-2 flex items-center gap-1">
                    <BookOpen size={11} />
                    Cursos inclusos
                  </h4>
                  <ul className="space-y-1">
                    {bundleCourses.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 text-xs text-pco-deep"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-pco-blue" />
                        <span className="flex-1 truncate">{c.title}</span>
                        {enrolledIds.has(c.id) && (
                          <span className="pco-badge text-[9px] bg-status-success/10 text-status-success">
                            já tem
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-pco-border pt-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      {savings && (
                        <div className="text-[11px] text-ink-subtle line-through">
                          {(savings.regularSum / 100).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: bundle.currency,
                          })}
                        </div>
                      )}
                      <div className="text-2xl font-bold text-pco-deep">
                        {price}
                      </div>
                      {savings && (
                        <div className="text-[11px] font-semibold text-status-success flex items-center gap-1">
                          <Star size={10} className="fill-status-success" />
                          Economia de {savings.pct}%
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingProduct(bundle)}
                      disabled={allEnrolled}
                      className="pco-btn-primary text-xs"
                    >
                      {allEnrolled ? 'Já matriculado' : 'Comprar'}
                      <ArrowRight size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

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
