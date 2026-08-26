import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Auditoria das contas sem ficha de aluno.
 *
 * A pergunta que ela responde trava o disparo dos convites: cliente da loja
 * convidado para o AVA recebe acesso a um ambiente vazio (constrangimento);
 * aluno com matrícula perdida convidado sem a matrícula de volta conclui que
 * perdeu o que pagou. Os dois erros são caros, e distinguir os casos é o que
 * este módulo faz.
 *
 * O teste que mais importa aqui é o do INCONCLUSIVO: sem dados de progresso, a
 * resposta não pode virar "ninguém estudou".
 */

let tmpDir: string;
let auditoria: typeof import('../scripts/auditar_contas_sem_ficha');

async function escrever(nome: string, dados: unknown): Promise<void> {
  await fs.writeFile(path.join(tmpDir, nome), JSON.stringify(dados, null, 2));
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-aud-'));
  process.env.DATA_DIR = tmpDir;

  await escrever('users.json', [
    { id: 'u-loja', email: 'loja@x.com' },
    { id: 'u-portal', email: 'portal@x.com' },
    { id: 'u-com-ficha', email: 'ficha@x.com' },
    { id: 'u-perdido', email: 'perdido@x.com' },
  ]);
  await escrever('admin-students.json', [{ id: 'u-com-ficha', enrolledCourseIds: ['c1'] }]);
  await escrever('external-references.json', [
    { externalEntityType: 'student', externalId: 'psi:1', internalId: 'u-loja' },
    { externalEntityType: 'student', externalId: 'portal:2', internalId: 'u-portal' },
    { externalEntityType: 'student', externalId: 'portal:3', internalId: 'u-com-ficha' },
    // Matrícula apontando para conta sem ficha: o caso grave.
    { externalEntityType: 'enrollment', externalId: 'x', internalId: 'u-perdido:c9' },
  ]);

  auditoria = await import('../scripts/auditar_contas_sem_ficha');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('auditoria de contas sem ficha', () => {
  it('separa quem só existe na loja de quem tem presença no portal', async () => {
    const r = await auditoria.auditar();
    expect(r.semFicha).toBe(3); // todos menos u-com-ficha
    expect(r.soLoja).toBe(1);
    expect(r.comPortal).toBe(1);
  });

  it('conta matrícula órfã — o sinal de que a migração perdeu a ficha', async () => {
    const r = await auditoria.auditar();
    expect(r.matriculaPerdida).toBe(1);
  });

  it('sem dados de progresso a resposta é INCONCLUSIVA, não "ninguém estudou"', async () => {
    const r = await auditoria.auditar();
    // Esta é a distinção que impede um relatório confiante e errado: base sem
    // progresso carregado não prova ausência de estudo.
    expect(r.progressoDisponivel).toBe(false);
    expect(r.progressoSemFicha).toBe(0);
  });

  it('havendo progresso, aponta quem estudou sem ficha', async () => {
    await escrever('lesson-progress.json', [
      { userId: 'u-portal', lessonId: 'l1' },
      { userId: 'u-com-ficha', lessonId: 'l2' },
    ]);
    const r = await auditoria.auditar();
    expect(r.progressoDisponivel).toBe(true);
    // Só u-portal está sem ficha; u-com-ficha tem e não conta.
    expect(r.progressoSemFicha).toBe(1);
  });

  it('a amostra traz e-mail para o dono conseguir conferir caso a caso', async () => {
    const r = await auditoria.auditar();
    expect(r.amostraPortalSemFicha[0]).toEqual({ id: 'u-portal', email: 'portal@x.com' });
  });
});
