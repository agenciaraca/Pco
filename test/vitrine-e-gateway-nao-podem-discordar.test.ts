import { describe, it, expect, vi, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PARCELAS_MAXIMAS,
  VALOR_MINIMO_DA_PARCELA_CENTS,
  parcelasPara,
  valorDaParcelaCents,
  opcoesDeParcelamento,
} from '../shared/parcelamento';
import { pagarmeProvider } from '../server/payments/providers/pagarme';
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
    expect(parcelasPara(0)).toBe(1);
    expect(parcelasPara(-1)).toBe(1);
    expect(parcelasPara(Number.NaN)).toBe(1);
  });

  it('respeita o piso por parcela em vez de fatiar centavos', () => {
    // R$ 20,00 só comporta 4 parcelas de R$ 5,00.
    expect(parcelasPara(VALOR_MINIMO_DA_PARCELA_CENTS * 4)).toBe(4);
    // Abaixo do piso, é à vista.
    expect(parcelasPara(VALOR_MINIMO_DA_PARCELA_CENTS - 1)).toBe(1);
  });

  it('não passa do teto, por mais caro que seja o curso', () => {
    expect(parcelasPara(10_000_000)).toBe(PARCELAS_MAXIMAS);
  });

  it.each(PRECOS_REAIS)('para %i centavos, chega ao teto', (preco) => {
    expect(parcelasPara(preco)).toBe(PARCELAS_MAXIMAS);
  });

  it('é sem juros: toda opção cobra o mesmo total', () => {
    const opcoes = opcoesDeParcelamento(119_980);
    expect(opcoes.length).toBeGreaterThan(1);
    for (const o of opcoes) expect(o.total).toBe(119_980);
  });

  it('sempre inclui o à vista — quem quer pagar 1x tem de conseguir', () => {
    for (const preco of [...PRECOS_REAIS, 700, 50_000]) {
      expect(opcoesDeParcelamento(preco).some((o) => o.number === 1)).toBe(true);
    }
  });
});

describe('o que a vitrine anuncia é o que o gateway aceita', () => {
  it.each([...PRECOS_REAIS, 700, 50_000])(
    'para %i centavos, o Pagar.me recebe exatamente as parcelas anunciadas',
    async (preco) => {
      const f = fetchFalso();
      vi.stubGlobal('fetch', f);
      await pagarmeProvider.createPayment(gateway, creds, entrada(preco));

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
      expect(enviadas.length).toBe(parcelasPara(preco));
      expect(Math.max(...enviadas.map((o) => o.number))).toBe(parcelasPara(preco));
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
  it('a vitrine lê do módulo compartilhado, e não de um número solto', async () => {
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server/public/projections.ts'),
      'utf-8',
    );
    expect(fonte).toContain("from '../../shared/parcelamento'");
    // Era exatamente esta linha que mentia para o comprador.
    expect(fonte).not.toContain('installments = priceCents != null ? 12');
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
