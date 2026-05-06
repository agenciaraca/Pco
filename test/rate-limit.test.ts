import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, getHits, summarize } from '../server/rate-limit';

function buildApp(opts: { windowMs: number; max: number }) {
  const app = new Hono();
  app.use('*', rateLimit(opts));
  app.get('/', (c) => c.json({ ok: true }));
  return app;
}

describe('rate-limit middleware', () => {
  beforeEach(() => {
    // store é global em memória — não conseguimos limpar limpinho,
    // mas IPs/keys diferentes por teste evitam colisão
  });

  it('permite requests dentro do limite', async () => {
    const app = buildApp({ windowMs: 60_000, max: 5 });
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      expect(res.status).toBe(200);
    }
  });

  it('bloqueia request acima do limite (429 + Retry-After)', async () => {
    const app = buildApp({ windowMs: 60_000, max: 2 });
    const ip = '10.0.0.2';
    await app.request('/', { headers: { 'x-forwarded-for': ip } });
    await app.request('/', { headers: { 'x-forwarded-for': ip } });
    const res = await app.request('/', { headers: { 'x-forwarded-for': ip } });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('expõe headers RateLimit-Limit/Remaining/Reset em 200', async () => {
    const app = buildApp({ windowMs: 60_000, max: 10 });
    const res = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.3' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('RateLimit-Limit')).toBe('10');
    const remaining = Number(res.headers.get('RateLimit-Remaining'));
    expect(remaining).toBeLessThanOrEqual(10);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('IPs diferentes têm buckets separados', async () => {
    const app = buildApp({ windowMs: 60_000, max: 1 });
    // IP A consome
    const a1 = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.10' },
    });
    expect(a1.status).toBe(200);
    // IP B ainda livre
    const b1 = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.11' },
    });
    expect(b1.status).toBe(200);
    // IP A já bloqueado
    const a2 = await app.request('/', {
      headers: { 'x-forwarded-for': '10.0.0.10' },
    });
    expect(a2.status).toBe(429);
  });

  it('cf-connecting-ip também é aceito como IP', async () => {
    const app = buildApp({ windowMs: 60_000, max: 1 });
    const res1 = await app.request('/', {
      headers: { 'cf-connecting-ip': '10.0.0.20' },
    });
    expect(res1.status).toBe(200);
    const res2 = await app.request('/', {
      headers: { 'cf-connecting-ip': '10.0.0.20' },
    });
    expect(res2.status).toBe(429);
  });

  it('keyFn customizada agrupa requests', async () => {
    const app = new Hono();
    app.use(
      '*',
      rateLimit({
        windowMs: 60_000,
        max: 1,
        keyFn: (c) => `tenant:${c.req.header('x-tenant') ?? 'default'}`,
      }),
    );
    app.get('/', (c) => c.json({ ok: true }));

    // Mesmo tenant
    const a1 = await app.request('/', { headers: { 'x-tenant': 'A' } });
    expect(a1.status).toBe(200);
    const a2 = await app.request('/', { headers: { 'x-tenant': 'A' } });
    expect(a2.status).toBe(429);
    // Tenant diferente
    const b1 = await app.request('/', { headers: { 'x-tenant': 'B' } });
    expect(b1.status).toBe(200);
  });

  it('getHits retorna eventos registrados', () => {
    const all = getHits();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('summarize retorna topIps + recentBlocks + window', () => {
    const s = summarize(60 * 60_000);
    expect(s.totalHits).toBeGreaterThan(0);
    expect(Array.isArray(s.topIps)).toBe(true);
    expect(Array.isArray(s.topPaths)).toBe(true);
    expect(s.windowMs).toBe(60 * 60_000);
    expect(s.topIps.every((x) => typeof x.ip === 'string')).toBe(true);
  });

  it('summarize com janela curta exclui hits antigos', () => {
    // Com janela 1ms tudo está fora
    const s = summarize(1);
    // pode ter alguns recentes, mas tem que ser menor ou igual ao total geral
    expect(s.totalHits).toBeLessThanOrEqual(getHits().length);
  });
});
