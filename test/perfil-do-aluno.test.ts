import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-perfil-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import * as repo from '../server/repositories/students';
import { currentStudent, adminStudents } from '../src/app/data/seed';

// Até 20/ago/2026, `/auth/me` montava o perfil com getCurrentStudent() — sempre
// o aluno do seed — e trocava só nome e e-mail por cima. Todo aluno logado via
// as matrículas e o progresso de OUTRA pessoa, e não via os próprios cursos.
// Com 507 convites prestes a sair, cada um deles entraria assim.

describe('perfil do aluno é do próprio aluno', () => {
  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  beforeAll(async () => {
    // garante o store carregado
    await repo.listAdminStudents({});
  });

  it('devolve as matrículas de quem foi pedido, não as do aluno-semente', async () => {
    const outro = adminStudents.find((s) => s.id !== currentStudent.id);
    expect(outro, 'o seed precisa ter mais de um aluno para este teste valer').toBeTruthy();

    const perfil = await repo.getStudentProfile(outro!.id);
    expect(perfil).not.toBeNull();
    expect(perfil!.id).toBe(outro!.id);
    expect(perfil!.enrolledCourseIds).toEqual(outro!.enrolledCourseIds);
  });

  it('perfis de duas pessoas não se misturam', async () => {
    const [a, b] = adminStudents;
    if (!a || !b) return;
    const pa = await repo.getStudentProfile(a.id);
    const pb = await repo.getStudentProfile(b.id);
    expect(pa!.id).not.toBe(pb!.id);
    // Se um dia voltarem a compartilhar a mesma origem, os dois passam a ter a
    // mesma lista — e é isso que este teste existe para pegar.
    if (a.enrolledCourseIds.join() !== b.enrolledCourseIds.join()) {
      expect(pa!.enrolledCourseIds).not.toEqual(pb!.enrolledCourseIds);
    }
  });

  it('quem não existe devolve nulo, não o perfil de outra pessoa', async () => {
    expect(await repo.getStudentProfile('nao-existe-esse-aluno')).toBeNull();
  });

  it('o perfil traz os campos que a interface do aluno consome', async () => {
    // De propósito com um aluno da lista, e não com `currentStudent`: o aluno
    // demo do app nem consta em `adminStudents` — outro sintoma do mesmo
    // emaranhado que fazia `/auth/me` devolver o perfil dele para todo mundo.
    const perfil = await repo.getStudentProfile(adminStudents[0].id);
    expect(perfil).not.toBeNull();
    expect(perfil).toMatchObject({
      id: expect.any(String),
      role: 'student',
      enrolledCourseIds: expect.any(Array),
    });
    expect(typeof perfil!.weeklyGoalMinutes).toBe('number');
  });
});
