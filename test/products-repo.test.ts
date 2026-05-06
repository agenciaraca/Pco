import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/payments/products-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-prod-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/products-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('products-repo', () => {
  it('createProduct gera id e defaults', async () => {
    const p = await repo.createProduct({
      kind: 'course',
      refId: 'c-1',
      name: 'Curso Teste',
      priceCents: 49900,
    });
    expect(p.id).toMatch(/^prod-/);
    expect(p.active).toBe(true);
    expect(p.currency).toBe('BRL');
    expect(p.priceCents).toBe(49900);
  });

  it('findByCourseId retorna apenas active + matching course', async () => {
    const p1 = await repo.createProduct({
      kind: 'course',
      refId: 'c-2',
      name: 'P1',
      priceCents: 100,
    });
    await repo.createProduct({
      kind: 'course',
      refId: 'c-2',
      name: 'P2 inactive',
      priceCents: 100,
      active: false,
    });
    const found = await repo.findByCourseId('c-2');
    expect(found!.id).toBe(p1.id);
  });

  it('listActive retorna apenas active', async () => {
    const all = await repo.listActive();
    expect(all.every((p) => p.active)).toBe(true);
  });

  it('updateProduct altera campos', async () => {
    const created = await repo.createProduct({
      kind: 'course',
      refId: 'c-up',
      name: 'Antes',
      priceCents: 1000,
    });
    const updated = await repo.updateProduct(created.id, {
      name: 'Depois',
      priceCents: 2000,
      active: false,
    });
    expect(updated!.name).toBe('Depois');
    expect(updated!.priceCents).toBe(2000);
    expect(updated!.active).toBe(false);
  });

  it('deleteProduct remove', async () => {
    const p = await repo.createProduct({
      kind: 'course',
      refId: 'c-del',
      name: 'Del',
      priceCents: 100,
    });
    const ok = await repo.deleteProduct(p.id);
    expect(ok).toBe(true);
    expect(await repo.findById(p.id)).toBeNull();
  });

  it('createProduct com kind=bundle e metadata.courseIds', async () => {
    const p = await repo.createProduct({
      kind: 'bundle',
      name: 'Pacote',
      priceCents: 99900,
      metadata: { courseIds: ['c-1', 'c-2'] },
    });
    expect(p.kind).toBe('bundle');
    expect(p.metadata).toEqual({ courseIds: ['c-1', 'c-2'] });
  });

  it('listAll retorna todos (active + inactive)', async () => {
    const all = await repo.listAll();
    expect(all.length).toBeGreaterThan(0);
  });
});
