import { Link } from 'react-router-dom';
import { Mic2, PlayCircle, Heart, CheckCircle2, Clock } from 'lucide-react';
import { podcasts } from '../data/seed';

export default function Podcasts() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">PCO POD</h1>
        <p className="pco-section-subtitle mt-1">
          Conteúdo em áudio para sua jornada — episódios por curso, módulo e tema.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {podcasts.map((p) => (
          <article key={p.id} className="pco-card pco-card-hover">
            <div className="flex gap-4">
              <div
                className={`h-24 w-24 rounded-xl bg-gradient-to-br ${p.coverColor} grid place-items-center shrink-0`}
              >
                <Mic2 size={28} className="text-white" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-1">
                  {p.listened && (
                    <span className="pco-badge bg-status-success/10 text-status-success">
                      <CheckCircle2 size={10} strokeWidth={2} /> Ouvido
                    </span>
                  )}
                  {p.favorite && (
                    <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                      <Heart size={10} strokeWidth={2} /> Favorito
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-pco-deep line-clamp-2">{p.title}</h3>
                <p className="mt-1 text-xs text-ink-muted line-clamp-2">{p.description}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {p.durationMinutes} min
                  </span>
                  <span>{new Date(p.publishedAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to={`/podcasts/${p.id}`} className="pco-btn-primary text-xs">
                    <PlayCircle size={14} strokeWidth={2} />
                    Reproduzir
                  </Link>
                  <button className="pco-btn-ghost text-xs px-3">
                    <Heart size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
