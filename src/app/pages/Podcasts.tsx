import { Link } from 'react-router-dom';
import { Mic2, PlayCircle, Heart, CheckCircle2, Clock, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  usePodcasts,
  useMyPodcastEngagement,
  useSetPodcastEngagement,
} from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';

/*
  Lista vazia estável.

  `data ?? []` cria um array novo a cada render, e todo `useMemo` que dependa
  dele recalcula sempre — o que é justamente o oposto do que o `useMemo` está
  ali para fazer.
*/
const VAZIO: never[] = [];

export default function Podcasts() {
  const t = useT();
  const podcastsQ = usePodcasts();
  const podcasts = podcastsQ.data ?? VAZIO;
  const engagementQ = useMyPodcastEngagement();
  const setEng = useSetPodcastEngagement();
  const toast = useToast();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const engagementMap = useMemo(() => {
    const map = new Map<string, { listened: boolean; favorite: boolean }>();
    (engagementQ.data ?? []).forEach((e) =>
      map.set(e.episodeId, { listened: e.listened, favorite: e.favorite }),
    );
    return map;
  }, [engagementQ.data]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of podcasts) {
      for (const t of p.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [podcasts]);

  const visiblePodcasts = useMemo(
    () =>
      activeTag
        ? podcasts.filter((p) => (p.tags ?? []).includes(activeTag))
        : podcasts,
    [podcasts, activeTag],
  );

  // Sem rede a consulta fica `paused`, e aí `isLoading` e `isError` são
  // os dois `false`: a tela caía no estado vazio e dizia que não há nada,
  // que é a única leitura que faz alguém parar de procurar.
  if (podcastsQ.fetchStatus === 'paused') return <SemConexao oQue="os episódios" />;
  if (podcastsQ.isPending) return <CardListSkeleton count={4} />;
  if (podcastsQ.isError)
    return (
      <FalhaAoCarregar
        erro={podcastsQ.error}
        oQue="os episódios"
        aoTentarDeNovo={() => void podcastsQ.refetch()}
      />
    );

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
        <h1 className="pco-section-title">{t('podcasts.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Conteúdo em áudio para sua jornada — episódios por curso, módulo e tema.
        </p>
      </header>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Tag size={12} className="text-pco-blue" strokeWidth={1.75} />
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`pco-badge text-xs ${
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
              className={`pco-badge text-xs ${
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

      <div className="grid gap-4 lg:grid-cols-2">
        {visiblePodcasts.map((p) => {
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
