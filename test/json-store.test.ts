import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let JsonStore: typeof import('../server/db/json-store').JsonStore;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-jstore-'));
  process.env.DATA_DIR = tmpDir;
  ({ JsonStore } = await import('../server/db/json-store'));
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

interface Item {
  id: string;
  value: number;
}

describe('db/json-store', () => {
  it('getAll retorna defaults quando arquivo não existe', async () => {
    const store = new JsonStore<Item>('test-defaults.json', () => [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
    const all = await store.getAll();
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe('a');
  });

  it('persiste arquivo no disco com mode 0600 (best-effort)', async () => {
    const store = new JsonStore<Item>('test-persist.json', () => []);
    await store.add({ id: '1', value: 100 });
    // dá tempo da fila de write rodar
    await new Promise((r) => setTimeout(r, 50));
    const filepath = path.join(tmpDir, 'test-persist.json');
    const raw = await fs.readFile(filepath, 'utf8');
    const parsed = JSON.parse(raw) as Item[];
    expect(parsed[0]!.value).toBe(100);
  });

  it('add insere no fim', async () => {
    const store = new JsonStore<Item>('test-add.json', () => []);
    await store.add({ id: '1', value: 1 });
    await store.add({ id: '2', value: 2 });
    const all = await store.getAll();
    expect(all.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('unshift insere no começo', async () => {
    const store = new JsonStore<Item>('test-unshift.json', () => []);
    await store.unshift({ id: '1', value: 1 });
    await store.unshift({ id: '2', value: 2 });
    const all = await store.getAll();
    expect(all.map((x) => x.id)).toEqual(['2', '1']);
  });

  it('update aplica mutator e retorna item atualizado', async () => {
    const store = new JsonStore<Item>('test-update.json', () => []);
    await store.add({ id: 'x', value: 10 });
    const u = await store.update(
      (i) => i.id === 'x',
      (i) => ({ ...i, value: 999 }),
    );
    expect(u!.value).toBe(999);
  });

  it('update retorna null se não encontra', async () => {
    const store = new JsonStore<Item>('test-update-null.json', () => []);
    const u = await store.update(
      () => false,
      (i) => i,
    );
    expect(u).toBeNull();
  });

  it('remove retorna true/false', async () => {
    const store = new JsonStore<Item>('test-remove.json', () => []);
    await store.add({ id: 'r', value: 1 });
    expect(await store.remove((i) => i.id === 'r')).toBe(true);
    expect(await store.remove((i) => i.id === 'r')).toBe(false);
  });

  it('findOne retorna item ou null', async () => {
    const store = new JsonStore<Item>('test-find.json', () => [
      { id: 'a', value: 1 },
    ]);
    const found = await store.findOne((i) => i.id === 'a');
    expect(found!.value).toBe(1);
    expect(await store.findOne((i) => i.id === 'no')).toBeNull();
  });

  it('filter aplica predicate', async () => {
    const store = new JsonStore<Item>('test-filter.json', () => [
      { id: 'a', value: 1 },
      { id: 'b', value: 5 },
      { id: 'c', value: 10 },
    ]);
    const r = await store.filter((i) => i.value >= 5);
    expect(r).toHaveLength(2);
  });

  it('mutate aplica em todos que casam + retorna count', async () => {
    const store = new JsonStore<Item>('test-mutate.json', () => [
      { id: '1', value: 0 },
      { id: '2', value: 0 },
      { id: '3', value: 5 },
    ]);
    const count = await store.mutate(
      (i) => i.value === 0,
      (i) => {
        i.value = 99;
      },
    );
    expect(count).toBe(2);
    const all = await store.getAll();
    expect(all.filter((i) => i.value === 99)).toHaveLength(2);
  });

  it('modify recebe array completo + retorna valor do mutator', async () => {
    const store = new JsonStore<Item>('test-modify.json', () => [
      { id: 'a', value: 1 },
    ]);
    const result = await store.modify((items) => {
      items.push({ id: 'b', value: 2 });
      return 'done';
    });
    expect(result).toBe('done');
    const all = await store.getAll();
    expect(all).toHaveLength(2);
  });

  it('setAll substitui toda a coleção', async () => {
    const store = new JsonStore<Item>('test-setall.json', () => [
      { id: 'old', value: 0 },
    ]);
    await store.setAll([{ id: 'new', value: 1 }]);
    const all = await store.getAll();
    expect(all).toEqual([{ id: 'new', value: 1 }]);
  });

  it('getAll devolve cópia (mutação não afeta store)', async () => {
    const store = new JsonStore<Item>('test-snapshot.json', () => [
      { id: 'a', value: 1 },
    ]);
    const a = await store.getAll();
    a.push({ id: 'b', value: 2 });
    const b = await store.getAll();
    expect(b).toHaveLength(1);
  });

  it('reload recupera dados do disco em nova instância', async () => {
    const store1 = new JsonStore<Item>('test-reload.json', () => []);
    await store1.add({ id: 'p', value: 42 });
    await new Promise((r) => setTimeout(r, 50));
    const store2 = new JsonStore<Item>('test-reload.json', () => []);
    const all = await store2.getAll();
    expect(all).toEqual([{ id: 'p', value: 42 }]);
  });
});
