/**
 * Preenche a duração dos podcasts perguntando ao provedor do vídeo.
 *
 * ## Por que existe
 *
 * A importação do LMS antigo grava `durationMinutes: 0`, e faz certo: o
 * LearnDash não informa a duração, e **zero é "não medido"** — inventar 30
 * minutos encheria a lista de números falsos, que é o defeito que este projeto
 * persegue em toda tela de métrica.
 *
 * Mas o número existe: o oEmbed da Vimeo devolve `duration` em segundos. Isto
 * é o passo que troca "não medido" por medido, sem estimar nada.
 *
 * ## O detalhe que faz funcionar, e que já custou dias neste projeto
 *
 * **Sem o cabeçalho `Referer`, a resposta vem sem `duration` e sem `title`.**
 * Os vídeos da escola são `privacy.embed: "whitelist"`, e a Vimeo decide o que
 * entregar pelo domínio de origem — exatamente o mesmo mecanismo que fazia o
 * player mostrar "este conteúdo está bloqueado" e que se lê como problema de
 * conta. Medido em 10/set/2026: sem `Referer` o oEmbed responde 200 com um
 * corpo mudo; com ele, devolve título e duração.
 *
 * ## Três coisas que qualquer mexida aqui tem de respeitar
 *
 * - **Ensaio é o padrão.** Sem `--commit` nada é gravado.
 * - **Falha não vira zero.** Vídeo que não responder fica como está; o que não
 *   se conseguiu medir continua dizendo que não foi medido.
 * - **Só preenche o que está vazio.** Duração já cadastrada é decisão de quem
 *   cadastrou, e sobrescrevê-la apagaria o trabalho de alguém.
 */
import 'dotenv/config';

const COMMIT = process.argv.includes('--commit');

/** O domínio que a Vimeo conhece. Sem isto o oEmbed responde mudo. */
const REFERER = process.env.PUBLIC_ORIGIN?.trim() || 'https://psicanaliseclinica.online';

interface Oembed {
  title?: string;
  duration?: number;
  domain_status_code?: number;
}

async function duracaoEmMinutos(videoUrl: string): Promise<number | null> {
  const alvo = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;
  try {
    const r = await fetch(alvo, {
      headers: { Referer: REFERER },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Oembed;
    if (typeof j.duration !== 'number' || j.duration <= 0) return null;
    // Arredonda para cima: um episódio de 3min40 é "4 min" para quem decide se
    // dá tempo de ouvir agora, e nunca "3".
    return Math.max(1, Math.ceil(j.duration / 60));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log(COMMIT ? '*** MODO COMMIT ***' : 'ensaio (nada será gravado)');
  console.log('referer usado:', REFERER, '\n');

  const repo = await import('../server/repositories/podcasts');
  const todos = await repo.listPodcasts();
  const alvos = todos.filter((p) => p.videoUrl && !p.durationMinutes);
  console.log(`${todos.length} episódios · ${alvos.length} sem duração\n`);

  let medidos = 0;
  let mudos = 0;
  for (const p of alvos) {
    const min = await duracaoEmMinutos(p.videoUrl!);
    if (min === null) {
      mudos++;
      console.log(`  ?  ${p.title.slice(0, 54).padEnd(56)} não respondeu`);
      continue;
    }
    medidos++;
    console.log(`  ${String(min).padStart(3)}m ${p.title.slice(0, 54)}`);
    if (COMMIT) await repo.updatePodcast(p.id, { durationMinutes: min });
  }

  console.log(`\nmedidos: ${medidos} · sem resposta: ${mudos}`);
  if (!COMMIT) console.log('Nada foi gravado. Para executar: --commit');
}

void main();
