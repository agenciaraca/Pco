import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Pedidos: o backend JSON continua inteiro depois da migração para o banco.
 *
 * Pedido é registro de dinheiro, e enquanto viveu só em
 * `data/payment-orders.json` ficou fora do backup transacional e de qualquer
 * consulta. A tabela `payment_orders` resolve isso — mas o caminho JSON não
 * pode quebrar, porque é ele que faz o dev local rodar sem banco.
 *
 * Sem `DATABASE_URL`, `getDb()` devolve null e tudo aqui exercita o JSON. É
 * exatamente o cenário que estes testes protegem.
 */

let tmpDir: string;
let orders: typeof import('../server/payments/orders-repo');

const entrada = {
  userId: 'u1',
  userEmail: 'aluno@exemplo.com',
  productId: 'prod-1',
  productSnapshot: {
    name: 'Curso X',
    priceCents: 19900,
    currency: 'BRL',
    kind: 'course' as const,
    refId: 'c1',
  },
  gatewayId: 'gw-1',
  gatewayProvider: 'mock' as const,
  amountCents: 19900,
  currency: 'BRL',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ord-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  orders = await import('../server/payments/orders-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

// O JsonStore mantém cache em memória, então reescrever o arquivo não zera
// nada. Em vez de lutar contra isso, cada teste usa o próprio dono: as
// asserções passam a ser sobre o que aquele teste criou, não sobre o total.
let n = 0;
function donoUnico(): string {
  n += 1;
  return `u-teste-${n}`;
}

describe('pedidos sem banco', () => {
  it('cria com status pending e um evento de abertura', async () => {
    const o = await orders.createOrder(entrada);
    expect(o.id).toMatch(/^ord-/);
    expect(o.status).toBe('pending');
    expect(o.events).toHaveLength(1);
    expect(o.paidAt).toBeNull();
  });

  it('anexar o resultado do gateway guarda externalId e checkoutUrl', async () => {
    const o = await orders.createOrder(entrada);
    const out = await orders.attachGatewayResult(o.id, {
      externalId: 'ext-9',
      checkoutUrl: 'https://pagar.exemplo/9',
      status: 'pending',
    });
    expect(out?.externalId).toBe('ext-9');
    expect(out?.checkoutUrl).toBe('https://pagar.exemplo/9');
    expect(await orders.findByExternalId('ext-9')).not.toBeNull();
  });

  it('paidAt é gravado uma vez só — reprocessar webhook não reescreve a data', async () => {
    const o = await orders.createOrder(entrada);
    const primeiro = await orders.updateStatus(o.id, 'paid', 'webhook');
    expect(primeiro?.paidAt).toBeTruthy();
    const data1 = primeiro!.paidAt;
    // Gateways reenviam webhook. A data em que o dinheiro entrou não pode andar.
    const segundo = await orders.updateStatus(o.id, 'paid', 'webhook repetido');
    expect(segundo?.paidAt).toBe(data1);
  });

  it('cada mudança de status deixa rastro no log de eventos', async () => {
    const o = await orders.createOrder(entrada);
    await orders.updateStatus(o.id, 'processing', 'em análise');
    await orders.updateStatus(o.id, 'paid', 'aprovado');
    const atual = await orders.findById(o.id);
    expect(atual?.events.map((e) => e.status)).toEqual(['pending', 'processing', 'paid']);
  });

  it('listForUser separa por dono', async () => {
    const a = donoUnico();
    const b = donoUnico();
    await orders.createOrder({ ...entrada, userId: a });
    await orders.createOrder({ ...entrada, userId: a });
    await orders.createOrder({ ...entrada, userId: b });
    expect((await orders.listForUser(a)).length).toBe(2);
    expect((await orders.listForUser(b)).length).toBe(1);
    expect((await orders.listForUser('ninguem')).length).toBe(0);
  });

  it('a migração para o banco é inerte quando não há banco', async () => {
    // Sem DATABASE_URL não há o que migrar, e a função não pode explodir nem
    // apagar a origem.
    const dono = donoUnico();
    await orders.createOrder({ ...entrada, userId: dono });
    const antes = (await orders.listForUser(dono)).length;
    const r = await orders.migrarJsonParaBanco();
    expect(r).toEqual({ noJson: 0, jaNoBanco: 0, migrados: 0 });
    expect((await orders.listForUser(dono)).length).toBe(antes);
  });
});
