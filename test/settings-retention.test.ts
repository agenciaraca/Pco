import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let settings: typeof import('../server/repositories/settings');
let retention: typeof import('../server/repositories/retention');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-set-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  settings = await import('../server/repositories/settings');
  retention = await import('../server/repositories/retention');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/settings', () => {
  it('getSettings retorna defaults', async () => {
    const s = await settings.getSettings();
    expect(s.siteName).toContain('AVA PCO');
    expect(s.timezone).toBe('America/Sao_Paulo');
    expect(s.contactEmail).toContain('@');
  });

  it('updateSettings faz merge + bumpa updatedAt', async () => {
    const before = await settings.getSettings();
    await new Promise((r) => setTimeout(r, 5));
    const after = await settings.updateSettings({
      siteName: 'Novo nome',
      whatsappNumber: '5511999999999',
    });
    expect(after.siteName).toBe('Novo nome');
    expect(after.whatsappNumber).toBe('5511999999999');
    expect(after.timezone).toBe(before.timezone); // não tocado
    expect(after.updatedAt > before.updatedAt).toBe(true);
  });

  it('updateSettings persiste através de leituras', async () => {
    await settings.updateSettings({ helpEmail: 'help@x.com' });
    const r = await settings.getSettings();
    expect(r.helpEmail).toBe('help@x.com');
  });
});

describe('repositories/retention', () => {
  it('listRetentionRisks retorna seed', async () => {
    const list = await retention.listRetentionRisks();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.studentId && r.level)).toBe(true);
  });

  it('listRetentionRisks com level filtra', async () => {
    const all = await retention.listRetentionRisks();
    const levels = new Set(all.map((r) => r.level));
    if (levels.has('alto')) {
      const high = await retention.listRetentionRisks('alto');
      expect(naoVazio(high).every((r) => r.level === 'alto')).toBe(true);
    }
  });

  it('listRetentionRisks level=todos retorna tudo', async () => {
    const all = await retention.listRetentionRisks();
    const todos = await retention.listRetentionRisks('todos');
    expect(todos.length).toBe(all.length);
  });

  it('items contém campos obrigatórios (studentId, score, level, reasons)', async () => {
    const list = await retention.listRetentionRisks();
    for (const r of list) {
      expect(typeof r.studentId).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(['baixo', 'medio', 'alto', 'critico']).toContain(r.level);
      expect(Array.isArray(r.reasons)).toBe(true);
    }
  });
});
