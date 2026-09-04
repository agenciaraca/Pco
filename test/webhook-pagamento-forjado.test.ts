import { describe, it, expect } from 'vitest';
import { pagarmeProvider } from '../server/payments/providers/pagarme';
import { paypalProvider } from '../server/payments/providers/paypal';
import { asaasProvider } from '../server/payments/providers/asaas';
import { comparaSegura } from '../server/payments/providers/compara-segura';
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
 *
 * ## O que faltava aqui até 3/set/2026 (QA2-001 e QA2-002)
 *
 * Este arquivo importava **dois** provedores. O **Asaas** tinha o mesmo defeito
 * — `if (creds.webhookSecret && token !== creds.webhookSecret)`, ou seja, sem
 * segredo cadastrado a guarda **não rodava** e qualquer POST anônimo com um
 * `externalId` de pedido pendente marcava esse pedido como pago. Ele foi
 * corrigido na manhã de 3/set/2026 e a correção **subiu sem teste nenhum**,
 * num arquivo cujo nome promete exatamente essa cobertura.
 *
 * E `comparaSegura`, que é o **ponto único** de verificação de assinatura dos
 * dois provedores que a usam, não tinha teste em lugar algum do repositório.
 * Função de segurança sem teste é função de segurança que ninguém vê quebrar:
 * ela continua devolvendo `boolean`, e um `boolean` errado aqui é um curso
 * liberado sem pagamento.
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

describe('Asaas', () => {
  const gatewayAsaas = { ...gateway, provider: 'asaas' } as unknown as PaymentGateway;

  const CORPO_PAGO_ASAAS = JSON.stringify({
    event: 'PAYMENT_CONFIRMED',
    payment: { id: 'pedido-da-vitima', status: 'CONFIRMED' },
  });

  it('sem webhookSecret configurado, recusa — era este o buraco', async () => {
    // A guarda antiga era `if (creds.webhookSecret && token !== ...)`: sem
    // segredo ela nem rodava, e este caso passava direto para "pago".
    const evt = await asaasProvider.parseWebhook!(
      gatewayAsaas,
      semCredencial,
      CORPO_PAGO_ASAAS,
      { 'asaas-access-token': 'qualquer-coisa' },
    );
    expect(evt, 'sem segredo cadastrado, nada é aceito').toBeNull();
  });

  it('sem o cabeçalho de token, recusa', async () => {
    const evt = await asaasProvider.parseWebhook!(
      gatewayAsaas,
      { apiKey: 'k', apiSecret: 's', webhookSecret: 'segredo-certo' },
      CORPO_PAGO_ASAAS,
      {},
    );
    expect(evt).toBeNull();
  });

  it('com token errado, recusa', async () => {
    const evt = await asaasProvider.parseWebhook!(
      gatewayAsaas,
      { apiKey: 'k', apiSecret: 's', webhookSecret: 'segredo-certo' },
      CORPO_PAGO_ASAAS,
      { 'asaas-access-token': 'segredo-errado' },
    );
    expect(evt).toBeNull();
  });

  it('com o token certo, aceita e normaliza o evento', async () => {
    // Guarda contra "consertar" recusando tudo: o caminho legítimo tem de
    // continuar funcionando, senão o gateway deixa de confirmar pagamento e
    // ninguém percebe até alguém reclamar que comprou e não recebeu.
    const evt = await asaasProvider.parseWebhook!(
      gatewayAsaas,
      { apiKey: 'k', apiSecret: 's', webhookSecret: 'segredo-certo' },
      CORPO_PAGO_ASAAS,
      { 'asaas-access-token': 'segredo-certo' },
    );
    expect(evt).not.toBeNull();
    expect(evt!.externalId).toBe('pedido-da-vitima');
    expect(evt!.status).toBe('paid');
  });

  it('token certo mas corpo inválido não vira evento', async () => {
    const evt = await asaasProvider.parseWebhook!(
      gatewayAsaas,
      { apiKey: 'k', apiSecret: 's', webhookSecret: 'segredo-certo' },
      'isto não é json',
      { 'asaas-access-token': 'segredo-certo' },
    );
    expect(evt).toBeNull();
  });
});

/**
 * `comparaSegura` — o ponto único, sem teste até agora.
 *
 * Ela existe porque a mesma regra vivia em dois provedores e divergiu: o
 * Pagar.me comparava em tempo constante, o Asaas com `!==`. Um ponto único que
 * ninguém testa é um ponto único de falha, não de segurança.
 */
describe('comparaSegura', () => {
  it('aceita apenas o valor idêntico', () => {
    expect(comparaSegura('segredo', 'segredo')).toBe(true);
    expect(comparaSegura('segredo', 'segred0')).toBe(false);
    expect(comparaSegura('segredo', 'Segredo')).toBe(false);
  });

  it('tamanhos diferentes devolvem false sem lançar', () => {
    // `crypto.timingSafeEqual` **lança** com buffers de tamanhos diferentes.
    // Se essa proteção sumir, a rota de webhook passa a estourar 500 em vez de
    // recusar — e um 500 num caminho de pagamento é indistinguível, de fora,
    // de indisponibilidade do gateway.
    expect(() => comparaSegura('curto', 'muito mais longo que o outro')).not.toThrow();
    expect(comparaSegura('curto', 'muito mais longo que o outro')).toBe(false);
    expect(comparaSegura('', 'x')).toBe(false);
  });

  it('strings vazias iguais são iguais — e não é um caso feliz', () => {
    // Duas vazias batem, e é por isso que **quem chama tem de recusar o
    // segredo ausente ANTES de comparar**. Os dois provedores fazem isso
    // (`if (!creds.webhookSecret) return null`); este caso existe para que
    // ninguém remova aquela linha achando que a comparação protege sozinha.
    expect(comparaSegura('', '')).toBe(true);
  });

  it('trata bytes multibyte sem quebrar', () => {
    expect(comparaSegura('seguro-ção', 'seguro-ção')).toBe(true);
    expect(comparaSegura('seguro-ção', 'seguro-cao')).toBe(false);
  });
});
