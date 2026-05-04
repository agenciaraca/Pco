import { Link } from 'react-router-dom';
import { Mic2, PlayCircle, Heart, CheckCircle2, Clock } from 'lucide-react';
import { useMemo } from 'react';
import {
  usePodcasts,
  useMyPodcastEngagement,
  useSetPodcastEngagement,
} from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';

export default function Podcasts() {
  const { data: podcasts = [], isLoading } = usePodcasts();
  const engagementQ = useMyPodcastEngagement();
  const setEng = useSetPodcastEngagement();
  const toast = useToast();

  const engagementMap = useMemo(() => {
    const map = new Map<string, { listened: boolean; favorite: boolean }>();
    (engagementQ.data ?? []).forEach((e) =>
      map.set(e.episodeId, { listened: e.listened, favorite: e.favorite }),
    );
    return map;
  }, [engagementQ.data]);

  if (isLoading) return <CardListSkeleton count={4} />;

  async function toggleFavorite(id: string, current: boolean) {
    try {
      await setEng.mutateAsync({ episodeId: id, patch: { favorite: !current } });
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">PCO POD</h1>
        <p className="pco-section-subtitle mt-1">
          Conteúdo em áudio para sua jornada — episódios por curso, módulo e tema.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {podcasts.map((p) => {
          const eng = engagementMap.get(p.id);
          const listened = eng?.listened ?? p.listened ?? false;
          const favorite = eng?.favorite ?? p.favorite ?? false;
          return (
            <article key={p.id} className="pco-card pco-card-hover">
              <div className="flex gap-4">
                <div
                  className={`h-24 w-24 rounded-xl bg-gradient-to-br ${p.coverColor} grid place-items-center shrink-0`}
                >
                  <Mic2 size={28} className="text-white" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-1">
                    {listened && (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        <CheckCircle2 size={10} strokeWidth={2} /> Ouvido
                      </span>
                    )}
                    {favorite && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        <Heart size={10} strokeWidth={2} /> Favorito
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-pco-deep line-clamp-2">
                    {p.title}
                  </h3>
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
                    <button
                      type="button"
                      onClick={() => toggleFavorite(p.id, favorite)}
                      disabled={setEng.isPending}
                      className={
                        favorite
                          ? 'pco-btn-secondary text-xs px-3'
                          : 'pco-btn-ghost text-xs px-3'
                      }
                      title={favorite ? 'Remover dos favoritos' : 'Favoritar'}
                      aria-pressed={favorite}
                    >
                      <Heart
                        size={14}
                        strokeWidth={1.75}
                        className={favorite ? 'fill-pco-orange text-pco-orange' : ''}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
