import { useParams, Link, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Share2,
  Mic2,
  BookOpen,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  usePodcasts,
  useCourses,
  useLibrary,
  useSetPodcastEngagement,
  useMyPodcastEngagement,
} from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';

export default function PodcastEpisode() {
  const { id } = useParams<{ id: string }>();
  const { data: podcasts = [], isLoading } = usePodcasts();
  const { data: courses = [] } = useCourses();
  const { data: libraryItems = [] } = useLibrary();
  const setEng = useSetPodcastEngagement();
  const episode = podcasts.find((p) => p.id === id);
  const [playing, setPlaying] = useState(false);
  const [markedListened, setMarkedListened] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { data: engajamento = [] } = useMyPodcastEngagement();
  const favorito = engajamento.some((e) => e.episodeId === id && e.favorite);
  /**
   * O player era um `setInterval` que somava 0.6% a cada 200ms.
   *
   * Não havia `<audio>` em lugar nenhum e `episode.audioUrl` — que existe no
   * DTO — nunca era lido. A barra andava sozinha, o botão "voltar 15s" mexia
   * num número, e **aos 80% desse progresso inventado a tela gravava
   * `listened: true`**. Ou seja, a métrica de engajamento com podcast da escola
   * era produzida por uma animação: ninguém tinha ouvido nada.
   *
   * Agora o áudio é de verdade e o progresso vem do `timeupdate` dele. A CSP
   * ganhou `media-src` em 3/set/2026 justamente para isto.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [duracaoReal, setDuracaoReal] = useState(0);

  useEffect(() => {
    // Episódio novo, player do zero.
    setSegundos(0);
    setDuracaoReal(0);
    setPlaying(false);
    setMarkedListened(false);
  }, [id]);

  if (isLoading) return <CardListSkeleton count={2} />;
  if (!episode) return <Navigate to="/podcasts" replace />;

  // A duração de verdade é a do arquivo; `durationMinutes` é o que alguém
  // digitou no cadastro e só serve enquanto o áudio não carregou.
  const totalSeconds = duracaoReal || episode.durationMinutes * 60;
  const currentSeconds = segundos;
  const progress = totalSeconds > 0 ? Math.min(100, (segundos / totalSeconds) * 100) : 0;
  const audioUrl = episode.audioUrl;

  function mover(delta: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
  }
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const relatedCourses = (episode.relatedCourseIds ?? []).map((cid) =>
    courses.find((c) => c.id === cid),
  );
  const relatedMaterials = libraryItems.filter((m) =>
    episode.relatedCourseIds?.some((cid) => m.relatedCourseIds?.includes(cid)),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/podcasts"
          className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar aos episódios
        </Link>
      </div>

      <div className="pco-card p-0 overflow-hidden">
        <div className={`relative h-44 bg-gradient-to-br ${episode.coverColor}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
            <div className="text-white">
              <div className="text-xs uppercase tracking-[0.3em] font-semibold opacity-80">
                PCO POD
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-bold leading-tight max-w-2xl">
                {episode.title}
              </h1>
            </div>
            <Mic2 size={48} className="text-white/90" strokeWidth={1.25} />
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {episode.durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {new Date(episode.publishedAt).toLocaleDateString('pt-BR')}
            </span>
            {relatedCourses.map(
              (c) =>
                c && (
                  <span key={c.id} className="pco-badge bg-pco-blue/10 text-pco-blue">
                    {c.shortTitle}
                  </span>
                ),
            )}
            {episode.favorite && (
              <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                <Heart size={10} strokeWidth={2} />
                Favorito
              </span>
            )}
          </div>

          {audioUrl ? (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onLoadedMetadata={(e) => setDuracaoReal(e.currentTarget.duration || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(e) => {
                const a = e.currentTarget;
                setSegundos(a.currentTime);
                // 80% do que foi ouvido de verdade. Antes era 80% de uma
                // animação, e virava dado de engajamento igual.
                if (id && !markedListened && a.duration > 0 && a.currentTime / a.duration >= 0.8) {
                  setMarkedListened(true);
                  setEng.mutate({ episodeId: id, patch: { listened: true } });
                }
              }}
              className="hidden"
            />
          ) : (
            /*
              Sem arquivo não há o que tocar — e dizer isso é melhor do que
              deixar um play que finge. O episódio segue com título, descrição e
              transcrição, que é o que existe dele.
            */
            <p className="rounded-xl bg-surface-gray px-4 py-3 text-xs text-ink-muted">
              Este episódio ainda não tem o áudio publicado. Assim que ele subir,
              o player aparece aqui.
            </p>
          )}

          <div className="space-y-3">
            <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
              <span>{fmt(currentSeconds)}</span>
              <span>{fmt(totalSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => mover(-15)}
              className="h-11 w-11 rounded-full bg-surface-gray text-pco-deep grid place-items-center hover:bg-pco-blue hover:text-white transition-colors"
              aria-label="Voltar 15s"
            >
              <SkipBack size={18} strokeWidth={1.75} />
            </button>
            <button
              disabled={!audioUrl}
              onClick={() => {
                const a = audioRef.current;
                if (!a) return;
                if (a.paused) void a.play();
                else a.pause();
              }}
              className="h-14 w-14 rounded-full bg-pco-blue text-white grid place-items-center hover:bg-[#007a92] transition-colors shadow-card"
              aria-label={playing ? 'Pausar' : 'Reproduzir'}
            >
              {playing ? (
                <Pause size={24} strokeWidth={1.75} />
              ) : (
                <Play size={24} strokeWidth={1.75} className="ml-1" />
              )}
            </button>
            <button
              onClick={() => mover(15)}
              className="h-11 w-11 rounded-full bg-surface-gray text-pco-deep grid place-items-center hover:bg-pco-blue hover:text-white transition-colors"
              aria-label="Avançar 15s"
            >
              <SkipForward size={18} strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
            {/*
              Os dois botões não faziam nada. Favoritar tinha backend inteiro
              (`PUT /podcasts/:id/engagement` com o campo `favorite`) e o hook
              já estava importado nesta página — faltava ligar. Compartilhar não
              precisa de backend nenhum: copiar o endereço resolve.
            */}
            <button
              type="button"
              onClick={() =>
                setEng.mutate({ episodeId: episode.id, patch: { favorite: !favorito } })
              }
              disabled={setEng.isPending}
              className="pco-btn-ghost text-xs disabled:opacity-60"
              aria-pressed={favorito}
            >
              <Heart
                size={12}
                strokeWidth={1.75}
                className={favorito ? 'fill-pco-orange text-pco-orange' : undefined}
              />
              {favorito ? 'Favoritado' : 'Favoritar'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopiado(true);
                  window.setTimeout(() => setCopiado(false), 2000);
                } catch {
                  // Navegador sem permissão de área de transferência: melhor não
                  // fingir que copiou.
                  setCopiado(false);
                }
              }}
              className="pco-btn-ghost text-xs"
            >
              <Share2 size={12} strokeWidth={1.75} />
              {copiado ? 'Link copiado' : 'Compartilhar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3">Sobre este episódio</h3>
          <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
            {episode.description}
          </p>
        </div>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-3 flex items-center gap-2">
            <BookOpen size={16} className="text-pco-blue" strokeWidth={1.75} />
            Materiais relacionados
          </h3>
          {relatedMaterials.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {relatedMaterials.slice(0, 4).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off"
                >
                  <BookOpen size={14} className="text-pco-blue shrink-0" strokeWidth={1.75} />
                  <span className="text-pco-deep flex-1 truncate">{m.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">Nenhum material vinculado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
