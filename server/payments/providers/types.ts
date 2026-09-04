// Interface comum a todos providers de pagamento.

import type { PaymentGateway } from '../types';

export interface CreatePaymentInput {
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  /**
   * CPF/CNPJ do comprador. Opcional na interface porque a maioria dos gateways
   * não exige — mas a Sandra exige, e sem ele a cobrança nem sai. O checkout
   * público já coleta o campo; até 31/ago/2026 ele parava no cadastro e não
   * chegava aqui.
   */
  customerDocument?: string;
  customerPhone?: string;
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

export interface PingResult {
  ok: boolean;
  /**
   * O gateway chegou a responder alguma coisa? Separa "a chave não vale" de
   * "não deu para falar com ele" — são duas ações diferentes de quem lê a
   * tela: uma é ir ao painel do gateway, a outra é esperar/olhar a rede.
   * Credencial vencida em silêncio é exatamente o modo de falha que já custou
   * pagamento confirmado neste projeto (ver o worker da Sandra).
   */
  alcancou: boolean;
  message: string;
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

  /**
   * Confere, **sem cobrar ninguém**, se o gateway responde e ainda aceita esta
   * credencial. Opcional: provider que não tenha leitura barata simplesmente
   * não implementa, e a tela diz "não dá para testar" — que é diferente de
   * dizer que está tudo bem.
   */
  ping?(
    gateway: PaymentGateway,
    credentials: { apiKey: string; apiSecret: string; webhookSecret: string },
  ): Promise<PingResult>;
}

export class PaymentProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
