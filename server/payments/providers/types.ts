// Interface comum a todos providers de pagamento.

import type { PaymentGateway } from '../types';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';

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
  /**
   * Pix, boleto ou cartão. **Opcional na interface, e não por preguiça:** o
   * checkout antigo não mandava método nenhum, e cada provider decidia sozinho.
   * Ausente, o provider mantém o comportamento que tinha; presente, ele é
   * obrigado a honrá-lo — é isso que torna possível rotear boleto para um
   * gateway e cartão para outro.
   */
  metodo?: MetodoPagamento;
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
  /**
   * Métodos que este provider sabe cobrar — e que ele **honra** quando
   * `input.metodo` vem preenchido.
   *
   * É obrigatório, e não opcional como `ping`, porque a tabela de roteamento
   * oferece ao admin só o que o provider declara: sem isso seria possível
   * mandar boleto para o Stripe, e a venda morreria na hora da cobrança em vez
   * de morrer na hora de configurar. Provider novo não compila sem responder a
   * esta pergunta.
   */
  metodosSuportados: MetodoPagamento[];

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

/**
 * A cobrança chegou a ser criada no gateway?
 *
 * É a única pergunta que autoriza o fallback automático a existir. `'nao'` só
 * pode ser usado quando o gateway **respondeu recusando** — ou quando a
 * requisição nem saiu da máquina: aí é certo que não há cobrança, e tentar
 * outro gateway não pode dobrar nada.
 *
 * `'talvez'` cobre dois casos que se parecem e pedem a mesma cautela: a
 * requisição que partiu e não voltou (tempo esgotado, conexão cortada — pode
 * ter chegado) e a resposta que diz explicitamente que a cobrança existe
 * apesar do erro. O 502 da Sandra é o segundo: vem com `invoiceId`, a fatura
 * está lá, pendente, e reemitir cria a segunda.
 *
 * **É o padrão de propósito.** Erro que não se classificou não autoriza
 * retentativa: no caminho do dinheiro, a falha segura é parar e contar o que
 * houve, não tentar de novo em outro lugar.
 */
export type CriouCobranca = 'nao' | 'talvez';

export class PaymentProviderError extends Error {
  code: string;
  criouCobranca: CriouCobranca;
  constructor(code: string, message: string, criouCobranca: CriouCobranca = 'talvez') {
    super(message);
    this.code = code;
    this.criouCobranca = criouCobranca;
  }
}
