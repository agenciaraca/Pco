import { describe, it, expect } from 'vitest';
import { pagarmeProvider } from '../server/payments/providers/pagarme';
import { paypalProvider } from '../server/payments/providers/paypal';
import type { PaymentGateway } from '../server/payments/types';

/**
 * Webhook forjado não pode marcar pedido como pago.
 *
 * Até 27/ago/2026 dois provedores aceitavam qualquer corpo:
 *
 * - **Pagar.me** só fazia `JSON.parse`, com um comentário dizendo que a
 *   autenticação era "feita pelo nginx upstream em prod". Não há nginx na
 *   frente da app no VPS atual — o processo PM2 responde direto na 3035 — e
 *   mesmo que houvesse, verificação que vive fora do repositório é
 *   verificação que ninguém vê sumir.
 * - **PayPal** idem, com um comentário dizendo que a verificação real "entra
 *   em sprint dedicado".
 *
 * O efeito era um bypass de pagamento: quem soubesse o `externalId` de um
 * pedido pendente — o próprio comprador — mandava um `order.paid` forjado e
 * recebia o curso sem pagar.
 *
 * A regra que estes testes cobram é **falha fechada**: sem credencial de
 * webhook configurada, nenhum evento é aceito. Antes, a ausência de
 * configuração era o caminho feliz.
 */

const gateway = {
  id: 'gw-teste',
  provider: 'pagarme',
  mode: 'test',
  label: 'Teste',
  active: true,
} as unknown as PaymentGateway;

const semCredencial = { apiKey: 'k', apiSecret: 's', webhookSecret: '' };

const CORPO_PAGO_PAGARME = JSON.stringify({
  type: 'order.paid',
  data: { id: 'pedido-da-vitima', status: 'paid' },
});

const CORPO_PAGO_PAYPAL = JSON.stringify({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: { id: 'pedido-da-vitima', status: 'COMPLETED' },
});

describe('Pagar.me', () => {
  it('sem webhookSecret configurado, recusa — não é caminho feliz', async () => {
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      semCredencial,
      CORPO_PAGO_PAGARME,
      {},
    );
    expect(evt).toBeNull();
  });

  it('sem cabeçalho Authorization, recusa', async () => {
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      { ...semCredencial, webhookSecret: 'usuario:senha' },
      CORPO_PAGO_PAGARME,
      {},
    );
    expect(evt).toBeNull();
  });

  it('com credencial errada, recusa', async () => {
    const errada = Buffer.from('usuario:chutei').toString('base64');
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      { ...semCredencial, webhookSecret: 'usuario:senha' },
      CORPO_PAGO_PAGARME,
      { authorization: `Basic ${errada}` },
    );
    expect(evt).toBeNull();
  });

  it('cabeçalho que não é Basic não passa', async () => {
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      { ...semCredencial, webhookSecret: 'usuario:senha' },
      CORPO_PAGO_PAGARME,
      { authorization: 'Bearer usuario:senha' },
    );
    expect(evt).toBeNull();
  });

  it('com a credencial certa, aceita e normaliza o evento', async () => {
    const certa = Buffer.from('usuario:senha').toString('base64');
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      { ...semCredencial, webhookSecret: 'usuario:senha' },
      CORPO_PAGO_PAGARME,
      { authorization: `Basic ${certa}` },
    );
    expect(evt).not.toBeNull();
    expect(evt!.status).toBe('paid');
    expect(evt!.externalId).toBe('pedido-da-vitima');
  });

  it('credencial certa mas corpo inválido não vira evento', async () => {
    const certa = Buffer.from('usuario:senha').toString('base64');
    const evt = await pagarmeProvider.parseWebhook(
      gateway,
      { ...semCredencial, webhookSecret: 'usuario:senha' },
      'isto não é json',
      { authorization: `Basic ${certa}` },
    );
    expect(evt).toBeNull();
  });
});

describe('PayPal', () => {
  it('sem Webhook ID configurado, recusa', async () => {
    const evt = await paypalProvider.parseWebhook(
      { ...gateway, provider: 'paypal' } as PaymentGateway,
      semCredencial,
      CORPO_PAGO_PAYPAL,
      {},
    );
    expect(evt).toBeNull();
  });

  it('sem clientId/secret não tenta verificar — e não aceita', async () => {
    const evt = await paypalProvider.parseWebhook(
      { ...gateway, provider: 'paypal' } as PaymentGateway,
      { apiKey: '', apiSecret: '', webhookSecret: 'WH-123' },
      CORPO_PAGO_PAYPAL,
      {},
    );
    expect(evt).toBeNull();
  });

  it('corpo inválido não vira evento nem por acidente', async () => {
    const evt = await paypalProvider.parseWebhook(
      { ...gateway, provider: 'paypal' } as PaymentGateway,
      { apiKey: 'id', apiSecret: 'segredo', webhookSecret: 'WH-123' },
      'isto não é json',
      {},
    );
    expect(evt).toBeNull();
  });
});
