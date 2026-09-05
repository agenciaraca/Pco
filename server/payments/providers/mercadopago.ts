// Provider Mercado Pago (PIX/Cartão).
// Doc: https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';
import { PaymentProviderError } from './types';
import { pingHttp } from './ping-http';
import { origemPublica } from '../../origem-publica';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';

const API_BASE = 'https://api.mercadopago.com';

/**
 * Restringir a preferência a um método é subtrativo no Mercado Pago: manda-se
 * o que **não** se aceita. Pix, para o MP, é `bank_transfer`.
 *
 * **Não foi exercitado contra a API real** — o MP não é o gateway ativo desta
 * escola, e o teste confere o que se envia, não o que o MP faz com isso. Está
 * escrito aqui para que a próxima pessoa saiba o que precisa conferir antes de
 * ativá-lo, em vez de descobrir na primeira venda.
 */
const EXCLUIR_PARA: Record<MetodoPagamento, string[]> = {
  credit_card: ['ticket', 'bank_transfer', 'debit_card', 'atm'],
  boleto: ['credit_card', 'debit_card', 'bank_transfer', 'atm'],
  pix: ['credit_card', 'debit_card', 'ticket', 'atm'],
};

export const mercadopagoProvider: PaymentProviderImpl = {
  metodosSuportados: ['pix', 'boleto', 'credit_card'],

  async createPayment(_gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Mercado Pago access_token ausente.', 'nao');
    }
    const res = await fetch(`${API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: input.description.slice(0, 256),
            quantity: 1,
            unit_price: input.amountCents / 100,
            currency_id: input.currency,
          },
        ],
        payer: { email: input.customerEmail },
        external_reference: input.metadata.orderId ?? '',
        metadata: input.metadata,
        back_urls: {
          success: `${publicOrigin()}/perfil?payment=success`,
          failure: `${publicOrigin()}/cursos?payment=failure`,
          pending: `${publicOrigin()}/perfil?payment=pending`,
        },
        auto_return: 'approved',
        ...(input.metodo
          ? {
              payment_methods: {
                excluded_payment_types: EXCLUIR_PARA[input.metodo].map((id) => ({ id })),
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      // Preferência recusada: não existe cobrança do outro lado.
      throw new PaymentProviderError(
        'MP_CREATE_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
        'nao',
      );
    }
    const pref = (await res.json()) as { id: string; init_point: string };
    return {
      externalId: pref.id,
      status: 'pending',
      checkoutUrl: pref.init_point,
    };
  },

  async parseWebhook(_gateway, creds, rawBody): Promise<WebhookEvent | null> {
    try {
      const evt = JSON.parse(rawBody) as {
        type?: string;
        action?: string;
        data?: { id?: string };
      };
      const paymentId = evt.data?.id;
      if (!paymentId || !creds.apiKey) return null;

      // Mercado Pago manda o id; precisa consultar para obter status real.
      const detailRes = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as {
        id: string;
        status: string;
        external_reference?: string;
      };
      let status: WebhookEvent['status'] = 'processing';
      if (detail.status === 'approved') status = 'paid';
      else if (detail.status === 'rejected' || detail.status === 'cancelled')
        status = 'failed';
      else if (detail.status === 'refunded') status = 'refunded';
      return {
        externalId: String(detail.id),
        status,
        rawPayload: detail,
        metadata: detail.external_reference ? { orderId: detail.external_reference } : undefined,
      };
    } catch {
      return null;
    }
  },

  async refundPayment(_gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Mercado Pago access_token ausente.');
    }
    // externalId em MP é o payment id (não preference). Reembolso direto via /v1/payments/{id}/refunds
    const body: Record<string, unknown> = {};
    if (amountCents !== undefined) body.amount = amountCents / 100;
    const res = await fetch(`${API_BASE}/v1/payments/${externalId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund-${externalId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new PaymentProviderError(
        'MP_REFUND_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
      );
    }
    const r = (await res.json()) as { id?: number; amount?: number; status?: string };
    return {
      externalRefundId: r.id ? String(r.id) : undefined,
      refundedCents: Math.round((r.amount ?? 0) * 100),
      status: r.status === 'approved' ? 'refunded' : 'pending',
    };
  },
  /** Identifica a conta dona do access_token. Leitura, e não cria preferência. */
  async ping(_gateway, creds) {
    if (!creds.apiKey) {
      return { ok: false, alcancou: false, message: 'Mercado Pago: access_token ausente.' };
    }
    return await pingHttp(
      `${API_BASE}/users/me`,
      { headers: { Authorization: `Bearer ${creds.apiKey}` } },
      'Mercado Pago',
    );
  },
};

function publicOrigin(): string {
  return origemPublica();
}
