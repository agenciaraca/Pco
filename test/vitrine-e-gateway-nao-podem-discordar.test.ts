import { describe, it, expect, vi, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PARCELAS_MAXIMAS_POR_METODO,
  VALOR_MINIMO_DA_PARCELA_CENTS,
  parcelasPara,
  valorDaParcelaCents,
  opcoesDeParcelamento,
} from '../shared/parcelamento';
import { pagarmeProvider } from '../server/payments/providers/pagarme';
import { asaasProvider } from '../server/payments/providers/asaas';
import type { PaymentGateway } from '../server/payments/types';

/**
 * A vitrine dizia "ou 12x de R$ X" em três telas — página do curso, listagem e
 * carrinho — enquanto o pedido enviado ao Pagar.me oferecia
 * `installments: [{ number: 1 }]`. A pessoa decidia comprar por causa de uma
 * condição que o checkout não praticava, sobre o item de maior ticket do
 * catálogo.
 *
 * O defeito não era um número errado: eram **duas cópias** da mesma regra, uma
 * em cada ponta, livres para divergir. Este arquivo cobra que continuem
 * saindo do mesmo lugar.
 */

const gateway = { id: 'gw-1', provider: 'pagarme', mode: 'live' } as unknown as PaymentGateway;
const creds = { apiKey: 'sk_test', apiSecret: '', webhookSecret: '' };

/** Os dois preços reais do catálogo, mais as bordas. */
const PRECOS_REAIS = [119_980, 349_650];

/** O teto do cartão, que é o caso da maioria dos casos abaixo. */
const TETO_CARTAO = PARCELAS_MAXIMAS_POR_METODO.credit_card;

function entrada(amountCents: number) {
  return {
    amountCents,
    currency: 'BRL',
    description: 'Curso',
    customerEmail: 'aluna@exemplo.com',
    customerName: 'Aluna Exemplo',
    metadata: { orderId: 'ord-1' },
  };
}

function fetchFalso() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'or_1', status: 'pending', checkouts: [{ payment_url: 'x' }] }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a regra de parcelamento', () => {
  it('nunca oferece 0x, nem para valor zero ou inválido', () => {
    expect(parcelasPara(0, TETO_CARTAO)).toBe(1);
    expect(parcelasPara(-1, TETO_CARTAO)).toBe(1);
    expect(parcelasPara(Number.NaN, TETO_CARTAO)).toBe(1);
  });

  it('respeita o piso por parcela em vez de fatiar centavos', () => {
    // R$ 20,00 só comporta 4 parcelas de R$ 5,00.
    expect(parcelasPara(VALOR_MINIMO_DA_PARCELA_CENTS * 4, TETO_CARTAO)).toBe(4);
    // Abaixo do piso, é à vista.
    expect(parcelasPara(VALOR_MINIMO_DA_PARCELA_CENTS - 1, TETO_CARTAO)).toBe(1);
  });

  it('não passa do teto, por mais caro que seja o curso', () => {
    expect(parcelasPara(10_000_000, TETO_CARTAO)).toBe(TETO_CARTAO);
  });

  it.each(PRECOS_REAIS)('para %i centavos, chega ao teto', (preco) => {
    expect(parcelasPara(preco, TETO_CARTAO)).toBe(TETO_CARTAO);
  });

  it('é sem juros: toda opção cobra o mesmo total', () => {
    const opcoes = opcoesDeParcelamento(119_980, TETO_CARTAO);
    expect(opcoes.length).toBeGreaterThan(1);
    for (const o of opcoes) expect(o.total).toBe(119_980);
  });

  it('sempre inclui o à vista — quem quer pagar 1x tem de conseguir', () => {
    for (const preco of [...PRECOS_REAIS, 700, 50_000]) {
      expect(opcoesDeParcelamento(preco, TETO_CARTAO).some((o) => o.number === 1)).toBe(true);
    }
  });
});

describe('o que a vitrine anuncia é o que o gateway aceita', () => {
  it.each([...PRECOS_REAIS, 700, 50_000])(
    'para %i centavos, o Pagar.me recebe exatamente as parcelas anunciadas',
    async (preco) => {
      const f = fetchFalso();
      vi.stubGlobal('fetch', f);
      await pagarmeProvider.createPayment(gateway, creds, {
        ...entrada(preco),
        metodo: 'credit_card',
      });

      const [, init] = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
        string,
        { body: string },
      ];
      const corpo = JSON.parse(init.body) as {
        payments: Array<{
          checkout: { credit_card: { installments: Array<{ number: number; total: number }> } };
        }>;
      };
      const enviadas = corpo.payments[0]!.checkout.credit_card.installments;

      // O número que a vitrine imprime ("ou Nx de ...") é `parcelasPara`.
      expect(enviadas.length).toBe(parcelasPara(preco, TETO_CARTAO));
      expect(Math.max(...enviadas.map((o) => o.number))).toBe(parcelasPara(preco, TETO_CARTAO));
      for (const o of enviadas) expect(o.total).toBe(preco);
    },
  );

  it('o valor exibido bate com o total dividido', () => {
    // R$ 1.199,80 em 12x → R$ 99,98 (o arredondamento é de exibição; o total
    // cobrado continua sendo o preço cheio, porque não há juros).
    expect(valorDaParcelaCents(119_980, 12)).toBe(9_998);
  });
});

describe('a regra não pode voltar a existir em duas cópias', () => {
  it('a vitrine lê o que o gateway faz, e não um número solto', async () => {
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server/public/projections.ts'),
      'utf-8',
    );
    // A vitrine passou a ler de `condicoes`, que é quem cruza a política da
    // escola com a capacidade de quem vai cobrar. Ler direto de
    // `shared/parcelamento` voltaria a anunciar a política — que é o que a
    // escola gostaria de oferecer, não o que o checkout pratica.
    expect(fonte).toContain("from '../payments/condicoes'");
    // Era exatamente esta linha que mentia para o comprador.
    expect(fonte).not.toContain('installments = priceCents != null ? 12');
  });

  it('e `condicoes` continua saindo do módulo compartilhado', async () => {
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server/payments/condicoes.ts'),
      'utf-8',
    );
    expect(fonte).toContain("from '../../shared/parcelamento'");
  });

  it('o Pagar.me lê do módulo compartilhado, e não de uma lista fixa', async () => {
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server/payments/providers/pagarme.ts'),
      'utf-8',
    );
    expect(fonte).toContain("from '../../../shared/parcelamento'");
    expect(fonte).not.toContain('installments: [{ number: 1');
  });
});

/**
 * "12x no cartão ou 6x no boleto" — a regra que o dono pediu em 5/set/2026.
 *
 * Ela não cabia numa constante, e é isso que estes casos guardam: **a política
 * da escola não é a capacidade do gateway**. O objeto `boleto` da API v5 do
 * Pagar.me não tem campo de parcelamento; o Asaas tem `installmentCount`, e o
 * que ele emite é um carnê de N boletos. Prometer 6x no boleto sem olhar quem
 * cobra é repetir, em outro método, exatamente o defeito que este arquivo
 * existe para impedir.
 */
describe('cada método promete o que o gateway dele faz', () => {
  it('a política é 12x no cartão e 6x no boleto', () => {
    expect(PARCELAS_MAXIMAS_POR_METODO.credit_card).toBe(12);
    expect(PARCELAS_MAXIMAS_POR_METODO.boleto).toBe(6);
    // Não existe pix parcelado.
    expect(PARCELAS_MAXIMAS_POR_METODO.pix).toBe(1);
  });

  it('o Pagar.me declara que não parcela boleto — porque a API dele não tem o campo', () => {
    expect(pagarmeProvider.parcelasMaximas.credit_card).toBe(12);
    expect(pagarmeProvider.parcelasMaximas.boleto).toBe(1);
  });

  it('o Asaas declara o carnê, e é ele quem sustenta o 6x', () => {
    expect(asaasProvider.parcelasMaximas.boleto).toBe(6);
  });

  it('e parcela cartão em 12x — é o que sustenta a venda sem o Pagar.me', () => {
    // Entrou em 5/set/2026, às pressas e por um motivo concreto: a conta do
    // Pagar.me não tem o produto "Checkout" habilitado e recusava toda compra.
    // Sem isto, mover o cartão para o Asaas salvaria a venda e mataria o 12x.
    expect(asaasProvider.parcelasMaximas.credit_card).toBe(12);
  });

  it('cartão parcelado no Asaas manda installmentCount, como o carnê', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pay_c', status: 'PENDING', invoiceUrl: 'https://x' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);

    await asaasProvider.createPayment(
      { id: 'gw', provider: 'asaas', mode: 'live' } as unknown as PaymentGateway,
      creds,
      { ...entrada(119_980), metodo: 'credit_card' },
    );
    const chamadas = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const [, init] = chamadas[1] as [string, { body: string }];
    const corpo = JSON.parse(init.body) as {
      billingType: string;
      installmentCount?: number;
      totalValue?: number;
    };
    expect(corpo.billingType).toBe('CREDIT_CARD');
    expect(corpo.installmentCount).toBe(12);
    expect(corpo.totalValue).toBe(1199.8);
  });

  it('o boleto parcelado sai como carnê, com o total fechando no preço', async () => {
    // `totalValue` em vez de `installmentValue`: assim o arredondamento cai na
    // última parcela e a soma bate com o valor anunciado na vitrine. Dividir
    // aqui deixaria centavos sobrando contra o preço da página.
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pay_1', status: 'PENDING', invoiceUrl: 'https://x' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);

    await asaasProvider.createPayment(
      { id: 'gw', provider: 'asaas', mode: 'live' } as unknown as PaymentGateway,
      creds,
      { ...entrada(119_980), customerDocument: '39053344705', metodo: 'boleto' },
    );

    const chamadas = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // A primeira chamada cria o cliente; a segunda, a cobrança.
    const [, init] = chamadas[1] as [string, { body: string }];
    const corpo = JSON.parse(init.body) as {
      billingType: string;
      installmentCount?: number;
      totalValue?: number;
      value: number;
    };
    expect(corpo.billingType).toBe('BOLETO');
    expect(corpo.installmentCount).toBe(6);
    expect(corpo.totalValue).toBe(1199.8);
  });

  it('e no pix não vai parcelamento nenhum', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pay_2', status: 'PENDING', invoiceUrl: 'https://x' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);

    await asaasProvider.createPayment(
      { id: 'gw', provider: 'asaas', mode: 'live' } as unknown as PaymentGateway,
      creds,
      { ...entrada(119_980), metodo: 'pix' },
    );
    const chamadas = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const [, init] = chamadas[1] as [string, { body: string }];
    const corpo = JSON.parse(init.body) as { installmentCount?: number };
    expect(corpo.installmentCount).toBeUndefined();
  });
});
