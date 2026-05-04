// Provider PayPal — REST v2 (Orders API).
// Doc: https://developer.paypal.com/docs/api/orders/v2/

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from './types';
import { PaymentProviderError } from './types';

function apiBase(mode: 'test' | 'live'): string {
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(
  base: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new PaymentProviderError('PAYPAL_AUTH_FAILED', `HTTP ${res.status}`);
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

export const paypalProvider: PaymentProviderImpl = {
  async createPayment(gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey || !creds.apiSecret) {
      throw new PaymentProviderError(
        'NO_KEY',
        'PayPal requer apiKey (client_id) e apiSecret (client_secret).',
      );
    }
    const base = apiBase(gateway.mode);
    const token = await getAccessToken(base, creds.apiKey, creds.apiSecret);

    const res = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.metadata.orderId ?? 'order',
            description: input.description.slice(0, 127),
            amount: {
              currency_code: input.currency,
              value: (input.amountCents / 100).toFixed(2),
            },
            custom_id: input.metadata.orderId ?? '',
          },
        ],
        application_context: {
          return_url: `${publicOrigin()}/perfil?payment=success`,
          cancel_url: `${publicOrigin()}/cursos?payment=cancel`,
          user_action: 'PAY_NOW',
        },
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new PaymentProviderError(
        'PAYPAL_CREATE_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
      );
    }
    const order = (await res.json()) as {
      id: string;
      status: string;
      links: Array<{ rel: string; href: string }>;
    };
    const approveLink = order.links.find((l) => l.rel === 'approve')?.href;
    return {
      externalId: order.id,
      status: order.status === 'COMPLETED' ? 'paid' : 'pending',
      checkoutUrl: approveLink,
    };
  },

  async parseWebhook(_gateway, _creds, rawBody): Promise<WebhookEvent | null> {
    // PayPal verifica via webhook id + headers; em prod usar o endpoint /verify-webhook-signature.
    // Por enquanto só parseia (verificação real entra em sprint dedicado).
    try {
      const evt = JSON.parse(rawBody) as {
        event_type: string;
        resource: { id: string; status?: string };
      };
      let status: WebhookEvent['status'] = 'processing';
      if (
        evt.event_type === 'CHECKOUT.ORDER.APPROVED' ||
        evt.event_type === 'PAYMENT.CAPTURE.COMPLETED' ||
        evt.resource.status === 'COMPLETED'
      ) {
        status = 'paid';
      } else if (
        evt.event_type === 'PAYMENT.CAPTURE.DENIED' ||
        evt.event_type === 'CHECKOUT.ORDER.VOIDED'
      ) {
        status = 'failed';
      } else if (evt.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
        status = 'refunded';
      }
      return { externalId: evt.resource.id, status, rawPayload: evt };
    } catch {
      return null;
    }
  },
};

function publicOrigin(): string {
  return process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
}
