import { Calendar, Tag, Search, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNews } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useT } from '../i18n';

export default function News() {
  const t = useT();
  const { data: newsArticles = [], isLoading } = useNews();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    newsArticles.forEach((a) => set.add(a.category));
    return Array.from(set).sort();
  }, [newsArticles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return newsArticles.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (q) {
        const hay = `${a.title} ${a.excerpt} ${a.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [newsArticles, search, category]);

  if (isLoading) return <CardListSkeleton count={4} />;

  // Featured só aparece quando filtros estão "limpos"
  const showFeatured = search.trim() === '' && category === 'all';
  const featured = showFeatured ? filtered.find((a) => a.featured) : undefined;
  const others = filtered.filter((a) => !showFeatured || !a.featured);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('news.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Estudos comentados, notícias da escola e curadoria de leituras.
        </p>
      </header>

      <div className="pco-card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, resumo ou tag..."
            className="pco-input pl-9 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="pco-input w-auto text-sm"
        >
          <option value="all">Todas categorias</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-muted inline-flex items-center gap-1">
          <Filter size={11} strokeWidth={2} />
          {filtered.length} de {newsArticles.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum artigo com esses filtros"
          description="Limpe os filtros ou tente outros termos."
        />
      ) : (
        <>
          {featured && (
            <article className="pco-card pco-card-hover overflow-hidden p-0">
              <div className={`h-56 bg-gradient-to-br ${featured.coverColor}`} />
              <div className="p-6">
                <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-pco-blue">
                  Destaque · {featured.category}
                </div>
                <h2 className="mt-2 text-2xl font-bold text-pco-deep">{featured.title}</h2>
                <p className="mt-2 text-sm text-ink-muted">{featured.excerpt}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(featured.publishedAt).toLocaleDateString('pt-BR')}
                  </span>
                  <span>{featured.authorName}</span>
                </div>
              </div>
            </article>
          )}

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {others.map((a) => (
              <article key={a.id} className="pco-card pco-card-hover">
                <div className={`h-32 rounded-xl bg-gradient-to-br ${a.coverColor} mb-3`} />
                <div className="text-[10px] font-semibold uppercase tracking-wider text-pco-blue">
                  {a.category}
                </div>
                <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">
                  {a.title}
                </h3>
                <p className="mt-1 text-xs text-ink-muted line-clamp-3">{a.excerpt}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span key={t} className="pco-badge bg-surface-gray text-ink-muted">
                      <Tag size={10} strokeWidth={1.75} />
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-ink-subtle">
                  {new Date(a.publishedAt).toLocaleDateString('pt-BR')} · {a.authorName}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
