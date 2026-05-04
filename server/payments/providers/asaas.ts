// Provider Asaas — REST API direta.
// Doc: https://docs.asaas.com/reference/criar-novo-pagamento

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from './types';
import { PaymentProviderError } from './types';

function apiBase(mode: 'test' | 'live'): string {
  return mode === 'live'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

export const asaasProvider: PaymentProviderImpl = {
  async createPayment(gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Asaas apiKey ausente.');
    }
    const base = apiBase(gateway.mode);

    // Asaas requer customer pré-criado. Cria/busca um.
    const customerRes = await fetch(`${base}/customers`, {
      method: 'POST',
      headers: {
        access_token: creds.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.customerName ?? input.customerEmail.split('@')[0],
        email: input.customerEmail,
      }),
    });
    if (!customerRes.ok) {
      const j = await customerRes.json().catch(() => null);
      throw new PaymentProviderError(
        'ASAAS_CUSTOMER_FAILED',
        JSON.stringify(j) || `HTTP ${customerRes.status}`,
      );
    }
    const customer = (await customerRes.json()) as { id: string };

    // Cria payment (PIX por padrão; admin pode escolher outro tipo via metadata)
    const billingType = (input.metadata.billingType as string) ?? 'PIX';
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // 3 dias

    const paymentRes = await fetch(`${base}/payments`, {
      method: 'POST',
      headers: {
        access_token: creds.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customer.id,
        billingType,
        value: input.amountCents / 100,
        dueDate,
        description: input.description,
        externalReference: input.metadata.orderId ?? '',
      }),
    });
    if (!paymentRes.ok) {
      const j = await paymentRes.json().catch(() => null);
      throw new PaymentProviderError(
        'ASAAS_PAYMENT_FAILED',
        JSON.stringify(j) || `HTTP ${paymentRes.status}`,
      );
    }
    const payment = (await paymentRes.json()) as {
      id: string;
      invoiceUrl?: string;
      status: string;
    };

    // Pega QR Code PIX se billingType=PIX
    let qrCode: string | undefined;
    if (billingType === 'PIX') {
      const qrRes = await fetch(`${base}/payments/${payment.id}/pixQrCode`, {
        headers: { access_token: creds.apiKey },
      });
      if (qrRes.ok) {
        const qr = (await qrRes.json()) as { encodedImage?: string; payload?: string };
        qrCode = qr.payload ?? qr.encodedImage;
      }
    }

    return {
      externalId: payment.id,
      status: payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' ? 'paid' : 'pending',
      checkoutUrl: payment.invoiceUrl,
      qrCode,
    };
  },

  async parseWebhook(_gateway, creds, rawBody, headers): Promise<WebhookEvent | null> {
    // Asaas valida via header asaas-access-token (que deve bater com webhookSecret OU apiKey)
    const token = headers['asaas-access-token'];
    if (creds.webhookSecret && token !== creds.webhookSecret) {
      return null;
    }
    try {
      const evt = JSON.parse(rawBody) as {
        event: string;
        payment: { id: string; status: string };
      };
      if (!evt.payment?.id) return null;
      let status: WebhookEvent['status'] = 'processing';
      if (
        evt.event === 'PAYMENT_CONFIRMED' ||
        evt.event === 'PAYMENT_RECEIVED' ||
        evt.payment.status === 'CONFIRMED' ||
        evt.payment.status === 'RECEIVED'
      ) {
        status = 'paid';
      } else if (evt.event === 'PAYMENT_REFUNDED') {
        status = 'refunded';
      } else if (
        evt.event === 'PAYMENT_OVERDUE' ||
        evt.event === 'PAYMENT_DELETED'
      ) {
        status = 'failed';
      }
      return { externalId: evt.payment.id, status, rawPayload: evt };
    } catch {
      return null;
    }
  },
};
