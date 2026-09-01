import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A matrícula acompanha o pedido — e é isto que faltava.
 *
 * A regra do dono da escola virou código em 1/set/2026
 * (`server/access/situacao-matricula.ts`), com teste próprio e tudo. Só que
 * **ninguém a chamava**: até esta tarde apenas o script de importação histórica
 * usava, e todo o caminho de runtime passava por fora. O efeito estava em
 * produção — lançamento manual "já pago" não matriculava, e estornar pelo
 * admin deixava o acesso de pé.
 *
 * Estes testes existem para que a próxima pessoa que mexer no CRUD de pedidos
 * descubra isso pelo vermelho, não por um aluno reclamando.
 *
 * Sem `DATABASE_URL` tudo aqui exercita o backend JSON — o mesmo cenário do
 * dev local.
 */

let tmpDir: string;
let students: typeof import('../server/repositories/students');
let orders: typeof import('../server/payments/orders-repo');
let aplicar: typeof import('../server/app').aplicarSituacaoDoPedido;

const CURSO = 'c-teste-matricula';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mat-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  students = await import('../server/repositories/students');
  orders = await import('../server/payments/orders-repo');
  ({ aplicarSituacaoDoPedido: aplicar } = await import('../server/app'));
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

let n = 0;
async function alunoNovo(comMatricula = false) {
  n += 1;
  return students.createAdminStudent({
    name: `Aluno Teste ${n}`,
    email: `aluno.teste.${n}@exemplo.com`,
    weeklyGoalMinutes: 180,
    status: 'ativo',
    enrolledCourseIds: comMatricula ? [CURSO] : [],
  });
}

async function pedidoDe(userId: string, email: string) {
  return orders.createOrder({
    userId,
    userEmail: email,
    productId: 'prod-teste',
    productSnapshot: {
      name: 'Curso de Teste',
      priceCents: 19900,
      currency: 'BRL',
      kind: 'course',
      refId: CURSO,
    },
    gatewayId: 'manual',
    gatewayProvider: 'manual',
    amountCents: 19900,
    currency: 'BRL',
  });
}

/** O que o portão vai ver: lista de matrículas + situação de cada uma. */
async function situacaoDe(userId: string) {
  const ficha = await students.findAdminStudent(userId);
  return {
    matriculado: (ficha?.enrolledCourseIds ?? []).includes(CURSO),
    // Ausente = `ativa`, pela convenção do próprio DTO.
    situacao: ficha?.enrollmentStatusByCourse?.[CURSO] ?? 'ativa',
  };
}

describe('a matrícula segue o status do pedido', () => {
  it('pedido pago matricula — é o lançamento manual que não matriculava', async () => {
    const aluno = await alunoNovo();
    const p = await pedidoDe(aluno.id, aluno.email);
    const pago = await orders.updateStatus(p.id, 'paid', 'teste');

    await aplicar(pago!, 'pending');

    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });

  it('estorno cancela a matrícula sem apagá-la', async () => {
    const aluno = await alunoNovo();
    const p = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(p.id, 'paid', 'teste'))!, 'pending');

    const estornado = await orders.updateStatus(p.id, 'refunded', 'teste');
    await aplicar(estornado!, 'paid');

    // O registro fica: o histórico do aluno vale mais que a linha limpa, e o
    // portão já sabe fechar em cima de `cancelada`.
    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'cancelada' });
  });

  it('cancelar pedido que chegou a ser pago derruba a matrícula', async () => {
    const aluno = await alunoNovo();
    const p = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(p.id, 'paid', 'teste'))!, 'pending');

    const cancelado = await orders.updateStatus(p.id, 'canceled', 'desistência');
    await aplicar(cancelado!, 'paid');

    expect((await situacaoDe(aluno.id)).situacao).toBe('cancelada');
  });

  it('cancelar pedido que nunca foi pago não mexe em matrícula nenhuma', async () => {
    // A pessoa já era aluna por outro caminho (importação, cortesia). Um
    // pedido abandonado no checkout não pode tirar isso dela.
    const aluno = await alunoNovo(true);
    const p = await pedidoDe(aluno.id, aluno.email);
    const cancelado = await orders.updateStatus(p.id, 'canceled', 'abandonou');

    await aplicar(cancelado!, 'pending');

    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });

  it('pedido importado com paidAt de mentira não derruba matrícula legítima', async () => {
    // A importação da loja gravou `paidAt` igual à data do pedido em TODOS os
    // pedidos, inclusive nos boletos que ninguém pagou. Cinco alunos de
    // produção estavam nesse caso: matrícula legítima, vinda do LMS, e um
    // pedido de boleto cancelado com `paidAt` preenchido. Tratar isso como
    // "chegou a ser pago" tirava o acesso deles.
    const aluno = await alunoNovo(true);
    const p = await pedidoDe(aluno.id, aluno.email);
    await orders.updateStatus(p.id, 'canceled', 'importado da loja · status na origem: cancelled');
    const comPaidAtFalso = await orders.updateOrder(p.id, {
      paidAt: new Date('2025-12-24T14:40:07-03:00').toISOString(),
    });
    // A montagem só vale se reproduzir o caso: paidAt cheio, nenhum evento pago.
    expect(comPaidAtFalso!.paidAt).toBeTruthy();
    expect(comPaidAtFalso!.events.some((e) => e.status === 'paid')).toBe(false);

    await aplicar(comPaidAtFalso!, 'pending');

    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });

  it('atraso suspende, e quitar devolve o acesso sozinho', async () => {
    const aluno = await alunoNovo();
    const p = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(p.id, 'paid', 'teste'))!, 'pending');

    const pendurado = await orders.updateStatus(p.id, 'pending', 'boleto vencido');
    await aplicar(pendurado!, 'paid');
    expect((await situacaoDe(aluno.id)).situacao).toBe('suspensa');

    const quitado = await orders.updateStatus(p.id, 'paid', 'pagou');
    await aplicar(quitado!, 'pending');
    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });

  it('quem tem outro pedido pago do mesmo curso não é suspenso pelo pedido novo', async () => {
    const aluno = await alunoNovo();
    const pago = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(pago.id, 'paid', 'teste'))!, 'pending');

    // Segundo pedido do mesmo curso, ainda pendente (renovação, upgrade).
    const novo = await pedidoDe(aluno.id, aluno.email);
    await aplicar(novo, null);

    // A situação mais forte vence — trancar quem já pagou seria o contrário
    // do que a regra manda.
    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });

  it('quem foi estornado e comprou de novo volta a ter acesso', async () => {
    const aluno = await alunoNovo();
    const primeiro = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(primeiro.id, 'paid', 'teste'))!, 'pending');
    await aplicar((await orders.updateStatus(primeiro.id, 'refunded', 'teste'))!, 'paid');
    expect((await situacaoDe(aluno.id)).situacao).toBe('cancelada');

    // Aqui morava a armadilha: `enrollInCourse` não sobrescreve linha
    // existente, então matricular de novo deixava a situação em `cancelada` —
    // a pessoa pagava outra vez e continuava sem acesso.
    const segundo = await pedidoDe(aluno.id, aluno.email);
    await aplicar((await orders.updateStatus(segundo.id, 'paid', 'teste'))!, 'pending');

    expect(await situacaoDe(aluno.id)).toEqual({ matriculado: true, situacao: 'ativa' });
  });
});
