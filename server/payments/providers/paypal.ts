// Provider PayPal — REST v2 (Orders API).
// Doc: https://developer.paypal.com/docs/api/orders/v2/

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
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

  /**
   * Webhook do PayPal, com a assinatura verificada de verdade.
   *
   * Até 27/ago/2026 este método só fazia `JSON.parse`, com um comentário
   * dizendo que "a verificação real entra em sprint dedicado". O efeito: quem
   * soubesse o `externalId` de um pedido pendente — o próprio comprador, por
   * exemplo — mandava um `PAYMENT.CAPTURE.COMPLETED` forjado e recebia o curso
   * sem pagar.
   *
   * A verificação usa `/v1/notifications/verify-webhook-signature`, o
   * endpoint que o próprio PayPal oferece para isso. O `webhookSecret` guarda
   * o **Webhook ID** (é assim que o PayPal identifica a assinatura; não é um
   * segredo HMAC como no Stripe).
   *
   * **Falha fechada:** sem Webhook ID configurado, ou se o PayPal não
   * confirmar a assinatura, este método devolve `null` e o pedido não muda de
   * status. Antes, a ausência de configuração era o caminho feliz.
   */
  async parseWebhook(gateway, creds, rawBody, headers): Promise<WebhookEvent | null> {
    const webhookId = creds.webhookSecret?.trim();
    if (!webhookId) {
      // Sem o Webhook ID não há como distinguir PayPal de qualquer um.
      return null;
    }
    if (!creds.apiKey || !creds.apiSecret) return null;

    let evt: { event_type: string; resource: { id: string; status?: string } };
    try {
      evt = JSON.parse(rawBody) as typeof evt;
    } catch {
      return null;
    }

    const base = apiBase(gateway.mode);
    try {
      const token = await getAccessToken(base, creds.apiKey, creds.apiSecret);
      const verifica = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          // O corpo precisa ir como objeto, e é sobre ELE que a assinatura
          // é conferida — por isso o `rawBody` é reaproveitado, e não um
          // objeto reconstruído com as chaves em outra ordem.
          webhook_event: JSON.parse(rawBody) as unknown,
        }),
      });
      if (!verifica.ok) return null;
      const r = (await verifica.json()) as { verification_status?: string };
      if (r.verification_status !== 'SUCCESS') return null;
    } catch {
      // Rede fora, credencial errada, PayPal indisponível: não confirma nada.
      return null;
    }

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
  },

  async refundPayment(gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey || !creds.apiSecret) {
      throw new PaymentProviderError(
        'NO_KEY',
        'PayPal requer apiKey + apiSecret.',
      );
    }
    const base = apiBase(gateway.mode);
    const token = await getAccessToken(base, creds.apiKey, creds.apiSecret);

    // externalId é o order id. Precisamos do capture id (capture.id dentro do purchase_unit).
    const oRes = await fetch(`${base}/v2/checkout/orders/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!oRes.ok) {
      throw new PaymentProviderError('PAYPAL_LOOKUP_FAILED', `HTTP ${oRes.status}`);
    }
    const order = (await oRes.json()) as {
      purchase_units?: Array<{
        payments?: { captures?: Array<{ id: string }> };
      }>;
      status?: string;
    };
    const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) {
      throw new PaymentProviderError(
        'NO_CAPTURE',
        'Order sem captures (não foi pago ainda?).',
      );
    }
    const body: Record<string, unknown> = {};
    if (amountCents !== undefined) {
      body.amount = {
        value: (amountCents / 100).toFixed(2),
        currency_code: 'USD',
      };
    }
    const r = await fetch(`${base}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new PaymentProviderError(
        'PAYPAL_REFUND_FAILED',
        JSON.stringify(j) || `HTTP ${r.status}`,
      );
    }
    const data = (await r.json()) as {
      id?: string;
      amount?: { value?: string };
      status?: string;
    };
    return {
      externalRefundId: data.id,
      refundedCents: data.amount?.value
        ? Math.round(Number(data.amount.value) * 100)
        : amountCents ?? 0,
      status: data.status === 'COMPLETED' ? 'refunded' : 'pending',
    };
  },
};

function publicOrigin(): string {
  return process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
}
