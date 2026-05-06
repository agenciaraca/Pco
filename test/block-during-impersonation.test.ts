import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { blockDuringImpersonation } from '../server/auth/block-during-impersonation';
import type { JwtPayload } from '../server/auth/jwt';

function buildApp(payload: JwtPayload | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (payload) c.set('user', payload);
    await next();
  });
  app.post(
    '/danger',
    blockDuringImpersonation('user.delete'),
    (c) => c.json({ ok: true }),
  );
  app.post(
    '/safe',
    blockDuringImpersonation('order.refund'),
    (c) => c.json({ ok: true, ran: true }),
  );
  return app;
}

const adminPayload: JwtPayload = {
  sub: 'admin-1',
  email: 'admin@pco.local',
  role: 'admin',
  tv: 0,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const impersonationPayload: JwtPayload = {
  ...adminPayload,
  sub: 'student-1',
  email: 'student@pco.local',
  role: 'student',
  act: { sub: 'admin-1', email: 'admin@pco.local', role: 'admin' },
};

describe('blockDuringImpersonation middleware', () => {
  it('passa quando não há sessão de impersonation (act ausente)', async () => {
    const app = buildApp(adminPayload);
    const res = await app.request('http://x/danger', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('bloqueia ação listada quando há claim act', async () => {
    const app = buildApp(impersonationPayload);
    const res = await app.request('http://x/danger', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; details: { action: string } } };
    expect(body.error.code).toBe('IMPERSONATION_BLOCKED');
    expect(body.error.details.action).toBe('user.delete');
  });

  it('bloqueia ação order.refund durante impersonation', async () => {
    const app = buildApp(impersonationPayload);
    const res = await app.request('http://x/safe', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { details: { action: string } } };
    expect(body.error.details.action).toBe('order.refund');
  });

  it('passa em sessão sem user (rota pública)', async () => {
    const app = buildApp(null);
    const res = await app.request('http://x/danger', { method: 'POST' });
    // Sem user no contexto: middleware não bloqueia (deixa requireAuth fazer o trabalho)
    expect(res.status).toBe(200);
  });

  it('mensagem de erro contém instrução de sair da visualização', async () => {
    const app = buildApp(impersonationPayload);
    const res = await app.request('http://x/danger', { method: 'POST' });
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/visualizando como outro usuário/i);
    expect(body.error.message).toMatch(/saia da visualização/i);
  });

  it('é no-op para superadmin sem impersonation', async () => {
    const app = buildApp({ ...adminPayload, role: 'superadmin' });
    const res = await app.request('http://x/danger', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('respeita lista canônica — bloqueio só para ações listadas', async () => {
    // Usa middleware com action que não está na lista — não deveria nem ser
    // possível compilar (TS BlockedAction), mas testa runtime safety.
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', impersonationPayload);
      await next();
    });
    app.post(
      '/x',
      // @ts-expect-error: forçando string fora da union pra testar runtime guard
      blockDuringImpersonation('something.unknown'),
      (c) => c.json({ ok: true }),
    );
    const res = await app.request('http://x/x', { method: 'POST' });
    // Como 'something.unknown' não está em BLOCKED_ACTIONS, passa
    expect(res.status).toBe(200);
  });
});
