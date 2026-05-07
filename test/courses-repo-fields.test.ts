// Verifica que updateCourse propaga corretamente todos os novos
// fields adicionados nesta sessão (sprints 482, 488, 489, 501, 504, 524).

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let courses: typeof import('../server/repositories/courses');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-courses-fields-'));
  process.env.DATA_DIR = tmpDir;
  courses = await import('../server/repositories/courses');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  // Não há _resetForTests no courses; usamos seed inicial
});

describe('updateCourse — propagação de fields novos', () => {
  it('propaga prerequisiteCourseIds (sprint 482)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    expect(c).toBeDefined();
    const updated = await courses.updateCourse(c.id, {
      prerequisiteCourseIds: ['c-base', 'c-intro'],
    });
    expect(updated?.prerequisiteCourseIds).toEqual(['c-base', 'c-intro']);
  });

  it('propaga learningOutcomes (sprint 488)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      learningOutcomes: ['Conceito A', 'Conceito B'],
    });
    expect(updated?.learningOutcomes).toEqual(['Conceito A', 'Conceito B']);
  });

  it('propaga instructor fields (sprint 489)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      instructorName: 'Dra. Maria',
      instructorBio: 'Psicanalista clínica há 15 anos',
      instructorPhotoUrl: 'https://example.com/maria.jpg',
    });
    expect(updated?.instructorName).toBe('Dra. Maria');
    expect(updated?.instructorBio).toContain('Psicanalista');
    expect(updated?.instructorPhotoUrl).toBe('https://example.com/maria.jpg');
  });

  it('propaga certificateTemplate (sprint 501)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      certificateTemplate: {
        title: 'Diploma',
        accentColor: '#ff0000',
      },
    });
    expect(updated?.certificateTemplate?.title).toBe('Diploma');
    expect(updated?.certificateTemplate?.accentColor).toBe('#ff0000');
  });

  it('propaga collaborators (sprint 504)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      collaborators: [
        { name: 'João', role: 'Co-autor' },
        { name: 'Ana', bio: 'Especialista em Lacan' },
      ],
    });
    expect(updated?.collaborators).toHaveLength(2);
    expect(updated?.collaborators?.[0].name).toBe('João');
    expect(updated?.collaborators?.[1].bio).toBe('Especialista em Lacan');
  });

  it('propaga changelog (sprint 524)', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      changelog: [
        {
          version: 'v2.0',
          date: '2026-05-01',
          notes: 'Novo módulo sobre Winnicott',
        },
      ],
    });
    expect(updated?.changelog).toHaveLength(1);
    expect(updated?.changelog?.[0].version).toBe('v2.0');
  });

  it('propagações múltiplas em uma chamada', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    const updated = await courses.updateCourse(c.id, {
      prerequisiteCourseIds: ['x'],
      learningOutcomes: ['a'],
      instructorName: 'Tutor',
      collaborators: [{ name: 'Co' }],
      changelog: [{ version: '1', date: '2026-01-01', notes: 'inicial' }],
    });
    expect(updated?.prerequisiteCourseIds).toEqual(['x']);
    expect(updated?.learningOutcomes).toEqual(['a']);
    expect(updated?.instructorName).toBe('Tutor');
    expect(updated?.collaborators).toHaveLength(1);
    expect(updated?.changelog).toHaveLength(1);
  });

  it('updateCourse em ID inexistente: retorna null', async () => {
    const updated = await courses.updateCourse('nonexistent-id-xyz', {
      title: 'X',
    });
    expect(updated).toBeNull();
  });

  it('updateCourse com patch vazio: preserva fields existentes', async () => {
    const all = await courses.listCourses();
    const c = all[0];
    await courses.updateCourse(c.id, { title: 'Title Original' });
    const updated = await courses.updateCourse(c.id, {});
    expect(updated?.title).toBe('Title Original');
  });
});
