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
  const [progress, setProgress] = useState(0);
  const [markedListened, setMarkedListened] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setProgress((p) => Math.min(100, p + 0.6));
      }, 200);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  useEffect(() => {
    if (progress >= 100) setPlaying(false);
    // Marca como ouvido quando atinge 80% (uma vez)
    if (id && progress >= 80 && !markedListened) {
      setMarkedListened(true);
      setEng.mutate({ episodeId: id, patch: { listened: true } });
    }
  }, [progress, id, markedListened, setEng]);

  if (isLoading) return <CardListSkeleton count={2} />;
  if (!episode) return <Navigate to="/podcasts" replace />;

  const totalSeconds = episode.durationMinutes * 60;
  const currentSeconds = (progress / 100) * totalSeconds;
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
              <div className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-80">
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

          <div className="space-y-3">
            <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <span>{fmt(currentSeconds)}</span>
              <span>{fmt(totalSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setProgress((p) => Math.max(0, p - 5))}
              className="h-11 w-11 rounded-full bg-surface-gray text-pco-deep grid place-items-center hover:bg-pco-blue hover:text-white transition-colors"
              aria-label="Voltar 15s"
            >
              <SkipBack size={18} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setPlaying((v) => !v)}
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
              onClick={() => setProgress((p) => Math.min(100, p + 5))}
              className="h-11 w-11 rounded-full bg-surface-gray text-pco-deep grid place-items-center hover:bg-pco-blue hover:text-white transition-colors"
              aria-label="Avançar 15s"
            >
              <SkipForward size={18} strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
            <button className="pco-btn-ghost text-xs">
              <Heart size={12} strokeWidth={1.75} />
              Favoritar
            </button>
            <button className="pco-btn-ghost text-xs">
              <Share2 size={12} strokeWidth={1.75} />
              Compartilhar
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
