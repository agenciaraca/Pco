import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let buildFeed: typeof import('../server/activity/feed').buildFeed;
let auditLog: typeof import('../server/audit/log');
let emailLogs: typeof import('../server/notifications/log-store');

function mockCtx(opts: {
  user?: { sub: string; email?: string; role?: string } | null;
} = {}) {
  return {
    req: {
      header(): string | undefined {
        return undefined;
      },
    },
    get(key: string) {
      if (key === 'user') return opts.user ?? null;
      return null;
    },
  } as unknown as import('hono').Context;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-feed-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  buildFeed = (await import('../server/activity/feed')).buildFeed;
  auditLog = await import('../server/audit/log');
  emailLogs = await import('../server/notifications/log-store');

  // seed: alguns audit + email events
  await auditLog.recordAudit(
    mockCtx({ user: { sub: 'a1', email: 'a1@x.com', role: 'admin' } }),
    { action: 'user.create', targetType: 'user', targetId: 'u-1' },
  );
  await auditLog.recordAudit(mockCtx(), {
    action: 'order.refund',
    targetType: 'order',
    targetId: 'o-99',
  });
  await emailLogs.pushLog({
    configId: 'cfg-1',
    provider: 'mock',
    to: 'student@x.com',
    subject: 'Bem-vindo',
    tag: 'welcome',
    status: 'sent',
    externalId: 'mock-1',
  });
  await emailLogs.pushLog({
    configId: 'cfg-1',
    provider: 'mock',
    to: 'fail@x.com',
    subject: 'Falha',
    status: 'failed',
    error: 'connection refused',
  });
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('activity/feed', () => {
  it('buildFeed agrega audit + email events', async () => {
    const feed = await buildFeed();
    expect(feed.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(feed.map((i) => i.kind));
    expect(kinds.has('audit')).toBe(true);
    expect(kinds.has('email_sent')).toBe(true);
    expect(kinds.has('email_failed')).toBe(true);
  });

  it('items ordenados desc por ts', async () => {
    const feed = await buildFeed();
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i - 1]!.ts >= feed[i]!.ts).toBe(true);
    }
  });

  it('filtro por kinds isola tipos', async () => {
    const onlyEmail = await buildFeed({
      kinds: ['email_sent', 'email_failed'],
    });
    expect(onlyEmail.length).toBeGreaterThanOrEqual(2);
    expect(
      onlyEmail.every(
        (i) => i.kind === 'email_sent' || i.kind === 'email_failed',
      ),
    ).toBe(true);
  });

  it('filtro por since exclui anteriores', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const empty = await buildFeed({ since: future });
    expect(empty.length).toBe(0);
  });

  it('filtro q (text search) cobre label, detail, actor, target', async () => {
    const r = await buildFeed({ q: 'fail@x.com' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => (i.target ?? '').includes('fail@x.com'))).toBe(true);
  });

  it('q é case-insensitive', async () => {
    const upper = await buildFeed({ q: 'BEM-VINDO' });
    const lower = await buildFeed({ q: 'bem-vindo' });
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThan(0);
  });

  it('q matcha label do audit (action)', async () => {
    const r = await buildFeed({ q: 'order.refund' });
    expect(r.some((i) => i.label === 'order.refund')).toBe(true);
  });

  it('limit clamp (min 1, max 1000)', async () => {
    const r0 = await buildFeed({ limit: 0 });
    expect(r0.length).toBeLessThanOrEqual(1);
    const r9999 = await buildFeed({ limit: 9999 });
    expect(r9999.length).toBeLessThanOrEqual(1000);
  });

  it('email_failed tem detail com subject + tag opcional', async () => {
    const failed = (await buildFeed({ kinds: ['email_failed'] }))[0];
    expect(failed!.detail).toContain('Falha');
  });

  it('audit item exposes actor email + target', async () => {
    const audits = await buildFeed({ kinds: ['audit'] });
    const userCreate = audits.find((a) => a.label === 'user.create');
    expect(userCreate!.actor).toBe('a1@x.com');
    expect(userCreate!.target).toBe('u-1');
  });
});
