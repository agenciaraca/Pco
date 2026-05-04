// Provider Pagar.me — REST API v5.
// Doc: https://docs.pagar.me/reference/criar-pedido-1

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';
import { PaymentProviderError } from './types';

const API_BASE = 'https://api.pagar.me/core/v5';

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export const pagarmeProvider: PaymentProviderImpl = {
  async createPayment(_gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Pagar.me apiKey ausente.');
    }
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            amount: input.amountCents,
            description: input.description.slice(0, 256),
            quantity: 1,
          },
        ],
        customer: {
          name: input.customerName ?? input.customerEmail.split('@')[0],
          email: input.customerEmail,
          type: 'individual',
        },
        payments: [
          {
            payment_method: 'checkout',
            checkout: {
              expires_in: 3600,
              accepted_payment_methods: ['credit_card', 'boleto', 'pix'],
              success_url: `${publicOrigin()}/perfil?payment=success`,
            },
          },
        ],
        metadata: input.metadata,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new PaymentProviderError(
        'PAGARME_CREATE_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
      );
    }
    const order = (await res.json()) as {
      id: string;
      status: string;
      checkouts?: Array<{ payment_url?: string }>;
    };
    return {
      externalId: order.id,
      status: order.status === 'paid' ? 'paid' : 'pending',
      checkoutUrl: order.checkouts?.[0]?.payment_url,
    };
  },

  async parseWebhook(_gateway, _creds, rawBody): Promise<WebhookEvent | null> {
    // Pagar.me autentica via Basic auth no header — feito pelo nginx upstream em prod.
    // Aqui só parseamos o body.
    try {
      const evt = JSON.parse(rawBody) as {
        type: string;
        data: { id: string; status?: string };
      };
      let status: WebhookEvent['status'] = 'processing';
      if (evt.type === 'order.paid' || evt.data.status === 'paid') status = 'paid';
      else if (evt.type === 'order.canceled') status = 'canceled';
      else if (evt.type === 'charge.refunded') status = 'refunded';
      return { externalId: evt.data.id, status, rawPayload: evt };
    } catch {
      return null;
    }
  },

  async refundPayment(_gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Pagar.me apiKey ausente.');
    }
    // externalId é o order id. Precisamos do charge id (pega via GET order)
    const oRes = await fetch(`${API_BASE}/orders/${externalId}`, {
      headers: { Authorization: basicAuth(creds.apiKey) },
    });
    if (!oRes.ok) {
      throw new PaymentProviderError('PAGARME_LOOKUP_FAILED', `HTTP ${oRes.status}`);
    }
    const order = (await oRes.json()) as {
      charges?: Array<{ id: string; status: string }>;
    };
    const charge = order.charges?.find((c) => c.status === 'paid') ?? order.charges?.[0];
    if (!charge) {
      throw new PaymentProviderError('NO_CHARGE', 'Order sem charges para reembolsar.');
    }
    const body: Record<string, unknown> = {};
    if (amountCents !== undefined) body.amount = amountCents;
    const r = await fetch(`${API_BASE}/charges/${charge.id}/refund`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new PaymentProviderError(
        'PAGARME_REFUND_FAILED',
        JSON.stringify(j) || `HTTP ${r.status}`,
      );
    }
    const data = (await r.json()) as { id?: string; amount?: number; status?: string };
    return {
      externalRefundId: data.id,
      refundedCents: data.amount ?? amountCents ?? 0,
      status: data.status === 'refunded' || data.status === 'canceled' ? 'refunded' : 'pending',
    };
  },
};

function publicOrigin(): string {
  return process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
}
