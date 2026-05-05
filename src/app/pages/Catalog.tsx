import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { ArrowRight, Clock, Layers, BookOpen, GraduationCap } from 'lucide-react';
import { useCourses, useProducts } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import Logo from '../components/Logo';

/**
 * Catálogo público — visualização sem autenticação. Mostra cursos disponíveis
 * com CTA para login/cadastro.
 */
export default function Catalog() {
  useDocumentMeta({ title: 'Catálogo de cursos — AVA PCO' });
  const { data: courses, isLoading } = useCourses();
  const { data: products = [] } = useProducts();

  const visibleCourses = useMemo(() => {
    return (courses ?? []).filter((c) => {
      const product = products.find(
        (p) => p.kind === 'course' && p.refId === c.id && p.active,
      );
      return !!product; // só mostra cursos com produto à venda
    });
  }, [courses, products]);

  return (
    <div className="min-h-screen bg-surface-off">
      <header className="bg-white border-b border-pco-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" aria-label="Início">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="pco-btn-ghost text-sm">
              Entrar
            </Link>
            <Link to="/login" className="pco-btn-primary text-sm">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-pco-deep">
            Catálogo de cursos
          </h1>
          <p className="text-base text-ink-muted">
            Estude psicanálise clínica online com material atualizado, supervisão
            e certificação reconhecida. Crie sua conta e comece hoje.
          </p>
        </div>

        {isLoading ? (
          <CardListSkeleton count={3} />
        ) : visibleCourses.length === 0 ? (
          <EmptyState
            title="Nenhum curso disponível"
            description="Em breve novos cursos serão lançados."
            icon={<BookOpen size={28} className="text-pco-blue" />}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleCourses.map((course) => {
              const totalLessons = course.modules.reduce(
                (s, m) => s + m.lessons.length,
                0,
              );
              const product = products.find(
                (p) => p.kind === 'course' && p.refId === course.id && p.active,
              );
              const price =
                product &&
                (product.priceCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: product.currency,
                });

              return (
                <article
                  key={course.id}
                  className="pco-card pco-card-hover overflow-hidden p-0"
                >
                  <div
                    className={`relative h-40 bg-gradient-to-br ${course.coverColor} p-5`}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                    <div className="relative flex flex-col justify-between h-full text-white">
                      <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[10px] font-semibold uppercase tracking-wider">
                        {course.shortTitle}
                      </span>
                      <h3 className="text-xl font-bold leading-tight max-w-xs">
                        {course.title}
                      </h3>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <p className="text-sm text-ink-muted line-clamp-3">
                      {course.description}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={13} strokeWidth={1.75} className="text-pco-blue" />
                        {course.modules.length} módulos
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={13} strokeWidth={1.75} className="text-pco-blue" />
                        {totalLessons} aulas
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} strokeWidth={1.75} className="text-pco-blue" />
                        {course.totalHours}h
                      </span>
                    </div>

                    <div className="border-t border-pco-border pt-3 flex items-end justify-between gap-3">
                      <div>
                        {price && (
                          <>
                            <div className="text-[10px] uppercase tracking-wide text-ink-subtle">
                              A partir de
                            </div>
                            <div className="text-lg font-bold text-pco-deep">
                              {price}
                            </div>
                          </>
                        )}
                      </div>
                      <Link to="/login" className="pco-btn-primary text-xs">
                        Quero estudar
                        <ArrowRight size={12} strokeWidth={2} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="pco-card border-pco-blue/30 bg-pco-blue/5 p-6 text-center">
          <GraduationCap
            size={28}
            className="text-pco-blue mx-auto"
            strokeWidth={1.75}
          />
          <h2 className="text-xl font-bold text-pco-deep mt-2">
            Pronto para começar?
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Crie sua conta gratuita e tenha acesso ao primeiro contato com a
            plataforma.
          </p>
          <Link to="/login" className="pco-btn-primary mt-4 inline-flex">
            Criar conta agora
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </section>
      </main>

      <footer className="bg-white border-t border-pco-border py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-ink-subtle">
          © {new Date().getFullYear()} Psicanálise Clínica Online — AVA PCO
        </div>
      </footer>
    </div>
  );
}
