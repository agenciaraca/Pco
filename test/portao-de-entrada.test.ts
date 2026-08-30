/**
 * O portão de entrada: ninguém entra sem ter comprado.
 *
 * Regra pedida em 30/ago/2026. O que estes testes protegem, além do óbvio:
 *
 * 1. **As cinco portas.** Senha, senha com 2FA, Google, Microsoft e SAML emitem
 *    sessão. Guardar só a primeira transformaria o bloqueio em teatro — foi
 *    assim que oito rotas de admin ficaram abertas em agosto.
 * 2. **Admin nunca é barrado.** Ele não tem matrícula por definição; barrá-lo
 *    trancaria justamente quem consertaria a regra.
 * 3. **Matrícula vencida ainda entra.** Prazo expirado não pode virar porta
 *    trancada: quem venceu precisa entrar para renovar. É `courseAccessFor`
 *    que barra a aula — perguntas diferentes.
 * 4. **Falha aberta.** Se a consulta de pedidos quebrar, deixa entrar. Barrar
 *    um cliente legítimo por indisponibilidade custa mais que deixar alguém ver
 *    um ambiente vazio.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL = process.env.EXIGIR_MATRICULA_PARA_ENTRAR;

/** Importa o módulo com os repositórios trocados por dublês. */
async function comRepos(opts: {
  matriculas?: string[] | null;
  pedidos?: Array<{ status: string }> | null;
  pedidosQuebram?: boolean;
}) {
  vi.resetModules();

  vi.doMock('../server/repositories/students', () => ({
    findAdminStudent: vi.fn(async () =>
      opts.matriculas === null ? null : { enrolledCourseIds: opts.matriculas ?? [] },
    ),
  }));

  vi.doMock('../server/payments/orders-repo', () => ({
    listForUser: vi.fn(async () => {
      if (opts.pedidosQuebram) throw new Error('banco fora do ar');
      return opts.pedidos ?? [];
    }),
  }));

  return import('../server/access/portao-de-entrada');
}

describe('portão de entrada', () => {
  beforeEach(() => {
    process.env.EXIGIR_MATRICULA_PARA_ENTRAR = 'true';
  });

  afterEach(() => {
    vi.doUnmock('../server/repositories/students');
    vi.doUnmock('../server/payments/orders-repo');
    vi.resetModules();
    if (ORIGINAL === undefined) delete process.env.EXIGIR_MATRICULA_PARA_ENTRAR;
    else process.env.EXIGIR_MATRICULA_PARA_ENTRAR = ORIGINAL;
  });

  it('aluno sem matrícula e sem pedido pago não entra', async () => {
    const { podeEntrar } = await comRepos({ matriculas: [], pedidos: [] });
    const r = await podeEntrar({ id: 'u1', role: 'student' });
    expect(r.pode).toBe(false);
    expect(r.motivo).toBe('sem_matricula');
  });

  it('aluno com matrícula entra', async () => {
    const { podeEntrar } = await comRepos({ matriculas: ['curso-1'], pedidos: [] });
    expect((await podeEntrar({ id: 'u1', role: 'student' })).pode).toBe(true);
  });

  // Quem comprou só sessão de análise não tem curso nenhum. Sem esta regra,
  // a pessoa paga e não entra — o pior resultado para uma regra que existe
  // para proteger a receita.
  it('quem só comprou sessão, sem curso, entra pelo pedido pago', async () => {
    const { podeEntrar } = await comRepos({ matriculas: [], pedidos: [{ status: 'paid' }] });
    expect((await podeEntrar({ id: 'u1', role: 'student' })).pode).toBe(true);
  });

  it('pedido pendente ou estornado não abre a porta', async () => {
    const { podeEntrar } = await comRepos({
      matriculas: [],
      pedidos: [{ status: 'pending' }, { status: 'refunded' }],
    });
    expect((await podeEntrar({ id: 'u1', role: 'student' })).pode).toBe(false);
  });

  it('admin e superadmin nunca são barrados', async () => {
    const { podeEntrar } = await comRepos({ matriculas: [], pedidos: [] });
    expect((await podeEntrar({ id: 'a1', role: 'admin' })).pode).toBe(true);
    expect((await podeEntrar({ id: 's1', role: 'superadmin' })).pode).toBe(true);
  });

  // Conta sem ficha de aluno: `findAdminStudent` devolve null. Não pode
  // explodir — tem que cair no caminho normal de "sem matrícula".
  it('conta sem ficha de aluno não quebra a decisão', async () => {
    const { podeEntrar } = await comRepos({ matriculas: null, pedidos: [] });
    const r = await podeEntrar({ id: 'u1', role: 'student' });
    expect(r.pode).toBe(false);
  });

  it('falha do repositório de pedidos deixa entrar, não tranca', async () => {
    const { podeEntrar } = await comRepos({ matriculas: [], pedidosQuebram: true });
    expect((await podeEntrar({ id: 'u1', role: 'student' })).pode).toBe(true);
  });

  it('desligado por variável de ambiente, todo mundo entra', async () => {
    process.env.EXIGIR_MATRICULA_PARA_ENTRAR = 'false';
    const { podeEntrar } = await comRepos({ matriculas: [], pedidos: [] });
    expect((await podeEntrar({ id: 'u1', role: 'student' })).pode).toBe(true);
  });

  it('ligado por padrão: sem a variável definida, o portão vale', async () => {
    delete process.env.EXIGIR_MATRICULA_PARA_ENTRAR;
    const { portaoAtivo } = await comRepos({ matriculas: [], pedidos: [] });
    expect(portaoAtivo()).toBe(true);
  });
});

describe('as cinco portas que emitem sessão passam pelo portão', () => {
  it('nenhuma porta de login fica sem a guarda', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const app = readFileSync(
      path.resolve(__dirname, '..', 'server', 'app.ts'),
      'utf8',
    );

    // Uma chamada por porta: senha, 2FA, Google, Microsoft e SAML.
    const chamadas = app.match(/podeEntrar\(/g) ?? [];
    expect(
      chamadas.length,
      'Alguma porta que emite sessão deixou de chamar podeEntrar(). ' +
        'São cinco: senha, 2FA, Google, Microsoft e SAML — guardar só algumas ' +
        'é o mesmo que não guardar nenhuma.',
    ).toBeGreaterThanOrEqual(5);
  });
});
