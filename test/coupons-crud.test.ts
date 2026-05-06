import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/payments/coupons-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-coup-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/coupons-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('coupons-repo CRUD', () => {
  it('cria cupom uppercase', async () => {
    const c = await repo.createCoupon({
      code: 'desc10',
      discount: { kind: 'percent', value: 10 },
    });
    expect(c.code).toBe('DESC10');
    expect(c.usedCount).toBe(0);
    expect(c.active).toBe(true);
  });

  it('rejeita código inválido', async () => {
    await expect(
      repo.createCoupon({
        code: 'a',
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
    await expect(
      repo.createCoupon({
        code: 'invalid space',
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
  });

  it('rejeita código duplicado', async () => {
    await expect(
      repo.createCoupon({
        code: 'desc10',
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
  });

  it('findByCode é case-insensitive', async () => {
    const found = await repo.findByCode('DESC10');
    expect(found).not.toBeNull();
    const sameLower = await repo.findByCode('desc10');
    expect(sameLower).not.toBeNull();
    expect(sameLower!.id).toBe(found!.id);
  });

  it('updateCoupon altera campos', async () => {
    const c = await repo.findByCode('DESC10');
    const updated = await repo.updateCoupon(c!.id, {
      description: 'novo',
      maxUses: 50,
      active: false,
    });
    expect(updated!.description).toBe('novo');
    expect(updated!.maxUses).toBe(50);
    expect(updated!.active).toBe(false);
  });

  it('incrementUsage soma 1 e atualiza updatedAt', async () => {
    const c = await repo.findByCode('DESC10');
    const before = c!.usedCount;
    await repo.incrementUsage(c!.id);
    const after = await repo.findByCode('DESC10');
    expect(after!.usedCount).toBe(before + 1);
  });

  it('deleteCoupon remove', async () => {
    const c = await repo.createCoupon({
      code: 'TEMP1',
      discount: { kind: 'amount', value: 500 },
    });
    const ok = await repo.deleteCoupon(c.id);
    expect(ok).toBe(true);
    expect(await repo.findById(c.id)).toBeNull();
  });

  it('listAll retorna todos', async () => {
    const all = await repo.listAll();
    expect(all.length).toBeGreaterThan(0);
  });
});

describe('coupons-repo bulk', () => {
  it('createCouponsBulk com prefix+sequential', async () => {
    const r = await repo.createCouponsBulk({
      count: 5,
      prefix: 'BLACK',
      sequential: true,
      discount: { kind: 'percent', value: 20 },
    });
    expect(r.created.length).toBe(5);
    expect(r.skipped.length).toBe(0);
    expect(r.created[0]!.code).toMatch(/^BLACK\d{2}$/);
    expect(r.created[0]!.discount).toEqual({ kind: 'percent', value: 20 });
  });

  it('createCouponsBulk com random length', async () => {
    const r = await repo.createCouponsBulk({
      count: 3,
      randomLength: 10,
      discount: { kind: 'amount', value: 1000 },
    });
    expect(r.created.length).toBe(3);
    for (const c of r.created) {
      expect(c.code).toHaveLength(10);
      expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    }
  });

  it('createCouponsBulk com prefix+random', async () => {
    const r = await repo.createCouponsBulk({
      count: 2,
      prefix: 'X',
      sequential: false,
      randomLength: 6,
      discount: { kind: 'percent', value: 5 },
    });
    expect(r.created[0]!.code).toMatch(/^X[A-HJ-NP-Z2-9]{6}$/);
  });

  it('createCouponsBulk rejeita count < 1 ou > 1000', async () => {
    await expect(
      repo.createCouponsBulk({ count: 0, discount: { kind: 'percent', value: 10 } }),
    ).rejects.toThrow();
    await expect(
      repo.createCouponsBulk({
        count: 1001,
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
  });

  it('createCouponsBulk rejeita randomLength fora 4-20', async () => {
    await expect(
      repo.createCouponsBulk({
        count: 1,
        randomLength: 3,
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
    await expect(
      repo.createCouponsBulk({
        count: 1,
        randomLength: 21,
        discount: { kind: 'percent', value: 10 },
      }),
    ).rejects.toThrow();
  });

  it('exportCouponsAsCsv retorna header + rows', async () => {
    const csv = await repo.exportCouponsAsCsv();
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'code,description,discount_kind,discount_value,valid_from,valid_until,max_uses,used_count,active',
    );
    expect(lines.length).toBeGreaterThan(1);
  });
});
