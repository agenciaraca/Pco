import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let watchTimeRepo: typeof import('../server/repositories/watch-time');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-wt-'));
  process.env.DATA_DIR = tmpDir;
  watchTimeRepo = await import('../server/repositories/watch-time');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('getLastWatchedForUser', () => {
  it('retorna null quando user sem entries', async () => {
    const r = await watchTimeRepo.getLastWatchedForUser('u-vazio');
    expect(r).toBeNull();
  });

  it('retorna a entry mais recente do user', async () => {
    await watchTimeRepo.addChunk({
      userId: 'u1',
      lessonId: 'l1',
      courseId: 'c1',
      deltaSeconds: 30,
    });
    // pequena espera pra timestamps diferirem
    await new Promise((r) => setTimeout(r, 10));
    await watchTimeRepo.addChunk({
      userId: 'u1',
      lessonId: 'l2',
      courseId: 'c1',
      deltaSeconds: 30,
    });
    await new Promise((r) => setTimeout(r, 10));
    await watchTimeRepo.addChunk({
      userId: 'u1',
      lessonId: 'l3',
      courseId: 'c2',
      deltaSeconds: 30,
    });

    const last = await watchTimeRepo.getLastWatchedForUser('u1');
    expect(last).not.toBeNull();
    expect(last!.lessonId).toBe('l3');
    expect(last!.courseId).toBe('c2');
  });

  it('isola entries por user', async () => {
    await watchTimeRepo.addChunk({
      userId: 'u2',
      lessonId: 'lx',
      courseId: 'cx',
      deltaSeconds: 30,
    });
    const last = await watchTimeRepo.getLastWatchedForUser('u2');
    expect(last!.lessonId).toBe('lx');
    const lastU1 = await watchTimeRepo.getLastWatchedForUser('u1');
    expect(lastU1!.lessonId).not.toBe('lx');
  });
});
