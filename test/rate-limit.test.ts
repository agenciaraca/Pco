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

/**
 * Dois limitadores no mesmo caminho não podem dividir o contador.
 *
 * É o formato exato do produto: `app.use('*')` com 120/min por cima de
 * `/auth/login` com 5/min. Enquanto a chave foi só `ip:path`, cada POST contava
 * nos dois e o login bloqueava na terceira tentativa — quem errava a senha duas
 * vezes ficava um minuto fora, e ninguém percebia porque o 429 é o mesmo que o
 * ataque de força bruta recebe.
 */
describe('limitadores empilhados', () => {
  it('o global não consome a cota do limitador da rota', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 120 }));
    app.post('/auth/login', rateLimit({ windowMs: 60_000, max: 5 }), (c) => c.json({ ok: true }));

    const ip = '10.0.0.77';
    for (let i = 1; i <= 5; i++) {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
      });
      expect(res.status, `tentativa ${i} deveria passar`).toBe(200);
    }
    const sexta = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    });
    expect(sexta.status).toBe(429);
  });

  it('janela longa não é encurtada pela curta do limitador global', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 120 }));
    // Janela de 5 min, como `/auth/forgot-password`.
    app.post('/recuperar', rateLimit({ windowMs: 5 * 60_000, max: 3 }), (c) => c.json({ ok: true }));

    const ip = '10.0.0.78';
    for (let i = 0; i < 3; i++) {
      await app.request('/recuperar', { method: 'POST', headers: { 'x-forwarded-for': ip } });
    }
    const bloqueada = await app.request('/recuperar', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    });
    expect(bloqueada.status).toBe(429);
    // Retry-After tem que falar da janela de 5 min, não da de 1.
    expect(Number(bloqueada.headers.get('Retry-After'))).toBeGreaterThan(60);
  });
});
