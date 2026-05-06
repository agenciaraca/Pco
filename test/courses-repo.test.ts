import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/repositories/courses');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cur-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  repo = await import('../server/repositories/courses');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/courses', () => {
  it('listCourses retorna seed na 1ª leitura', async () => {
    const list = await repo.listCourses();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.id && c.title)).toBe(true);
  });

  it('findCourse retorna null para id inexistente', async () => {
    expect(await repo.findCourse('curso-fictio')).toBeNull();
  });

  it('findCourse retorna course existente', async () => {
    const list = await repo.listCourses();
    const first = list[0]!;
    const found = await repo.findCourse(first.id);
    expect(found!.id).toBe(first.id);
  });

  it('updateCourse altera campos', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const u = await repo.updateCourse(c.id, {
      title: 'Novo título alterado',
      shortTitle: 'NTA',
    });
    expect(u!.title).toBe('Novo título alterado');
    expect(u!.shortTitle).toBe('NTA');
  });

  it('updateCourse com tags', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const u = await repo.updateCourse(c.id, { tags: ['novo', 'destaque'] });
    expect(u!.tags).toEqual(['novo', 'destaque']);
  });

  it('createModule adiciona módulo a curso', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, {
      title: 'Módulo teste',
      description: 'desc',
      order: 99,
    });
    expect(m!.id).toContain(c.id);
    expect(m!.title).toBe('Módulo teste');
    // o curso agora tem um módulo a mais
    const after = await repo.findCourse(c.id);
    expect(after!.modules.some((mm) => mm.id === m!.id)).toBe(true);
  });

  it('updateModule altera título', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, {
      title: 'Update Mod',
      order: 100,
    });
    const u = await repo.updateModule(m!.id, { title: 'Atualizado' });
    expect(u!.title).toBe('Atualizado');
  });

  it('createLesson adiciona aula a módulo', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, { title: 'M', order: 200 });
    const l = await repo.createLesson(m!.id, {
      title: 'Aula 1',
      durationMinutes: 30,
      order: 1,
      isMandatory: true,
    });
    expect(l!.id).toContain(m!.id);
    expect(l!.durationMinutes).toBe(30);
    const c2 = await repo.findCourse(c.id);
    const m2 = c2!.modules.find((x) => x.id === m!.id);
    expect(m2!.lessons.some((ll) => ll.id === l!.id)).toBe(true);
  });

  it('updateLesson altera campos', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, { title: 'M', order: 300 });
    const l = await repo.createLesson(m!.id, {
      title: 'L1',
      durationMinutes: 30,
      order: 1,
      isMandatory: true,
    });
    const u = await repo.updateLesson(l!.id, {
      title: 'L1 atualizado',
      durationMinutes: 45,
    });
    expect(u!.title).toBe('L1 atualizado');
    expect(u!.durationMinutes).toBe(45);
  });

  it('deleteLesson remove + retorna true; segunda false', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, { title: 'M', order: 400 });
    const l = await repo.createLesson(m!.id, {
      title: 'L del',
      durationMinutes: 10,
      order: 1,
      isMandatory: false,
    });
    expect(await repo.deleteLesson(l!.id)).toBe(true);
    expect(await repo.deleteLesson(l!.id)).toBe(false);
  });

  it('deleteModule remove + retorna true', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, { title: 'Del', order: 500 });
    expect(await repo.deleteModule(m!.id)).toBe(true);
  });

  it('duplicateCourse clona com novo id, "Cópia de" no título', async () => {
    const list = await repo.listCourses();
    const original = list.find((c) => c.modules.length > 0)!;
    const dup = await repo.duplicateCourse(original.id);
    expect(dup!.id).not.toBe(original.id);
    expect(dup!.title).toContain('Cópia');
    expect(dup!.modules.length).toBe(original.modules.length);
    // módulos têm IDs novos
    const newIds = dup!.modules.map((m) => m.id);
    const oldIds = original.modules.map((m) => m.id);
    expect(newIds.every((id) => !oldIds.includes(id))).toBe(true);
  });

  it('duplicateCourse retorna null pra id inexistente', async () => {
    expect(await repo.duplicateCourse('nada')).toBeNull();
  });

  it('upsertAssessment cria + atualiza no mesmo módulo', async () => {
    const list = await repo.listCourses();
    const c = list[0]!;
    const m = await repo.createModule(c.id, { title: 'Asm', order: 600 });
    const a1 = await repo.upsertAssessment(m!.id, {
      title: 'Quiz 1',
      questionCount: 5,
      passingScore: 60,
    });
    expect(a1!.title).toBe('Quiz 1');
    const a2 = await repo.upsertAssessment(m!.id, {
      title: 'Quiz 1 atualizado',
      questionCount: 10,
      passingScore: 70,
    });
    expect(a2!.title).toBe('Quiz 1 atualizado');
    expect(a2!.id).toBe(a1!.id); // mesmo id (upsert)
  });
});
