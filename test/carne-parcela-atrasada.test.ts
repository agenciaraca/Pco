import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A parcela 3 do carnê não achava o pedido — e quem parava de pagar seguia
 * estudando.
 *
 * No carnê (boleto ou cartão parcelado), **cada parcela é uma cobrança com id
 * próprio** e o pedido guarda o da primeira. `findByExternalId` casa por
 * `externalId` + `gatewayId`: o aviso da parcela 1 encontra o pedido, e o das
 * parcelas 2 a N não encontra nada e é descartado em silêncio.
 *
 * Efeito prático: o AVA não fica sabendo da inadimplência. O elo existe do lado
 * do gateway — o Asaas devolve `installment` na criação e repete o mesmo id em
 * todas as parcelas —, e a coluna `gateway_installment_id` (migration `0020`) é
 * onde ele passa a existir do lado de cá.
 *
 * ## As duas metades, e a segunda é a que se esquece
 *
 * 1. A parcela atrasada **encontra** o pedido.
 * 2. E **não derruba** o pedido. Ele foi pago: a parcela 1 entrou e o acesso
 *    foi liberado. Marcá-lo `failed` porque a parcela 3 atrasou reescreveria a
 *    história — o `status` do pedido é a situação da compra, e a compra
 *    aconteceu.
 *
 * Suspender o acesso é **decisão comercial**, não técnica: cortar o curso de
 * quem atrasou um boleto por dois dias é política da escola. Por isso mora
 * atrás de `CARNE_ATRASO_SUSPENDE`, desligada por padrão — enquanto estiver
 * assim, o atraso aparece para gente decidir, que é o lado certo para errar.
 */

let tmpDir: string;
let repo: typeof import('../server/payments/orders-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-carne-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/orders-repo');
});

afterAll(async () => {
  if (!tmpDir) return;
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

async function pedidoComCarne() {
  const o = await repo.createOrder({
    userId: 'u-carne',
    userEmail: 'carne@pco.local',
    productId: 'p-1',
    productSnapshot: {
      name: 'Curso',
      priceCents: 119_980,
      currency: 'BRL',
      kind: 'course',
      refId: 'c-1',
    },
    gatewayId: 'gw-asaas',
    gatewayProvider: 'asaas',
    metodo: 'boleto',
    amountCents: 119_980,
    currency: 'BRL',
  });
  // A criação devolve a PRIMEIRA cobrança e o id do parcelamento.
  await repo.attachGatewayResult(o.id, {
    externalId: 'pay_parcela_1',
    status: 'pending',
    installmentId: 'inst_abc',
  });
  return o;
}

describe('a parcela do meio do carnê encontra o pedido', () => {
  it('pela primeira parcela, como sempre', async () => {
    const o = await pedidoComCarne();
    const achado = await repo.findByExternalId('pay_parcela_1', 'gw-asaas');
    expect(achado?.id).toBe(o.id);
  });

  it('e pela parcela 3, que tem id próprio', async () => {
    const o = await pedidoComCarne();
    // Este é o caso que sumia: a cobrança da parcela 3 não é a do pedido.
    expect(await repo.findByExternalId('pay_parcela_3', 'gw-asaas')).toBeNull();
    const achado = await repo.findByInstallment('inst_abc', 'gw-asaas');
    expect(achado?.id).toBe(o.id);
  });

  it('mas não atravessa gateways — parcelamento de um não acha pedido de outro', async () => {
    await pedidoComCarne();
    expect(await repo.findByInstallment('inst_abc', 'gw-outro')).toBeNull();
  });

  it('e pedido à vista não tem parcelamento nenhum', async () => {
    const o = await repo.createOrder({
      userId: 'u-vista',
      userEmail: 'vista@pco.local',
      productId: 'p-1',
      productSnapshot: {
        name: 'Curso',
        priceCents: 119_980,
        currency: 'BRL',
        kind: 'course',
        refId: 'c-1',
      },
      gatewayId: 'gw-asaas',
      gatewayProvider: 'asaas',
      amountCents: 119_980,
      currency: 'BRL',
    });
    await repo.attachGatewayResult(o.id, { externalId: 'pay_unico', status: 'pending' });
    const salvo = await repo.findById(o.id);
    // `null` quer dizer "não é carnê", e não "não se sabe".
    expect(salvo?.gatewayInstallmentId ?? null).toBeNull();
  });
});

describe('a decisão de suspender é comercial, e está escrita como tal', () => {
  it('o padrão é NÃO suspender, e a chave é explícita', async () => {
    const fonte = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    const i = fonte.indexOf('ehParcelaDeCarne');
    expect(i).toBeGreaterThan(0);
    const bloco = fonte.slice(i - 900, i + 1600);
    // Comparação com `'true'`: qualquer outro valor, inclusive ausência, deixa
    // desligado.
    expect(bloco).toContain("process.env.CARNE_ATRASO_SUSPENDE === 'true'");
    expect(bloco).toContain('acesso mantido');
  });

  it('parcela atrasada não marca o pedido como falho', async () => {
    // O pedido foi pago: a parcela 1 entrou e o acesso saiu. `failed` aqui
    // reescreveria a história da compra.
    const fonte = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    const i = fonte.indexOf('ehParcelaDeCarne');
    const bloco = fonte.slice(i, i + 1400);
    expect(bloco).toContain("suspende ? 'pending' : order.status");
    expect(bloco).not.toMatch(/updateStatus\([\s\S]{0,60}'failed'/);
  });
});
