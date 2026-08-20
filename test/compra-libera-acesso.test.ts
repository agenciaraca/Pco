import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-compra-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import * as repo from '../server/repositories/students';
import * as store from '../server/auth/users-store';

// O checkout público cria só a credencial de quem compra sem ter conta. Quando o
// pagamento é aprovado, o webhook chama enrollInCourse — que desistia em silêncio
// se a pessoa não tivesse ficha de aluno. Resultado: cliente novo pagava e não
// recebia acesso, sem erro em lugar nenhum. Este teste existe para que isso não
// volte a acontecer sem alguém perceber.

describe('quem paga recebe acesso', () => {
  const EMAIL = 'comprador.novo@pco.local';
  let userId: string;

  beforeAll(async () => {
    await store.loadUsers();
    const criada = await store.createUser({
      email: EMAIL,
      name: 'Comprador Novo',
      role: 'student',
      password: 'senha-de-teste-comprida',
    });
    userId = criada.id;
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('matricula mesmo quem só tinha credencial, sem ficha de aluno', async () => {
    await repo.enrollInCourse(userId, 'c-psi');
    const perfil = await repo.getStudentProfile(userId);
    expect(perfil, 'o comprador precisa existir como aluno').not.toBeNull();
    expect(perfil!.enrolledCourseIds).toContain('c-psi');
  });

  it('comprar duas vezes o mesmo curso não duplica a matrícula', async () => {
    await repo.enrollInCourse(userId, 'c-psi');
    const perfil = await repo.getStudentProfile(userId);
    const vezes = perfil!.enrolledCourseIds.filter((c) => c === 'c-psi').length;
    expect(vezes).toBe(1);
  });

  it('quem não existe como usuário não vira matrícula fantasma', async () => {
    await repo.enrollInCourse('nao-existe-ninguem-assim', 'c-psi');
    const perfil = await repo.getStudentProfile('nao-existe-ninguem-assim');
    expect(perfil).toBeNull();
  });

  it('um segundo curso comprado se soma ao primeiro', async () => {
    await repo.enrollInCourse(userId, 'c-tfs');
    const perfil = await repo.getStudentProfile(userId);
    expect(perfil!.enrolledCourseIds).toEqual(expect.arrayContaining(['c-psi', 'c-tfs']));
  });
});
