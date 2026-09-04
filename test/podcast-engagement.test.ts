import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let pe: typeof import('../server/repositories/podcast-engagement');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-pe-'));
  process.env.DATA_DIR = tmpDir;
  pe = await import('../server/repositories/podcast-engagement');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('podcast-engagement', () => {
  it('upsert cria entry nova com defaults', async () => {
    const e = await pe.upsert('u-1', 'ep-1', { listened: true });
    expect(e.userId).toBe('u-1');
    expect(e.episodeId).toBe('ep-1');
    expect(e.listened).toBe(true);
    expect(e.favorite).toBe(false);
  });

  it('upsert atualiza ao invés de duplicar', async () => {
    await pe.upsert('u-up', 'ep-up', { listened: true });
    await pe.upsert('u-up', 'ep-up', { favorite: true });
    const e = await pe.get('u-up', 'ep-up');
    expect(e!.listened).toBe(true);
    expect(e!.favorite).toBe(true);
    const list = await pe.listForUser('u-up');
    expect(list.length).toBe(1);
  });

  it('get retorna null se inexistente', async () => {
    expect(await pe.get('virgem', 'ep-x')).toBeNull();
  });

  it('listForUser isola por userId', async () => {
    await pe.upsert('u-A', 'ep-1', { listened: true });
    await pe.upsert('u-B', 'ep-1', { listened: true });
    const a = await pe.listForUser('u-A');
    expect(naoVazio(a).every((e) => e.userId === 'u-A')).toBe(true);
  });

  it('upsert default vazio cria com listened+favorite=false', async () => {
    const e = await pe.upsert('u-empty', 'ep-empty', {});
    expect(e.listened).toBe(false);
    expect(e.favorite).toBe(false);
  });
});
