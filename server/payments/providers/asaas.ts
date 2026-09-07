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
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';
import { parcelasPara } from '../../../shared/parcelamento';
import { pingHttp } from './ping-http';
import { comparaSegura } from './compara-segura';
import { criouCobrancaPeloStatus } from './criou-cobranca';

function apiBase(mode: 'test' | 'live'): string {
  return mode === 'live'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

/** Nosso método, no vocabulário do Asaas. */
const BILLING_TYPE: Record<MetodoPagamento, string> = {
  pix: 'PIX',
  boleto: 'BOLETO',
  credit_card: 'CREDIT_CARD',
};

export const asaasProvider: PaymentProviderImpl = {
  metodosSuportados: ['pix', 'boleto', 'credit_card'],
  /**
   * Boleto parcelado — o carnê.
   *
   * `installmentCount` + `totalValue` fazem o Asaas emitir **N boletos**, um
   * por parcela, agrupados por um id de parcelamento. A resposta traz a
   * primeira cobrança; as demais vencem mês a mês.
   *
   * **Cartão parcela pelo mesmo campo** (5/set/2026). No cartão,
   * `installmentCount` é o parcelado normal do adquirente — não vira carnê. O
   * motivo de ter entrado às pressas: a conta do Pagar.me não tem o produto
   * "Checkout" habilitado e recusava **toda** compra com
   * `The checkout payment method is not available for this account` — 14
   * pedidos perdidos entre 3 e 5/set, de gente vinda de anúncio pago. Sem isto
   * aqui, mover o cartão para o Asaas teria salvado a venda e matado o 12x.
   */
  parcelasMaximas: { credit_card: 12, boleto: 6, pix: 1 },

  async createPayment(gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Asaas apiKey ausente.', 'nao');
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
      // Cliente é cadastro, não cobrança: falhar aqui não deixa nada a pagar.
      throw new PaymentProviderError(
        'ASAAS_CUSTOMER_FAILED',
        JSON.stringify(j) || `HTTP ${customerRes.status}`,
        'nao',
      );
    }
    const customer = (await customerRes.json()) as { id: string };

    // Cria payment (PIX por padrão; admin pode escolher outro tipo via metadata)
    // O método pedido manda. Sem ele, o comportamento antigo — `billingType`
    // no metadata e, na falta, PIX — que é o padrão silencioso que fazia toda
    // compra pelo Asaas virar pix sem ninguém ter escolhido.
    const billingType = input.metodo
      ? BILLING_TYPE[input.metodo]
      : ((input.metadata.billingType as string) ?? 'PIX');
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // 3 dias

    // Quantas parcelas, pelo que ESTE provider sabe fazer e pelo que cabe no
    // piso da parcela. A vitrine leu o mesmo número antes de anunciar — ver
    // `server/payments/condicoes.ts`.
    const parcelas = input.metodo
      ? parcelasPara(input.amountCents, asaasProvider.parcelasMaximas[input.metodo])
      : 1;

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
        // Carnê: `installmentCount` + `totalValue` fazem o Asaas emitir N
        // boletos, um por parcela, agrupados por um id de parcelamento. A
        // resposta traz a **primeira** cobrança — é ela que o pedido guarda, e
        // é o pagamento dela que confirma a matrícula.
        //
        // `totalValue` em vez de `installmentValue` de propósito: assim o Asaas
        // fecha o arredondamento na última parcela, e a soma das parcelas é
        // exatamente o preço anunciado. Dividir aqui deixaria centavos sobrando
        // ou faltando contra a vitrine.
        //
        // **Como as parcelas 2..N encontram o pedido.**
        // Cada parcela é uma cobrança própria, com id próprio, e o pedido
        // guarda o da **primeira** — então `findByExternalId` casa a parcela 1
        // e mais nenhuma. O elo é o `installment` que o Asaas devolve na
        // criação e repete em todas: ele é gravado em `gatewayInstallmentId`
        // (migration `0020`), e o webhook cai em `findByInstallment` quando o
        // `externalId` não bate. Sem isso, o aviso da parcela 3 não achava
        // pedido nenhum e era descartado.
        //
        // ⚠️ **O que continua sendo decisão de gente.** Achar o pedido não é
        // suspender o acesso. Parcela vencida NÃO derruba o pedido — ele foi
        // pago, a parcela 1 entrou e o acesso saiu; marcá-lo `failed` porque a
        // 3 atrasou reescreveria a história da compra. O que o webhook faz é
        // registrar no histórico e auditar. Suspender mora atrás de
        // `CARNE_ATRASO_SUSPENDE=true`, **desligada**: cortar o curso de quem
        // atrasou um boleto por dois dias é política comercial da escola, e
        // enquanto ela não existir o lado certo para errar é manter o acesso.
        ...(parcelas > 1
          ? { installmentCount: parcelas, totalValue: input.amountCents / 100 }
          : {}),
      }),
    });
    if (!paymentRes.ok) {
      const j = await paymentRes.json().catch(() => null);
      /*
        **Só 4xx de validação prova que nada foi criado.** Antes esta linha era
        `'nao'` fixo, com o comentário "o Asaas respondeu recusando: ela não
        existe" — verdade para o 400, falsa para o 502 que chega depois de a
        cobrança ter sido gravada.
      */
      throw new PaymentProviderError(
        'ASAAS_PAYMENT_FAILED',
        JSON.stringify(j) || `HTTP ${paymentRes.status}`,
        criouCobrancaPeloStatus(paymentRes.status),
      );
    }
    const payment = (await paymentRes.json()) as {
      id: string;
      invoiceUrl?: string;
      status: string;
      /** Presente só quando é carnê: o id do parcelamento. */
      installment?: string;
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
      // O elo do carnê. Sem ele, o aviso da parcela 3 não acha o pedido.
      installmentId: payment.installment,
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
        payment: { id: string; status: string; installment?: string; installmentNumber?: number };
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
      return {
        externalId: evt.payment.id,
        // Parcelas 2..N têm id próprio e não casam com o pedido; o
        // parcelamento é o mesmo em todas, e é por ele que se acha.
        installmentId: evt.payment.installment,
        status,
        rawPayload: evt,
      };
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
  /** Lê um cliente — `createPayment` começa criando um, então é a mesma chave. */
  async ping(gateway, creds) {
    if (!creds.apiKey) return { ok: false, alcancou: false, message: 'Asaas: apiKey ausente.' };
    return await pingHttp(
      `${apiBase(gateway.mode)}/customers?limit=1`,
      { headers: { access_token: creds.apiKey } },
      `Asaas (${gateway.mode})`,
    );
  },
};
