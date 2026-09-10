import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Quando o reserva cobra, o pedido tem de dizer que o principal recusou.
 *
 * ## O caso, relatado como outra coisa
 *
 * Em 10/set/2026 o dono relatou: *"o gateway de cartão é o Pagar.me e ele
 * encaminha para o Asaas"*. Não havia bug de roteamento — o Pagar.me **é** o
 * primeiro candidato, é tentado, e recusa com
 * `The checkout payment method is not available for this account.`, porque a
 * conta não tem o produto Checkout habilitado. O reserva assume e a venda
 * passa. O sistema faz o certo.
 *
 * O que faltava era o sistema **contar isso**. `cobrar()` monta `tentativas[]`
 * com cada recusa e os três checkouts faziam
 * `const { gateway, resultado } = await cobrar(...)`, descartando exatamente a
 * informação que responde a pergunta do dono. Nada em lugar nenhum dizia por
 * quê — nem o pedido, nem o painel, nem o log.
 *
 * A frase só aparecia quando **todos** falhavam. Ou seja: a venda que morre
 * conta o porquê e a venda que passa pelo reserva não, que é o inverso do
 * útil — a que morre alguém percebe.
 *
 * ## E a metade que a medição achou
 *
 * Aquele caminho de falha gravava a mensagem **crua**. Medido no banco de
 * produção, os pedidos falhados de 5 e 6/set carregam
 * `{"errors":[{"code":"invalid_object","description":"…"}]}` inteiro dentro de
 * `events[].note` — que é o que `providers/ping-http.ts` existe para não
 * fazer, com o motivo escrito lá: corpo de gateway traz id de conta e
 * `request-id`, e `events` sobe para um bucket sem lifecycle. A regra valia
 * para o card do admin e não valia para o pedido, que é onde o dado fica.
 */

const criados: string[] = [];
let repo: typeof import('../server/payments/orders-repo');
let fala: typeof import('../server/payments/o-reserva-fala');

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-reserva-'));
  criados.push(dir);
  process.env.DATA_DIR = dir;
  vi.resetModules();
  repo = await import('../server/payments/orders-repo');
  fala = await import('../server/payments/o-reserva-fala');
});

afterAll(async () => {
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (const d of criados) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

/** O corpo exato que o Pagar.me devolveu em produção, em 5/set/2026. */
const CORPO_PAGARME =
  '{"message":"The checkout payment method is not available for this account."}';
/** E o do Asaas, em 6/set. */
const CORPO_ASAAS =
  '{"errors":[{"code":"invalid_object","description":"Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente."}]}';

const RECUSA_PAGARME = {
  gatewayId: 'gw-pagarme',
  provider: 'pagarme',
  ok: false,
  codigo: 'PAGARME_CREATE_FAILED',
  mensagem: CORPO_PAGARME,
};

async function pedido(gatewayProvider: 'pagarme' | 'asaas' = 'pagarme') {
  return await repo.createOrder({
    userId: 'u-1',
    userEmail: 'a@pco.local',
    productId: 'p-1',
    productSnapshot: {
      name: 'Formação',
      priceCents: 119_980,
      currency: 'BRL',
      kind: 'course',
      refId: 'c-1',
    },
    gatewayId: `gw-${gatewayProvider}`,
    gatewayProvider,
    amountCents: 119_980,
    currency: 'BRL',
  });
}

describe('o pedido conta que o reserva assumiu, e por quê', () => {
  it('grava quem recusou, o motivo e quem cobrou', async () => {
    const o = await pedido('pagarme');
    const atualizado = await repo.attachGatewayResult(o.id, {
      externalId: 'pay_123',
      status: 'pending',
      gatewayId: 'gw-asaas',
      gatewayProvider: 'asaas',
      tentativas: [RECUSA_PAGARME, { gatewayId: 'gw-asaas', provider: 'asaas', ok: true }],
    });

    const nota = atualizado!.events.at(-1)!.note!;
    expect(nota).toContain('Pagar.me');
    expect(nota).toContain('recusou');
    // A frase que responde a pergunta do dono.
    expect(nota).toContain('checkout payment method is not available');
    expect(nota).toContain('Asaas');
    expect(nota).toContain('pay_123');
  });

  it('a venda normal não ganha ruído: sem recusa, a nota é a de sempre', async () => {
    const o = await pedido('asaas');
    const atualizado = await repo.attachGatewayResult(o.id, {
      externalId: 'pay_ok',
      status: 'pending',
      gatewayId: 'gw-asaas',
      gatewayProvider: 'asaas',
      tentativas: [{ gatewayId: 'gw-asaas', provider: 'asaas', ok: true }],
    });
    const nota = atualizado!.events.at(-1)!.note!;
    expect(nota).toBe('Gateway respondeu (externalId pay_ok)');
    expect(fala.notaDizQueCaiuNoReserva(nota)).toBe(false);
  });

  /*
    O caminho JSON dizia sempre "Gateway respondeu", mesmo com o gateway
    trocado — só o de banco registrava a troca. Produção roda no banco, então a
    divergência ficava invisível justamente para quem a leria em teste.
  */
  it('o caminho JSON registra a troca de gateway como o de banco', async () => {
    const o = await pedido('pagarme');
    const atualizado = await repo.attachGatewayResult(o.id, {
      externalId: 'pay_456',
      status: 'pending',
      gatewayId: 'gw-asaas',
      gatewayProvider: 'asaas',
    });
    expect(atualizado!.events.at(-1)!.note).toContain('asaas');
  });
});

describe('a frase atravessa; o corpo do gateway, não', () => {
  it('extrai a frase do formato do Pagar.me', () => {
    expect(fala.frasePublica(CORPO_PAGARME)).toBe(
      'The checkout payment method is not available for this account.',
    );
  });

  it('extrai a frase do formato aninhado do Asaas', () => {
    expect(fala.frasePublica(CORPO_ASAAS)).toBe(
      'Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente.',
    );
  });

  it('a estrutura do JSON não vaza junto', () => {
    const frase = fala.frasePublica(CORPO_ASAAS)!;
    expect(frase).not.toContain('invalid_object');
    expect(frase).not.toContain('{');
    expect(frase).not.toContain('errors');
  });

  /*
    A trava que justifica gravar a frase no pedido. `events` entra no despejo
    do banco e sobe para um bucket sem lifecycle: o que passa aqui fica para
    sempre. Errar para o lado de calar custa uma consulta ao log — que tem
    rotação.
  */
  it('cala quando o texto parece credencial', () => {
    expect(fala.frasePublica('{"message":"invalid key sk_live_9f2ab7c1d4e5"}')).toBeNull();
    expect(fala.frasePublica('{"message":"Authorization: Bearer eyJhbGciOi"}')).toBeNull();
    expect(fala.frasePublica('{"message":"api_key= abc"}')).toBeNull();
    // Sequência longa sem espaço: a cara de um token ecoado por validação.
    expect(fala.frasePublica('{"message":"AKIAIOSFODNN7EXAMPLEKEYVALUE123"}')).toBeNull();
  });

  it('não devolve string vazia disfarçada de frase', () => {
    expect(fala.frasePublica('')).toBeNull();
    expect(fala.frasePublica(null)).toBeNull();
    expect(fala.frasePublica('{"codigo":42}')).toBeNull();
  });

  it('trunca o que for longo demais para uma nota', () => {
    const longa = fala.frasePublica(JSON.stringify({ message: 'erro. '.repeat(200) }))!;
    expect(longa.length).toBeLessThanOrEqual(180);
    expect(longa.endsWith('…')).toBe(true);
  });
});

describe('quando nenhum gateway cobra, a nota traz TODAS as recusas', () => {
  it('não conta só o que o último respondeu', () => {
    const nota = fala.notaDaFalha(
      [
        RECUSA_PAGARME,
        {
          gatewayId: 'gw-asaas',
          provider: 'asaas',
          ok: false,
          codigo: 'ASAAS_PAYMENT_FAILED',
          mensagem: CORPO_ASAAS,
        },
      ],
      new Error(CORPO_ASAAS),
    );
    // O último costuma ser o reserva: sem a primeira metade, quem lê o pedido
    // vê o erro do Asaas e não sabe que o Pagar.me recusou antes.
    expect(nota).toContain('Pagar.me');
    expect(nota).toContain('Asaas');
    expect(nota).toContain('CPF ou CNPJ');
  });

  it('o corpo cru do gateway não entra na nota', () => {
    const nota = fala.notaDaFalha([RECUSA_PAGARME], new Error(CORPO_PAGARME));
    expect(nota).not.toContain('{"message"');
    expect(nota).toContain('The checkout payment method is not available');
  });

  it('sem frase segura, diz onde está o detalhe em vez de despejar o corpo', () => {
    const nota = fala.notaDaFalha(
      [
        {
          gatewayId: 'gw-x',
          provider: 'stripe',
          ok: false,
          codigo: 'X',
          mensagem: 'sk_live_abcdef123456',
        },
      ],
      new Error('sk_live_abcdef123456'),
    );
    expect(nota).not.toContain('sk_live');
    expect(nota).toContain('log');
  });
});

describe('as tentativas chegam ao catch de quem chamou', () => {
  it('o erro carrega o que foi tentado, sem trocar de tipo', async () => {
    const { cobrar, tentativasDoErro } = await import('../server/payments/cobranca');
    const { PaymentProviderError } = await import('../server/payments/providers/types');

    const gw = {
      id: 'gw-sem-provider',
      provider: 'provider-que-nao-existe',
      active: true,
    } as never;

    let capturado: unknown = null;
    try {
      await cobrar({
        candidatos: [gw],
        input: {
          amountCents: 100,
          currency: 'BRL',
          description: 'x',
          customerEmail: 'a@b.c',
          metadata: { orderId: 'ord-1', userId: 'u-1' },
        },
      });
    } catch (err) {
      capturado = err;
    }

    expect(capturado).toBeInstanceOf(Error);
    // Embrulhar o erro quebraria os `instanceof PaymentProviderError` a jusante,
    // e é por eles que o checkout decide o que dizer a quem está comprando.
    expect(capturado instanceof PaymentProviderError).toBe(false);
    const tentativas = tentativasDoErro(capturado);
    expect(tentativas).toHaveLength(1);
    expect(tentativas[0].codigo).toBe('PROVIDER_NOT_IMPLEMENTED');
  });

  it('erro sem anotação nenhuma devolve lista vazia, não estoura', async () => {
    const { tentativasDoErro } = await import('../server/payments/cobranca');
    expect(tentativasDoErro(new Error('qualquer'))).toEqual([]);
    expect(tentativasDoErro(null)).toEqual([]);
    expect(tentativasDoErro('texto')).toEqual([]);
  });
});

describe('o painel mede quantas vendas o reserva salvou', () => {
  const agora = new Date().toISOString();

  /** A nota de uma venda que o reserva salvou, montada pelo código de verdade. */
  function notaDeQueda(externalId: string): string {
    return fala.notaDaCobranca({
      tentativas: [RECUSA_PAGARME, { gatewayId: 'gw-asaas', provider: 'asaas', ok: true }],
      externalId,
      providerQueCobrou: 'asaas',
    });
  }

  it('conta a queda e diz o motivo mais comum', () => {
    const queda = {
      createdAt: agora,
      events: [{ note: 'Order criada' }, { note: notaDeQueda('pay_1') }],
    };
    const direta = {
      createdAt: agora,
      events: [{ note: 'Order criada' }, { note: 'Gateway respondeu (externalId pay_2)' }],
    };

    const m = fala.medirQuedasNoReserva([queda, queda, direta]);
    expect(m.quedas).toBe(2);
    expect(m.cobrancas).toBe(3);
    expect(m.motivoMaisComum).toContain('Pagar.me');
  });

  /*
    Metade destes casos é sobre **não** alarmar, pela mesma razão do alarme de
    checkout: alarme que grita à toa vira filtro de caixa de entrada.
  */
  it('pedido sem cobrança criada não entra na base', () => {
    const m = fala.medirQuedasNoReserva([{ createdAt: agora, events: [{ note: 'Order criada' }] }]);
    expect(m.quedas).toBe(0);
    expect(m.cobrancas).toBe(0);
  });

  it('fora da janela não conta', () => {
    const velho = new Date(Date.now() - 80 * 3_600_000).toISOString();
    const m = fala.medirQuedasNoReserva(
      [
        {
          createdAt: velho,
          events: [{ note: notaDeQueda('pay_velho') }],
        },
      ],
      48,
    );
    expect(m.quedas).toBe(0);
  });

  it('venda que o principal cobrou não vira aviso', () => {
    const m = fala.medirQuedasNoReserva([
      {
        createdAt: agora,
        events: [{ note: 'Gateway respondeu (externalId pay_3)' }],
      },
    ]);
    expect(m.quedas).toBe(0);
    expect(m.cobrancas).toBe(1);
  });
});
