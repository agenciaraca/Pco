import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Hono } from 'hono';

let tmpDir: string;
let tokens: typeof import('../server/auth/api-tokens');
let mw: typeof import('../server/auth/api-token-middleware');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mid-'));
  process.env.DATA_DIR = tmpDir;
  process.env.API_TOKEN_RATE_LIMIT = '100';
  tokens = await import('../server/auth/api-tokens');
  mw = await import('../server/auth/api-token-middleware');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function buildApp(scope?: Parameters<typeof mw.requireApiToken>[0]) {
  const app = new Hono();
  app.use('/protected', mw.requireApiToken(scope));
  app.get('/protected', (c) => {
    const tok = c.get('apiToken');
    return c.json({ ok: true, tokenId: tok!.id });
  });
  return app;
}

describe('auth/api-token-middleware', () => {
  it('rejeita request sem Authorization (NO_TOKEN, 401)', async () => {
    const app = buildApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NO_TOKEN');
  });

  it('rejeita Authorization sem prefix Bearer pcok_', async () => {
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: 'Bearer xyz123' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NO_TOKEN');
  });

  it('rejeita token inválido (INVALID_TOKEN, 401)', async () => {
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: 'Bearer pcok_token_inexistente_aaa' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('aceita token válido + injeta apiToken no contexto', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'mw-test',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tokenId: string };
    expect(body.tokenId).toBe(created.token.id);
  });

  it('aceita Bearer case-insensitive', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'case-test',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: `bearer ${created.secret}` },
    });
    expect(res.status).toBe(200);
  });

  it('rejeita token sem scope necessário (INSUFFICIENT_SCOPE, 403)', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'limited',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    const app = buildApp('orders:read');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
    expect(body.error.message).toContain('orders:read');
  });

  it('all:read libera qualquer scope', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'super',
      scopes: ['all:read'],
      createdBy: 'admin',
    });
    const app = buildApp('orders:read');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.status).toBe(200);
  });

  it('expõe headers X-RateLimit-Limit e X-RateLimit-Remaining', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'headers',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    const remaining = Number(res.headers.get('X-RateLimit-Remaining'));
    expect(remaining).toBeLessThanOrEqual(100);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('token revogado → INVALID_TOKEN', async () => {
    mw.__testInternals__.reset();
    const created = await tokens.createToken({
      name: 'revoked',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    await tokens.revokeToken(created.token.id);
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('token expirado → INVALID_TOKEN', async () => {
    mw.__testInternals__.reset();
    const past = new Date(Date.now() - 1000).toISOString();
    const created = await tokens.createToken({
      name: 'expired-mw',
      scopes: ['stats:read'],
      createdBy: 'admin',
      expiresAt: past,
    });
    const app = buildApp();
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${created.secret}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});
