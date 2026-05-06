import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Hono } from 'hono';

let tmpDir: string;
let users: typeof import('../server/auth/users-store');
let jwt: typeof import('../server/auth/jwt');
let mw: typeof import('../server/auth/middleware');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-auth-'));
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pwd';
  process.env.INITIAL_ADMIN_PASSWORD = 'a-pwd';
  process.env.INITIAL_STUDENT_PASSWORD = 's-pwd';

  users = await import('../server/auth/users-store');
  jwt = await import('../server/auth/jwt');
  mw = await import('../server/auth/middleware');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function buildApp(roles: Parameters<typeof mw.requireAuth>) {
  const app = new Hono();
  app.use('*', mw.attachUser);
  app.get('/protected', mw.requireAuth(...roles), (c) => {
    const u = c.get('user')!;
    return c.json({ ok: true, role: u.role, sub: u.sub });
  });
  return app;
}

async function tokenFor(role: 'student' | 'admin' | 'superadmin') {
  const list = await users.listUsers();
  const u = list.find((x) => x.role === role)!;
  return await jwt.signToken({
    sub: u.id,
    email: u.email,
    role: u.role,
    tv: u.tokenVersion,
  });
}

describe('auth/middleware', () => {
  it('attachUser não seta user sem token', async () => {
    const app = buildApp([]);
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
  });

  it('attachUser + token válido passa', async () => {
    const app = buildApp([]);
    const tok = await tokenFor('student');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it('Authorization (capital A) também é aceito', async () => {
    const app = buildApp([]);
    const tok = await tokenFor('student');
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it('requireAuth() com role student rejeita admin? Não — sem roles especificadas, qualquer auth passa', async () => {
    const app = buildApp([]);
    const tok = await tokenFor('admin');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it('requireAuth(admin) rejeita student com 403', async () => {
    const app = buildApp(['admin']);
    const tok = await tokenFor('student');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('requireAuth(admin) aceita admin', async () => {
    const app = buildApp(['admin']);
    const tok = await tokenFor('admin');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it('superadmin sempre passa, mesmo se role não está na lista', async () => {
    const app = buildApp(['admin']);
    const tok = await tokenFor('superadmin');
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it('token com tv velho (após bump) é rejeitado (UNAUTHORIZED)', async () => {
    const list = await users.listUsers();
    const u = list.find((x) => x.role === 'student')!;
    const oldToken = await jwt.signToken({
      sub: u.id,
      email: u.email,
      role: u.role,
      tv: u.tokenVersion,
    });
    await users.bumpTokenVersion(u.id);

    const app = buildApp([]);
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(res.status).toBe(401);
  });

  it('token de user inactive é rejeitado', async () => {
    const u = await users.createUser({
      email: 'mid-inactive@x.com',
      name: 'Inact',
      role: 'student',
      password: 'p',
    });
    const tok = await jwt.signToken({
      sub: u.id,
      email: u.email,
      role: u.role,
      tv: u.tokenVersion,
    });
    await users.updateUser(u.id, { active: false });

    const app = buildApp([]);
    const res = await app.request('/protected', {
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(401);
  });

  it('header sem prefix Bearer é ignorado', async () => {
    const app = buildApp([]);
    const tok = await tokenFor('student');
    const res = await app.request('/protected', {
      headers: { authorization: tok }, // sem "Bearer "
    });
    expect(res.status).toBe(401);
  });

  it('UNAUTHORIZED sem token tem código', async () => {
    const app = buildApp([]);
    const res = await app.request('/protected');
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
