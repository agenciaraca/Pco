import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// O e-mail semanal de progresso do aluno tinha worker rodando em produção e
// NENHUMA tela: os 3 endpoints de config/status nunca eram chamados pelo client.
// A tela /admin/progresso-aluno passou a consumi-los — estes testes travam o
// contrato (guard de auth + shape) para a UI não quebrar em silêncio de novo.

let tmpDir: string;
let app: Awaited<ReturnType<typeof buildAppLazy>>;
let jwt: typeof import('../server/auth/jwt');
let users: typeof import('../server/auth/users-store');

async function buildAppLazy() {
  const mod = await import('../server/app');
  return mod.buildApp();
}

async function adminToken(): Promise<string> {
  const all = await users.listUsers();
  const admin = all.find((u) => u.role === 'admin' || u.role === 'superadmin');
  if (!admin) throw new Error('seed sem admin');
  return jwt.signToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    tv: admin.tokenVersion,
  });
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-spe-'));
  process.env.DATA_DIR = tmpDir;
  app = await buildAppLazy();
  jwt = await import('../server/auth/jwt');
  users = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET/PUT /admin/email/student-progress', () => {
  it('exige autenticação nos três endpoints', async () => {
    for (const [method, url] of [
      ['GET', '/api/admin/email/student-progress'],
      ['PUT', '/api/admin/email/student-progress'],
      ['GET', '/api/admin/email/student-progress/status'],
    ] as const) {
      const res = await app.request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'PUT' ? JSON.stringify({}) : undefined,
      });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it('devolve a config com o shape que a tela consome', async () => {
    const token = await adminToken();
    const res = await app.request('/api/admin/email/student-progress', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(typeof cfg.enabled).toBe('boolean');
    expect(typeof cfg.dayOfWeekUtc).toBe('number');
    expect(typeof cfg.hourUtc).toBe('number');
  });

  it('salva alterações e as devolve na leitura seguinte', async () => {
    const token = await adminToken();
    const put = await app.request('/api/admin/email/student-progress', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, dayOfWeekUtc: 3, hourUtc: 14 }),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({
      enabled: true,
      dayOfWeekUtc: 3,
      hourUtc: 14,
    });

    const get = await app.request('/api/admin/email/student-progress', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await get.json()).toMatchObject({ enabled: true, dayOfWeekUtc: 3, hourUtc: 14 });
  });

  it('normaliza hora e dia fora do intervalo', async () => {
    const token = await adminToken();
    const res = await app.request('/api/admin/email/student-progress', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ hourUtc: 99, dayOfWeekUtc: 9 }),
    });
    const cfg = (await res.json()) as { hourUtc: number; dayOfWeekUtc: number };
    expect(cfg.hourUtc).toBe(23);
    expect(cfg.dayOfWeekUtc).toBe(0);
  });

  it('status expõe lastRunAt/lastResult', async () => {
    const token = await adminToken();
    const res = await app.request('/api/admin/email/student-progress/status', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const st = (await res.json()) as Record<string, unknown>;
    expect(st).toHaveProperty('lastRunAt');
    expect(st).toHaveProperty('lastResult');
  });
});
