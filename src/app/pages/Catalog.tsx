import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Layers,
  BookOpen,
  GraduationCap,
  PlayCircle,
  Search,
} from 'lucide-react';
import { useCourses, useProducts } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useT } from '../i18n';
import { publicCourseUrl } from '../lib/publicUrls';

/**
 * Catálogo público — visualização sem autenticação. Mostra cursos disponíveis
 * com CTA para login/cadastro.
 */
export default function Catalog() {
  const t = useT();
  useDocumentMeta({ title: `${t('catalog.title')} — AVA PCO` });
  const { data: courses, isLoading } = useCourses();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string>('');

  const visibleCourses = useMemo(() => {
    let list = (courses ?? []).filter((c) => {
      const product = products.find(
        (p) => p.kind === 'course' && p.refId === c.id && p.active,
      );
      return !!product;
    });
    if (activeTag) {
      list = list.filter((c) => (c.tags ?? []).includes(activeTag));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => {
        const fields = [
          c.title,
          c.shortTitle,
          c.description,
          ...(c.tags ?? []),
          c.instructorName ?? '',
        ];
        return fields.some((f) => f.toLowerCase().includes(q));
      });
    }
    return list;
  }, [courses, products, search, activeTag]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses ?? []) {
      const product = products.find(
        (p) => p.kind === 'course' && p.refId === c.id && p.active,
      );
      if (!product) continue;
      for (const t of c.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [courses, products]);

  return (
    <div className="min-h-screen bg-surface-off">
      <SiteHeader />

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

        {allTags.length > 0 && (
          <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-1.5 justify-center">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Filtrar:
            </span>
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${
                activeTag === ''
                  ? 'bg-pco-blue text-white border-pco-blue'
                  : 'bg-white text-ink-muted border-pco-border hover:border-pco-blue/40'
              }`}
            >
              Todos
            </button>
            {allTags.slice(0, 12).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(activeTag === t ? '' : t)}
                className={`text-[11px] px-2.5 py-1 rounded-full border capitalize ${
                  activeTag === t
                    ? 'bg-pco-blue text-white border-pco-blue'
                    : 'bg-white text-ink-muted border-pco-border hover:border-pco-blue/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="max-w-xl mx-auto pco-card p-3 flex items-center gap-2">
          <Search size={16} className="text-ink-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, descrição, tag, instrutor…"
            className="pco-input text-sm flex-1 border-0 focus:ring-0"
            aria-label="Buscar curso"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="pco-btn-ghost text-xs"
            >
              Limpar
            </button>
          )}
        </div>

        {isLoading ? (
          <CardListSkeleton count={3} />
        ) : visibleCourses.length === 0 ? (
          <EmptyState
            title={search ? 'Nada encontrado' : 'Nenhum curso disponível'}
            description={
              search
                ? `Nenhum curso casa com "${search}". Tente outros termos.`
                : 'Em breve novos cursos serão lançados.'
            }
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
                <a
                  href={publicCourseUrl(course)}
                  key={course.id}
                  className="pco-card pco-card-hover overflow-hidden p-0 block"
                >
                  <div
                    className={`relative h-40 p-5 ${course.coverImageUrl ? 'bg-pco-deep' : `bg-gradient-to-br ${course.coverColor}`}`}
                  >
                    {course.coverImageUrl && (
                      <img
                        src={course.coverImageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                    {course.modules.some((m) => m.lessons.some((l) => l.isPreview)) && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-pco-deep text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        <PlayCircle size={10} strokeWidth={2.5} className="text-pco-blue" />
                        Preview livre
                      </span>
                    )}
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
                      <span className="pco-btn-primary text-xs">
                        Ver detalhes
                        <ArrowRight size={12} strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                </a>
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
