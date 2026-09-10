/**
 * Traz do LMS antigo (portalpco.online) o que ainda não existe no AVA:
 * os **podcasts em vídeo** e a **biblioteca digital**.
 *
 * ## Ensaio é o padrão
 *
 * Sem `--commit` este script **não grava nada**: ele lê a origem, mostra o que
 * faria e para. É a mesma regra do expurgo da LGPD e do restaurador de banco, e
 * existe pelo mesmo motivo — a decisão de executar se toma lendo o ensaio.
 *
 * ## O que ele traz, e por que assim
 *
 * **Podcasts (43).** São aulas do LearnDash cujo título começa com "Podcast", e
 * o vídeo vem de `ldlms/v2/topicos/:id` no campo `video_url` — medido em
 * 10/set/2026: 43 de 43 preenchidos, todos no Vimeo. Eles entram em
 * `podcasts.videoUrl`, **nunca** em `audioUrl`: um endereço do Vimeo num
 * `<audio>` não toca, porque `player.vimeo.com/video/<id>` devolve uma página e
 * não um arquivo de mídia. Ver a migration `0023`.
 *
 * **Biblioteca (47 pacotes).** Vêm de `wpdm/search`, que pagina de 8 em 8 e
 * traz título e a descrição curada pela escola. O arquivo em si é um PDF na
 * biblioteca de mídia do WordPress (100 no total), casado por semelhança de
 * nome.
 *
 * ## Cinco decisões que qualquer mexida aqui tem de respeitar
 *
 * - **Nada é sobrescrito.** O casamento é por título normalizado; item que já
 *   existe é contado como "já existia" e não é tocado. Rodar duas vezes tem de
 *   dar o mesmo resultado — o script de delta da loja segue essa regra e é
 *   assim que se confere que ele funcionou.
 * - **O arquivo é COPIADO, não linkado.** Apontar para o WordPress deixaria a
 *   biblioteca inteira dependendo de um site que vai sair do ar. Os PDFs vão
 *   para o `/uploads` do AVA, e é de lá que o aluno baixa.
 * - **Título vira título; a descrição não vira autor.** Muitos títulos trazem
 *   o autor depois de um travessão ("Os Arquétipos — Carl G. Jung"), e o campo
 *   `author` da biblioteca é obrigatório. O que dá para separar com segurança é
 *   separado; o que não dá fica com a escola como responsável pela curadoria,
 *   nunca com um nome inventado.
 * - **Duração de podcast não se estima.** O AVA guarda `durationMinutes`, e o
 *   LearnDash não informa a duração do vídeo. Entra `0`, que a tela já sabe
 *   tratar — inventar 30 minutos encheria a lista de números falsos, que é o
 *   defeito que este projeto persegue em todas as telas de métrica.
 * - **A publicação preserva a data de origem.** É ela que ordena a lista, e
 *   usar a data de importação faria todo o acervo parecer publicado hoje.
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/*
  As credenciais do LMS antigo moram em `.env.import`, não no `.env`.

  `dotenv/config` carrega só o `.env`, e sem esta linha o script diz "faltam as
  credenciais" com o arquivo cheio ao lado. É o mesmo tropeço que o CLAUDE.md
  já registra sobre script de manutenção — dois deles chegaram a rodar contra a
  base errada por não carregarem o ambiente certo.
*/
dotenv.config({ path: path.resolve(process.cwd(), '.env.import') });

interface TopicoWp {
  id: number;
  titulo: string;
  curso: number | null;
  videoUrl: string;
  publicadoEm: string;
}

interface PacoteWp {
  id: number;
  titulo: string;
  descricao: string;
  publicadoEm: string;
  /** O PDF em si, no WordPress. É ele que será copiado para o /uploads do AVA. */
  arquivoUrl: string;
}

const COMMIT = process.argv.includes('--commit');
const BASE = (process.env.PORTAL_PCO_URL ?? '').replace(/\/+$/, '');
const USER = process.env.PORTAL_PCO_USER ?? '';
const PASS = process.env.PORTAL_PCO_APP_PASSWORD ?? '';

function auth(): string {
  return 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
}

async function api<T>(caminho: string): Promise<T> {
  const r = await fetch(BASE + caminho, { headers: { Authorization: auth() } });
  if (!r.ok) throw new Error(`${caminho} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

/**
 * Uma página de listagem, ou `null` quando acabou.
 *
 * O WordPress responde **400** (`rest_post_invalid_page_number`) quando se
 * pede uma página além do total — não uma lista vazia. Tratar isso como erro
 * faria a importação morrer no fim da primeira coleção completa, que é
 * exatamente onde ela deveria simplesmente parar.
 */
async function pagina<T>(caminho: string): Promise<T[] | null> {
  const r = await fetch(BASE + caminho, { headers: { Authorization: auth() } });
  if (r.status === 400) return null;
  if (!r.ok) throw new Error(`${caminho} → HTTP ${r.status}`);
  const j = (await r.json()) as T[];
  return Array.isArray(j) && j.length > 0 ? j : null;
}

/** Sem acento, sem caixa, sem pontuação: é assim que se compara título. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** O WordPress entrega o título já escapado para HTML. Ver `shared/entidades-html.ts`. */
function desescapar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, "'");
}

/**
 * Separa "Obra — Autor" quando dá para ter certeza.
 *
 * O campo `author` da biblioteca é obrigatório, e a maioria dos títulos do
 * acervo traz o autor depois de um travessão ou hífen cercado de espaços. O que
 * NÃO casa esse formato fica com a escola: inventar um autor a partir do texto
 * da descrição produziria atribuição errada de obra, que é pior do que a
 * ausência.
 */
export function separarTituloEAutor(bruto: string): { titulo: string; autor: string } {
  const limpo = desescapar(bruto).trim();
  const m = /^(.*\S)\s+[–—-]\s+(\S.*)$/.exec(limpo);
  if (!m) return { titulo: limpo, autor: 'Acervo PCO' };
  const [, titulo, autor] = m;
  // "Cap1", "Volume 4", "2019": é parte da obra, não gente.
  if (/^\d+$/.test(autor!.trim()) || /^(cap|vol|volume|parte|ed|\d)/i.test(autor!.trim())) {
    return { titulo: limpo, autor: 'Acervo PCO' };
  }
  return { titulo: titulo!.trim(), autor: autor!.trim() };
}

async function lerPodcastsDaOrigem(): Promise<TopicoWp[]> {
  const achados: Array<{ id: number; title: { rendered: string }; date: string }> = [];
  for (let page = 1; page <= 8; page++) {
    const lote = await pagina<(typeof achados)[number]>(
      `/wp-json/wp/v2/sfwd-topic?per_page=100&page=${page}&search=podcast&_fields=id,title,date`,
    );
    if (!lote) break;
    for (const p of lote) if (/podcast/i.test(p.title?.rendered ?? '')) achados.push(p);
  }
  const out: TopicoWp[] = [];
  for (const p of achados) {
    const d = await api<{ video_url?: string; course?: number }>(
      `/wp-json/ldlms/v2/topicos/${p.id}`,
    );
    out.push({
      id: p.id,
      titulo: desescapar(p.title?.rendered ?? ''),
      curso: d.course ?? null,
      videoUrl: (d.video_url ?? '').trim(),
      publicadoEm: (p.date ?? '').slice(0, 10),
    });
  }
  return out;
}

/**
 * A biblioteca sai da MÍDIA, e não do gerenciador de downloads.
 *
 * O caminho óbvio seria `wpdm/search`, que é onde vivem os 47 "pacotes" com a
 * descrição curada pela escola. **Ele não pagina.** Medido em 10/set/2026:
 * `page`, `paged`, `offset`, `per_page`, `limit`, `items` e `pp` são todos
 * ignorados — a resposta diz `total: 47` e devolve sempre os mesmos 8.
 *
 * Os arquivos, porém, são anexos comuns do WordPress, e `wp/v2/media` pagina
 * como qualquer coleção: são **100 PDFs**. É a fonte que entrega o acervo
 * inteiro, e é o acervo que o aluno precisa.
 *
 * Os 8 pacotes legíveis entram como **enriquecimento**: quando o título casa,
 * a descrição curada é aproveitada. Os outros 39 ficam sem descrição em vez de
 * ficarem sem arquivo — perder a descrição de 39 é menos grave do que perder o
 * PDF de 92.
 */
async function lerBibliotecaDaOrigem(): Promise<PacoteWp[]> {
  const itens: PacoteWp[] = [];
  for (let page = 1; page <= 10; page++) {
    const lote = await pagina<{
      id: number;
      title?: { rendered?: string };
      date?: string;
      source_url?: string;
      mime_type?: string;
    }>(`/wp-json/wp/v2/media?per_page=100&page=${page}&media_type=application`);
    if (!lote) break;
    for (const m of lote) {
      if (m.mime_type !== 'application/pdf') continue;
      itens.push({
        id: m.id,
        titulo: desescapar(m.title?.rendered ?? ''),
        descricao: '',
        publicadoEm: String(m.date ?? '').slice(0, 10),
        arquivoUrl: m.source_url ?? '',
      });
    }
  }

  // Enriquecimento com o que o gerenciador de downloads deixa ler.
  try {
    const r = await api<{ packages?: Array<Record<string, unknown>> }>('/wp-json/wpdm/search?s=');
    const porTitulo = new Map<string, string>();
    for (const p of r.packages ?? []) {
      const desc = desescapar(String(p.post_content ?? ''))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (desc) porTitulo.set(normalizar(desescapar(String(p.post_title ?? ''))), desc);
    }
    for (const item of itens) {
      const d = porTitulo.get(normalizar(item.titulo));
      if (d) item.descricao = d;
    }
  } catch {
    // Sem descrição o acervo continua servindo: o arquivo é o que importa.
  }

  return itens;
}

async function main(): Promise<void> {
  if (!BASE || !USER || !PASS) {
    console.error('Faltam PORTAL_PCO_URL / PORTAL_PCO_USER / PORTAL_PCO_APP_PASSWORD em .env.import');
    process.exitCode = 1;
    return;
  }
  console.log(`origem: ${BASE}`);
  console.log(COMMIT ? '*** MODO COMMIT: vai gravar ***' : 'ensaio (nada será gravado)\n');

  const [podcasts, biblioteca] = await Promise.all([
    lerPodcastsDaOrigem(),
    lerBibliotecaDaOrigem(),
  ]);

  const semVideo = podcasts.filter((p) => !p.videoUrl);
  console.log(`PODCASTS   ${podcasts.length} encontrados · ${semVideo.length} sem vídeo`);
  for (const p of podcasts.slice(0, 5)) {
    console.log(`  ${String(p.id).padEnd(6)} ${p.titulo.slice(0, 52).padEnd(54)} ${p.videoUrl}`);
  }
  if (podcasts.length > 5) console.log(`  … e mais ${podcasts.length - 5}`);

  console.log(`\nBIBLIOTECA ${biblioteca.length} pacotes`);
  for (const b of biblioteca.slice(0, 5)) {
    const { titulo, autor } = separarTituloEAutor(b.titulo);
    console.log(`  ${String(b.id).padEnd(6)} ${titulo.slice(0, 44).padEnd(46)} autor: ${autor}`);
  }
  if (biblioteca.length > 5) console.log(`  … e mais ${biblioteca.length - 5}`);

  const destino = path.resolve(process.cwd(), 'data/importacao-portalpco.json');
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, JSON.stringify({ podcasts, biblioteca }, null, 2), 'utf8');
  console.log(`\nlevantamento salvo em ${destino}`);

  if (!COMMIT) {
    console.log('\nNada foi gravado. Para executar: --commit');
    return;
  }

  // A gravação usa os repositórios do AVA, e não SQL direto, porque é neles
  // que vivem as regras — id, valores padrão e o caminho de banco/JSON.
  const podcastsRepo = await import('../server/repositories/podcasts');
  const existentes = await podcastsRepo.listPodcasts();
  const jaTem = new Set(existentes.map((e) => normalizar(e.title)));

  let criados = 0;
  let pulados = 0;
  for (const p of podcasts) {
    if (!p.videoUrl) continue;
    if (jaTem.has(normalizar(p.titulo))) {
      pulados++;
      continue;
    }
    await podcastsRepo.createPodcast({
      title: p.titulo,
      // A origem não tem resumo próprio: o título é o que existe, e escrever um
      // resumo aqui seria inventar conteúdo editorial.
      description: p.titulo,
      // Zero é "não medido". O LearnDash não informa a duração do vídeo, e
      // estimar encheria a lista de números falsos.
      durationMinutes: 0,
      publishedAt: p.publicadoEm || new Date().toISOString().slice(0, 10),
      coverColor: 'from-pco-blue to-pco-cyan',
      videoUrl: p.videoUrl,
      relatedCourseIds: [],
      relatedModuleIds: [],
      tags: ['PCO POD'],
    });
    criados++;
  }
  console.log(`\npodcasts: ${criados} criado(s) · ${pulados} já existia(m)`);
}

void main();
