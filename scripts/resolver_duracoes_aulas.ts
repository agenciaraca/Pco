/**
 * Duração real das aulas, no lugar do placeholder de 15 minutos.
 *
 * O import gravou 15 min para todas — número que não veio de lugar nenhum. Não
 * afeta a carga horária declarada do curso, mas distorce toda métrica de estudo
 * que o aluno vê: tempo estimado, progresso por tempo, ritmo semanal.
 *
 * A duração de verdade está no vídeo. `scripts/scrape_lesson_media.ts` já
 * gravou `videoUrl` nas aulas, nos formatos
 * `https://www.youtube.com/embed/<id>` e `https://player.vimeo.com/video/<id>`.
 *
 * **O que este script NUNCA faz: inventar duração.** Aula sem vídeo, ou com
 * vídeo que o provedor não responde, fica exatamente como está e entra na
 * contagem de não resolvidas. Trocar um placeholder por outro seria piorar em
 * silêncio — o placeholder atual pelo menos é reconhecível.
 *
 * Provedores:
 *   - **Vimeo**: oEmbed público devolve `duration` em segundos. Sem chave.
 *   - **YouTube**: só a Data API devolve duração, e ela exige chave. Sem
 *     `YOUTUBE_API_KEY`, as aulas do YouTube são contadas como não resolvidas e
 *     o script diz isso na saída, em vez de fingir que terminou.
 *
 * Uso:
 *   npx tsx scripts/resolver_duracoes_aulas.ts                 # só relata
 *   YOUTUBE_API_KEY=... npx tsx scripts/resolver_duracoes_aulas.ts
 *   npx tsx scripts/resolver_duracoes_aulas.ts --aplicar       # grava
 */

import 'dotenv/config';
import * as coursesRepo from '../server/repositories/courses';

export interface Video {
  provedor: 'youtube' | 'vimeo';
  id: string;
}

/**
 * Identifica provedor e id a partir da URL. Parte pura — é o que dá para testar
 * sem rede, e é onde um erro silencioso custaria caro.
 */
export function identificarVideo(url: string | null | undefined): Video | null {
  if (!url) return null;
  const yt = url.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/);
  if (yt) return { provedor: 'youtube', id: yt[1]! };
  const ytWatch = url.match(/youtube\.com\/watch\?v=([\w-]{11})/);
  if (ytWatch) return { provedor: 'youtube', id: ytWatch[1]! };
  const ytCurto = url.match(/youtu\.be\/([\w-]{11})/);
  if (ytCurto) return { provedor: 'youtube', id: ytCurto[1]! };
  const vimeo = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provedor: 'vimeo', id: vimeo[1]! };
  return null;
}

/**
 * Converte a duração ISO-8601 do YouTube (`PT1H2M3S`) para minutos inteiros,
 * arredondando para cima: aula de 14min01s conta como 15, não como 14.
 */
export function iso8601ParaMinutos(iso: string): number | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const horas = Number(m[1] ?? 0);
  const minutos = Number(m[2] ?? 0);
  const segundos = Number(m[3] ?? 0);
  const total = horas * 60 + minutos + segundos / 60;
  if (total <= 0) return null;
  return Math.ceil(total);
}

/** Segundos para minutos inteiros, mesmo arredondamento. */
export function segundosParaMinutos(seg: number): number | null {
  if (!Number.isFinite(seg) || seg <= 0) return null;
  return Math.ceil(seg / 60);
}

async function duracaoVimeo(id: string): Promise<number | null> {
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { duration?: number };
    return typeof j.duration === 'number' ? segundosParaMinutos(j.duration) : null;
  } catch {
    return null;
  }
}

async function duracaoYoutube(id: string, chave: string): Promise<number | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${chave}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      items?: Array<{ contentDetails?: { duration?: string } }>;
    };
    const iso = j.items?.[0]?.contentDetails?.duration;
    return iso ? iso8601ParaMinutos(iso) : null;
  } catch {
    return null;
  }
}

interface Aula {
  id: string;
  title?: string;
  videoUrl?: string | null;
  durationMinutes?: number;
}

export interface Relatorio {
  aulas: number;
  comVideo: number;
  semVideo: number;
  resolvidas: number;
  naoResolvidas: number;
  /** Aulas de YouTube que ficaram de fora por falta de chave. */
  bloqueadasPorChave: number;
  alteradas: number;
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--aplicar');
  const chaveYt = process.env.YOUTUBE_API_KEY ?? '';

  // Lê pelo repositório, não pelo arquivo: produção é Postgres e a versão
  // anterior só sabia mexer em `data/courses.json` — rodava, dizia "0 aulas" e
  // parecia que não havia o que fazer.
  const cursos = (await coursesRepo.listCourses()) as unknown as Array<{
    title?: string;
    modules?: Array<{ lessons?: Aula[] }>;
  }>;

  const r: Relatorio = {
    aulas: 0,
    comVideo: 0,
    semVideo: 0,
    resolvidas: 0,
    naoResolvidas: 0,
    bloqueadasPorChave: 0,
    alteradas: 0,
  };

  for (const curso of cursos) {
    for (const modulo of curso.modules ?? []) {
      for (const aula of modulo.lessons ?? []) {
        r.aulas++;
        const video = identificarVideo(aula.videoUrl);
        if (!video) {
          r.semVideo++;
          continue;
        }
        r.comVideo++;

        if (video.provedor === 'youtube' && !chaveYt) {
          r.bloqueadasPorChave++;
          r.naoResolvidas++;
          continue;
        }

        const minutos =
          video.provedor === 'vimeo'
            ? await duracaoVimeo(video.id)
            : await duracaoYoutube(video.id, chaveYt);

        if (minutos === null) {
          r.naoResolvidas++;
          continue;
        }
        r.resolvidas++;
        if (aula.durationMinutes !== minutos) {
          r.alteradas++;
          if (aplicar) await coursesRepo.updateLesson(aula.id, { durationMinutes: minutos });
        }
      }
    }
  }

  console.log('');
  console.log('Duração real das aulas');
  console.log('======================');
  console.log(`aulas .......................... ${r.aulas}`);
  console.log(`  com vídeo .................... ${r.comVideo}`);
  console.log(`  sem vídeo (ficam como estão) . ${r.semVideo}`);
  console.log(`resolvidas ..................... ${r.resolvidas}`);
  console.log(`não resolvidas ................. ${r.naoResolvidas}`);
  if (r.bloqueadasPorChave > 0) {
    console.log(`  dessas, por falta de chave ... ${r.bloqueadasPorChave}`);
    console.log(`     ^ defina YOUTUBE_API_KEY para resolver as do YouTube`);
  }
  console.log(`durações que mudariam .......... ${r.alteradas}`);
  console.log(aplicar ? '>> gravado pelo repositório (banco ou JSON)' : '>> nada foi gravado (use --aplicar)');
  console.log('');
}

if (process.argv[1] && process.argv[1].includes('resolver_duracoes_aulas')) {
  void main();
}
