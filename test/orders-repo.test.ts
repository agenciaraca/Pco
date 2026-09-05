import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/payments/orders-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ord-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/orders-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

const baseInput = {
  userId: 'u1',
  userEmail: 'u1@test.com',
  productId: 'p1',
  productSnapshot: {
    name: 'Curso X',
    priceCents: 10000,
    currency: 'BRL',
    kind: 'course' as const,
    refId: 'c1',
  },
  gatewayId: 'gw1',
  gatewayProvider: 'mock' as const,
  amountCents: 10000,
  currency: 'BRL',
};

describe('orders-repo CRUD', () => {
  it('createOrder gera id e status pending', async () => {
    const o = await repo.createOrder(baseInput);
    expect(o.id).toMatch(/^ord-/);
    expect(o.status).toBe('pending');
    expect(o.amountCents).toBe(10000);
    expect(o.events.length).toBeGreaterThanOrEqual(1);
  });

  it('findById retorna order criada', async () => {
    const created = await repo.createOrder(baseInput);
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('attachGatewayResult atualiza externalId + checkoutUrl', async () => {
    const o = await repo.createOrder(baseInput);
    await repo.attachGatewayResult(o.id, {
      externalId: 'ext-123',
      checkoutUrl: 'https://gw.com/pay',
      status: 'pending',
    });
    const after = await repo.findById(o.id);
    expect(after!.externalId).toBe('ext-123');
    expect(after!.checkoutUrl).toBe('https://gw.com/pay');
  });

  it('findByExternalId encontra order via externalId', async () => {
    const o = await repo.createOrder(baseInput);
    await repo.attachGatewayResult(o.id, {
      externalId: 'unique-ext-456',
      status: 'pending',
    });
    // `gatewayId` passou a ser obrigatorio em 3/set/2026: o webhook autentica
    // pelo gateway da URL, e buscar no acervo inteiro fazia um gateway
    // confirmar pedido de outro.
    const found = await repo.findByExternalId('unique-ext-456', 'gw1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(o.id);
  });

  it('updateStatus transiciona pending → paid', async () => {
    const o = await repo.createOrder(baseInput);
    const updated = await repo.updateStatus(o.id, 'paid', 'webhook');
    expect(updated!.status).toBe('paid');
    expect(updated!.paidAt).toBeDefined();
    expect(updated!.events.some((e) => e.note === 'webhook')).toBe(true);
  });

  it('listForUser filtra por userId', async () => {
    await repo.createOrder({ ...baseInput, userId: 'u-other' });
    const u1Orders = await repo.listForUser('u1');
    // `every` numa lista vazia é verdadeiro: sem esta linha, o caso passaria
    // justamente se `listForUser` deixasse de devolver qualquer coisa — que é
    // a falha que ele existe para pegar.
    expect(u1Orders.length).toBeGreaterThan(0);
    expect(u1Orders.every((o) => o.userId === 'u1')).toBe(true);
  });

  it('listAll retorna ordenado desc por createdAt', async () => {
    const all = await repo.listAll();
    expect(all.length).toBeGreaterThan(0);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.createdAt >= all[i]!.createdAt).toBe(true);
    }
  });
});

/**
 * REG-012 · o `externalId` só vale dentro do gateway que o emitiu.
 *
 * `externalId` é o id **no gateway**, e nada garante que dois provedores não
 * usem a mesma string. Buscar no acervo inteiro fazia o webhook de um gateway
 * confirmar o pedido de outro. A primeira versão desta correção deixou
 * `gatewayId` opcional "para não quebrar uso administrativo" — uso que não
 * existe: parâmetro opcional numa guarda é falha aberta esperando o próximo
 * chamador esquecer.
 */
describe('REG-012 · findByExternalId não cruza gateways', () => {
  it('mesmo externalId em dois gateways devolve o pedido do gateway pedido', async () => {
    const naGw1 = await repo.createOrder({ ...baseInput, gatewayId: 'gw-um' });
    const naGw2 = await repo.createOrder({ ...baseInput, gatewayId: 'gw-dois' });
    // A colisão que o mundo real produz: o mesmo id em provedores diferentes.
    await repo.attachGatewayResult(naGw1.id, { externalId: 'colisao-1', status: 'pending' });
    await repo.attachGatewayResult(naGw2.id, { externalId: 'colisao-1', status: 'pending' });

    expect((await repo.findByExternalId('colisao-1', 'gw-um'))!.id).toBe(naGw1.id);
    expect((await repo.findByExternalId('colisao-1', 'gw-dois'))!.id).toBe(naGw2.id);
  });

  it('gateway que não emitiu aquele id não encontra nada', async () => {
    const o = await repo.createOrder({ ...baseInput, gatewayId: 'gw-um' });
    await repo.attachGatewayResult(o.id, { externalId: 'so-da-gw-um', status: 'pending' });
    expect(await repo.findByExternalId('so-da-gw-um', 'gw-tres')).toBeNull();
  });
});

/**
 * REG-006 · "equivalente" quer dizer equivalente.
 *
 * A proteção contra duplo clique devolve um pedido em aberto em vez de criar
 * outro. A primeira versão comparava **só o produto** — e o cupom é aplicado
 * ANTES desta busca. Quem criava um pedido sem cupom, voltava em cinco minutos
 * e digitava o código recebia de volta o pedido velho: o servidor validava o
 * cupom com sucesso, respondia 201, e a pessoa **pagava o preço cheio** logo
 * depois de o sistema ter dito que o desconto valia. O mesmo acontecia ao
 * trocar de gateway — a pessoa era mandada pagar onde não escolheu.
 */
describe('REG-006 · acharPendenteEquivalente compara valor e gateway', () => {
  const dono = 'u-reuso';

  async function pendente(amountCents: number, gatewayId: string, metodo: 'pix' | 'boleto' | 'credit_card' | null = null) {
    return await repo.createOrder({
      ...baseInput,
      userId: dono,
      productId: 'p-reuso',
      gatewayId,
      metodo,
      amountCents,
    });
  }

  it('reusa o pedido quando produto, valor e gateway batem', async () => {
    const original = await pendente(10000, 'gw1');
    const achado = await repo.acharPendenteEquivalente(dono, {
      productId: 'p-reuso',
      amountCents: 10000,
      metodo: null,
    });
    expect(achado, 'duplo clique continua sendo um pedido só').not.toBeNull();
    expect(achado!.id).toBe(original.id);
  });

  it('NÃO reusa quando o valor mudou — é o caso do cupom', async () => {
    // O pedido de 100,00 já existe (criado acima). Agora a pessoa digita um
    // cupom de 20%: o checkout procura por 80,00 e não pode achar o de 100,00.
    const comDesconto = await repo.acharPendenteEquivalente(dono, {
      productId: 'p-reuso',
      amountCents: 8000,
      metodo: null,
    });
    expect(comDesconto, 'cupom aceito não pode devolver pedido sem desconto').toBeNull();
  });

  it('NÃO reusa quando o método mudou', async () => {
    // Era o gateway, e virou o método em 5/set/2026: com roteamento, quem
    // escolhe gateway é a tabela, e o gateway do pedido pode até mudar depois
    // da criação, quando o reserva cobra. O que a pessoa escolheu — e o que
    // não pode ser trocado por baixo — é pagar no pix ou no boleto.
    const outroMetodo = await repo.acharPendenteEquivalente(dono, {
      productId: 'p-reuso',
      amountCents: 10000,
      metodo: 'boleto',
    });
    expect(outroMetodo, 'ninguém é mandado pagar como não escolheu').toBeNull();
  });

  it('reusa o pedido do MESMO método, ainda que o gateway seja outro', async () => {
    // A guarda do fallback: se o principal recusa e o reserva cobra, o pedido
    // muda de gateway. Chavear pelo gateway faria a retentativa seguinte criar
    // um segundo pedido — cobrança dobrada pela porta dos fundos.
    const original = await pendente(7700, 'gw1', 'pix');
    await repo.attachGatewayResult(original.id, {
      externalId: 'ext-1',
      status: 'pending',
      gatewayId: 'gw-reserva',
      gatewayProvider: 'mock',
    });
    const achado = await repo.acharPendenteEquivalente(dono, {
      productId: 'p-reuso',
      amountCents: 7700,
      metodo: 'pix',
    });
    expect(achado?.id).toBe(original.id);
    expect(achado?.gatewayId, 'o pedido passou a ser do gateway que cobrou').toBe('gw-reserva');
  });

  it('NÃO reusa pedido de outra pessoa', async () => {
    const deOutro = await repo.acharPendenteEquivalente('u-alheio', {
      productId: 'p-reuso',
      amountCents: 10000,
      metodo: null,
    });
    expect(deOutro).toBeNull();
  });

  it('NÃO reusa pedido fora da janela de tempo', async () => {
    const fora = await repo.acharPendenteEquivalente(
      dono,
      { productId: 'p-reuso', amountCents: 10000, metodo: null },
      // Janela de 1ms: o pedido criado agora já está velho demais.
      1,
    );
    expect(fora).toBeNull();
  });

  it('NÃO reusa pedido que já saiu de aberto', async () => {
    const pago = await pendente(4200, 'gw1');
    await repo.updateStatus(pago.id, 'paid', 'teste');
    const achado = await repo.acharPendenteEquivalente(dono, {
      productId: 'p-reuso',
      amountCents: 4200,
      metodo: null,
    });
    expect(achado, 'pedido pago não é pedido em aberto').toBeNull();
  });
});
