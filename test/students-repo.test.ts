import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/repositories/students');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-stu-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  repo = await import('../server/repositories/students');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/students', () => {
  it('createAdminStudent gera id + status default ativo', async () => {
    const s = await repo.createAdminStudent({
      name: 'Maria Silva',
      email: 'maria@x.com',
      enrolledCourseIds: ['c-1', 'c-2'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    expect(s.id).toMatch(/^s-/);
    expect(s.status).toBe('ativo');
    expect(s.riskScore).toBe(0);
    expect(s.enrolledCourseIds).toEqual(['c-1', 'c-2']);
    expect(s.progressByCourse).toEqual({ 'c-1': 0, 'c-2': 0 });
  });

  it('updateAdminStudent altera campos', async () => {
    const s = await repo.createAdminStudent({
      name: 'Update Me',
      email: 'up@x.com',
      enrolledCourseIds: [],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    const u = await repo.updateAdminStudent(s.id, {
      name: 'Updated',
      status: 'em_risco',
    });
    expect(u!.name).toBe('Updated');
    expect(u!.status).toBe('em_risco');
  });

  it('updateAdminStudent altera matrículas + preserva progresso quando possível', async () => {
    const s = await repo.createAdminStudent({
      name: 'Enr',
      email: 'enr@x.com',
      enrolledCourseIds: ['c-1', 'c-2'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    const u = await repo.updateAdminStudent(s.id, {
      enrolledCourseIds: ['c-2', 'c-3'],
    });
    expect(u!.enrolledCourseIds).toEqual(['c-2', 'c-3']);
    expect(u!.progressByCourse['c-2']).toBe(0); // preservado
    expect(u!.progressByCourse['c-3']).toBe(0); // novo curso, default 0
  });

  it('setStudentStatus altera só status', async () => {
    const s = await repo.createAdminStudent({
      name: 'Status',
      email: 'st@x.com',
      enrolledCourseIds: [],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    await repo.setStudentStatus(s.id, 'bloqueado');
    const after = await repo.findAdminStudent(s.id);
    expect(after!.status).toBe('bloqueado');
  });

  it('listAdminStudents filtra por search (case-insensitive)', async () => {
    await repo.createAdminStudent({
      name: 'João Pereira',
      email: 'joao@x.com',
      enrolledCourseIds: [],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    const r = await repo.listAdminStudents({ search: 'JOAO' });
    expect(r.some((s) => s.email === 'joao@x.com')).toBe(true);
  });

  it('listAdminStudents filtra por status', async () => {
    await repo.createAdminStudent({
      name: 'Bloq User',
      email: 'bloq@x.com',
      enrolledCourseIds: [],
      status: 'bloqueado',
      weeklyGoalMinutes: 180,
    });
    const r = await repo.listAdminStudents({ status: 'bloqueado' });
    expect(naoVazio(r).every((s) => s.status === 'bloqueado')).toBe(true);
    expect(r.some((s) => s.email === 'bloq@x.com')).toBe(true);
  });

  it('listAdminStudents filtra por courseId', async () => {
    await repo.createAdminStudent({
      name: 'Match course',
      email: 'mc@x.com',
      enrolledCourseIds: ['c-special'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    const r = await repo.listAdminStudents({ courseId: 'c-special' });
    expect(
      naoVazio(r).every((s) => s.enrolledCourseIds.includes('c-special')),
    ).toBe(true);
  });

  it('listAdminStudents sortBy=risk ordena desc por riskScore', async () => {
    const r = await repo.listAdminStudents({ sortBy: 'risk' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1]!.riskScore >= r[i]!.riskScore).toBe(true);
    }
  });

  it('findAdminStudent retorna null para id inexistente', async () => {
    expect(await repo.findAdminStudent('nao-existe')).toBeNull();
  });

  it('enrollInCourse adiciona curso à lista', async () => {
    const s = await repo.createAdminStudent({
      name: 'Enroll',
      email: 'enroll@x.com',
      enrolledCourseIds: ['c-1'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    await repo.enrollInCourse(s.id, 'c-novo');
    const after = await repo.findAdminStudent(s.id);
    expect(after!.enrolledCourseIds).toContain('c-novo');
  });

  it('enrollInCourse é idempotente', async () => {
    const s = await repo.createAdminStudent({
      name: 'Idem',
      email: 'idem@x.com',
      enrolledCourseIds: ['c-1'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    await repo.enrollInCourse(s.id, 'c-1');
    const after = await repo.findAdminStudent(s.id);
    expect(after!.enrolledCourseIds.filter((id) => id === 'c-1')).toHaveLength(1);
  });

  it('unenrollFromCourse remove curso', async () => {
    const s = await repo.createAdminStudent({
      name: 'Unenr',
      email: 'unenr@x.com',
      enrolledCourseIds: ['c-x', 'c-y'],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    await repo.unenrollFromCourse(s.id, 'c-x');
    const after = await repo.findAdminStudent(s.id);
    expect(after!.enrolledCourseIds).toEqual(['c-y']);
  });

  it('deleteAdminStudent remove + retorna false em segunda', async () => {
    const s = await repo.createAdminStudent({
      name: 'Del',
      email: 'del@x.com',
      enrolledCourseIds: [],
      status: 'ativo',
      weeklyGoalMinutes: 180,
    });
    expect(await repo.deleteAdminStudent(s.id)).toBe(true);
    expect(await repo.deleteAdminStudent(s.id)).toBe(false);
    expect(await repo.findAdminStudent(s.id)).toBeNull();
  });
});
