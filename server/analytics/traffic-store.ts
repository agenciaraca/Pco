/**
 * Agregados diários de tráfego — a persistência da medição própria.
 *
 * Dois backends, como o resto da casa: tabela `analytics_daily` com
 * `DATABASE_URL`, `data/analytics-daily.json` sem ela. Mesmo molde de
 * `courses.ts`.
 *
 * **O que fica gravado é contador, e só.** Nenhum identificador de pessoa
 * chega até aqui: sem IP, sem cookie, sem user-agent, sem id de sessão. A
 * sessão existe só na memória do processo (ver `collector.ts`), e o que
 * sobrevive ao restart são somas por dia. É essa escolha que permite medir o
 * site sem pedir consentimento de rastreamento — e é ela que precisa ser
 * defendida se alguém pedir "só mais um campinho" aqui dentro.
 */

import { eq } from 'drizzle-orm';
import { schema } from '../db/client';
import { bancoSeTabelaExiste } from '../db/tabela-ausente';
import { JsonStore } from '../db/json-store';

/** Origem da visita, classificada na primeira página da sessão. */
export type TrafficSource = 'organico' | 'direto' | 'social' | 'referral' | 'email';

export type DeviceClass = 'desktop' | 'mobile' | 'tablet';

/** Um dia de medição. Tudo aqui é soma; nada é amostra de gente. */
export interface DailyTraffic {
  /** YYYY-MM-DD, no fuso do servidor. */
  date: string;
  pageviews: number;
  /** Sessões iniciadas no dia — é o que a tela chama de "visitantes". */
  sessions: number;
  /** Sessões que ficaram numa página só. */
  bounces: number;
  /** Soma do tempo entre a primeira e a última página de cada sessão. */
  totalSessionSeconds: number;
  byPath: Record<string, { views: number; entries: number; bounces: number; totalSeconds: number }>;
  bySource: Record<string, number>;
  byDevice: Record<string, number>;
  /**
   * Histograma de LCP em faixas de 250 ms (24 faixas = 0–6 s) mais a última,
   * que recolhe tudo acima de 6 s. Guardar a distribuição em vez da média é o
   * que permite responder p75 sem guardar cada amostra.
   */
  lcpBuckets: number[];
  lcpCount: number;
  /** Rotas que o SPA não soube resolver — o "erros 404" da tela, medido. */
  notFound: Record<string, number>;
  updatedAt: string;
}

export const LCP_BUCKET_MS = 250;
export const LCP_BUCKETS = 25; // 24 faixas de 250ms + overflow

export function diaVazio(date: string): DailyTraffic {
  return {
    date,
    pageviews: 0,
    sessions: 0,
    bounces: 0,
    totalSessionSeconds: 0,
    byPath: {},
    bySource: {},
    byDevice: {},
    lcpBuckets: Array.from({ length: LCP_BUCKETS }, () => 0),
    lcpCount: 0,
    notFound: {},
    updatedAt: new Date().toISOString(),
  };
}

const store = new JsonStore<DailyTraffic>('analytics-daily.json', () => []);

function daLinha(r: typeof schema.analyticsDaily.$inferSelect): DailyTraffic {
  const base = diaVazio(r.date);
  return {
    ...base,
    pageviews: r.pageviews,
    sessions: r.sessions,
    bounces: r.bounces,
    totalSessionSeconds: r.totalSessionSeconds,
    byPath: (r.byPath as DailyTraffic['byPath']) ?? {},
    bySource: (r.bySource as Record<string, number>) ?? {},
    byDevice: (r.byDevice as Record<string, number>) ?? {},
    lcpBuckets: normalizaBuckets(r.lcpBuckets as number[] | null),
    lcpCount: r.lcpCount,
    notFound: (r.notFound as Record<string, number>) ?? {},
    updatedAt: r.updatedAt,
  };
}

function normalizaBuckets(b: number[] | null | undefined): number[] {
  const out = Array.from({ length: LCP_BUCKETS }, () => 0);
  if (!b) return out;
  for (let i = 0; i < Math.min(b.length, LCP_BUCKETS); i++) out[i] = b[i] ?? 0;
  return out;
}

/** Lê um dia; devolve `null` quando não houve medição nenhuma nele. */
export async function lerDia(date: string): Promise<DailyTraffic | null> {
  const db = await bancoSeTabelaExiste('analytics_daily');
  if (db) {
    const rows = await db
      .select()
      .from(schema.analyticsDaily)
      .where(eq(schema.analyticsDaily.date, date))
      .limit(1);
    if (rows.length > 0) return daLinha(rows[0]!);
    return null;
  }
  return await store.findOne((d) => d.date === date);
}

export async function gravarDia(dia: DailyTraffic): Promise<void> {
  const registro = { ...dia, updatedAt: new Date().toISOString() };
  const db = await bancoSeTabelaExiste('analytics_daily');
  if (db) {
    await db
      .insert(schema.analyticsDaily)
      .values({
        date: registro.date,
        pageviews: registro.pageviews,
        sessions: registro.sessions,
        bounces: registro.bounces,
        totalSessionSeconds: registro.totalSessionSeconds,
        byPath: registro.byPath,
        bySource: registro.bySource,
        byDevice: registro.byDevice,
        lcpBuckets: registro.lcpBuckets,
        lcpCount: registro.lcpCount,
        notFound: registro.notFound,
        updatedAt: registro.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.analyticsDaily.date,
        set: {
          pageviews: registro.pageviews,
          sessions: registro.sessions,
          bounces: registro.bounces,
          totalSessionSeconds: registro.totalSessionSeconds,
          byPath: registro.byPath,
          bySource: registro.bySource,
          byDevice: registro.byDevice,
          lcpBuckets: registro.lcpBuckets,
          lcpCount: registro.lcpCount,
          notFound: registro.notFound,
          updatedAt: registro.updatedAt,
        },
      });
    return;
  }
  const existente = await store.findOne((d) => d.date === registro.date);
  if (existente) {
    await store.update((d) => d.date === registro.date, () => registro);
  } else {
    await store.add(registro);
  }
}

/** Dias no intervalo [de, ate], inclusive, ordenados. Só os que existem. */
export async function lerIntervalo(de: string, ate: string): Promise<DailyTraffic[]> {
  const db = await bancoSeTabelaExiste('analytics_daily');
  let dias: DailyTraffic[];
  if (db) {
    const rows = await db.select().from(schema.analyticsDaily);
    dias = rows.map(daLinha);
  } else {
    dias = await store.getAll();
  }
  return dias
    .filter((d) => d.date >= de && d.date <= ate)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Data da primeira medição — o começo do histórico que existe de verdade. */
export async function primeiroDia(): Promise<string | null> {
  const db = await bancoSeTabelaExiste('analytics_daily');
  const dias = db
    ? (await db.select().from(schema.analyticsDaily)).map((r) => r.date)
    : (await store.getAll()).map((d) => d.date);
  if (dias.length === 0) return null;
  return dias.sort()[0]!;
}

/** p75 do histograma, em milissegundos. `null` quando não há amostra. */
export function p75DoHistograma(buckets: number[], total: number): number | null {
  if (total <= 0) return null;
  const alvo = total * 0.75;
  let acumulado = 0;
  for (let i = 0; i < buckets.length; i++) {
    acumulado += buckets[i] ?? 0;
    if (acumulado >= alvo) {
      // Topo da faixa: dizer 250ms a mais é preferível a dizer a menos.
      return (i + 1) * LCP_BUCKET_MS;
    }
  }
  return LCP_BUCKETS * LCP_BUCKET_MS;
}
