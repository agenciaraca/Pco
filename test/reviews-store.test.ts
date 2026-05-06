import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/reviews/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-revs-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/reviews/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('reviews/store', () => {
  it('upsertReview cria novo', async () => {
    const r = await store.upsertReview({
      courseId: 'c-1',
      userId: 'u-1',
      userEmail: 'u1@x.com',
      userName: 'João',
      rating: 5,
      comment: 'Excelente',
    });
    expect(r.id).toMatch(/^rev-/);
    expect(r.rating).toBe(5);
    expect(r.comment).toBe('Excelente');
    expect(r.createdAt).toBe(r.updatedAt);
  });

  it('upsertReview com mesmo (course,user) atualiza ao invés de duplicar', async () => {
    const a = await store.upsertReview({
      courseId: 'c-2',
      userId: 'u-1',
      userEmail: 'u1@x.com',
      userName: 'João',
      rating: 3,
    });
    const b = await store.upsertReview({
      courseId: 'c-2',
      userId: 'u-1',
      userEmail: 'u1@x.com',
      userName: 'João',
      rating: 4,
      comment: 'Mudei de ideia',
    });
    expect(b.id).toBe(a.id); // mesmo registro
    expect(b.rating).toBe(4);
    expect(b.comment).toBe('Mudei de ideia');
    // só uma entry pra esse par
    const list = await store.listForCourse('c-2');
    const mine = list.filter((r) => r.userId === 'u-1');
    expect(mine.length).toBe(1);
  });

  it('rating fora de 1..5 lança', async () => {
    await expect(
      store.upsertReview({
        courseId: 'c-x',
        userId: 'u-x',
        userEmail: 'x@x.com',
        userName: 'X',
        rating: 0,
      }),
    ).rejects.toThrow(/1 e 5/);
    await expect(
      store.upsertReview({
        courseId: 'c-x',
        userId: 'u-x',
        userEmail: 'x@x.com',
        userName: 'X',
        rating: 6,
      }),
    ).rejects.toThrow(/1 e 5/);
  });

  it('listForCourse ordena desc por createdAt', async () => {
    await store.upsertReview({
      courseId: 'c-list',
      userId: 'u-A',
      userEmail: 'a@x.com',
      userName: 'A',
      rating: 5,
    });
    await store.upsertReview({
      courseId: 'c-list',
      userId: 'u-B',
      userEmail: 'b@x.com',
      userName: 'B',
      rating: 4,
    });
    const list = await store.listForCourse('c-list');
    expect(list.length).toBe(2);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true);
    }
  });

  it('summary calcula avg + distribution', async () => {
    await store.upsertReview({
      courseId: 'c-stats',
      userId: 'sA',
      userEmail: 'a@x.com',
      userName: 'A',
      rating: 5,
    });
    await store.upsertReview({
      courseId: 'c-stats',
      userId: 'sB',
      userEmail: 'b@x.com',
      userName: 'B',
      rating: 4,
    });
    await store.upsertReview({
      courseId: 'c-stats',
      userId: 'sC',
      userEmail: 'c@x.com',
      userName: 'C',
      rating: 3,
    });
    const s = await store.summary('c-stats');
    expect(s.count).toBe(3);
    expect(s.avg).toBe(4); // (5+4+3)/3 = 4.0
    expect(s.distribution[5]).toBe(1);
    expect(s.distribution[4]).toBe(1);
    expect(s.distribution[3]).toBe(1);
    expect(s.distribution[2]).toBe(0);
    expect(s.distribution[1]).toBe(0);
  });

  it('summary curso sem reviews retorna count=0, avg=0', async () => {
    const s = await store.summary('c-empty');
    expect(s.count).toBe(0);
    expect(s.avg).toBe(0);
  });

  it('avg arredonda 1 casa decimal', async () => {
    await store.upsertReview({
      courseId: 'c-rnd',
      userId: 'r1',
      userEmail: '1@x.com',
      userName: '1',
      rating: 5,
    });
    await store.upsertReview({
      courseId: 'c-rnd',
      userId: 'r2',
      userEmail: '2@x.com',
      userName: '2',
      rating: 4,
    });
    await store.upsertReview({
      courseId: 'c-rnd',
      userId: 'r3',
      userEmail: '3@x.com',
      userName: '3',
      rating: 4,
    });
    const s = await store.summary('c-rnd');
    // (5+4+4)/3 = 4.333... → 4.3
    expect(s.avg).toBe(4.3);
  });

  it('findMine retorna review do user específico', async () => {
    await store.upsertReview({
      courseId: 'c-find',
      userId: 'find-me',
      userEmail: 'me@x.com',
      userName: 'Me',
      rating: 5,
    });
    const mine = await store.findMine('c-find', 'find-me');
    expect(mine).not.toBeNull();
    expect(mine!.userId).toBe('find-me');
    // outro user → null
    expect(await store.findMine('c-find', 'other-user')).toBeNull();
  });

  it('deleteReview remove + retorna true; segunda vez false', async () => {
    const r = await store.upsertReview({
      courseId: 'c-del',
      userId: 'u-del',
      userEmail: 'd@x.com',
      userName: 'D',
      rating: 1,
    });
    expect(await store.deleteReview(r.id)).toBe(true);
    expect(await store.deleteReview(r.id)).toBe(false);
    expect(await store.findMine('c-del', 'u-del')).toBeNull();
  });
});
