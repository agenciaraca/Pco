// Interface comum a todos providers de pagamento.

import type { PaymentGateway } from '../types';

export interface CreatePaymentInput {
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  // metadata para correlacionar com Order interna
  metadata: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreatePaymentResult {
  externalId: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  checkoutUrl?: string;
  qrCode?: string; // base64 ou string PIX copia-cola
}

export interface WebhookEvent {
  externalId: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded';
  rawPayload: unknown;
  // metadata extraído do payload, se o provider devolver
  metadata?: Record<string, string>;
}

export interface RefundResult {
  externalRefundId?: string;
  refundedCents: number;
  status: 'refunded' | 'partial' | 'pending';
}

export interface PaymentProviderImpl {
  /** Cria um payment no gateway. Retorna externalId + URL/QR para finalizar. */
  createPayment(
    gateway: PaymentGateway,
    credentials: { apiKey: string; apiSecret: string; webhookSecret: string },
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult>;

  /**
   * Decodifica e valida o webhook entrante.
   * Retorna evento normalizado, ou null se não for válido.
   */
  parseWebhook(
    gateway: PaymentGateway,
    credentials: { apiKey: string; apiSecret: string; webhookSecret: string },
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookEvent | null>;

  /**
   * Reembolsa um payment. amountCents omitido = total.
   * Lança PaymentProviderError se o provider não suporta ou falhar.
   */
  refundPayment?(
    gateway: PaymentGateway,
    credentials: { apiKey: string; apiSecret: string; webhookSecret: string },
    externalId: string,
    amountCents?: number,
  ): Promise<RefundResult>;
}

export class PaymentProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
