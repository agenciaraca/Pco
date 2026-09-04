import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let notes: typeof import('../server/repositories/lesson-notes');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-notes-'));
  process.env.DATA_DIR = tmpDir;
  notes = await import('../server/repositories/lesson-notes');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('lesson-notes', () => {
  it('upsertNote cria entry nova', async () => {
    const n = await notes.upsertNote('u-1', 'l-1', 'minha nota');
    expect(n.userId).toBe('u-1');
    expect(n.lessonId).toBe('l-1');
    expect(n.content).toBe('minha nota');
  });

  it('upsertNote atualiza ao invés de duplicar', async () => {
    await notes.upsertNote('u-up', 'l-up', 'v1');
    await notes.upsertNote('u-up', 'l-up', 'v2');
    const n = await notes.getNote('u-up', 'l-up');
    expect(n!.content).toBe('v2');
    const list = await notes.listForUser('u-up');
    expect(list.filter((x) => x.lessonId === 'l-up')).toHaveLength(1);
  });

  it('getNote retorna null se não existe', async () => {
    expect(await notes.getNote('u-virgem', 'l-x')).toBeNull();
  });

  it('listForUser isola por userId', async () => {
    await notes.upsertNote('u-A', 'l-1', 'A');
    await notes.upsertNote('u-A', 'l-2', 'A2');
    await notes.upsertNote('u-B', 'l-1', 'B');
    const a = await notes.listForUser('u-A');
    expect(naoVazio(a).every((n) => n.userId === 'u-A')).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it('deleteNote remove + retorna true; segunda false', async () => {
    await notes.upsertNote('u-del', 'l-del', 'x');
    expect(await notes.deleteNote('u-del', 'l-del')).toBe(true);
    expect(await notes.deleteNote('u-del', 'l-del')).toBe(false);
    expect(await notes.getNote('u-del', 'l-del')).toBeNull();
  });

  it('updatedAt muda no update', async () => {
    const a = await notes.upsertNote('u-ts', 'l-ts', 'v1');
    await new Promise((r) => setTimeout(r, 10));
    const b = await notes.upsertNote('u-ts', 'l-ts', 'v2');
    expect(b.updatedAt > a.updatedAt).toBe(true);
  });
});
