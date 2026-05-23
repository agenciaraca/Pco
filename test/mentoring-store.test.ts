import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/mentoring/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mentoring-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/mentoring/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await store._resetForTests();
});

const base = {
  courseId: 'c-psi',
  instructorName: 'Prof. Silva',
  bookingUrl: 'https://calendly.com/silva/mentoria',
  provider: 'calendly' as const,
  description: 'Supervisao clinica',
  durationMinutes: 50,
};

describe('mentoring store', () => {
  it('cria config com ID mnt-*', async () => {
    const cfg = await store.create(base);
    expect(cfg.id).toMatch(/^mnt-/);
    expect(cfg.instructorName).toBe('Prof. Silva');
    expect(cfg.bookingUrl).toContain('calendly.com');
    expect(cfg.active).toBe(true);
  });

  it('listAll retorna todas', async () => {
    await store.create(base);
    await store.create({ ...base, instructorName: 'Prof. Santos' });
    const all = await store.listAll();
    expect(all.length).toBe(2);
  });

  it('listByCourse filtra por courseId e active', async () => {
    await store.create(base);
    await store.create({ ...base, courseId: 'c-tfs' });
    const psi = await store.listByCourse('c-psi');
    expect(psi.length).toBe(1);
    expect(psi[0].courseId).toBe('c-psi');
  });

  it('update altera campos', async () => {
    const cfg = await store.create(base);
    const updated = await store.update(cfg.id, {
      instructorName: 'Prof. Atualizado',
      durationMinutes: 60,
    });
    expect(updated).not.toBeNull();
    expect(updated!.instructorName).toBe('Prof. Atualizado');
    expect(updated!.durationMinutes).toBe(60);
  });

  it('update active=false esconde de listByCourse', async () => {
    const cfg = await store.create(base);
    await store.update(cfg.id, { active: false });
    const active = await store.listByCourse('c-psi');
    expect(active.length).toBe(0);
  });

  it('remove deleta config', async () => {
    const cfg = await store.create(base);
    const ok = await store.remove(cfg.id);
    expect(ok).toBe(true);
    const all = await store.listAll();
    expect(all.length).toBe(0);
  });

  it('remove retorna false pra ID inexistente', async () => {
    const ok = await store.remove('mnt-nope');
    expect(ok).toBe(false);
  });

  it('findById encontra config existente', async () => {
    const cfg = await store.create(base);
    const found = await store.findById(cfg.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(cfg.id);
  });
});
