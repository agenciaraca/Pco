import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * `exportCouponsAsCsv` lia `store.getAll()` direto — pulando o
 * `bancoSeTabelaExiste` que TODA outra função de leitura deste arquivo passa
 * por (`listAll`, `findByCode`, `findById`). Em produção (banco configurado),
 * a lista do admin lê do Postgres e mostra os cupons reais; exportar em CSV
 * lia o JSON — vazio ou desatualizado — e devolvia um arquivo sem os cupons
 * que a própria tela acabou de mostrar.
 *
 * Achado em 12/set/2026, mesma classe de defeito de `support.ts` (só que ali
 * eram 3 de 5 funções sem o branch; aqui é 1 de 4 num arquivo diferente) —
 * varredura sistemática por todo repositório que mistura banco e JSON.
 *
 * Mocka `getDb()` como os outros testes de banco deste projeto
 * (`test/curso-desativado-nao-congela-aluno.test.ts`), incluindo a sonda
 * `to_regclass` que `bancoSeTabelaExiste` roda antes de qualquer leitura.
 */

const cupomDoBanco = vi.hoisted(() => ({
  id: 'coup-banco',
  code: 'SOEXISTONOPOSTGRES',
  description: 'Cupom que só existe no banco',
  discount: { kind: 'percent', value: 10 },
  appliesToProductIds: [],
  maxUses: null,
  usedCount: 0,
  validFrom: null,
  validUntil: null,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}));

const bancoFalso = vi.hoisted(() => {
  function nomeDaTabela(t: object): string {
    const s = Object.getOwnPropertySymbols(t).find((x) => x.description === 'drizzle:Name');
    return s ? String((t as Record<symbol, unknown>)[s]) : '?';
  }
  return {
    execute: () => Promise.resolve({ rows: [{ existe: true }] }),
    select: () => ({
      from: (t: object) => {
        const rows = nomeDaTabela(t) === 'payment_coupons' ? [cupomDoBanco] : [];
        return Promise.resolve(rows);
      },
    }),
  };
});

vi.mock('../server/db/client', async () => {
  const real =
    await vi.importActual<typeof import('../server/db/client')>('../server/db/client');
  return { ...real, getDb: () => bancoFalso, hasDb: () => true };
});

let coupons: typeof import('../server/payments/coupons-repo');

beforeAll(async () => {
  const { _reset } = await import('../server/db/tabela-ausente');
  _reset();
  coupons = await import('../server/payments/coupons-repo');
});

describe('exportCouponsAsCsv lê o banco quando ele existe', () => {
  it('o CSV traz o cupom que só existe no banco, não fica preso ao JSON', async () => {
    const csv = await coupons.exportCouponsAsCsv();
    expect(csv).toContain('SOEXISTONOPOSTGRES');
  });

  it('bate com o que listAll() (já correto) devolve — as duas leem a mesma fonte', async () => {
    const [csv, lista] = await Promise.all([coupons.exportCouponsAsCsv(), coupons.listAll()]);
    for (const c of lista) {
      expect(csv).toContain(c.code);
    }
  });
});
