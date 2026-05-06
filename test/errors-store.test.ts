import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/errors/store');

// Cria mock context Hono — chega bem perto sem subir o servidor
function mockCtx(opts: {
  method?: string;
  pathname?: string;
  user?: { sub: string; email?: string; role?: string } | null;
  ua?: string;
  xff?: string;
} = {}) {
  return {
    req: {
      method: opts.method ?? 'GET',
      path: opts.pathname ?? '/api/test',
      header(name: string): string | undefined {
        const h: Record<string, string> = {
          'user-agent': opts.ua ?? 'Mozilla/test',
          ...(opts.xff ? { 'x-forwarded-for': opts.xff } : {}),
        };
        return h[name.toLowerCase()];
      },
    },
    get(key: string) {
      if (key === 'user') return opts.user ?? null;
      return null;
    },
  } as unknown as import('hono').Context;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-errs-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/errors/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('errors/store', () => {
  it('recordError grava entry server-side', async () => {
    const ctx = mockCtx({
      method: 'POST',
      pathname: '/api/x',
      user: { sub: 'u1', email: 'a@b.com', role: 'admin' },
    });
    await store.recordError(ctx, new Error('boom'), 500);
    const all = await store.listErrors();
    const found = all.find((e) => e.message === 'boom');
    expect(found).toBeDefined();
    expect(found!.method).toBe('POST');
    expect(found!.path).toBe('/api/x');
    expect(found!.status).toBe(500);
    expect(found!.actorEmail).toBe('a@b.com');
    expect(found!.stack).toContain('Error: boom');
    expect(found!.id.startsWith('e-')).toBe(true);
  });

  it('recordClientError marca method=CLIENT', async () => {
    const ctx = mockCtx({ ua: 'BrowserX/1.0' });
    await store.recordClientError(ctx, {
      message: 'unhandledRejection',
      stack: 'TypeError: foo at line 5',
      path: '/dashboard',
    });
    const all = await store.listErrors();
    const found = all.find((e) => e.message === 'unhandledRejection');
    expect(found).toBeDefined();
    expect(found!.method).toBe('CLIENT');
    expect(found!.path).toBe('/dashboard');
    expect(found!.id.startsWith('c-')).toBe(true);
  });

  it('listErrors filtra por since', async () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const filtered = await store.listErrors({ since: futureDate });
    expect(filtered.length).toBe(0);
  });

  it('listErrors clamp limit (min 1, max 1000)', async () => {
    const r1 = await store.listErrors({ limit: 0 });
    expect(r1.length).toBeLessThanOrEqual(1);
    // limit > 1000 fica em 1000 (mas só temos algumas entries)
    const all = await store.listErrors({ limit: 9999 });
    expect(all.length).toBeLessThanOrEqual(1000);
  });

  it('clientIp prefere x-forwarded-for', async () => {
    const ctx = mockCtx({ xff: '203.0.113.42, 10.0.0.1' });
    await store.recordError(ctx, new Error('xff-test'), 500);
    const all = await store.listErrors();
    const found = all.find((e) => e.message === 'xff-test');
    expect(found!.ip).toBe('203.0.113.42');
  });

  it('actorId é null quando user não autenticado', async () => {
    const ctx = mockCtx({ user: null });
    await store.recordError(ctx, new Error('anon'), 401);
    const all = await store.listErrors();
    const found = all.find((e) => e.message === 'anon');
    expect(found!.actorId).toBeNull();
    expect(found!.actorEmail).toBeNull();
  });

  it('errorsByDay agrega por dia em buckets', async () => {
    const days = await store.errorsByDay(7);
    expect(days.length).toBe(7);
    expect(days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))).toBe(true);
    // soma de hoje deve ter as entries que adicionamos
    const today = new Date().toISOString().slice(0, 10);
    const todayBucket = days.find((d) => d.day === today);
    expect(todayBucket!.total).toBeGreaterThan(0);
    expect(todayBucket!.client).toBeGreaterThanOrEqual(1); // do recordClientError
    expect(todayBucket!.server).toBeGreaterThanOrEqual(1); // do recordError
  });

  it('message comprida é truncada em 1000 chars', async () => {
    const huge = 'x'.repeat(2000);
    await store.recordClientError(mockCtx(), { message: huge });
    const all = await store.listErrors();
    const found = all.find((e) => e.message.startsWith('xxxx'));
    expect(found!.message.length).toBe(1000);
  });

  it('non-Error string é coercida via String()', async () => {
    const ctx = mockCtx();
    await store.recordError(ctx, 'plain string error', 400);
    const all = await store.listErrors();
    const found = all.find((e) => e.message === 'plain string error');
    expect(found!.stack).toBeNull();
  });
});
