import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let wt: typeof import('../server/repositories/watch-time');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-wta-'));
  process.env.DATA_DIR = tmpDir;
  wt = await import('../server/repositories/watch-time');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('watch-time addChunk + aggregates', () => {
  it('addChunk cria entry nova', async () => {
    const e = await wt.addChunk({
      userId: 'u-1',
      lessonId: 'l-1',
      courseId: 'c-1',
      deltaSeconds: 30,
    });
    expect(e.totalSeconds).toBe(30);
    expect(e.userId).toBe('u-1');
    expect(e.lessonId).toBe('l-1');
  });

  it('addChunk acumula em entry existente', async () => {
    await wt.addChunk({
      userId: 'u-acc',
      lessonId: 'l-acc',
      courseId: 'c',
      deltaSeconds: 30,
    });
    const e = await wt.addChunk({
      userId: 'u-acc',
      lessonId: 'l-acc',
      courseId: 'c',
      deltaSeconds: 30,
    });
    expect(e.totalSeconds).toBe(60);
  });

  it('addChunk faz cap em deltaSeconds (max 60)', async () => {
    const e = await wt.addChunk({
      userId: 'u-cap',
      lessonId: 'l-cap',
      courseId: 'c',
      deltaSeconds: 9999,
    });
    expect(e.totalSeconds).toBeLessThanOrEqual(60);
  });

  it('addChunk usa lessonDurationSeconds * 1.5 como cap quando fornecido', async () => {
    // duração 600s → cap 900s
    for (let i = 0; i < 20; i++) {
      await wt.addChunk({
        userId: 'u-dur',
        lessonId: 'l-dur',
        courseId: 'c',
        deltaSeconds: 60,
        lessonDurationSeconds: 600,
      });
    }
    const e = await wt.getEntry('u-dur', 'l-dur');
    expect(e!.totalSeconds).toBe(900); // capped
    expect(e!.maxAllowedSeconds).toBe(900);
  });

  it('addChunk negativo é zerado', async () => {
    const e = await wt.addChunk({
      userId: 'u-neg',
      lessonId: 'l-neg',
      courseId: 'c',
      deltaSeconds: -5,
    });
    expect(e.totalSeconds).toBe(0);
  });

  it('listForUser isola por userId', async () => {
    await wt.addChunk({
      userId: 'u-A',
      lessonId: 'l-1',
      courseId: 'c',
      deltaSeconds: 10,
    });
    await wt.addChunk({
      userId: 'u-B',
      lessonId: 'l-2',
      courseId: 'c',
      deltaSeconds: 10,
    });
    const a = await wt.listForUser('u-A');
    expect(naoVazio(a).every((e) => e.userId === 'u-A')).toBe(true);
  });

  it('aggregateLesson soma totalSeconds + uniqueViewers', async () => {
    await wt.addChunk({
      userId: 'u-agg-1',
      lessonId: 'l-agg',
      courseId: 'c-agg',
      deltaSeconds: 20,
    });
    await wt.addChunk({
      userId: 'u-agg-2',
      lessonId: 'l-agg',
      courseId: 'c-agg',
      deltaSeconds: 40,
    });
    const a = await wt.aggregateLesson('l-agg');
    expect(a.uniqueViewers).toBe(2);
    expect(a.totalSeconds).toBe(60);
    expect(a.avgSecondsPerViewer).toBe(30);
  });

  it('aggregateLesson sem viewers retorna zeros', async () => {
    const a = await wt.aggregateLesson('l-vazia');
    expect(a.uniqueViewers).toBe(0);
    expect(a.totalSeconds).toBe(0);
    expect(a.avgSecondsPerViewer).toBe(0);
  });

  it('aggregateCourse retorna byLesson + uniqueLearners', async () => {
    await wt.addChunk({
      userId: 'u-c-A',
      lessonId: 'l-c-1',
      courseId: 'c-cur',
      deltaSeconds: 20,
    });
    await wt.addChunk({
      userId: 'u-c-A',
      lessonId: 'l-c-2',
      courseId: 'c-cur',
      deltaSeconds: 30,
    });
    await wt.addChunk({
      userId: 'u-c-B',
      lessonId: 'l-c-1',
      courseId: 'c-cur',
      deltaSeconds: 40,
    });
    const a = await wt.aggregateCourse('c-cur');
    expect(a.uniqueLearners).toBe(2);
    expect(a.byLesson.length).toBe(2);
    const l1 = a.byLesson.find((b) => b.lessonId === 'l-c-1');
    expect(l1!.viewers).toBe(2);
    expect(l1!.totalSeconds).toBe(60);
  });

  it('getLastWatchedForUser retorna lesson com maior lastHeartbeatAt', async () => {
    await wt.addChunk({
      userId: 'u-last',
      lessonId: 'l-old',
      courseId: 'c',
      deltaSeconds: 10,
    });
    await new Promise((r) => setTimeout(r, 10));
    await wt.addChunk({
      userId: 'u-last',
      lessonId: 'l-new',
      courseId: 'c',
      deltaSeconds: 10,
    });
    const last = await wt.getLastWatchedForUser('u-last');
    expect(last!.lessonId).toBe('l-new');
  });

  it('getLastWatchedForUser null se sem entries', async () => {
    expect(await wt.getLastWatchedForUser('u-virgem')).toBeNull();
  });

  it('listForLesson filtra por lessonId', async () => {
    const list = await wt.listForLesson('l-c-1');
    expect(naoVazio(list).every((e) => e.lessonId === 'l-c-1')).toBe(true);
  });

  it('listForCourse filtra por courseId', async () => {
    const list = await wt.listForCourse('c-cur');
    expect(naoVazio(list).every((e) => e.courseId === 'c-cur')).toBe(true);
  });
});
