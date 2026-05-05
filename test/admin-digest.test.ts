import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let buildDigestData: typeof import('../server/notifications/admin-digest').buildDigestData;
let renderDigestHtml: typeof import('../server/notifications/admin-digest').renderDigestHtml;
let setConfig: typeof import('../server/notifications/admin-digest').setConfig;
let getConfig: typeof import('../server/notifications/admin-digest').getConfig;
let ordersRepo: typeof import('../server/payments/orders-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-digest-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET = 'test-secret';

  const mod = await import('../server/notifications/admin-digest');
  buildDigestData = mod.buildDigestData;
  renderDigestHtml = mod.renderDigestHtml;
  setConfig = mod.setConfig;
  getConfig = mod.getConfig;

  ordersRepo = await import('../server/payments/orders-repo');

  // Seed: 2 paid recentes
  for (let i = 0; i < 2; i++) {
    const o = await ordersRepo.createOrder({
      userId: `u${i}`,
      userEmail: `u${i}@test.com`,
      productId: 'p1',
      productSnapshot: {
        name: 'Curso Test',
        priceCents: 5000,
        currency: 'BRL',
        kind: 'course',
        refId: 'c1',
      },
      gatewayId: 'gw1',
      gatewayProvider: 'mock',
      amountCents: 5000,
      currency: 'BRL',
    });
    await ordersRepo.updateStatus(o.id, 'paid', 'test');
  }
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('buildDigestData', () => {
  it('soma vendas das últimas 24h', async () => {
    const d = await buildDigestData();
    expect(d.paidOrders).toBe(2);
    expect(d.revenueCents).toBe(10000);
    expect(d.newOrders).toBe(2);
  });

  it('lista top produtos', async () => {
    const d = await buildDigestData();
    expect(d.topProducts.length).toBe(1);
    expect(d.topProducts[0]!.name).toBe('Curso Test');
    expect(d.topProducts[0]!.count).toBe(2);
  });

  it('janela de 24h', async () => {
    const d = await buildDigestData();
    const fromMs = new Date(d.windowFrom).getTime();
    const toMs = new Date(d.windowTo).getTime();
    const diffH = (toMs - fromMs) / (60 * 60_000);
    expect(diffH).toBeGreaterThanOrEqual(23.9);
    expect(diffH).toBeLessThanOrEqual(24.1);
  });
});

describe('renderDigestHtml', () => {
  it('retorna subject e html', async () => {
    const d = await buildDigestData();
    const r = renderDigestHtml(d);
    expect(r.subject).toContain('R$');
    expect(r.html).toContain('AVA PCO');
    expect(r.html).toContain('Curso Test');
    expect(r.html).toContain('100,00'); // 10000 cents = R$ 100,00
  });

  it('escapa HTML em nomes de produto', async () => {
    const d = {
      windowFrom: '2025-01-01T00:00:00Z',
      windowTo: '2025-01-02T00:00:00Z',
      newOrders: 1,
      paidOrders: 1,
      revenueCents: 1000,
      refundedOrders: 0,
      newUsers: 0,
      certificatesIssued: 0,
      topProducts: [
        { name: '<script>alert(1)</script>', revenueCents: 1000, count: 1 },
      ],
    };
    const r = renderDigestHtml(d);
    expect(r.html).not.toContain('<script>alert');
    expect(r.html).toContain('&lt;script&gt;');
  });
});

describe('config persistence', () => {
  it('lê e escreve config', async () => {
    const initial = await getConfig();
    expect(initial.enabled).toBe(false);
    expect(initial.hourUtc).toBe(11);

    const updated = await setConfig({ enabled: true, hourUtc: 8 });
    expect(updated.enabled).toBe(true);
    expect(updated.hourUtc).toBe(8);

    const reread = await getConfig();
    expect(reread.enabled).toBe(true);
    expect(reread.hourUtc).toBe(8);
  });

  it('clamp hour para 0-23', async () => {
    const r1 = await setConfig({ hourUtc: 99 });
    expect(r1.hourUtc).toBe(23);
    const r2 = await setConfig({ hourUtc: -5 });
    expect(r2.hourUtc).toBe(0);
  });
});
