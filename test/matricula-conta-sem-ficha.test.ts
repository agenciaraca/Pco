import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Matricular quem tem conta e ainda não tem ficha de aluno.
 *
 * Na base de produção há centenas de contas com login e sem ficha — a auditoria
 * de 26/ago/2026 contou 989, das quais 763 vieram só da loja. O disparo de
 * convites cria mais. Até aqui, `enroll-bulk` devolvia "aluno não encontrado"
 * para todas elas, e não havia saída: `createAdminStudent` gera id próprio,
 * então nem pela tela dava para ligar a ficha à conta existente.
 *
 * `enrollInCourse` já sabia criar a ficha nesse caso, nos dois backends — o
 * comentário lá conta que isso custou caro uma vez, quando cliente do checkout
 * público pagava e não recebia acesso. O que faltava era `enroll-bulk` chegar
 * até ele em vez de desistir antes.
 */

let tmpDir: string;
let students: typeof import('../server/repositories/students');
let usersStore: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mat-'));
  process.env.DATA_DIR = tmpDir;
  students = await import('../server/repositories/students');
  usersStore = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('conta sem ficha de aluno', () => {
  it('matricular cria a ficha para quem tem conta', async () => {
    const conta = await usersStore.createUser({
      name: 'Convidada Sem Ficha',
      email: 'convidada@exemplo.com',
      password: 'senha-de-teste-123',
      role: 'student',
    });
    // Ponto de partida: existe login, não existe ficha.
    expect(await students.findAdminStudent(conta.id)).toBeNull();

    await students.enrollInCourse(conta.id, 'curso-x');

    const ficha = await students.findAdminStudent(conta.id);
    expect(ficha).not.toBeNull();
    // A ficha nasce com o nome da conta, não com o id no lugar do nome.
    expect(ficha!.name).toBe('Convidada Sem Ficha');
    expect(ficha!.email).toBe('convidada@exemplo.com');
    expect(ficha!.enrolledCourseIds).toContain('curso-x');
  });

  it('id que não é conta nem ficha não vira aluno', async () => {
    // O outro lado da moeda: sem ninguém por trás, matricular não pode
    // fabricar uma ficha com o id no lugar do nome.
    await students.enrollInCourse('id-que-nao-existe-em-lugar-nenhum', 'curso-x');
    expect(await students.findAdminStudent('id-que-nao-existe-em-lugar-nenhum')).toBeNull();
  });

  it('matricular duas vezes não duplica nem reescreve a data de entrada', async () => {
    const conta = await usersStore.createUser({
      name: 'Repetida',
      email: 'repetida@exemplo.com',
      password: 'senha-de-teste-123',
      role: 'student',
    });
    await students.enrollInCourse(conta.id, 'curso-y');
    const primeira = await students.findAdminStudent(conta.id);
    const entradaOriginal = primeira!.enrollmentDates?.['curso-y'];

    await students.enrollInCourse(conta.id, 'curso-y');
    const segunda = await students.findAdminStudent(conta.id);

    expect(segunda!.enrolledCourseIds.filter((c) => c === 'curso-y')).toHaveLength(1);
    // A data de entrada manda no prazo de acesso: reescrevê-la a cada
    // rematrícula daria tempo extra sem ninguém decidir isso.
    expect(segunda!.enrollmentDates?.['curso-y']).toBe(entradaOriginal);
  });
});
