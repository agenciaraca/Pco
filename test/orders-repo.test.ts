import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/payments/orders-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ord-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/orders-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

const baseInput = {
  userId: 'u1',
  userEmail: 'u1@test.com',
  productId: 'p1',
  productSnapshot: {
    name: 'Curso X',
    priceCents: 10000,
    currency: 'BRL',
    kind: 'course' as const,
    refId: 'c1',
  },
  gatewayId: 'gw1',
  gatewayProvider: 'mock' as const,
  amountCents: 10000,
  currency: 'BRL',
};

describe('orders-repo CRUD', () => {
  it('createOrder gera id e status pending', async () => {
    const o = await repo.createOrder(baseInput);
    expect(o.id).toMatch(/^ord-/);
    expect(o.status).toBe('pending');
    expect(o.amountCents).toBe(10000);
    expect(o.events.length).toBeGreaterThanOrEqual(1);
  });

  it('findById retorna order criada', async () => {
    const created = await repo.createOrder(baseInput);
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('attachGatewayResult atualiza externalId + checkoutUrl', async () => {
    const o = await repo.createOrder(baseInput);
    await repo.attachGatewayResult(o.id, {
      externalId: 'ext-123',
      checkoutUrl: 'https://gw.com/pay',
      status: 'pending',
    });
    const after = await repo.findById(o.id);
    expect(after!.externalId).toBe('ext-123');
    expect(after!.checkoutUrl).toBe('https://gw.com/pay');
  });

  it('findByExternalId encontra order via externalId', async () => {
    const o = await repo.createOrder(baseInput);
    await repo.attachGatewayResult(o.id, {
      externalId: 'unique-ext-456',
      status: 'pending',
    });
    const found = await repo.findByExternalId('unique-ext-456');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(o.id);
  });

  it('updateStatus transiciona pending → paid', async () => {
    const o = await repo.createOrder(baseInput);
    const updated = await repo.updateStatus(o.id, 'paid', 'webhook');
    expect(updated!.status).toBe('paid');
    expect(updated!.paidAt).toBeDefined();
    expect(updated!.events.some((e) => e.note === 'webhook')).toBe(true);
  });

  it('listForUser filtra por userId', async () => {
    await repo.createOrder({ ...baseInput, userId: 'u-other' });
    const u1Orders = await repo.listForUser('u1');
    expect(u1Orders.every((o) => o.userId === 'u1')).toBe(true);
  });

  it('listAll retorna ordenado desc por createdAt', async () => {
    const all = await repo.listAll();
    expect(all.length).toBeGreaterThan(0);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.createdAt >= all[i]!.createdAt).toBe(true);
    }
  });
});
