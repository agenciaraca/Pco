import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Quanto do dinheiro entra por cada método.
 *
 * A escola passou a rotear gateway **por método** em 5/set/2026 — e a pergunta
 * que essa decisão exige não tinha resposta em tela nenhuma. Ligar boleto,
 * negociar a taxa do cartão, deixar de oferecer pix: tudo era palpite.
 *
 * As três regras que este arquivo cobra, e que são as que se erram:
 *
 * 1. **Só pago entra.** Boleto deixa pedido em aberto por dias; somar o
 *    pendente faria o boleto parecer vender o que ele ainda não vendeu.
 * 2. **Ausência não é zero, nem é pix.** Pedido pago antes de o campo `metodo`
 *    existir não tem método. Diluí-lo no primeiro da lista infla o número que a
 *    coordenação leva para negociar taxa.
 * 3. **A soma fecha.** Métodos + não registrado = receita paga do período. Se
 *    não fechar, uma das duas metades está mentindo e não dá para saber qual.
 */

let tmpDir: string;
let repo: typeof import('../server/payments/orders-repo');
let analytics: typeof import('../server/payments/sales-analytics');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-vendas-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/orders-repo');
  analytics = await import('../server/payments/sales-analytics');
});

afterAll(async () => {
  if (!tmpDir) return;
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

type Metodo = 'pix' | 'boleto' | 'credit_card';

async function pedido(opts: {
  metodo?: Metodo;
  cents: number;
  pago: boolean;
  carne?: boolean;
}) {
  const o = await repo.createOrder({
    userId: 'u-1',
    userEmail: 'a@pco.local',
    productId: 'p-1',
    productSnapshot: {
      name: 'Curso',
      priceCents: opts.cents,
      currency: 'BRL',
      kind: 'course',
      refId: 'c-1',
    },
    gatewayId: 'gw-asaas',
    gatewayProvider: 'asaas',
    ...(opts.metodo ? { metodo: opts.metodo } : {}),
    amountCents: opts.cents,
    currency: 'BRL',
  });
  await repo.attachGatewayResult(o.id, {
    externalId: `ext-${o.id}`,
    status: 'pending',
    ...(opts.carne ? { installmentId: `inst-${o.id}` } : {}),
  });
  if (opts.pago) await repo.updateStatus(o.id, 'paid');
  return o;
}

describe('receita por método', () => {
  beforeAll(async () => {
    await pedido({ metodo: 'credit_card', cents: 100_000, pago: true, carne: true });
    await pedido({ metodo: 'credit_card', cents: 50_000, pago: true });
    await pedido({ metodo: 'boleto', cents: 30_000, pago: true });
    // Pendente: existe, e não é receita.
    await pedido({ metodo: 'boleto', cents: 999_999, pago: false });
    // Pago antes de o campo existir.
    await pedido({ cents: 20_000, pago: true });
  });

  it('soma só o que foi pago', async () => {
    const s = await analytics.buildSalesSummary(30);
    const boleto = s.porMetodo.itens.find((i) => i.metodo === 'boleto')!;
    // Os R$ 9.999,99 pendentes não podem aparecer em lugar nenhum daqui.
    expect(boleto.revenueCents).toBe(30_000);
    expect(boleto.orders).toBe(1);
  });

  it('conta o carnê à parte, sem tirá-lo do método', async () => {
    const s = await analytics.buildSalesSummary(30);
    const cartao = s.porMetodo.itens.find((i) => i.metodo === 'credit_card')!;
    expect(cartao.revenueCents).toBe(150_000);
    expect(cartao.orders).toBe(2);
    expect(cartao.carnes).toBe(1);
  });

  it('pedido sem método fica à parte, e não vira pix', async () => {
    const s = await analytics.buildSalesSummary(30);
    expect(s.porMetodo.semMetodo).toEqual({ revenueCents: 20_000, orders: 1 });
    const pix = s.porMetodo.itens.find((i) => i.metodo === 'pix')!;
    expect(pix.revenueCents).toBe(0);
    expect(pix.orders).toBe(0);
  });

  it('a soma fecha com a receita do período', async () => {
    const s = await analytics.buildSalesSummary(30);
    const soma =
      s.porMetodo.itens.reduce((t, i) => t + i.revenueCents, 0) +
      s.porMetodo.semMetodo.revenueCents;
    expect(soma).toBe(s.totals.revenueCents);
  });

  it('todo método conhecido aparece, mesmo zerado', async () => {
    // Método com zero venda é informação: diz que a escola oferece e ninguém
    // usou. Omiti-lo faria "não oferecemos" e "ninguém escolheu" parecerem a
    // mesma coisa — e são decisões opostas.
    const s = await analytics.buildSalesSummary(30);
    expect(s.porMetodo.itens.map((i) => i.metodo).sort()).toEqual([
      'boleto',
      'credit_card',
      'pix',
    ]);
  });
});
