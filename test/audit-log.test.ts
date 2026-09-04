import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let audit: typeof import('../server/audit/log');

function mockCtx(opts: {
  user?: { sub: string; email?: string; role?: string } | null;
  ua?: string;
  xff?: string;
} = {}) {
  return {
    req: {
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-audit-'));
  process.env.DATA_DIR = tmpDir;
  audit = await import('../server/audit/log');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('audit/log', () => {
  it('recordAudit grava entry com actor + action', async () => {
    await audit.recordAudit(
      mockCtx({ user: { sub: 'u1', email: 'a@b.com', role: 'admin' } }),
      {
        action: 'student.create',
        targetType: 'student',
        targetId: 's-123',
        meta: { name: 'João' },
      },
    );
    const list = await audit.listAudit();
    const found = list.find((e) => e.targetId === 's-123');
    expect(found).toBeDefined();
    expect(found!.action).toBe('student.create');
    expect(found!.actorEmail).toBe('a@b.com');
    expect(found!.actorRole).toBe('admin');
    expect(found!.status).toBe('ok');
    expect(found!.meta).toEqual({ name: 'João' });
  });

  it('actor null quando context sem user', async () => {
    await audit.recordAudit(mockCtx({ user: null }), {
      action: 'system.boot',
    });
    const list = await audit.listAudit({ action: 'system.' });
    const found = list.find((e) => e.action === 'system.boot');
    expect(found!.actorId).toBeNull();
    expect(found!.actorEmail).toBeNull();
  });

  it('listAudit filtra por action (prefix match)', async () => {
    await audit.recordAudit(mockCtx(), { action: 'order.refund' });
    await audit.recordAudit(mockCtx(), { action: 'order.cancel' });
    await audit.recordAudit(mockCtx(), { action: 'student.create' });
    const orders = await audit.listAudit({ action: 'order.' });
    expect(naoVazio(orders).every((e) => e.action.startsWith('order.'))).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(2);
  });

  it('listAudit filtra por actorId', async () => {
    await audit.recordAudit(
      mockCtx({ user: { sub: 'specific-user', role: 'admin' } }),
      { action: 'specific.x' },
    );
    const r = await audit.listAudit({ actorId: 'specific-user' });
    expect(naoVazio(r).every((e) => e.actorId === 'specific-user')).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it('listAudit filtra por targetType + targetId', async () => {
    await audit.recordAudit(mockCtx(), {
      action: 'product.update',
      targetType: 'product',
      targetId: 'prod-X',
    });
    const r = await audit.listAudit({
      targetType: 'product',
      targetId: 'prod-X',
    });
    expect(r.length).toBe(1);
    expect(r[0]!.action).toBe('product.update');
  });

  it('listAudit filtra por since/until', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const empty = await audit.listAudit({ since: future });
    expect(empty.length).toBe(0);

    const past = new Date(Date.now() - 60_000).toISOString();
    const all = await audit.listAudit({ since: past });
    expect(all.length).toBeGreaterThan(0);
  });

  it('status pode ser ok ou error', async () => {
    await audit.recordAudit(mockCtx(), {
      action: 'op.fail',
      status: 'error',
    });
    const r = await audit.listAudit({ action: 'op.fail' });
    expect(r[0]!.status).toBe('error');
  });

  it('clientIp pega x-forwarded-for primeiro IP', async () => {
    await audit.recordAudit(mockCtx({ xff: '1.2.3.4, 10.0.0.1' }), {
      action: 'ip.test',
    });
    const r = await audit.listAudit({ action: 'ip.test' });
    expect(r[0]!.ip).toBe('1.2.3.4');
  });

  it('auditByDay agrega buckets diários ok+error', async () => {
    const days = await audit.auditByDay(7);
    expect(days.length).toBe(7);
    expect(days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const t = days.find((d) => d.day === today);
    expect(t!.ok + t!.error).toBe(t!.total);
    expect(t!.total).toBeGreaterThan(0);
  });

  it('listAudit clamp limit', async () => {
    const r = await audit.listAudit({ limit: 5 });
    expect(r.length).toBeLessThanOrEqual(5);
  });
});
