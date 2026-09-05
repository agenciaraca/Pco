/**
 * Provider Sandra — cobrança emitida pelo gateway da própria escola.
 *
 * Doc de origem: `docs/cobranca-api/README.md` do projeto Sandra.
 *
 * ## O que ele é, e o que não é
 *
 * A Sandra **não recebe o dinheiro**. Ela cria a cobrança no gateway da escola
 * (Asaas, Stripe…), com a credencial da escola, e devolve um `checkoutUrl`. O
 * pagamento cai na conta da escola e o cartão é digitado na página do provedor —
 * nada de dado de cartão passa por aqui, e é isso que mantém a integração fora
 * do escopo pesado de PCI.
 *
 * ## Três coisas que este provider faz diferente dos outros
 *
 * **1. A chave de repetição é o id do pedido.** A Sandra exige
 * `Idempotency-Key`, e o motivo é caro: sem ela, uma retentativa de rede ou um
 * duplo clique vira **duas cobranças reais** para a mesma compra. Usamos
 * `metadata.orderId` — que já existe, é estável para o pedido e diferente entre
 * pedidos. Nunca um UUID gerado na hora: cada tentativa geraria uma chave nova,
 * que é exatamente o que a chave existe para impedir.
 *
 * **2. CPF/CNPJ é obrigatório, e falhamos ANTES de chamar.** Todos os gateways
 * que a Sandra fala exigem documento. Se ele não veio, o erro é do formulário,
 * não do gateway — e dizer isso aqui evita um `502 gateway_error` que faria
 * alguém procurar defeito no lugar errado.
 *
 * **3. O `502` NÃO é para repetir.** Quando o gateway da escola falha, a Sandra
 * responde 502 **com `invoiceId`**: a fatura existe, `pending`, e a escola
 * reemite pelo painel. Criar outra cobrança para o mesmo pedido é o erro caro,
 * então o erro carrega o `invoiceId` na mensagem e não sugere retentativa.
 *
 * ## Confirmação do pagamento
 *
 * O aviso de volta (`charge.paid`) é fase 2 na Sandra e **ainda não é emitido**.
 * Enquanto isso quem confirma é `server/payments/sandra-poll-worker.ts`, que
 * consulta as cobranças pendentes. `parseWebhook` já está escrito no contrato
 * documentado (HMAC sobre `timestamp.corpo`) para quando a fase 2 entrar — e
 * recusa qualquer coisa que não bata, em vez de aceitar por otimismo.
 */

import crypto from 'node:crypto';
import type {
  PaymentProviderImpl,
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from './types';
import { PaymentProviderError } from './types';
import { pingHttp } from './ping-http';
import type { MetodoPagamento } from '../../../shared/metodos-pagamento';

/** Métodos aceitos pela Sandra. Não há padrão — de propósito, do lado dela. */
export type MetodoSandra = 'pix' | 'boleto' | 'credit' | 'debit';
const METODOS: MetodoSandra[] = ['pix', 'boleto', 'credit', 'debit'];

interface OpcoesSandra {
  /** Ex.: `https://app.sandra.com.vc`. */
  baseUrl?: string;
  /** Slug da escola dentro da Sandra. */
  tenantSlug?: string;
  /** Método da cobrança. Sem padrão do lado da Sandra; aqui o padrão é `pix`. */
  metodo?: MetodoSandra;
  /** Dias até o vencimento. */
  diasParaVencer?: number;
}

export function lerOpcoes(options: Record<string, unknown> | undefined): Required<OpcoesSandra> {
  const o = (options ?? {}) as OpcoesSandra;
  const metodo = METODOS.includes(o.metodo as MetodoSandra) ? (o.metodo as MetodoSandra) : 'pix';
  const dias = Number(o.diasParaVencer);
  return {
    baseUrl: (o.baseUrl ?? '').replace(/\/+$/, ''),
    tenantSlug: o.tenantSlug ?? '',
    metodo,
    diasParaVencer: Number.isFinite(dias) && dias > 0 && dias <= 90 ? Math.trunc(dias) : 3,
  };
}

/**
 * A regra do dígito verificador mudou para `shared/documento.ts` quando o
 * checkout de dentro do app passou a pedir CPF: o formulário valida no
 * navegador e o servidor revalida, e os dois têm de concordar. Duas cópias da
 * mesma regra acabam discordando.
 *
 * Continua exportada daqui porque este caminho já era importado — acrescentar,
 * não renomear.
 */
import { documentoValido } from '../../../shared/documento';
export { documentoValido };

/** `AAAA-MM-DD` daqui a N dias. Hoje vale; ontem, não. */
export function vencimentoEm(dias: number, agora = new Date()): string {
  const d = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

interface RespostaCobranca {
  id: string;
  status: string;
  amount: number;
  method: string;
  dueAt: string;
  reference: string;
  gateway?: string;
  externalId?: string;
  checkoutUrl?: string | null;
  replayed?: boolean;
  paidAt?: string | null;
}

/** Estados da Sandra → estados do pedido aqui. */
export function traduzirStatus(s: string): WebhookEvent['status'] {
  switch (s) {
    case 'paid':
      return 'paid';
    case 'cancelled':
      return 'canceled';
    case 'refunded':
      return 'refunded';
    case 'overdue':
    case 'renegotiated':
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * Nosso método, no vocabulário da Sandra. `debit` existe do lado dela e não
 * tem par aqui — ver `shared/metodos-pagamento.ts`.
 */
const METODO_SANDRA: Record<MetodoPagamento, MetodoSandra> = {
  pix: 'pix',
  boleto: 'boleto',
  credit_card: 'credit',
};

export const sandraProvider: PaymentProviderImpl = {
  metodosSuportados: ['pix', 'boleto', 'credit_card'],
  // A cobrança da Sandra tem `method` e `dueAt`, e nada de parcelas.
  parcelasMaximas: { credit_card: 1, boleto: 1, pix: 1 },

  async createPayment(gateway, creds, input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const o = lerOpcoes(gateway.options);
    if (!creds.apiKey)
      throw new PaymentProviderError('NO_KEY', 'Sandra: chave de API ausente.', 'nao');
    if (!o.baseUrl || !o.tenantSlug) {
      throw new PaymentProviderError(
        'SANDRA_CONFIG',
        'Sandra: faltam `baseUrl` e `tenantSlug` nas opções do gateway.',
        'nao',
      );
    }

    const orderId = input.metadata.orderId;
    if (!orderId) {
      // Sem id de pedido não há chave de repetição estável, e sem ela a
      // retentativa vira cobrança dobrada. Melhor não emitir.
      throw new PaymentProviderError(
        'SANDRA_SEM_PEDIDO',
        'Sandra: sem orderId não há chave de repetição — o pedido precisa existir antes da cobrança.',
        'nao',
      );
    }

    const documento = (input.customerDocument ?? '').trim();
    if (!documento) {
      throw new PaymentProviderError(
        'SANDRA_SEM_DOCUMENTO',
        'Sandra: CPF ou CNPJ é obrigatório para emitir a cobrança.',
        'nao',
      );
    }
    if (!documentoValido(documento)) {
      throw new PaymentProviderError(
        'SANDRA_DOCUMENTO_INVALIDO',
        'Sandra: o CPF/CNPJ informado não é válido — confira o número digitado.',
        'nao',
      );
    }

    const corpo = {
      amount: input.amountCents / 100,
      // O método pedido no checkout vence o configurado no gateway: `metodo`
      // nas opções deixa de ser "o que a escola cobra" e passa a ser o padrão
      // de quando ninguém escolheu.
      method: input.metodo ? METODO_SANDRA[input.metodo] : o.metodo,
      dueAt: vencimentoEm(o.diasParaVencer),
      reference: input.description.slice(0, 200),
      payer: {
        name: input.customerName ?? input.customerEmail.split('@')[0],
        document: documento,
        email: input.customerEmail,
        ...(input.customerPhone ? { phone: input.customerPhone } : {}),
      },
    };

    const r = await fetch(`${o.baseUrl}/api/v1/tenants/${encodeURIComponent(o.tenantSlug)}/charges`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${creds.apiKey}`,
        'idempotency-key': orderId,
      },
      body: JSON.stringify(corpo),
    });
    const j = (await r.json().catch(() => ({}))) as RespostaCobranca & {
      error?: string;
      campo?: string;
      motivo?: string;
      invoiceId?: string;
    };

    // 202: a primeira chamada com esta chave ainda está em voo. Não é sucesso e
    // não é falha — é "pergunte de novo". Tratar como falha faria o site abrir
    // outro pedido, que é a duplicidade que a chave existe para impedir.
    if (r.status === 202) {
      // `talvez`, e é o padrão: existe uma cobrança em voo com esta chave.
      // Cair para outro gateway aqui é exatamente a cobrança dobrada que a
      // chave de repetição existe para impedir.
      throw new PaymentProviderError(
        'SANDRA_EM_VOO',
        'Sandra: a cobrança deste pedido está sendo criada agora. Tente em instantes — não crie outra.',
      );
    }
    if (!r.ok) {
      if (r.status === 502 && j.invoiceId) {
        // A fatura EXISTE. Sem fallback, sob nenhuma circunstância.
        throw new PaymentProviderError(
          'SANDRA_GATEWAY_FALHOU',
          `Sandra: o gateway da escola falhou, mas a fatura ${j.invoiceId} FOI criada e está pendente. ` +
            'Reemita pelo painel da Sandra — não crie outra cobrança para este pedido.',
        );
      }
      const detalhe = j.campo ? ` (${j.campo}: ${j.motivo})` : '';
      // A Sandra respondeu recusando, e sem `invoiceId`: nada foi criado.
      throw new PaymentProviderError(
        'SANDRA_ERRO',
        `Sandra ${r.status} ${j.error ?? 'erro_desconhecido'}${detalhe}`,
        'nao',
      );
    }

    return {
      externalId: j.id,
      status: traduzirStatus(j.status) === 'paid' ? 'paid' : 'pending',
      checkoutUrl: j.checkoutUrl ?? undefined,
    };
  },

  /**
   * O contrato do aviso de volta, escrito antes de existir.
   *
   * A Sandra ainda não emite `charge.paid` — é fase 2. Isto fica pronto para
   * quando entrar, e **recusa tudo que não bater**: sem segredo configurado,
   * sem assinatura, com assinatura errada ou com carimbo velho, devolve null.
   * Aceitar por otimismo transformaria a rota num jeito de qualquer um marcar
   * pedido como pago.
   */
  async parseWebhook(gateway, creds, rawBody, headers): Promise<WebhookEvent | null> {
    const segredo = creds.webhookSecret;
    if (!segredo) return null;

    const assinatura = headers['x-sandra-signature'] ?? headers['X-Sandra-Signature'];
    const carimbo = headers['x-sandra-timestamp'] ?? headers['X-Sandra-Timestamp'];
    if (!assinatura || !carimbo) return null;

    // A assinatura é sobre "<timestamp>.<corpo cru>". Sem o carimbo no material
    // assinado, um corpo capturado uma vez valeria para sempre.
    const esperado = crypto
      .createHmac('sha256', segredo)
      .update(`${carimbo}.${rawBody}`)
      .digest('hex');
    const recebido = assinatura.replace(/^v1=/, '');
    const a = Buffer.from(esperado, 'utf8');
    const b = Buffer.from(recebido, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    // Janela de 5 minutos: assinatura válida com carimbo antigo é replay.
    const segundos = Number(carimbo);
    if (!Number.isFinite(segundos) || Math.abs(Date.now() / 1000 - segundos) > 300) return null;

    let corpo: Record<string, unknown>;
    try {
      corpo = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const cobranca = (corpo.cobranca ?? corpo.charge ?? {}) as { id?: string; status?: string };
    const id = cobranca.id ?? (corpo.chargeId as string | undefined);
    if (!id) return null;

    return {
      externalId: id,
      status: traduzirStatus(cobranca.status ?? 'pending'),
      rawPayload: corpo,
    };
  },
  /**
   * Lê a lista de cobranças do tenant — o mesmo caminho que o worker de
   * sondagem percorre de 5 em 5 minutos. Como a Sandra ainda não emite
   * `charge.paid`, esse worker é o **único** confirmador de pagamento dela:
   * credencial vencida aqui significa venda paga que não vira matrícula, em
   * silêncio. É o gateway em que este botão mais importa.
   */
  async ping(gateway, creds) {
    const o = lerOpcoes(gateway.options);
    if (!creds.apiKey) return { ok: false, alcancou: false, message: 'Sandra: chave ausente.' };
    if (!o.baseUrl || !o.tenantSlug) {
      return {
        ok: false,
        alcancou: false,
        message: 'Sandra: faltam `baseUrl` e `tenantSlug` nas opções do gateway.',
      };
    }
    return await pingHttp(
      `${o.baseUrl}/api/v1/tenants/${encodeURIComponent(o.tenantSlug)}/charges?limit=1`,
      { headers: { authorization: `Bearer ${creds.apiKey}` } },
      'Sandra',
    );
  },
};

/**
 * Consulta o estado de uma cobrança. É assim que o pagamento é confirmado
 * enquanto o aviso de volta não existe — ver o worker de sondagem.
 */
export async function consultarCobranca(
  baseUrl: string,
  tenantSlug: string,
  apiKey: string,
  chargeId: string,
): Promise<{ status: WebhookEvent['status']; paidAt: string | null } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  const r = await fetch(
    `${base}/api/v1/tenants/${encodeURIComponent(tenantSlug)}/charges/${encodeURIComponent(chargeId)}`,
    { headers: { authorization: `Bearer ${apiKey}` } },
  );
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as RespostaCobranca | null;
  if (!j?.status) return null;
  return { status: traduzirStatus(j.status), paidAt: j.paidAt ?? null };
}
