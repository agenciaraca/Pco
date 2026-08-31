// Tipos compartilhados de payment gateways e orders.

export type PaymentProvider =
  | 'mock'
  | 'stripe'
  | 'asaas'
  | 'pagarme'
  | 'paypal'
  | 'mercadopago'
  /**
   * Sandra — a cobrança é emitida no gateway da PRÓPRIA escola, com a
   * credencial dela. O dinheiro não passa pela Sandra. Ver
   * `providers/sandra.ts`.
   */
  | 'sandra';

export type PaymentMode = 'test' | 'live';

export interface PaymentGateway {
  id: string;
  provider: PaymentProvider;
  displayName: string;
  mode: PaymentMode;
  active: boolean;
  // Credenciais — encriptadas em data/payment-gateways.json
  apiKey: string;
  apiSecret?: string | null;
  webhookSecret?: string | null;
  publicKey?: string | null; // p/ providers tipo Stripe que precisam expor pk_test/pk_live
  // Configurações específicas (mock pode usar autoApproveAfterMs)
  options?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayPublic
  extends Omit<PaymentGateway, 'apiKey' | 'apiSecret' | 'webhookSecret'> {
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
}

// Tipos de produto vendido
export type ProductKind = 'course' | 'session_pack' | 'tutor_pack' | 'bundle';

export interface Product {
  id: string;
  kind: ProductKind;
  // courseId quando kind=course; serviceId quando kind=session_pack; etc.
  refId: string | null;
  name: string;
  description?: string;
  priceCents: number;
  currency: string; // 'BRL', 'USD'...
  active: boolean;
  // metadata pra dar pistas ao gateway/recibo
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Order = pedido de compra
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded';

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  productId: string;
  productSnapshot: Pick<Product, 'name' | 'priceCents' | 'currency' | 'kind' | 'refId'>;
  gatewayId: string;
  gatewayProvider: PaymentProvider;
  externalId: string | null; // ID do payment no gateway
  status: OrderStatus;
  amountCents: number;
  currency: string;
  // Logs cronológicos do lifecycle
  events: Array<{
    ts: string;
    status: OrderStatus;
    note?: string;
  }>;
  // URL de checkout/QR retornado pelo gateway
  checkoutUrl?: string | null;
  qrCode?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}
