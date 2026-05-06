import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let tokens: typeof import('../server/auth/api-tokens');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-tok-'));
  process.env.DATA_DIR = tmpDir;
  tokens = await import('../server/auth/api-tokens');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('auth/api-tokens', () => {
  it('createToken retorna secret pcok_* + token sem hash', async () => {
    const r = await tokens.createToken({
      name: 'BI integration',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    expect(r.secret).toMatch(/^pcok_/);
    expect(r.secret.length).toBeGreaterThan(20);
    expect(r.token.prefix).toBe(r.secret.slice(0, 12));
    expect(r.token.active).toBe(true);
    expect(r.token.usageCount).toBe(0);
    expect((r.token as Record<string, unknown>).secretHash).toBeUndefined();
  });

  it('verifyToken aceita secret válido', async () => {
    const r = await tokens.createToken({
      name: 'valid',
      scopes: ['orders:read'],
      createdBy: 'admin',
    });
    const v = await tokens.verifyToken(r.secret);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(r.token.id);
  });

  it('verifyToken rejeita prefix errado', async () => {
    expect(await tokens.verifyToken('not-prefixed-token')).toBeNull();
    expect(await tokens.verifyToken('')).toBeNull();
  });

  it('verifyToken rejeita secret modificado', async () => {
    const r = await tokens.createToken({
      name: 'mod',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    const tampered = r.secret.slice(0, -3) + 'XXX';
    expect(await tokens.verifyToken(tampered)).toBeNull();
  });

  it('verifyToken rejeita token revogado', async () => {
    const r = await tokens.createToken({
      name: 'revoke me',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    await tokens.revokeToken(r.token.id);
    expect(await tokens.verifyToken(r.secret)).toBeNull();
  });

  it('verifyToken rejeita token expirado', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const r = await tokens.createToken({
      name: 'expired',
      scopes: ['stats:read'],
      createdBy: 'admin',
      expiresAt: past,
    });
    expect(await tokens.verifyToken(r.secret)).toBeNull();
  });

  it('hasScope: scope explícito presente', () => {
    const tok = {
      scopes: ['orders:read', 'stats:read'],
    } as Parameters<typeof tokens.hasScope>[0];
    expect(tokens.hasScope(tok, 'orders:read')).toBe(true);
    expect(tokens.hasScope(tok, 'stats:read')).toBe(true);
    expect(tokens.hasScope(tok, 'students:read')).toBe(false);
  });

  it('hasScope: all:read libera qualquer scope', () => {
    const tok = { scopes: ['all:read'] } as Parameters<typeof tokens.hasScope>[0];
    expect(tokens.hasScope(tok, 'orders:read')).toBe(true);
    expect(tokens.hasScope(tok, 'students:read')).toBe(true);
    expect(tokens.hasScope(tok, 'certificates:read')).toBe(true);
  });

  it('deleteToken remove de fato', async () => {
    const r = await tokens.createToken({
      name: 'will-delete',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    expect(await tokens.deleteToken(r.token.id)).toBe(true);
    expect(await tokens.verifyToken(r.secret)).toBeNull();
    // segunda delete retorna false
    expect(await tokens.deleteToken(r.token.id)).toBe(false);
  });

  it('listTokens retorna sem secretHash, ordenado desc por createdAt', async () => {
    const list = await tokens.listTokens();
    expect(list.length).toBeGreaterThan(0);
    for (const t of list) {
      expect((t as Record<string, unknown>).secretHash).toBeUndefined();
    }
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true);
    }
  });

  it('verifyToken bumpa usageCount + lastUsedAt (best-effort)', async () => {
    const r = await tokens.createToken({
      name: 'usage',
      scopes: ['stats:read'],
      createdBy: 'admin',
    });
    await tokens.verifyToken(r.secret);
    // dá tempo do void update terminar
    await new Promise((res) => setTimeout(res, 50));
    const list = await tokens.listTokens();
    const found = list.find((t) => t.id === r.token.id);
    expect(found!.usageCount).toBeGreaterThanOrEqual(1);
    expect(found!.lastUsedAt).toBeDefined();
  });
});
