import { useParams, Link, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileText,
  Volume2,
  VolumeX,
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
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';

/*
  Lista vazia estável.

  `data ?? []` cria um array novo a cada render, e todo `useMemo` que dependa
  dele recalcula sempre — o que é justamente o oposto do que o `useMemo` está
  ali para fazer.
*/
const VAZIO: never[] = [];

export default function PodcastEpisode() {
  const { id } = useParams<{ id: string }>();
  const podcastsQ = usePodcasts();
  const podcasts = podcastsQ.data ?? VAZIO;
  const { data: courses = [] } = useCourses();
  const { data: libraryItems = [] } = useLibrary();
  const setEng = useSetPodcastEngagement();
  const episode = podcasts.find((p) => p.id === id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [mudo, setMudo] = useState(false);
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

  /*
    **Sem rede, `isLoading` e `isError` são os dois `false`.**

    No TanStack Query v5 a consulta feita offline fica `fetchStatus: 'paused'`:
    nada está sendo buscado e nada falhou. Numa tela que só conhece esses dois
    estados a execução escorria até o ramo final — que aqui era
    `<Navigate to="/podcasts" />`. O ouvinte era jogado para fora do episódio
    **sem uma palavra**, no metrô, que é exatamente onde se ouve podcast.
  */
  if (podcastsQ.fetchStatus === 'paused') return <SemConexao oQue="este episódio" />;
  if (podcastsQ.isPending) return <CardListSkeleton count={2} />;
  if (podcastsQ.isError)
    return (
      <FalhaAoCarregar
        erro={podcastsQ.error}
        oQue="este episódio"
        aoTentarDeNovo={() => void podcastsQ.refetch()}
      />
    );
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

  /** Posiciona em segundos absolutos, com as bordas presas. */
  function irPara(seg: number) {
    const a = audioRef.current;
    if (!a) return;
    const limite = a.duration || totalSeconds || 0;
    a.currentTime = Math.max(0, Math.min(limite, seg));
    setSegundos(a.currentTime);
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
            {/*
              **A barra é um controle, não um enfeite.**

              Ela era um `<div>` com `width` calculada: não respondia a clique,
              a teclado nem a leitor de tela. Os únicos controles de posição
              eram ±15s — chegar ao minuto 40 de um episódio de 60 min exigia
              cerca de 160 acionamentos.

              Isso costuma ser lido como problema só de acessibilidade, e não
              era: **nem o mouse tinha para onde clicar**. Quem depende de
              teclado só perdia mais porque não tinha nem a alternativa.

              `role="slider"` com `aria-valuetext` resolve as duas coisas de uma
              vez, e de quebra dá ao leitor de tela um jeito de responder "em
              que ponto estou" sem varrer a página atrás do contador.
            */}
            <div
              role="slider"
              tabIndex={audioUrl ? 0 : -1}
              aria-label="Posição do episódio"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalSeconds)}
              aria-valuenow={Math.round(currentSeconds)}
              aria-valuetext={`${fmt(currentSeconds)} de ${fmt(totalSeconds)}`}
              aria-disabled={!audioUrl}
              onClick={(e) => {
                if (!audioUrl) return;
                const r = e.currentTarget.getBoundingClientRect();
                if (r.width <= 0) return;
                irPara(((e.clientX - r.left) / r.width) * totalSeconds);
              }}
              onKeyDown={(e) => {
                if (!audioUrl) return;
                // Setas movem 5s; Page Up/Down, um minuto; Home/End vão às
                // pontas. É o comportamento que um `<input type=range>` traria
                // de graça, e que se perde ao desenhar o controle à mão.
                const passos: Record<string, number> = {
                  ArrowRight: 5,
                  ArrowUp: 5,
                  ArrowLeft: -5,
                  ArrowDown: -5,
                  PageUp: 60,
                  PageDown: -60,
                };
                if (e.key in passos) {
                  e.preventDefault();
                  irPara(currentSeconds + passos[e.key]!);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  irPara(0);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  irPara(totalSeconds);
                }
              }}
              className={`h-1.5 rounded-full bg-surface-gray overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pco-blue focus-visible:ring-offset-2 ${
                audioUrl ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className="h-full bg-gradient-to-r from-pco-blue to-pco-cyan transition-all duration-200 pointer-events-none"
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

          {/*
            **Volume.**

            O `<audio>` fica com `display:none` e sem `controls`, então tudo o
            que o elemento nativo daria de graça — volume, mudo, taxa de
            reprodução — precisa ser reconstruído. Só play/pause e ±15s tinham
            sido. Sem isto, a única forma de baixar o som do episódio é o
            controle do sistema operacional, que é menos descobrível e vale para
            a máquina inteira.

            Aqui é `<input type="range">` nativo, e não outro controle
            desenhado à mão: ele já traz teclado, leitor de tela e arrasto.
          */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                const a = audioRef.current;
                if (!a) return;
                const novo = !mudo;
                a.muted = novo;
                setMudo(novo);
              }}
              disabled={!audioUrl}
              className="h-8 w-8 rounded-full text-ink-muted grid place-items-center hover:text-pco-blue disabled:opacity-40"
              aria-label={mudo ? 'Reativar som' : 'Silenciar'}
            >
              {mudo || volume === 0 ? (
                <VolumeX size={16} strokeWidth={1.75} />
              ) : (
                <Volume2 size={16} strokeWidth={1.75} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={mudo ? 0 : Math.round(volume * 100)}
              disabled={!audioUrl}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                const a = audioRef.current;
                setVolume(v);
                setMudo(v === 0);
                if (a) {
                  a.volume = v;
                  a.muted = v === 0;
                }
              }}
              aria-label="Volume"
              aria-valuetext={`${Math.round((mudo ? 0 : volume) * 100)}%`}
              className="w-28 accent-pco-blue disabled:opacity-40"
            />
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
        <div className="lg:col-span-2 space-y-5">
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Sobre este episódio</h3>
            <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
              {episode.description}
            </p>
          </div>

          {/*
            **A transcrição, para quem não pode ouvir.**

            Episódio de podcast é conteúdo **só-áudio**: sem alternativa textual
            não há via de acesso nenhuma para quem é surdo ou tem deficiência
            auditiva — nem para quem está numa sala de espera sem fone. As aulas
            de vídeo têm transcrição desde a migration `0017`; o formato em que
            o áudio *é* o conteúdo não tinha.

            O resumo acima não substitui: ele é o texto do card da lista,
            limitado a 2000 caracteres. Um episódio de 40 minutos não cabe ali.

            Fica recolhida por padrão porque são milhares de palavras entre o
            player e o resto da página — e quem veio ouvir não deveria ter de
            rolar por elas. `<details>` nativo: abre sem JavaScript, é anunciado
            pelo leitor de tela e o navegador já sabe procurar dentro dele.
          */}
          {episode.transcript ? (
            <details className="pco-card group">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-pco-deep flex items-center gap-2">
                  <FileText size={16} className="text-pco-blue" strokeWidth={1.75} />
                  Transcrição
                </span>
                <span className="text-xs text-ink-muted group-open:hidden">mostrar</span>
                <span className="text-xs text-ink-muted hidden group-open:inline">ocultar</span>
              </summary>
              <div className="mt-4 border-t border-border-subtle pt-4">
                <p className="text-sm text-pco-deep leading-relaxed whitespace-pre-line">
                  {episode.transcript}
                </p>
              </div>
            </details>
          ) : (
            /*
              Silêncio aqui diria que o áudio basta. Quem depende de texto
              precisa saber que o pedido é legítimo e para onde levá-lo.
            */
            <p className="pco-card text-xs text-ink-subtle">
              Este episódio ainda não tem transcrição. Se você precisa dela para
              acompanhar o conteúdo,{' '}
              <Link to="/suporte" className="text-pco-blue hover:underline">
                peça à secretaria
              </Link>{' '}
              — a escola prioriza a transcrição dos episódios pedidos.
            </p>
          )}
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
