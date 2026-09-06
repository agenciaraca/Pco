// Provider Pagar.me — REST API v5.
// Doc: https://docs.pagar.me/reference/criar-pedido-1

import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
  RefundResult,
} from './types';
import { PaymentProviderError } from './types';
import { pingHttp } from './ping-http';
import { comparaSegura } from './compara-segura';
import { criouCobrancaPeloStatus } from './criou-cobranca';
import { origemPublica } from '../../origem-publica';
import { opcoesDeParcelamento } from '../../../shared/parcelamento';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';

const API_BASE = 'https://api.pagar.me/core/v5';

/** Uma hora para concluir o checkout, e o mesmo para o QR do Pix expirar. */
const CHECKOUT_EXPIRA_EM_SEGUNDOS = 3600;
const PIX_EXPIRA_EM_SEGUNDOS = 3600;
/** Boleto tem prazo em dias, não em segundos: três dias úteis de folga. */
const BOLETO_DIAS_PARA_VENCER = 3;

/** Vencimento do boleto em ISO, que é o formato que a v5 aceita em `due_at`. */
function vencimentoDoBoleto(agora = new Date()): string {
  return new Date(
    agora.getTime() + BOLETO_DIAS_PARA_VENCER * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

/** Comparação de tempo constante — `!==` em credencial vaza o prefixo certo. */

/** Nosso método, no vocabulário da API v5. */
const METODO_PAGARME: Record<MetodoPagamento, string> = {
  pix: 'pix',
  boleto: 'boleto',
  credit_card: 'credit_card',
};

export const pagarmeProvider: PaymentProviderImpl = {
  metodosSuportados: ['pix', 'boleto', 'credit_card'],
  /**
   * Cartão parcela; boleto **não**.
   *
   * O objeto `boleto` da API v5 não tem campo de parcelamento — conferido na
   * referência do provedor. "6x no boleto" pelo Pagar.me exigiria emitir seis
   * cobranças, que é outro produto. Quem faz carnê aqui é o Asaas.
   */
  parcelasMaximas: { credit_card: 12, boleto: 1, pix: 1 },

  async createPayment(_gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Pagar.me apiKey ausente.', 'nao');
    }
    // Métodos aceitos e seus blocos de configuração andam juntos.
    //
    // A API v5 recusa o pedido inteiro quando um método está em
    // `accepted_payment_methods` e o bloco correspondente não veio:
    //
    //   payments[0].checkout.boleto: The boleto field is required when
    //   boleto payment is accepted
    //
    // Foi exatamente o que aconteceu em produção: pedíamos cartão, boleto e
    // pix, mandávamos zero blocos, e **nenhuma venda passava**. Montar os dois
    // a partir da mesma lista impede que voltem a divergir.
    // Boleto exige documento do comprador; sem CPF/CNPJ ele nem é oferecido,
    // porque a alternativa é o gateway recusar a compra inteira no fim.
    const documento = (input.customerDocument ?? '').replace(/\D/g, '');

    // Com método escolhido, o checkout do Pagar.me abre **só** nele.
    //
    // Sem método — que é como o checkout antigo chamava — mantém-se a lista
    // inteira e quem escolhe é o comprador, lá dentro. Os dois comportamentos
    // convivem porque a escolha na nossa página é nova: nenhum link antigo
    // deixa de funcionar por causa dela.
    let metodos: string[];
    if (input.metodo) {
      if (input.metodo === 'boleto' && !documento) {
        throw new PaymentProviderError(
          'PAGARME_BOLETO_SEM_DOCUMENTO',
          'Boleto exige CPF ou CNPJ do comprador.',
          'nao',
        );
      }
      metodos = [METODO_PAGARME[input.metodo]];
    } else {
      metodos = ['credit_card', 'pix'];
      if (documento) metodos.push('boleto');
    }

    const configPorMetodo: Record<string, unknown> = {
      credit_card: {
        // De 1x até o máximo que couber, sem juros — as mesmas opções que a
        // vitrine anuncia, do mesmo módulo. Mandar só `1x` aqui enquanto a
        // página do curso dizia "12x de ..." era prometer uma condição que o
        // checkout não oferecia.
        //
        // O teto vem de `parcelasMaximas` deste provider, e não da política da
        // escola: é o que este código sabe enviar. Quem junta os dois é
        // `server/payments/condicoes.ts`, que é de onde a vitrine lê.
        installments: opcoesDeParcelamento(
          input.amountCents,
          pagarmeProvider.parcelasMaximas.credit_card,
        ),
      },
      pix: { expires_in: PIX_EXPIRA_EM_SEGUNDOS },
      boleto: {
        due_at: vencimentoDoBoleto(),
        instructions: 'Pagar até o vencimento.',
      },
    };
    const checkout: Record<string, unknown> = {
      expires_in: CHECKOUT_EXPIRA_EM_SEGUNDOS,
      accepted_payment_methods: metodos,
      success_url: `${origemPublica()}/perfil?payment=success`,
    };
    for (const m of metodos) checkout[m] = configPorMetodo[m];

    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            amount: input.amountCents,
            description: input.description.slice(0, 256),
            quantity: 1,
          },
        ],
        customer: {
          // O nome vinha de `email.split('@')[0]` quando a rota não mandava
          // nome — e mandava-se assim a partir do checkout de dentro do app.
          // O comprovante saía com "mariadyduda" no lugar da pessoa.
          name: input.customerName || input.customerEmail.split('@')[0],
          email: input.customerEmail,
          type: documento.length === 14 ? 'company' : 'individual',
          ...(documento
            ? { document: documento, document_type: documento.length === 14 ? 'CNPJ' : 'CPF' }
            : {}),
        },
        payments: [
          {
            payment_method: 'checkout',
            checkout,
          },
        ],
        metadata: input.metadata,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      // 4xx de validação libera o próximo gateway da rota; 5xx e 429 não,
      // porque a cobrança pode ter sido gravada antes de a resposta falhar.
      throw new PaymentProviderError(
        'PAGARME_CREATE_FAILED',
        JSON.stringify(j) || `HTTP ${res.status}`,
        criouCobrancaPeloStatus(res.status),
      );
    }
    const order = (await res.json()) as {
      id: string;
      status: string;
      checkouts?: Array<{ payment_url?: string }>;
    };
    return {
      externalId: order.id,
      status: order.status === 'paid' ? 'paid' : 'pending',
      checkoutUrl: order.checkouts?.[0]?.payment_url,
    };
  },

  /**
   * Webhook do Pagar.me, com o Basic auth conferido **aqui**.
   *
   * Até 27/ago/2026 este método só fazia `JSON.parse`, com um comentário
   * dizendo que a autenticação era "feita pelo nginx upstream em prod". Duas
   * coisas erradas nisso: não há nginx na frente da app no VPS atual (o
   * processo PM2 responde direto na 3035), e mesmo que houvesse, uma
   * verificação que vive fora do repositório é uma verificação que ninguém vê
   * sumir.
   *
   * O efeito era um bypass de pagamento: quem soubesse o `externalId` de um
   * pedido pendente — o próprio comprador, por exemplo — mandava um
   * `order.paid` forjado e recebia o curso sem pagar.
   *
   * O Pagar.me manda as credenciais que você cadastrou no painel dele como
   * Basic auth. Guarde-as em `webhookSecret` no formato `usuario:senha`.
   *
   * **Falha fechada:** sem `webhookSecret` configurado, ou com credencial que
   * não bate, devolve `null` e o pedido não muda de status.
   */
  async parseWebhook(_gateway, creds, rawBody, headers): Promise<WebhookEvent | null> {
    const esperado = creds.webhookSecret?.trim();
    if (!esperado) return null;

    const auth = headers['authorization'] ?? '';
    if (!auth.toLowerCase().startsWith('basic ')) return null;
    let recebido: string;
    try {
      recebido = Buffer.from(auth.slice(6).trim(), 'base64').toString('utf8');
    } catch {
      return null;
    }
    // Comparação de tempo constante: comparar credencial com `!==` vaza,
    // byte a byte, quanto do prefixo está certo.
    if (!comparaSegura(recebido, esperado)) return null;

    try {
      const evt = JSON.parse(rawBody) as {
        type: string;
        data: { id: string; status?: string };
      };
      let status: WebhookEvent['status'] = 'processing';
      if (evt.type === 'order.paid' || evt.data.status === 'paid') status = 'paid';
      else if (evt.type === 'order.canceled') status = 'canceled';
      else if (evt.type === 'charge.refunded') status = 'refunded';
      return { externalId: evt.data.id, status, rawPayload: evt };
    } catch {
      return null;
    }
  },

  async refundPayment(_gateway, creds, externalId, amountCents): Promise<RefundResult> {
    if (!creds.apiKey) {
      throw new PaymentProviderError('NO_KEY', 'Pagar.me apiKey ausente.');
    }
    // externalId é o order id. Precisamos do charge id (pega via GET order)
    const oRes = await fetch(`${API_BASE}/orders/${externalId}`, {
      headers: { Authorization: basicAuth(creds.apiKey) },
    });
    if (!oRes.ok) {
      throw new PaymentProviderError('PAGARME_LOOKUP_FAILED', `HTTP ${oRes.status}`);
    }
    const order = (await oRes.json()) as {
      charges?: Array<{ id: string; status: string }>;
    };
    const charge = order.charges?.find((c) => c.status === 'paid') ?? order.charges?.[0];
    if (!charge) {
      throw new PaymentProviderError('NO_CHARGE', 'Order sem charges para reembolsar.');
    }
    const body: Record<string, unknown> = {};
    if (amountCents !== undefined) body.amount = amountCents;
    const r = await fetch(`${API_BASE}/charges/${charge.id}/refund`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new PaymentProviderError(
        'PAGARME_REFUND_FAILED',
        JSON.stringify(j) || `HTTP ${r.status}`,
      );
    }
    const data = (await r.json()) as { id?: string; amount?: number; status?: string };
    return {
      externalRefundId: data.id,
      refundedCents: data.amount ?? amountCents ?? 0,
      status: data.status === 'refunded' || data.status === 'canceled' ? 'refunded' : 'pending',
    };
  },
  /** Lê um pedido — o mesmo recurso que `createPayment` cria. */
  async ping(_gateway, creds) {
    if (!creds.apiKey) return { ok: false, alcancou: false, message: 'Pagar.me: apiKey ausente.' };
    return await pingHttp(
      `${API_BASE}/orders?size=1`,
      { headers: { Authorization: basicAuth(creds.apiKey) } },
      'Pagar.me',
    );
  },
};

function publicOrigin(): string {
  return origemPublica();
}
