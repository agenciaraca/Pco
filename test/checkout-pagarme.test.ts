import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pagarmeProvider } from '../server/payments/providers/pagarme';
import { documentoValido, formatarDocumento } from '../shared/documento';
import { checkoutSchema, publicCheckoutSchema } from '../shared/schemas';

/**
 * Por que estes testes existem.
 *
 * Uma aluna tentou comprar e recebeu, do Pagar.me:
 *
 *   payments[0].checkout.boleto: The boleto field is required when boleto
 *   payment is accepted
 *   order.payments[0].checkout.pix: The pix field is required when pix
 *   payment is accepted
 *
 * Pedíamos `accepted_payment_methods: ['credit_card','boleto','pix']` e não
 * mandávamos nenhum dos blocos de configuração que a API v5 cobra junto.
 * **Nenhuma compra por dentro do app se concluía.**
 *
 * No mesmo payload estava a segunda metade do problema: `"name":"mariadyduda"`,
 * que é o e-mail da compradora cortado no `@`. A rota `/payments/checkout`
 * mandava ao gateway só o e-mail — enquanto `/public/checkout`, que faz a mesma
 * coisa, sempre mandou nome, CPF e telefone. Duas rotas de compra com contratos
 * diferentes, e só uma funcionava.
 */

const CREDS = { apiKey: 'sk_test_x' } as never;
const GATEWAY = { id: 'gw-1', provider: 'pagarme' } as never;

const BASE = {
  amountCents: 119860,
  currency: 'BRL',
  description: 'Terapia Familiar Sistêmica',
  customerEmail: 'mariadyduda@example.com',
  metadata: { orderId: 'ord-1', userId: 'stude-1' },
};

/** CPF com DV correto, gerado para teste — não pertence a ninguém. */
const CPF_VALIDO = '52998224725';

let enviado: Record<string, unknown> | null = null;

beforeEach(() => {
  enviado = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          id: 'or_123',
          status: 'pending',
          checkouts: [{ payment_url: 'https://pagar.me/c/123' }],
        }),
      };
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function checkoutEnviado(): Record<string, unknown> {
  const pagamentos = (enviado as { payments: Array<{ checkout: Record<string, unknown> }> })
    .payments;
  return pagamentos[0]!.checkout;
}

describe('Pagar.me: método aceito sem bloco de configuração derruba a compra', () => {
  it('todo método em accepted_payment_methods tem o bloco correspondente', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, {
      ...BASE,
      customerName: 'Maria Eduarda',
      customerDocument: CPF_VALIDO,
    });
    const checkout = checkoutEnviado();
    const metodos = checkout.accepted_payment_methods as string[];
    expect(metodos.length).toBeGreaterThan(0);
    for (const m of metodos) {
      expect(checkout[m], `faltou o bloco de configuração de "${m}"`).toBeTruthy();
    }
  });

  it('com CPF, os três métodos são oferecidos', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, {
      ...BASE,
      customerName: 'Maria Eduarda',
      customerDocument: CPF_VALIDO,
    });
    const metodos = checkoutEnviado().accepted_payment_methods as string[];
    expect(metodos).toContain('credit_card');
    expect(metodos).toContain('pix');
    expect(metodos).toContain('boleto');
  });

  it('sem documento, boleto NÃO é oferecido — o gateway o recusaria', () => {
    // Oferecer boleto sem CPF faz o Pagar.me recusar o pedido inteiro, e a
    // pessoa perde também o cartão e o pix. Melhor não oferecer o que não dá.
    return pagarmeProvider
      .createPayment(GATEWAY, CREDS, { ...BASE, customerName: 'Maria' })
      .then(() => {
        const checkout = checkoutEnviado();
        const metodos = checkout.accepted_payment_methods as string[];
        expect(metodos).not.toContain('boleto');
        expect(checkout.boleto).toBeUndefined();
        expect(metodos).toContain('pix');
        expect(checkout.pix).toBeTruthy();
      });
  });
});

describe('Pagar.me: quem compra tem nome', () => {
  it('o nome enviado é o nome, não o e-mail cortado no @', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, {
      ...BASE,
      customerName: 'Maria Eduarda',
      customerDocument: CPF_VALIDO,
    });
    const cliente = (enviado as { customer: Record<string, unknown> }).customer;
    expect(cliente.name).toBe('Maria Eduarda');
    expect(cliente.name).not.toBe('mariadyduda');
  });

  it('o documento vai só com dígitos, e tipado', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, {
      ...BASE,
      customerName: 'Maria Eduarda',
      customerDocument: formatarDocumento(CPF_VALIDO),
    });
    const cliente = (enviado as { customer: Record<string, unknown> }).customer;
    expect(cliente.document).toBe(CPF_VALIDO);
    expect(cliente.document_type).toBe('CPF');
    expect(cliente.type).toBe('individual');
  });

  it('CNPJ muda o tipo do cliente para company', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, {
      ...BASE,
      customerName: 'Escola PCO',
      customerDocument: '11222333000181',
    });
    const cliente = (enviado as { customer: Record<string, unknown> }).customer;
    expect(cliente.document_type).toBe('CNPJ');
    expect(cliente.type).toBe('company');
  });

  it('sem nome, o fallback antigo continua — não quebra quem já chamava assim', async () => {
    await pagarmeProvider.createPayment(GATEWAY, CREDS, BASE);
    const cliente = (enviado as { customer: Record<string, unknown> }).customer;
    expect(cliente.name).toBe('mariadyduda');
    expect(cliente.document).toBeUndefined();
  });
});

describe('os dois checkouts pedem a mesma coisa', () => {
  /**
   * Foi a divergência entre eles que produziu a falha: o público pedia nome,
   * documento e telefone; o de dentro do app pedia só o id do produto.
   */
  it('checkoutSchema aceita name, document e whatsapp, como o público', () => {
    const campos = Object.keys(checkoutSchema.shape);
    for (const c of ['name', 'document', 'whatsapp']) {
      expect(campos, `checkoutSchema não aceita "${c}"`).toContain(c);
      expect(Object.keys(publicCheckoutSchema.shape)).toContain(c);
    }
  });

  it('os campos do comprador são opcionais — chamada antiga continua válida', () => {
    const r = checkoutSchema.safeParse({ productId: 'prod-1' });
    expect(r.success).toBe(true);
  });
});

describe('CPF: dígito verificador', () => {
  it('aceita CPF e CNPJ válidos, com ou sem pontuação', () => {
    expect(documentoValido(CPF_VALIDO)).toBe(true);
    expect(documentoValido(formatarDocumento(CPF_VALIDO))).toBe(true);
    expect(documentoValido('11222333000181')).toBe(true);
  });

  it('recusa dígito trocado, repetido e tamanho errado', () => {
    expect(documentoValido('52998224726')).toBe(false);
    expect(documentoValido('11111111111')).toBe(false);
    expect(documentoValido('123')).toBe(false);
    expect(documentoValido('')).toBe(false);
  });

  it('a máscara não deixa passar do tamanho de CNPJ', () => {
    expect(formatarDocumento('112223330001812222')).toBe('11.222.333/0001-81');
  });
});
