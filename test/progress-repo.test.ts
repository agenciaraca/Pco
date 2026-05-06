import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/repositories/progress');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-prog-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/repositories/progress');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/progress', () => {
  it('markCompleted cria entrada com timestamp', async () => {
    const r = await repo.markCompleted({
      userId: 'u-1',
      lessonId: 'l-1',
      courseId: 'c-1',
      moduleId: 'm-1',
    });
    expect(r.userId).toBe('u-1');
    expect(r.lessonId).toBe('l-1');
    expect(r.completedAt).toMatch(/T.*Z$/);
  });

  it('markCompleted é idempotente — segunda chamada retorna mesmo registro', async () => {
    const a = await repo.markCompleted({
      userId: 'u-idem',
      lessonId: 'l-idem',
      courseId: 'c',
      moduleId: 'm',
    });
    const b = await repo.markCompleted({
      userId: 'u-idem',
      lessonId: 'l-idem',
      courseId: 'c',
      moduleId: 'm',
    });
    expect(a.completedAt).toBe(b.completedAt);
  });

  it('isCompleted true após mark', async () => {
    await repo.markCompleted({
      userId: 'u-2',
      lessonId: 'l-x',
      courseId: 'c',
      moduleId: 'm',
    });
    expect(await repo.isCompleted('u-2', 'l-x')).toBe(true);
    expect(await repo.isCompleted('u-2', 'l-nada')).toBe(false);
  });

  it('getCompletedLessons retorna lista de lessonIds do user', async () => {
    await repo.markCompleted({
      userId: 'u-list',
      lessonId: 'l-1',
      courseId: 'c',
      moduleId: 'm',
    });
    await repo.markCompleted({
      userId: 'u-list',
      lessonId: 'l-2',
      courseId: 'c',
      moduleId: 'm',
    });
    const l = await repo.getCompletedLessons('u-list');
    expect(l).toContain('l-1');
    expect(l).toContain('l-2');
  });

  it('listForUser isola por userId', async () => {
    await repo.markCompleted({
      userId: 'u-A',
      lessonId: 'l-A',
      courseId: 'c',
      moduleId: 'm',
    });
    await repo.markCompleted({
      userId: 'u-B',
      lessonId: 'l-B',
      courseId: 'c',
      moduleId: 'm',
    });
    const a = await repo.listForUser('u-A');
    expect(a.every((p) => p.userId === 'u-A')).toBe(true);
  });

  it('unmarkCompleted remove + retorna true; segunda false', async () => {
    await repo.markCompleted({
      userId: 'u-rm',
      lessonId: 'l-rm',
      courseId: 'c',
      moduleId: 'm',
    });
    expect(await repo.unmarkCompleted('u-rm', 'l-rm')).toBe(true);
    expect(await repo.unmarkCompleted('u-rm', 'l-rm')).toBe(false);
    expect(await repo.isCompleted('u-rm', 'l-rm')).toBe(false);
  });

  it('distinctActivityDays conta dias únicos no período', async () => {
    // Em testes não conseguimos manipular completedAt direto via API,
    // mas sabemos que markCompleted usa hoje. Múltiplas lessons no mesmo
    // dia → 1 dia distinto.
    await repo.markCompleted({
      userId: 'u-streak',
      lessonId: 'l-1',
      courseId: 'c',
      moduleId: 'm',
    });
    await repo.markCompleted({
      userId: 'u-streak',
      lessonId: 'l-2',
      courseId: 'c',
      moduleId: 'm',
    });
    expect(await repo.distinctActivityDays('u-streak')).toBe(1);
  });

  it('distinctActivityDays = 0 sem activity', async () => {
    expect(await repo.distinctActivityDays('user-virgem')).toBe(0);
  });

  it('progressByCourse agrega por courseId', async () => {
    await repo.markCompleted({
      userId: 'u-pc',
      lessonId: 'l-c1-1',
      courseId: 'c-1',
      moduleId: 'm-1',
    });
    await repo.markCompleted({
      userId: 'u-pc',
      lessonId: 'l-c1-2',
      courseId: 'c-1',
      moduleId: 'm-1',
    });
    await repo.markCompleted({
      userId: 'u-pc',
      lessonId: 'l-c2-1',
      courseId: 'c-2',
      moduleId: 'm-2',
    });
    const r = await repo.progressByCourse('u-pc');
    expect(r['c-1']!.lessonsCompleted).toBe(2);
    expect(r['c-2']!.lessonsCompleted).toBe(1);
    expect(r['c-1']!.lastAt).not.toBeNull();
  });

  it('streakInfo retorna { current: 1, longest: 1 } com 1 lesson hoje', async () => {
    await repo.markCompleted({
      userId: 'u-sk',
      lessonId: 'l-sk',
      courseId: 'c',
      moduleId: 'm',
    });
    const s = await repo.streakInfo('u-sk');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.lastActiveDay).toBe(new Date().toISOString().slice(0, 10));
  });

  it('streakInfo zerado pra user sem activity', async () => {
    const s = await repo.streakInfo('u-novo');
    expect(s.current).toBe(0);
    expect(s.longest).toBe(0);
    expect(s.lastActiveDay).toBeNull();
  });

  it('completionsByDay tem entries pra todos os dias do período', async () => {
    const r = await repo.completionsByDay(7);
    expect(r.length).toBe(7);
    expect(r.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const t = r.find((d) => d.day === today);
    expect(t!.count).toBeGreaterThan(0);
  });

  it('listAll retorna tudo cross-user', async () => {
    const all = await repo.listAll();
    const userIds = new Set(all.map((p) => p.userId));
    expect(userIds.size).toBeGreaterThan(1);
  });
});
