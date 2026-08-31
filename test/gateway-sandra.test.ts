import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  sandraProvider,
  documentoValido,
  lerOpcoes,
  traduzirStatus,
  vencimentoEm,
} from '../server/payments/providers/sandra';
import { PaymentProviderError } from '../server/payments/providers/types';
import { ALL_PROVIDERS, getPaymentProvider } from '../server/payments/providers/registry';
import type { PaymentGateway } from '../server/payments/types';

/**
 * O provider da Sandra difere dos outros em três pontos que custam dinheiro se
 * estiverem errados, e é isso que estes testes vigiam:
 *
 * 1. A chave de repetição é o id do pedido. Sem ela, retentativa de rede ou
 *    duplo clique viram DUAS cobranças reais para a mesma compra.
 * 2. CPF/CNPJ é obrigatório e é conferido aqui — para que erro de formulário
 *    volte como erro de formulário, e não como "o gateway falhou".
 * 3. O 502 traz `invoiceId`: a fatura existe. Repetir cria cobrança duplicada.
 */

const gateway = {
  id: 'gw-sandra',
  provider: 'sandra',
  displayName: 'Sandra',
  mode: 'live',
  active: true,
  apiKey: 'cifrada',
  options: {
    baseUrl: 'https://app.sandra.com.vc/',
    tenantSlug: 'pco',
    metodo: 'pix',
    diasParaVencer: 3,
  },
  createdAt: '',
  updatedAt: '',
} as unknown as PaymentGateway;

const creds = { apiKey: 'chave-real', apiSecret: '', webhookSecret: 'segredo' };

const entrada = {
  amountCents: 119_860,
  currency: 'BRL',
  description: 'Curso de Psicanálise Clínica Online',
  customerEmail: 'maria@exemplo.com',
  customerName: 'Maria Souza',
  customerDocument: '390.533.447-05',
  metadata: { orderId: 'ord-123', userId: 'u-1' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function respostaFalsa(status: number, corpo: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  })) as unknown as typeof fetch;
}

describe('o provider está registrado como os outros', () => {
  it('aparece na lista e resolve pelo registry', () => {
    expect(getPaymentProvider('sandra')).toBeTruthy();
    expect(ALL_PROVIDERS.some((p) => p.id === 'sandra' && p.implemented)).toBe(true);
  });
});

describe('criar cobrança', () => {
  it('manda a chave de repetição com o id do pedido', async () => {
    const f = respostaFalsa(201, {
      id: 'chg-1',
      status: 'pending',
      checkoutUrl: 'https://pagar/1',
    });
    vi.stubGlobal('fetch', f);

    const r = await sandraProvider.createPayment(gateway, creds, entrada);
    expect(r.externalId).toBe('chg-1');
    expect(r.checkoutUrl).toBe('https://pagar/1');

    const [url, init] = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://app.sandra.com.vc/api/v1/tenants/pco/charges');
    expect(init.headers['idempotency-key']).toBe('ord-123');
    const corpo = JSON.parse(init.body) as { amount: number; method: string; payer: { document: string } };
    // Centavos viram reais uma vez só — dividir duas vezes cobraria R$ 11,98.
    expect(corpo.amount).toBe(1198.6);
    expect(corpo.method).toBe('pix');
    expect(corpo.payer.document).toBe('390.533.447-05');
  });

  it('recusa antes de chamar quando não há id de pedido', async () => {
    const f = respostaFalsa(201, {});
    vi.stubGlobal('fetch', f);
    await expect(
      sandraProvider.createPayment(gateway, creds, { ...entrada, metadata: {} }),
    ).rejects.toThrow(PaymentProviderError);
    expect(f).not.toHaveBeenCalled();
  });

  it('recusa antes de chamar quando falta o documento', async () => {
    const f = respostaFalsa(201, {});
    vi.stubGlobal('fetch', f);
    await expect(
      sandraProvider.createPayment(gateway, creds, { ...entrada, customerDocument: '' }),
    ).rejects.toThrow(/obrigatório/i);
    expect(f).not.toHaveBeenCalled();
  });

  it('recusa documento com dígito verificador errado, sem ir à rede', async () => {
    const f = respostaFalsa(201, {});
    vi.stubGlobal('fetch', f);
    await expect(
      sandraProvider.createPayment(gateway, creds, { ...entrada, customerDocument: '111.111.111-11' }),
    ).rejects.toThrow(/não é válido/i);
    expect(f).not.toHaveBeenCalled();
  });

  it('o 202 diz para esperar, não para criar outra', async () => {
    vi.stubGlobal('fetch', respostaFalsa(202, {}));
    await expect(sandraProvider.createPayment(gateway, creds, entrada)).rejects.toThrow(
      /não crie outra/i,
    );
  });

  it('o 502 carrega o invoiceId e desaconselha a repetição', async () => {
    vi.stubGlobal(
      'fetch',
      respostaFalsa(502, { error: 'gateway_error', invoiceId: 'inv-9' }),
    );
    await expect(sandraProvider.createPayment(gateway, creds, entrada)).rejects.toThrow(
      /inv-9[\s\S]*não crie outra/i,
    );
  });

  it('erro de validação chega com o campo e o motivo', async () => {
    vi.stubGlobal(
      'fetch',
      respostaFalsa(400, { error: 'invalid_request', campo: 'payer.document', motivo: 'documento_invalido' }),
    );
    await expect(sandraProvider.createPayment(gateway, creds, entrada)).rejects.toThrow(
      /payer\.document: documento_invalido/,
    );
  });

  it('sem baseUrl ou tenantSlug, nem tenta', async () => {
    const f = respostaFalsa(201, {});
    vi.stubGlobal('fetch', f);
    const semConfig = { ...gateway, options: {} } as unknown as PaymentGateway;
    await expect(sandraProvider.createPayment(semConfig, creds, entrada)).rejects.toThrow(
      /baseUrl/,
    );
    expect(f).not.toHaveBeenCalled();
  });
});

describe('aviso de volta (ainda não emitido pela Sandra)', () => {
  const corpo = JSON.stringify({ cobranca: { id: 'chg-1', status: 'paid' } });
  const assinar = (ts: string, body: string, segredo = 'segredo') =>
    createHmac('sha256', segredo).update(`${ts}.${body}`).digest('hex');

  it('aceita quando a assinatura bate e o carimbo é recente', async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const ev = await sandraProvider.parseWebhook!(gateway, creds, corpo, {
      'x-sandra-signature': `v1=${assinar(ts, corpo)}`,
      'x-sandra-timestamp': ts,
    });
    expect(ev?.externalId).toBe('chg-1');
    expect(ev?.status).toBe('paid');
  });

  it('recusa assinatura errada', async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const ev = await sandraProvider.parseWebhook!(gateway, creds, corpo, {
      'x-sandra-signature': `v1=${assinar(ts, corpo, 'outro-segredo')}`,
      'x-sandra-timestamp': ts,
    });
    expect(ev).toBeNull();
  });

  it('recusa carimbo velho, mesmo com assinatura boa (replay)', async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 3600);
    const ev = await sandraProvider.parseWebhook!(gateway, creds, corpo, {
      'x-sandra-signature': `v1=${assinar(ts, corpo)}`,
      'x-sandra-timestamp': ts,
    });
    expect(ev).toBeNull();
  });

  it('sem segredo configurado, não aceita nada', async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const ev = await sandraProvider.parseWebhook!(
      gateway,
      { ...creds, webhookSecret: '' },
      corpo,
      { 'x-sandra-signature': `v1=${assinar(ts, corpo)}`, 'x-sandra-timestamp': ts },
    );
    expect(ev).toBeNull();
  });
});

describe('partes puras', () => {
  it('valida CPF e CNPJ de verdade', () => {
    expect(documentoValido('390.533.447-05')).toBe(true);
    expect(documentoValido('11.222.333/0001-81')).toBe(true);
    expect(documentoValido('123.456.789-00')).toBe(false);
    expect(documentoValido('000.000.000-00')).toBe(false);
    expect(documentoValido('')).toBe(false);
  });

  it('traduz os estados da Sandra sem inventar', () => {
    expect(traduzirStatus('paid')).toBe('paid');
    expect(traduzirStatus('cancelled')).toBe('canceled');
    expect(traduzirStatus('refunded')).toBe('refunded');
    // Vencida e renegociada NÃO são falha: o pedido segue pendente.
    expect(traduzirStatus('overdue')).toBe('pending');
    expect(traduzirStatus('renegotiated')).toBe('pending');
  });

  it('opções têm padrão sensato e recusam método inventado', () => {
    const o = lerOpcoes({ baseUrl: 'https://x/', tenantSlug: 'p', metodo: 'cheque' });
    expect(o.metodo).toBe('pix');
    expect(o.baseUrl).toBe('https://x');
    expect(o.diasParaVencer).toBe(3);
  });

  it('o vencimento é uma data no futuro, no formato da Sandra', () => {
    const d = vencimentoEm(3, new Date('2026-08-31T12:00:00Z'));
    expect(d).toBe('2026-09-03');
  });
});
