// Provider Asaas — REST API direta.
// Doc: https://docs.asaas.com/reference/criar-novo-pagamento

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';
import { PaymentProviderError } from './types';
import { comparaSegura } from './compara-segura';

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
    // Asaas valida via header `asaas-access-token`, que deve bater com o
    // `webhookSecret` cadastrado.
    //
    // Até 3/set/2026 a guarda era `if (creds.webhookSecret && token !== ...)`:
    // sem segredo cadastrado ela **não rodava**, e qualquer POST anônimo com um
    // `externalId` de pedido pendente marcava esse pedido como pago. Falha
    // aberta num caminho que libera curso. Os outros cinco provedores já
    // falhavam fechados; este era o único fora do padrão.
    //
    // Agora: sem segredo, o webhook é recusado. Configurar o segredo no
    // `/admin/payments/gateways` é pré-requisito para o Asaas confirmar
    // qualquer coisa — e é assim que deve ser.
    const token = headers['asaas-access-token'];
    if (!creds.webhookSecret) return null;
    if (!token || !comparaSegura(token, creds.webhookSecret)) return null;
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

  async refundPayment(gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Asaas apiKey ausente.');
    }
    const base = apiBase(gateway.mode);
    const body: Record<string, unknown> = {};
    if (amountCents !== undefined) body.value = amountCents / 100;
    const res = await fetch(`${base}/payments/${externalId}/refund`, {
      method: 'POST',
      headers: {
        access_token: creds.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new PaymentProviderError(
        'ASAAS_REFUND_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
      );
    }
    const r = (await res.json()) as { id?: string; value?: number; status?: string };
    return {
      externalRefundId: r.id,
      refundedCents: Math.round((r.value ?? 0) * 100),
      status: r.status === 'REFUNDED' ? 'refunded' : 'pending',
    };
  },
};
