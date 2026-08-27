/**
 * Medição própria de tráfego — o que substituiu os números de demonstração.
 *
 * O navegador manda um sinal a cada página aberta (`POST /analytics/hit`) e o
 * servidor soma. Não há Google Analytics, não há cookie, não há IP guardado:
 * o id da sessão é gerado no `sessionStorage` da aba, vive na memória deste
 * processo por 30 minutos e nunca é persistido. O que vai para o disco é
 * contador por dia (ver `traffic-store.ts`).
 *
 * ## O que dá para medir assim, e o que não dá
 *
 * Dá: páginas vistas, sessões, taxa de rejeição, tempo por sessão, origem,
 * dispositivo, LCP e as rotas que o SPA não resolveu.
 *
 * Não dá: posição em busca, volume de pesquisa e CTR — isso mora no Search
 * Console e depende de credencial. Enquanto não chegar, essas tabelas somem da
 * tela em vez de mostrar ficção.
 *
 * ## Duas honestidades embutidas
 *
 * 1. **`/admin/*` não é medido.** Contar a navegação de quem administra como
 *    tráfego do site inflaria justamente o número que o administrador olha.
 * 2. **Bot conhecido não conta.** Sem isso, o primeiro rastreador do Google
 *    devolveria a tela para o mesmo lugar: números com cara de medição.
 *
 * ## Vercel
 *
 * A tabela de sessões vive na memória do processo. No VPS (processo único e
 * longo) isso é exato; em Vercel Functions cada invocação pode ser outro
 * processo, então pageviews continuam certas e sessão/rejeição/tempo viram
 * subestimativa. Mesma nota que já vale para os workers.
 */

import {
  diaVazio,
  gravarDia,
  lerDia,
  LCP_BUCKETS,
  LCP_BUCKET_MS,
  type DailyTraffic,
  type DeviceClass,
  type TrafficSource,
} from './traffic-store';

/** Meia hora sem sinal encerra a sessão — a convenção usual de analytics. */
const SESSAO_TTL_MS = 30 * 60_000;
/** Teto de sessões vivas na memória. Acima disso, expurga as mais antigas. */
const MAX_SESSOES = 20_000;
/** Distintos caminhos guardados por dia; o excedente cai em `(outras)`. */
const MAX_PATHS_POR_DIA = 400;

interface Sessao {
  primeiroEm: number;
  ultimoEm: number;
  hits: number;
  /** O dia em que a sessão começou — é nele que o tempo é somado. */
  dia: string;
  /** Página de entrada: é dela que a rejeição é descontada na 2ª visita. */
  entrada: string;
}

const sessoes = new Map<string, Sessao>();

/** Escrita agrupada: o dia fica em memória e vai ao disco a cada N segundos. */
const pendentes = new Map<string, DailyTraffic>();
let flushAgendado: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 5_000;

const BOT_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headlesschrome|lighthouse|pingdom|uptimerobot|curl\/|wget\/|python-requests|axios\/|node-fetch/i;

export function ehBot(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // sem UA, quase sempre é script
  return BOT_RE.test(userAgent);
}

export function classificaDispositivo(userAgent: string | undefined): DeviceClass {
  const ua = (userAgent ?? '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) return 'mobile';
  return 'desktop';
}

const SOCIAL_RE =
  /facebook|instagram|twitter|t\.co|x\.com|linkedin|youtube|tiktok|pinterest|reddit|whatsapp|telegram|threads/i;
const BUSCA_RE = /google|bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu|ask\.com/i;

/**
 * Origem da sessão. UTM vence referrer — quem marcou a campanha sabe mais do
 * que o cabeçalho.
 */
export function classificaOrigem(
  referrer: string,
  utmMedium: string,
  host: string,
): TrafficSource {
  const medium = utmMedium.trim().toLowerCase();
  if (medium) {
    if (/email|newsletter|mail/.test(medium)) return 'email';
    if (/social|paid[-_]?social|cpc|ppc|display/.test(medium)) return 'social';
    if (/organic|search/.test(medium)) return 'organico';
    if (/referral/.test(medium)) return 'referral';
  }
  const ref = referrer.trim();
  if (!ref) return 'direto';
  let hostRef: string;
  try {
    hostRef = new URL(ref).hostname.toLowerCase();
  } catch {
    return 'direto';
  }
  if (!hostRef) return 'direto';
  // Navegação dentro do próprio site não é origem nova.
  if (host && (hostRef === host.toLowerCase() || hostRef.endsWith(`.${host.toLowerCase()}`))) {
    return 'direto';
  }
  if (BUSCA_RE.test(hostRef)) return 'organico';
  if (SOCIAL_RE.test(hostRef)) return 'social';
  return 'referral';
}

/**
 * Normaliza o caminho para não explodir a cardinalidade: querystring fora,
 * ids longos e uuids viram `:id`, barra final some. Slug de curso fica — é o
 * que faz a tabela de páginas mais acessadas ter alguma utilidade.
 */
export function normalizaCaminho(raw: string): string {
  let p = (raw || '/').split('?')[0]!.split('#')[0]!;
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '') || '/';
  const partes = p.split('/').map((seg) => {
    if (!seg) return seg;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id';
    if (/^\d{4,}$/.test(seg)) return ':id';
    // Id do projeto tem a forma `prefixo-sufixo`, e o sufixo mistura letra com
    // dígito (`curso-a1b2c3d4`). Exigir o dígito é o que separa isso de um
    // slug de verdade: sem essa condição, `/pagina-inexistente` virava `/:id`
    // — e a tabela de 404 passava a esconder justamente o endereço quebrado
    // que ela existe para mostrar.
    const partido = /^[a-z]{2,10}-([a-z0-9]{6,})$/i.exec(seg);
    if (partido && /\d/.test(partido[1]!) && /[a-z]/i.test(partido[1]!)) return ':id';
    return seg;
  });
  const out = partes.join('/') || '/';
  return out.slice(0, 120);
}

export function ehAdmin(caminho: string): boolean {
  return caminho === '/admin' || caminho.startsWith('/admin/');
}

function hoje(agora = new Date()): string {
  // Fuso do servidor, deliberadamente: o relatório é lido por quem opera daqui.
  const off = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - off).toISOString().slice(0, 10);
}

async function diaEmMemoria(date: string): Promise<DailyTraffic> {
  const emAberto = pendentes.get(date);
  if (emAberto) return emAberto;
  const doDisco = (await lerDia(date)) ?? diaVazio(date);
  pendentes.set(date, doDisco);
  return doDisco;
}

function agendaFlush(): void {
  if (flushAgendado) return;
  flushAgendado = setTimeout(() => {
    flushAgendado = null;
    void flush();
  }, FLUSH_MS);
  // Não segura o processo vivo só por causa de um flush pendente.
  (flushAgendado as { unref?: () => void }).unref?.();
}

/** Descarrega o que está em memória. Exportado para os testes e o shutdown. */
export async function flush(): Promise<void> {
  const paraGravar = Array.from(pendentes.values());
  pendentes.clear();
  for (const dia of paraGravar) {
    try {
      await gravarDia(dia);
    } catch (e) {
      console.error('[analytics] falha ao gravar dia', dia.date, e);
    }
  }
}

function expurgaSessoes(agora: number): void {
  for (const [id, s] of sessoes) {
    if (agora - s.ultimoEm > SESSAO_TTL_MS) sessoes.delete(id);
  }
  if (sessoes.size <= MAX_SESSOES) return;
  const ordenadas = Array.from(sessoes.entries()).sort((a, b) => a[1].ultimoEm - b[1].ultimoEm);
  const excesso = sessoes.size - MAX_SESSOES;
  for (let i = 0; i < excesso; i++) sessoes.delete(ordenadas[i]![0]);
}

function contaCaminho(
  dia: DailyTraffic,
  caminho: string,
  entrada: boolean,
  segundos: number,
): string {
  let chave = caminho;
  if (!dia.byPath[chave] && Object.keys(dia.byPath).length >= MAX_PATHS_POR_DIA) {
    chave = '(outras)';
  }
  const atual = dia.byPath[chave] ?? { views: 0, entries: 0, bounces: 0, totalSeconds: 0 };
  atual.views += 1;
  if (entrada) {
    atual.entries += 1;
    // Nasce rejeitando, como a sessão. `descontaRejeicao` desfaz na 2ª página.
    atual.bounces += 1;
  }
  atual.totalSeconds += segundos;
  dia.byPath[chave] = atual;
  return chave;
}

/** Desfaz a rejeição da página de entrada quando a sessão continua. */
function descontaRejeicao(dia: DailyTraffic, caminho: string): void {
  const alvo = dia.byPath[caminho] ?? dia.byPath['(outras)'];
  if (alvo) alvo.bounces = Math.max(0, alvo.bounces - 1);
}

export interface HitInput {
  sessionId: string;
  path: string;
  referrer?: string;
  utmMedium?: string;
  notFound?: boolean;
  /** LCP em ms, medido pelo próprio navegador. Só vem na primeira página. */
  lcpMs?: number;
  userAgent?: string;
  host?: string;
}

export type ResultadoHit =
  | { registrado: true; sessaoNova: boolean }
  | { registrado: false; motivo: 'bot' | 'admin' };

export async function registraHit(input: HitInput, agoraMs = Date.now()): Promise<ResultadoHit> {
  if (ehBot(input.userAgent)) return { registrado: false, motivo: 'bot' };

  const caminho = normalizaCaminho(input.path);
  if (ehAdmin(caminho)) return { registrado: false, motivo: 'admin' };

  expurgaSessoes(agoraMs);

  const chave = input.sessionId.slice(0, 64);
  const anterior = sessoes.get(chave);
  const expirada = !anterior || agoraMs - anterior.ultimoEm > SESSAO_TTL_MS;
  const data = hoje(new Date(agoraMs));
  const dia = await diaEmMemoria(data);

  dia.pageviews += 1;

  if (expirada) {
    dia.sessions += 1;
    // Toda sessão nasce sendo rejeição; a segunda página desfaz.
    dia.bounces += 1;
    const origem = classificaOrigem(input.referrer ?? '', input.utmMedium ?? '', input.host ?? '');
    dia.bySource[origem] = (dia.bySource[origem] ?? 0) + 1;
    const device = classificaDispositivo(input.userAgent);
    dia.byDevice[device] = (dia.byDevice[device] ?? 0) + 1;
    const chaveEntrada = contaCaminho(dia, caminho, true, 0);
    sessoes.set(chave, {
      primeiroEm: agoraMs,
      ultimoEm: agoraMs,
      hits: 1,
      dia: data,
      entrada: chaveEntrada,
    });
  } else {
    const s = anterior!;
    const delta = Math.max(
      0,
      Math.min(Math.round((agoraMs - s.ultimoEm) / 1000), SESSAO_TTL_MS / 1000),
    );
    const diaDaSessao = s.dia === data ? dia : await diaEmMemoria(s.dia);
    if (s.hits === 1) {
      // Deixou de ser rejeição — desconta do dia em que a sessão começou.
      diaDaSessao.bounces = Math.max(0, diaDaSessao.bounces - 1);
      descontaRejeicao(diaDaSessao, s.entrada);
    }
    diaDaSessao.totalSessionSeconds += delta;
    s.hits += 1;
    s.ultimoEm = agoraMs;
    contaCaminho(dia, caminho, false, delta);
  }

  if (input.notFound) {
    dia.notFound[caminho] = (dia.notFound[caminho] ?? 0) + 1;
  }

  if (typeof input.lcpMs === 'number' && Number.isFinite(input.lcpMs) && input.lcpMs > 0) {
    const idx = Math.min(Math.floor(input.lcpMs / LCP_BUCKET_MS), LCP_BUCKETS - 1);
    dia.lcpBuckets[idx] = (dia.lcpBuckets[idx] ?? 0) + 1;
    dia.lcpCount += 1;
  }

  agendaFlush();
  return { registrado: true, sessaoNova: expirada };
}

/** Só para os testes: zera a memória entre casos. */
export function _reset(): void {
  sessoes.clear();
  pendentes.clear();
  if (flushAgendado) {
    clearTimeout(flushAgendado);
    flushAgendado = null;
  }
}

export function sessoesVivas(): number {
  return sessoes.size;
}
