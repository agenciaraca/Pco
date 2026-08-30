// Provider Stripe — usa REST API direta (sem SDK pra evitar dep pesada).
// Doc: https://stripe.com/docs/api/checkout/sessions/create
//      https://stripe.com/docs/webhooks/signatures

import crypto from 'node:crypto';
import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';
import { PaymentProviderError } from './types';
import { origemPublica } from '../../origem-publica';

const API_BASE = 'https://api.stripe.com/v1';

function formEncode(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export const stripeProvider: PaymentProviderImpl = {
  async createPayment(_gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Stripe apiKey ausente.');
    }

    const params: Record<string, string> = {
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': input.description.slice(0, 250),
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][quantity]': '1',
      mode: 'payment',
      customer_email: input.customerEmail,
      success_url:
        input.successUrl ?? `${publicOrigin()}/perfil?payment=success&order={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl ?? `${publicOrigin()}/cursos?payment=cancel`,
    };
    // Metadata
    for (const [k, v] of Object.entries(input.metadata)) {
      params[`metadata[${k}]`] = v;
    }
    if (input.customerName) params.customer_name = input.customerName;

    const res = await fetch(`${API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode(params),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      const msg =
        (j as { error?: { message?: string } })?.error?.message ??
        `Stripe HTTP ${res.status}`;
      throw new PaymentProviderError('STRIPE_CREATE_FAILED', msg);
    }
    const session = (await res.json()) as {
      id: string;
      url: string;
      payment_status: string;
    };
    return {
      externalId: session.id,
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
      checkoutUrl: session.url,
    };
  },

  async parseWebhook(_gateway, creds, rawBody: string, headers): Promise<WebhookEvent | null> {
    const sigHeader = headers['stripe-signature'];
    if (!sigHeader) return null;
    if (!creds.webhookSecret) {
      // Sem secret configurado, não confia no webhook
      return null;
    }
    // Stripe-Signature: t=...,v1=...
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('='))) as Record<
      string,
      string
    >;
    const ts = parts.t;
    const v1 = parts.v1;
    if (!ts || !v1) return null;

    const signedPayload = `${ts}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', creds.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) {
      return null;
    }

    try {
      const evt = JSON.parse(rawBody) as {
        type: string;
        data: { object: { id: string; payment_status?: string; status?: string } };
      };
      const obj = evt.data.object;
      // Mapeia tipos Stripe → status interno
      let status: WebhookEvent['status'] = 'processing';
      if (
        evt.type === 'checkout.session.completed' ||
        evt.type === 'payment_intent.succeeded'
      ) {
        status = 'paid';
      } else if (
        evt.type.startsWith('payment_intent.payment_failed') ||
        evt.type === 'checkout.session.expired'
      ) {
        status = 'failed';
      } else if (evt.type === 'charge.refunded') {
        status = 'refunded';
      }
      return {
        externalId: obj.id,
        status,
        rawPayload: evt,
      };
    } catch {
      return null;
    }
  },

  async refundPayment(_gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Stripe apiKey ausente.');
    }
    // externalId é o session id (cs_...). Pegamos o payment_intent.
    const sessRes = await fetch(`${API_BASE}/checkout/sessions/${externalId}`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    });
    if (!sessRes.ok) {
      const j = await sessRes.json().catch(() => null);
      throw new PaymentProviderError(
        'STRIPE_LOOKUP_FAILED',
        (j as { error?: { message?: string } })?.error?.message ?? `HTTP ${sessRes.status}`,
      );
    }
    const sess = (await sessRes.json()) as { payment_intent?: string | null };
    if (!sess.payment_intent) {
      throw new PaymentProviderError('NO_PAYMENT', 'Sessão sem payment_intent.');
    }
    const params: Record<string, string> = { payment_intent: sess.payment_intent };
    if (amountCents !== undefined) params.amount = String(amountCents);
    const refRes = await fetch(`${API_BASE}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode(params),
    });
    if (!refRes.ok) {
      const j = await refRes.json().catch(() => null);
      throw new PaymentProviderError(
        'STRIPE_REFUND_FAILED',
        (j as { error?: { message?: string } })?.error?.message ?? `HTTP ${refRes.status}`,
      );
    }
    const r = (await refRes.json()) as { id: string; amount: number; status: string };
    return {
      externalRefundId: r.id,
      refundedCents: r.amount,
      status: r.status === 'succeeded' ? 'refunded' : 'pending',
    };
  },
};

function publicOrigin(): string {
  return origemPublica();
}
