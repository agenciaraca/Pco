import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let history: typeof import('../server/repositories/tutor-history');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-tut-'));
  process.env.DATA_DIR = tmpDir;
  history = await import('../server/repositories/tutor-history');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('tutor-history', () => {
  it('recordTurn cria turno com id + ts', async () => {
    const t = await history.recordTurn({
      userId: 'u-1',
      prompt: 'O que é Édipo?',
      response: 'O complexo de Édipo...',
      provider: 'openai',
      model: 'gpt-4',
    });
    expect(t.id).toMatch(/^t-/);
    expect(t.ts).toMatch(/T.*Z$/);
    expect(t.prompt).toBe('O que é Édipo?');
  });

  it('listForUser isola por userId', async () => {
    await history.recordTurn({
      userId: 'u-A',
      prompt: 'p1',
      response: 'r1',
      provider: null,
      model: null,
    });
    await history.recordTurn({
      userId: 'u-B',
      prompt: 'p2',
      response: 'r2',
      provider: null,
      model: null,
    });
    const a = await history.listForUser('u-A');
    const b = await history.listForUser('u-B');
    expect(naoVazio(a).every((t) => t.userId === 'u-A')).toBe(true);
    expect(naoVazio(b).every((t) => t.userId === 'u-B')).toBe(true);
  });

  it('listForUser respeita limit', async () => {
    for (let i = 0; i < 5; i++) {
      await history.recordTurn({
        userId: 'u-many',
        prompt: `p${i}`,
        response: `r${i}`,
        provider: null,
        model: null,
      });
    }
    const r = await history.listForUser('u-many', 2);
    expect(r.length).toBe(2);
  });

  it('clearForUser remove apenas turnos do user e retorna count', async () => {
    await history.recordTurn({
      userId: 'u-clear',
      prompt: 'p',
      response: 'r',
      provider: null,
      model: null,
    });
    await history.recordTurn({
      userId: 'u-clear',
      prompt: 'p2',
      response: 'r2',
      provider: null,
      model: null,
    });
    await history.recordTurn({
      userId: 'u-keep',
      prompt: 'k',
      response: 'kr',
      provider: null,
      model: null,
    });
    const removed = await history.clearForUser('u-clear');
    expect(removed).toBe(2);
    expect(await history.listForUser('u-clear')).toEqual([]);
    // u-keep não tocado
    expect((await history.listForUser('u-keep')).length).toBe(1);
  });

  it('clearForUser sem turnos retorna 0', async () => {
    expect(await history.clearForUser('user-virgem')).toBe(0);
  });

  it('usageStats agrega counts por dia + uniqueUsers + topUsers', async () => {
    await history.recordTurn({
      userId: 'top-A',
      prompt: 'a',
      response: 'a',
      provider: null,
      model: null,
    });
    await history.recordTurn({
      userId: 'top-A',
      prompt: 'a',
      response: 'a',
      provider: null,
      model: null,
    });
    await history.recordTurn({
      userId: 'top-B',
      prompt: 'b',
      response: 'b',
      provider: null,
      model: null,
    });
    const s = await history.usageStats(7);
    expect(s.totalTurns).toBeGreaterThan(0);
    expect(s.uniqueUsers).toBeGreaterThanOrEqual(2);
    expect(s.byDay.length).toBe(7);
    expect(s.topUsers.length).toBeLessThanOrEqual(10);
    // top-A com 2 turns deve estar no top
    const top = s.topUsers.find((u) => u.userId === 'top-A');
    expect(top!.count).toBeGreaterThanOrEqual(2);
  });

  it('usageStats byDay tem entrada pra hoje', async () => {
    const s = await history.usageStats(1);
    expect(s.byDay.length).toBe(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(s.byDay[0]!.day).toBe(today);
  });

  it('listAll retorna tudo (cross-user)', async () => {
    const all = await history.listAll();
    expect(all.length).toBeGreaterThan(0);
    const userIds = new Set(all.map((t) => t.userId));
    expect(userIds.size).toBeGreaterThan(1);
  });
});
