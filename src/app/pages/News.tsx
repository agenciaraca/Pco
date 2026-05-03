import { Calendar, Tag } from 'lucide-react';
import { newsArticles } from '../data/seed';

export default function News() {
  const featured = newsArticles.find((a) => a.featured);
  const others = newsArticles.filter((a) => !a.featured);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">PCO News</h1>
        <p className="pco-section-subtitle mt-1">
          Estudos comentados, notícias da escola e curadoria de leituras.
        </p>
      </header>

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
            <h3 className="mt-1 text-base font-semibold text-pco-deep line-clamp-2">{a.title}</h3>
            <p className="mt-1 text-xs text-ink-muted line-clamp-3">{a.excerpt}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.tags.map((t) => (
                <span key={t} className="pco-badge bg-surface-gray text-ink-muted">
                  <Tag size={10} strokeWidth={1.75} />
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
