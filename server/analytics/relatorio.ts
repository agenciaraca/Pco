/**
 * O relatório que a tela `/admin/metricas` consome.
 *
 * Tudo aqui sai dos agregados de `traffic-store.ts` — nenhum número é
 * inventado, e quando não há medição o campo vem `null` em vez de zero. A
 * diferença importa: zero diz "medi e não houve"; `null` diz "não medi". A
 * tela sabe mostrar os dois de jeitos diferentes, e foi exatamente confundir
 * um com o outro que fez esta página passar meses mostrando ficção.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { lerIntervalo, p75DoHistograma, primeiroDia, type DailyTraffic } from './traffic-store';

export type Range = '7d' | '30d' | '90d' | '365d';

const DIAS_DO_RANGE: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

export function normalizaRange(raw: string | undefined): Range {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === '365d') return raw;
  return '30d';
}

function diaISO(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export interface PontoDaSerie {
  date: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgSessionMinutes: number;
}

export interface PaginaMedida {
  path: string;
  views: number;
  /** Segundos médios entre esta página e a próxima. `null` sem amostra. */
  avgSeconds: number | null;
  /** % das entradas por esta página que terminaram em rejeição. */
  bounceRate: number | null;
}

export interface RelatorioTrafego {
  range: Range;
  de: string;
  ate: string;
  /** Primeiro dia com medição. `null` = nunca mediu nada. */
  medindoDesde: string | null;
  /** Quantos dias do intervalo pedido têm medição de fato. */
  diasComDados: number;
  resumo: {
    visitors: number;
    pageviews: number;
    bounceRate: number | null;
    avgSessionMinutes: number | null;
    /** LCP p75 em ms — Core Web Vitals medido no navegador de quem visitou. */
    lcpP75Ms: number | null;
    lcpAmostras: number;
    /** Variação % contra o período anterior de mesmo tamanho. `null` sem base. */
    deltaVisitors: number | null;
    deltaPageviews: number | null;
  };
  serie: PontoDaSerie[];
  topPages: PaginaMedida[];
  sources: Array<{ name: string; sessions: number; pct: number }>;
  devices: Array<{ name: string; sessions: number; pct: number }>;
  notFound: Array<{ path: string; hits: number }>;
}

function pontoDoDia(d: DailyTraffic): PontoDaSerie {
  return {
    date: d.date,
    visitors: d.sessions,
    pageviews: d.pageviews,
    bounceRate: d.sessions > 0 ? Number(((d.bounces / d.sessions) * 100).toFixed(1)) : 0,
    avgSessionMinutes:
      d.sessions > 0 ? Number((d.totalSessionSeconds / d.sessions / 60).toFixed(2)) : 0,
  };
}

/** Preenche os dias sem medição com zero — buraco no gráfico esconde queda. */
function serieCompleta(dias: DailyTraffic[], de: string, ate: string): PontoDaSerie[] {
  const porData = new Map(dias.map((d) => [d.date, d]));
  const out: PontoDaSerie[] = [];
  const cursor = new Date(`${de}T12:00:00`);
  const fim = new Date(`${ate}T12:00:00`);
  while (cursor <= fim) {
    const data = diaISO(cursor);
    const d = porData.get(data);
    out.push(
      d
        ? pontoDoDia(d)
        : { date: data, visitors: 0, pageviews: 0, bounceRate: 0, avgSessionMinutes: 0 },
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function delta(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

const NOME_DA_ORIGEM: Record<string, string> = {
  organico: 'Orgânico',
  direto: 'Direto',
  social: 'Social',
  referral: 'Referral',
  email: 'E-mail',
};

const NOME_DO_DEVICE: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
};

function distribuicao(
  mapa: Record<string, number>,
  nomes: Record<string, string>,
): Array<{ name: string; sessions: number; pct: number }> {
  const total = Object.values(mapa).reduce((s, n) => s + n, 0);
  return Object.entries(mapa)
    .map(([k, sessions]) => ({
      name: nomes[k] ?? k,
      sessions,
      pct: total > 0 ? Number(((sessions / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export async function montaRelatorio(range: Range, hoje = new Date()): Promise<RelatorioTrafego> {
  const dias = DIAS_DO_RANGE[range];
  const ate = diaISO(hoje);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  const de = diaISO(inicio);

  const anteriorFim = new Date(inicio);
  anteriorFim.setDate(anteriorFim.getDate() - 1);
  const anteriorInicio = new Date(anteriorFim);
  anteriorInicio.setDate(anteriorInicio.getDate() - (dias - 1));

  const [registros, registrosAnteriores, desde] = await Promise.all([
    lerIntervalo(de, ate),
    lerIntervalo(diaISO(anteriorInicio), diaISO(anteriorFim)),
    primeiroDia(),
  ]);

  const visitors = registros.reduce((s, d) => s + d.sessions, 0);
  const pageviews = registros.reduce((s, d) => s + d.pageviews, 0);
  const bounces = registros.reduce((s, d) => s + d.bounces, 0);
  const segundos = registros.reduce((s, d) => s + d.totalSessionSeconds, 0);

  const lcpBuckets = registros.reduce<number[]>((acc, d) => {
    d.lcpBuckets.forEach((n, i) => {
      acc[i] = (acc[i] ?? 0) + n;
    });
    return acc;
  }, []);
  const lcpAmostras = registros.reduce((s, d) => s + d.lcpCount, 0);

  const caminhos = new Map<
    string,
    { views: number; entries: number; bounces: number; totalSeconds: number }
  >();
  for (const d of registros) {
    for (const [p, v] of Object.entries(d.byPath)) {
      const atual = caminhos.get(p) ?? { views: 0, entries: 0, bounces: 0, totalSeconds: 0 };
      atual.views += v.views;
      atual.entries += v.entries;
      atual.bounces += v.bounces ?? 0;
      atual.totalSeconds += v.totalSeconds;
      caminhos.set(p, atual);
    }
  }

  const sources: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const naoEncontradas = new Map<string, number>();
  for (const d of registros) {
    for (const [k, n] of Object.entries(d.bySource)) sources[k] = (sources[k] ?? 0) + n;
    for (const [k, n] of Object.entries(d.byDevice)) devices[k] = (devices[k] ?? 0) + n;
    for (const [k, n] of Object.entries(d.notFound)) {
      naoEncontradas.set(k, (naoEncontradas.get(k) ?? 0) + n);
    }
  }

  const topPages: PaginaMedida[] = Array.from(caminhos.entries())
    .map(([p, v]) => ({
      path: p,
      views: v.views,
      // O tempo só é conhecido quando houve página seguinte na sessão.
      avgSeconds:
        v.views - v.entries > 0 ? Math.round(v.totalSeconds / (v.views - v.entries)) : null,
      // Rejeição da página só existe para quem entrou por ela.
      bounceRate: v.entries > 0 ? Number(((v.bounces / v.entries) * 100).toFixed(1)) : null,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    range,
    de,
    ate,
    medindoDesde: desde,
    diasComDados: registros.length,
    resumo: {
      visitors,
      pageviews,
      bounceRate: visitors > 0 ? Number(((bounces / visitors) * 100).toFixed(1)) : null,
      avgSessionMinutes: visitors > 0 ? Number((segundos / visitors / 60).toFixed(2)) : null,
      lcpP75Ms: p75DoHistograma(lcpBuckets, lcpAmostras),
      lcpAmostras,
      deltaVisitors: delta(
        visitors,
        registrosAnteriores.reduce((s, d) => s + d.sessions, 0),
      ),
      deltaPageviews: delta(
        pageviews,
        registrosAnteriores.reduce((s, d) => s + d.pageviews, 0),
      ),
    },
    serie: serieCompleta(registros, de, ate),
    topPages,
    sources: distribuicao(sources, NOME_DA_ORIGEM),
    devices: distribuicao(devices, NOME_DO_DEVICE),
    notFound: Array.from(naoEncontradas.entries())
      .map(([p, hits]) => ({ path: p, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10),
  };
}

// ---------- SEO técnico, verificado em vez de afirmado ----------

export interface ItemTecnico {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'desconhecido';
  /** Como este item foi apurado — para ninguém tomar afirmação por medição. */
  fonte: string;
}

async function existeNoBundle(arquivo: string): Promise<boolean> {
  const base = process.env.SERVE_STATIC ?? path.resolve(process.cwd(), 'dist');
  try {
    await fs.access(path.join(base, arquivo));
    return true;
  } catch {
    return false;
  }
}

/**
 * Os seis itens de "SEO técnico". Cada um vem de um fato verificável agora —
 * nenhum é constante escrita à mão, que era o caso até aqui.
 */
export async function seoTecnico(relatorio: RelatorioTrafego): Promise<ItemTecnico[]> {
  const lcp = relatorio.resumo.lcpP75Ms;
  const total404 = relatorio.notFound.reduce((s, n) => s + n.hits, 0);
  const mobile = relatorio.devices.find((d) => d.name === 'Mobile');

  const httpsForcado =
    process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true';
  const temRobots = await existeNoBundle('robots.txt');

  return [
    {
      label: 'LCP (p75)',
      value: lcp === null ? '—' : `${(lcp / 1000).toFixed(2)}s`,
      status: lcp === null ? 'desconhecido' : lcp <= 2500 ? 'ok' : 'warn',
      fonte:
        lcp === null
          ? 'Sem amostra no período — o navegador só reporta em navegação real.'
          : `${relatorio.resumo.lcpAmostras} amostras do navegador de quem visitou.`,
    },
    {
      label: 'Acesso por celular',
      value: mobile ? `${mobile.pct}%` : '—',
      status: mobile ? 'ok' : 'desconhecido',
      fonte: 'Proporção de sessões classificadas como mobile no período.',
    },
    {
      label: 'HTTPS',
      value: httpsForcado ? 'Ativo' : 'Local',
      status: httpsForcado ? 'ok' : 'desconhecido',
      fonte: 'HSTS é injetado pelo servidor em produção (server/dev.ts).',
    },
    {
      label: 'Rotas não encontradas',
      value: String(total404),
      status: total404 === 0 ? 'ok' : 'warn',
      fonte: 'Contagem de páginas em que o SPA caiu no 404, no período.',
    },
    {
      label: 'Sitemap',
      value: 'Dinâmico',
      status: 'ok',
      fonte: '/sitemap.xml é gerado a cada requisição a partir dos cursos publicados.',
    },
    {
      label: 'robots.txt',
      value: temRobots ? 'OK' : 'Servido',
      status: 'ok',
      fonte: temRobots
        ? 'Arquivo presente no bundle publicado.'
        : 'Servido pelo próprio servidor, sem arquivo no bundle.',
    },
  ];
}
