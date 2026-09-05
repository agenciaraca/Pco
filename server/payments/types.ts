// Tipos compartilhados de payment gateways e orders.

import type { MetodoPagamento } from '../../shared/metodos-pagamento';

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
  | 'sandra'
  /**
   * Lançamento manual do admin. Não cobra nada e não tem implementação em
   * `providers/` de propósito: é o registro de uma venda que aconteceu fora do
   * sistema — transferência, dinheiro, acordo.
   */
  | 'manual'
  /**
   * Histórico da loja WooCommerce, importado em 1/set/2026. Também não cobra:
   * o dinheiro entrou lá, anos atrás. Existe para que o pedido antigo não
   * minta dizendo que veio de um gateway que nunca o processou.
   */
  | 'legado-wp';

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
  /**
   * Resultado do último "testar conexão". Fica no gateway, e não só na resposta
   * da rota, para que a tela diga o estado sem obrigar o admin a testar de novo
   * — credencial que parou de valer não avisa ninguém sozinha.
   */
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
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

import type { Atribuicao } from '../marketing/atribuicao';

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
  /**
   * Gateway que **de fato** emitiu a cobrança.
   *
   * Com fallback automático ele pode não ser o que criou o pedido: se o
   * principal recusar, quem cobra é o seguinte, e este campo é reescrito. Tem
   * de ser — `findByExternalId` casa o webhook por `externalId` **e**
   * `gatewayId`, então um pedido cobrado no gateway B e marcado com o A nunca
   * receberia a confirmação de pagamento. A pessoa pagaria e não entraria.
   */
  gatewayId: string;
  gatewayProvider: PaymentProvider;
  /**
   * Pix, boleto ou cartão — o que a pessoa escolheu. `null` nos pedidos
   * anteriores a 5/set/2026, e nulo quer dizer "não se sabe".
   */
  metodo?: MetodoPagamento | null;
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
  /**
   * De onde veio esta venda: origem, meio, campanha. `null` quando não se sabe
   * — e não se sabe é diferente de "direto". Ver `marketing/atribuicao.ts`.
   */
  attribution?: Atribuicao | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}
