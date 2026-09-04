// Provider 'mock' — sandbox local que simula um gateway real.
// Útil para testar checkout e webhooks sem depender de API externa.
//
// Comportamento:
// - createPayment retorna externalId aleatório + checkoutUrl para uma página
//   interna que mostra dados e botão "Confirmar pagamento" (que dispara o webhook).
// - parseWebhook aceita qualquer body com { externalId, status }.

import crypto from 'node:crypto';
import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';

export const mockProvider: PaymentProviderImpl = {
  async createPayment(_gateway, _creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const externalId = `mock_${crypto.randomBytes(8).toString('hex')}`;
    const params = new URLSearchParams({
      externalId,
      amount: String(input.amountCents),
      currency: input.currency,
      description: input.description,
      orderId: input.metadata.orderId ?? '',
    });
    return {
      externalId,
      status: 'pending',
      checkoutUrl: `/checkout/mock?${params.toString()}`,
    };
  },

  async parseWebhook(_gateway, _creds, rawBody: string): Promise<WebhookEvent | null> {
    try {
      const data = JSON.parse(rawBody) as {
        externalId?: string;
        status?: string;
        metadata?: Record<string, string>;
      };
      if (!data.externalId) return null;
      const status = (data.status ?? 'paid') as WebhookEvent['status'];
      return {
        externalId: data.externalId,
        status,
        rawPayload: data,
        metadata: data.metadata,
      };
    } catch {
      return null;
    }
  },

  async refundPayment(_gateway, _creds, externalId, amountCents): Promise<RefundResult> {
    return {
      externalRefundId: `refund_${externalId}_${Date.now()}`,
      refundedCents: amountCents ?? 0,
      status: 'refunded',
    };
  },
  /**
   * Não fala com ninguém — e diz isso. Responder "OK" aqui sem ressalva faria
   * o sandbox parecer prova de que a integração real funciona.
   */
  async ping() {
    return {
      ok: true,
      alcancou: true,
      message: 'Sandbox local: não há gateway externo para consultar.',
    };
  },
};
