import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let paths: typeof import('../server/repositories/study-paths');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-paths-http-'));
  process.env.DATA_DIR = tmpDir;
  paths = await import('../server/repositories/study-paths');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await paths._resetForTests();
});

describe('study-paths field validations', () => {
  it('coverColor default quando não passado', async () => {
    const p = await paths.createPath({ slug: 'aa', title: 'A' });
    expect(p.coverColor).toBe('from-pco-blue to-pco-cyan');
  });

  it('aceita coverColor custom', async () => {
    const p = await paths.createPath({
      slug: 'cor',
      title: 'C',
      coverColor: 'from-purple-600 to-pink-500',
    });
    expect(p.coverColor).toBe('from-purple-600 to-pink-500');
  });

  it('active e publicVisible default true', async () => {
    const p = await paths.createPath({ slug: 'def', title: 'D' });
    expect(p.active).toBe(true);
    expect(p.publicVisible).toBe(true);
  });

  it('aceita active=false e publicVisible=false', async () => {
    const p = await paths.createPath({
      slug: 'hidden',
      title: 'H',
      active: false,
      publicVisible: false,
    });
    expect(p.active).toBe(false);
    expect(p.publicVisible).toBe(false);
  });

  it('updatePath aceita patch parcial', async () => {
    const p = await paths.createPath({
      slug: 'partial',
      title: 'P',
      courseIds: ['c1', 'c2'],
    });
    await paths.updatePath(p.id, { active: false });
    const u = await paths.findById(p.id);
    expect(u?.active).toBe(false);
    expect(u?.courseIds).toEqual(['c1', 'c2']); // preservado
    expect(u?.title).toBe('P'); // preservado
  });

  it('updatePath rejeita courseIds inválido', async () => {
    const p = await paths.createPath({ slug: 'inv', title: 'I' });
    const tooMany = Array.from({ length: 31 }, (_, i) => `c${i}`);
    await expect(
      paths.updatePath(p.id, { courseIds: tooMany }),
    ).rejects.toMatchObject({ code: 'INVALID_COURSES' });
  });

  it('listPaths ordena por título alfabético', async () => {
    await paths.createPath({ slug: 'beta', title: 'Beta' });
    await paths.createPath({ slug: 'alfa', title: 'Alfa' });
    await paths.createPath({ slug: 'gama', title: 'Gama' });
    const all = await paths.listPaths();
    expect(all.map((p) => p.title)).toEqual(['Alfa', 'Beta', 'Gama']);
  });

  it('updatedAt é bumped após updatePath', async () => {
    const p = await paths.createPath({ slug: 'updt', title: 'U' });
    const before = p.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await paths.updatePath(p.id, { title: 'U2' });
    const after = await paths.findById(p.id);
    expect(after!.updatedAt).not.toBe(before);
  });
});

describe('computePathProgress edge cases', () => {
  it('mantém ordem ao retornar status (não reordena por completude)', () => {
    const r = paths.computePathProgress(
      { id: 'p', courseIds: ['c1', 'c2', 'c3'] },
      ['c2'],
    );
    expect(r.status.map((s) => s.courseId)).toEqual(['c1', 'c2', 'c3']);
    expect(r.status.map((s) => s.completed)).toEqual([false, true, false]);
  });

  it('completedCourseIds com IDs não-do-path são ignorados', () => {
    const r = paths.computePathProgress(
      { id: 'p', courseIds: ['c1'] },
      ['c1', 'c-other'],
    );
    expect(r.completedCourses).toBe(1);
    expect(r.done).toBe(true);
  });
});
