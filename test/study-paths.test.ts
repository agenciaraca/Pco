import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let paths: typeof import('../server/repositories/study-paths');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-paths-'));
  process.env.DATA_DIR = tmpDir;
  paths = await import('../server/repositories/study-paths');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await paths._resetForTests();
});

describe('study-paths', () => {
  describe('createPath', () => {
    it('cria com slug normalizado e defaults', async () => {
      const p = await paths.createPath({ slug: 'Foundations 101!', title: 'Fundamentos' });
      expect(p.slug).toBe('foundations-101');
      expect(p.title).toBe('Fundamentos');
      expect(p.active).toBe(true);
      expect(p.publicVisible).toBe(true);
      expect(p.courseIds).toEqual([]);
    });

    it('rejeita slug duplicado', async () => {
      await paths.createPath({ slug: 'aa', title: 'A' });
      await expect(paths.createPath({ slug: 'aa', title: 'B' })).rejects.toMatchObject({
        code: 'SLUG_TAKEN',
      });
    });

    it('rejeita slug curto', async () => {
      await expect(paths.createPath({ slug: 'a', title: 'X' })).rejects.toMatchObject({
        code: 'INVALID_SLUG',
      });
    });

    it('rejeita título vazio', async () => {
      await expect(paths.createPath({ slug: 'xx', title: '' })).rejects.toMatchObject({
        code: 'INVALID_TITLE',
      });
    });

    it('deduplica courseIds', async () => {
      const p = await paths.createPath({
        slug: 'dupe',
        title: 'Dupe',
        courseIds: ['c1', 'c2', 'c1'],
      });
      expect(p.courseIds).toEqual(['c1', 'c2']);
    });

    it('rejeita > 30 cursos', async () => {
      const ids = Array.from({ length: 31 }, (_, i) => `c${i}`);
      await expect(
        paths.createPath({ slug: 'big', title: 'Big', courseIds: ids }),
      ).rejects.toMatchObject({ code: 'INVALID_COURSES' });
    });
  });

  describe('updatePath', () => {
    it('atualiza title/description/courseIds', async () => {
      const p = await paths.createPath({ slug: 'trilha-1', title: 'T' });
      const u = await paths.updatePath(p.id, {
        title: 'Trilha Atualizada',
        description: 'Nova descrição',
        courseIds: ['c1'],
      });
      expect(u.title).toBe('Trilha Atualizada');
      expect(u.description).toBe('Nova descrição');
      expect(u.courseIds).toEqual(['c1']);
    });

    it('NOT_FOUND quando id não existe', async () => {
      await expect(
        paths.updatePath('path-inexistente', { title: 'X' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('deletePath', () => {
    it('deleta e retorna true', async () => {
      const p = await paths.createPath({ slug: 'del', title: 'D' });

      expect(await paths.deletePath(p.id)).toBe(true);
      expect(await paths.findById(p.id)).toBeNull();
    });

    it('retorna false se não existe', async () => {
      expect(await paths.deletePath('nope')).toBe(false);
    });
  });

  describe('listPublicPaths', () => {
    it('filtra por active && publicVisible', async () => {
      await paths.createPath({ slug: 'aa', title: 'A' });
      await paths.createPath({ slug: 'bb', title: 'B', active: false });
      await paths.createPath({ slug: 'cc', title: 'C', publicVisible: false });
      const pub = await paths.listPublicPaths();
      expect(pub).toHaveLength(1);
      expect(pub[0].slug).toBe('aa');
    });
  });

  describe('computePathProgress', () => {
    it('todos cursos completos → done=true', () => {
      const p = paths.computePathProgress(
        { id: 'p1', courseIds: ['c1', 'c2'] },
        ['c1', 'c2'],
      );
      expect(p.done).toBe(true);
      expect(p.completedCourses).toBe(2);
      expect(p.nextCourseId).toBeNull();
    });

    it('parcial → next aponta primeiro pendente na ordem', () => {
      const p = paths.computePathProgress(
        { id: 'p1', courseIds: ['c1', 'c2', 'c3'] },
        ['c2'],
      );
      expect(p.done).toBe(false);
      expect(p.completedCourses).toBe(1);
      expect(p.nextCourseId).toBe('c1');
    });

    it('nenhum completo → next é o primeiro', () => {
      const p = paths.computePathProgress(
        { id: 'p1', courseIds: ['c1', 'c2'] },
        [],
      );
      expect(p.nextCourseId).toBe('c1');
      expect(p.done).toBe(false);
    });

    it('trilha vazia → done=false (não conta como concluída)', () => {
      const p = paths.computePathProgress({ id: 'p1', courseIds: [] }, []);
      expect(p.done).toBe(false);
      expect(p.totalCourses).toBe(0);
    });
  });
});
