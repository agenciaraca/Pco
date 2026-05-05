import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/activity/wishlist-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-wish-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/activity/wishlist-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('wishlist-store', () => {
  it('add é idempotente', async () => {
    const e1 = await store.add('u1', 'c1');
    const e2 = await store.add('u1', 'c1');
    expect(e1.addedAt).toBe(e2.addedAt);
    const list = await store.listForUser('u1');
    expect(list.length).toBe(1);
  });

  it('listForUser separa por user', async () => {
    await store.add('u1', 'c2');
    await store.add('u2', 'c1');
    const u1List = await store.listForUser('u1');
    const u2List = await store.listForUser('u2');
    expect(u1List.length).toBe(2);
    expect(u2List.length).toBe(1);
  });

  it('remove apaga apenas a entrada certa', async () => {
    await store.remove('u1', 'c1');
    const u1List = await store.listForUser('u1');
    expect(u1List.length).toBe(1);
    expect(u1List[0]!.courseId).toBe('c2');
  });

  it('remove inexistente retorna false', async () => {
    const r = await store.remove('u-xxx', 'c-xxx');
    expect(r).toBe(false);
  });

  it('aggregateByCourse soma por curso e ordena desc', async () => {
    await store.add('u3', 'c1');
    await store.add('u4', 'c1');
    const agg = await store.aggregateByCourse();
    const c1 = agg.find((a) => a.courseId === 'c1');
    expect(c1).toBeDefined();
    expect(c1!.count).toBe(3); // u2, u3, u4
    // ordenado desc por count
    expect(agg[0]!.count).toBeGreaterThanOrEqual(agg[1]!.count);
  });

  it('isWished retorna true quando existe', async () => {
    expect(await store.isWished('u2', 'c1')).toBe(true);
    expect(await store.isWished('u-x', 'c-x')).toBe(false);
  });

  it('addedLastWeek conta apenas últimos 7 dias', async () => {
    const agg = await store.aggregateByCourse();
    const c1 = agg.find((a) => a.courseId === 'c1');
    expect(c1!.addedLastWeek).toBe(c1!.count); // tudo recente
  });
});
