import type { Context, Next } from 'hono';

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
  keyFn?: (c: Context) => string;
}

const store = new Map<string, Bucket>();

// ---------- Telemetria de rate limit ----------

export interface RateLimitHit {
  ts: number;
  ip: string;
  path: string;
  method: string;
  blocked: boolean; // true se bateu 429
}

const HIT_BUFFER_MAX = 10_000;
const hits: RateLimitHit[] = [];

function recordHit(h: RateLimitHit): void {
  hits.push(h);
  if (hits.length > HIT_BUFFER_MAX) hits.splice(0, hits.length - HIT_BUFFER_MAX);
}

export function getHits(): readonly RateLimitHit[] {
  return hits;
}

export interface RateLimitSummary {
  totalHits: number;
  blockedCount: number;
  windowMs: number;
  topIps: Array<{ ip: string; count: number; blocked: number }>;
  topPaths: Array<{ path: string; count: number; blocked: number }>;
  recentBlocks: Array<{
    ts: number;
    ip: string;
    path: string;
    method: string;
  }>;
}

export function summarize(windowMs = 24 * 60 * 60_000): RateLimitSummary {
  const cutoff = Date.now() - windowMs;
  const inWindow = hits.filter((h) => h.ts >= cutoff);
  const ipCounts = new Map<string, { count: number; blocked: number }>();
  const pathCounts = new Map<string, { count: number; blocked: number }>();
  for (const h of inWindow) {
    const ip = ipCounts.get(h.ip) ?? { count: 0, blocked: 0 };
    ip.count++;
    if (h.blocked) ip.blocked++;
    ipCounts.set(h.ip, ip);
    const p = pathCounts.get(h.path) ?? { count: 0, blocked: 0 };
    p.count++;
    if (h.blocked) p.blocked++;
    pathCounts.set(h.path, p);
  }
  return {
    totalHits: inWindow.length,
    blockedCount: inWindow.filter((h) => h.blocked).length,
    windowMs,
    topIps: Array.from(ipCounts.entries())
      .map(([ip, v]) => ({ ip, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    topPaths: Array.from(pathCounts.entries())
      .map(([path, v]) => ({ path, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    recentBlocks: inWindow
      .filter((h) => h.blocked)
      .slice(-50)
      .reverse()
      .map((h) => ({ ts: h.ts, ip: h.ip, path: h.path, method: h.method })),
  };
}

/**
 * Cada limitador tem o proprio balde.
 *
 * Antes a chave era so `ip:path`, e o limitador global (`app.use('*')`, 120/min)
 * dividia o balde com o da rota. Duas consequencias em producao, nenhuma
 * visivel de fora:
 *
 * - **`/auth/login` bloqueava na 3a tentativa, nao na 6a.** Cada POST era
 *   contado duas vezes no mesmo contador, entao `max: 5` valia 2. Quem errava a
 *   senha duas vezes ficava um minuto fora.
 * - **Janela curta vencia janela longa.** `/auth/forgot-password` pede 3 por
 *   5 minutos; o global cria o balde com `resetAt` de 1 minuto e quem chega
 *   primeiro define a janela, encurtando a protecao para um quinto.
 *
 * O contador por instancia resolve os dois sem mudar nenhuma chamada.
 */
let sequencia = 0;

export function rateLimit({ windowMs, max, keyFn }: Options) {
  const escopo = `rl${(sequencia += 1)}`;
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = `${escopo}:${keyFn ? keyFn(c) : `${ip}:${c.req.path}`}`;
    const now = Date.now();
    let bucket = store.get(key);
    let blocked = false;
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 1, resetAt: now + windowMs };
      store.set(key, bucket);
    } else {
      bucket.count += 1;
      if (bucket.count > max) {
        blocked = true;
      }
    }
    recordHit({ ts: now, ip, path: c.req.path, method: c.req.method, blocked });
    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header('Retry-After', retryAfter.toString());
      c.header('RateLimit-Limit', max.toString());
      c.header('RateLimit-Remaining', '0');
      c.header('RateLimit-Reset', retryAfter.toString());
      c.status(429);
      return c.json({
        error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente em instantes.' },
      });
    }
    await next();
    const remaining = Math.max(0, max - bucket.count);
    const resetSec = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
    c.header('RateLimit-Limit', max.toString());
    c.header('RateLimit-Remaining', remaining.toString());
    c.header('RateLimit-Reset', resetSec.toString());
  };
}
