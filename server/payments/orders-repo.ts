/**
 * Repository de orders (pedidos de compra).
 *
 * Dois backends, como o resto da casa: com `DATABASE_URL`, lê e escreve na
 * tabela `payment_orders`; sem ela, cai no JSON de sempre. O caminho JSON não
 * foi apagado — é o que faz o dev local rodar sem banco.
 *
 * Por que valia migrar: pedido é registro de dinheiro. Enquanto viveu só em
 * `data/payment-orders.json`, ficou fora do backup transacional, fora de
 * qualquer consulta e sujeito a se perder junto com o arquivo. O agendamento de
 * sessão, que passou a gerar pedidos em 26/ago/2026, herdaria o mesmo risco.
 */

import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '../db/client';
import { bancoSeTabelaExiste } from '../db/tabela-ausente';
import { JsonStore } from '../db/json-store';
import type { Order, OrderStatus } from './types';

const store = new JsonStore<Order>('payment-orders.json', () => []);

type Linha = typeof schema.paymentOrders.$inferSelect;

function daLinha(r: Linha): Order {
  return {
    id: r.id,
    userId: r.userId,
    userEmail: r.userEmail,
    productId: r.productId,
    productSnapshot: r.productSnapshot as Order['productSnapshot'],
    gatewayId: r.gatewayId,
    gatewayProvider: r.gatewayProvider as Order['gatewayProvider'],
    metodo: (r.metodo ?? null) as Order['metodo'],
    gatewayInstallmentId: r.gatewayInstallmentId ?? null,
    externalId: r.externalId ?? null,
    status: r.status as OrderStatus,
    amountCents: r.amountCents,
    currency: r.currency,
    events: (r.events ?? []) as Order['events'],
    attribution: (r.attribution ?? null) as Order['attribution'],
    checkoutUrl: r.checkoutUrl ?? null,
    qrCode: r.qrCode ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    paidAt: r.paidAt ?? null,
  };
}

function maisNovoPrimeiro(a: Order, b: Order): number {
  return b.createdAt > a.createdAt ? 1 : -1;
}

function newId(): string {
  return `ord-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Leva os pedidos que estão no JSON para a tabela. Idempotente: pula o que já
 * existe, comparando por id.
 *
 * Existe como função, e não só como script, porque quem precisa disso é o dono
 * — e ele não tem shell. A rota `/admin/payments/orders/migrar` chama daqui.
 *
 * Não apaga o JSON. Se a migração der errado no meio, a origem continua
 * intacta e a chamada pode ser repetida.
 */
export async function migrarJsonParaBanco(): Promise<{
  noJson: number;
  jaNoBanco: number;
  migrados: number;
}> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (!db) return { noJson: 0, jaNoBanco: 0, migrados: 0 };

  const doJson = await store.getAll();
  const noBanco = await db.select({ id: schema.paymentOrders.id }).from(schema.paymentOrders);
  const existentes = new Set(noBanco.map((r) => r.id));

  let migrados = 0;
  for (const o of doJson) {
    if (existentes.has(o.id)) continue;
    await db.insert(schema.paymentOrders).values({
      id: o.id,
      userId: o.userId,
      userEmail: o.userEmail ?? '',
      productId: o.productId,
      productSnapshot: o.productSnapshot,
      gatewayId: o.gatewayId,
      gatewayProvider: o.gatewayProvider,
      externalId: o.externalId ?? null,
      status: o.status,
      amountCents: o.amountCents,
      currency: o.currency,
      events: o.events ?? [],
      checkoutUrl: o.checkoutUrl ?? null,
      qrCode: o.qrCode ?? null,
      attribution: o.attribution ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      paidAt: o.paidAt ?? null,
    });
    migrados++;
  }
  return { noJson: doJson.length, jaNoBanco: existentes.size, migrados };
}

export async function listAll(): Promise<Order[]> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db.select().from(schema.paymentOrders);
    // Tabela vazia é banco novo, não "sem pedidos": cair no JSON preserva o
    // histórico de quem ainda não migrou.
    if (rows.length > 0) return rows.map(daLinha).sort(maisNovoPrimeiro);
  }
  return [...(await store.getAll())].sort(maisNovoPrimeiro);
}

export async function listForUser(userId: string): Promise<Order[]> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentOrders)
      .where(eq(schema.paymentOrders.userId, userId));
    if (rows.length > 0) return rows.map(daLinha).sort(maisNovoPrimeiro);
  }
  return [...(await store.filter((o) => o.userId === userId))].sort(maisNovoPrimeiro);
}

/**
 * O pedido em aberto que esta pessoa já criou para este mesmo produto, dentro
 * de uma janela curta. Serve para **reusar** em vez de criar outro.
 *
 * O `CLAUDE.md` dizia, sobre a Sandra: "a chave de repetição é o `orderId`.
 * Sem ela, retentativa de rede ou duplo clique viram duas cobranças reais.
 * Nunca um id gerado na hora." A frase estava certa e a proteção não cobria o
 * caso: o `orderId` **era** gerado na hora, um por requisição HTTP. A chave de
 * idempotência do gateway protege contra repetir *a mesma tentativa* — coisa
 * que o código nunca faz, porque não há laço de retry — e não contra o segundo
 * clique, que é a ameaça descrita.
 *
 * Botão desabilitado no React também não resolve: cobre o duplo clique e não a
 * retentativa do navegador quando a resposta demora e a conexão cai.
 */
export async function acharPendenteEquivalente(
  userId: string,
  criterio: {
    productId: string;
    /** Valor JÁ com desconto aplicado. Reusar pedido de outro valor cobra errado. */
    amountCents: number;
    /**
     * O método escolhido — pix, boleto ou cartão.
     *
     * **Era o gateway**, e a razão escrita era boa: reusar pedido de outro
     * gateway manda a pessoa pagar onde ela não escolheu. Com roteamento a
     * pessoa não escolhe mais o gateway, escolhe o método — e o gateway do
     * pedido pode mudar depois da criação, quando o fallback entra. Chavear
     * pelo gateway passaria a criar um pedido novo a cada retentativa que
     * caísse noutro gateway, que é exatamente a cobrança dobrada que esta
     * função existe para impedir.
     */
    metodo?: Order['metodo'];
  },
  janelaMs = 10 * 60_000,
): Promise<Order | null> {
  if (!userId || !criterio.productId) return null;
  const limite = Date.now() - janelaMs;
  const candidatos = (await listForUser(userId)).filter(
    (o) =>
      o.productId === criterio.productId &&
      // **Equivalente quer dizer equivalente.** A primeira versão comparava só
      // o produto, e o cupom era aplicado ANTES desta busca: quem criava um
      // pedido sem cupom, voltava em 5 minutos e digitava o código, tinha o
      // cupom validado com sucesso pelo servidor e recebia de volta o pedido
      // velho — sem desconto, com 201 e sem aviso. A pessoa pagava cheio
      // depois de o sistema ter dito que o cupom valia. O mesmo valia para
      // trocar de gateway.
      o.amountCents === criterio.amountCents &&
      (o.metodo ?? null) === (criterio.metodo ?? null) &&
      (o.status === 'pending' || o.status === 'processing') &&
      Date.parse(o.createdAt) >= limite,
  );
  // `listForUser` já devolve o mais novo primeiro.
  return candidatos[0] ?? null;
}

export async function findById(id: string): Promise<Order | null> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentOrders)
      .where(eq(schema.paymentOrders.id, id));
    if (rows[0]) return daLinha(rows[0]);
  }
  return await store.findOne((o) => o.id === id);
}

/**
 * Acha o pedido pelo id que o gateway conhece.
 *
 * **`gatewayId` não é opcional por conveniência: é a correção de um defeito.**
 * Até 3/set/2026 a busca era global. O webhook autentica pelo gateway da URL
 * (`/payments/webhook/:gatewayId`) e depois procurava o `externalId` no acervo
 * inteiro — de modo que um gateway com verificação fraca confirmava pedido de
 * qualquer outro. Somado à falha aberta que o Asaas tinha, isso era um caminho
 * de "marcar como pago" para quem conhecesse um id pendente.
 *
 * **`gatewayId` é obrigatório.** A primeira versão desta correção o deixou
 * opcional "para não quebrar uso administrativo" — uso que não existe: o único
 * chamador de produção é o webhook, e ele já passa o gateway. Parâmetro
 * opcional numa guarda é falha aberta esperando o próximo chamador esquecer.
 */
export async function findByExternalId(
  externalId: string,
  gatewayId: string,
): Promise<Order | null> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentOrders)
      .where(
        and(
          eq(schema.paymentOrders.externalId, externalId),
          eq(schema.paymentOrders.gatewayId, gatewayId),
        ),
      );
    if (rows[0]) return daLinha(rows[0]);
  }
  return await store.findOne((o) => o.externalId === externalId && o.gatewayId === gatewayId);
}

interface CreateInput {
  userId: string;
  userEmail: string;
  productId: string;
  productSnapshot: Order['productSnapshot'];
  gatewayId: string;
  gatewayProvider: Order['gatewayProvider'];
  /** Pix, boleto ou cartão. Ausente vira NULL — e NULL é "não se sabe". */
  metodo?: Order['metodo'];
  amountCents: number;
  currency: string;
  /** De onde veio a venda. Ausente vira NULL — não vira "direto". */
  attribution?: Order['attribution'];
}

/**
 * Acha o pedido pelo **parcelamento**, quando a parcela não é a primeira.
 *
 * `findByExternalId` casa pelo id da cobrança, e num carnê cada parcela tem o
 * seu — só a primeira está no pedido. Sem esta busca, o aviso de vencimento da
 * parcela 3 não encontra nada e é descartado: quem para de pagar no meio segue
 * estudando, e o AVA não fica sabendo.
 *
 * Continua exigindo o gateway, pelo mesmo motivo da outra: gateway não
 * confirma pedido de outro.
 */
export async function findByInstallment(
  installmentId: string,
  gatewayId: string,
): Promise<Order | null> {
  if (!installmentId) return null;
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentOrders)
      .where(
        and(
          eq(schema.paymentOrders.gatewayInstallmentId, installmentId),
          eq(schema.paymentOrders.gatewayId, gatewayId),
        ),
      );
    if (rows[0]) return daLinha(rows[0]);
  }
  return (
    (await store.findOne(
      (o) => o.gatewayInstallmentId === installmentId && o.gatewayId === gatewayId,
    )) ?? null
  );
}

export async function createOrder(input: CreateInput): Promise<Order> {
  const now = new Date().toISOString();
  const o: Order = {
    id: newId(),
    userId: input.userId,
    userEmail: input.userEmail,
    productId: input.productId,
    productSnapshot: input.productSnapshot,
    gatewayId: input.gatewayId,
    gatewayProvider: input.gatewayProvider,
    metodo: input.metodo ?? null,
    externalId: null,
    gatewayInstallmentId: null,
    status: 'pending',
    amountCents: input.amountCents,
    currency: input.currency,
    events: [{ ts: now, status: 'pending', note: 'Order criada' }],
    attribution: input.attribution ?? null,
    checkoutUrl: null,
    qrCode: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    await db.insert(schema.paymentOrders).values({ ...o, events: o.events });
    return o;
  }
  await store.unshift(o);
  return o;
}

export async function attachGatewayResult(
  id: string,
  data: {
    externalId: string;
    checkoutUrl?: string;
    qrCode?: string;
    status: OrderStatus;
    /**
     * Quem cobrou de verdade, quando o fallback entrou.
     *
     * **Não é cosmético.** `findByExternalId` casa o webhook por `externalId`
     * **e** `gatewayId`: pedido cobrado no gateway B e marcado com o A nunca
     * receberia o `paid`, e a pessoa pagaria sem entrar no curso.
     */
    gatewayId?: string;
    gatewayProvider?: Order['gatewayProvider'];
    /** Id do parcelamento, quando a cobrança criada é um carnê. */
    installmentId?: string;
  },
): Promise<Order | null> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const atual = await findById(id);
    if (!atual) return null;
    const agora = new Date().toISOString();
    const rows = await db
      .update(schema.paymentOrders)
      .set({
        externalId: data.externalId,
        checkoutUrl: data.checkoutUrl ?? null,
        qrCode: data.qrCode ?? null,
        status: data.status,
        ...(data.gatewayId ? { gatewayId: data.gatewayId } : {}),
        ...(data.gatewayProvider ? { gatewayProvider: data.gatewayProvider } : {}),
        ...(data.installmentId ? { gatewayInstallmentId: data.installmentId } : {}),
        updatedAt: agora,
        events: [
          ...atual.events,
          {
            ts: agora,
            status: data.status,
            note:
              data.gatewayId && data.gatewayId !== atual.gatewayId
                ? `Cobrado no gateway ${data.gatewayProvider ?? data.gatewayId} (externalId ${data.externalId})`
                : `Gateway respondeu (externalId ${data.externalId})`,
          },
        ],
      })
      .where(eq(schema.paymentOrders.id, id))
      .returning();
    return rows[0] ? daLinha(rows[0]) : null;
  }
  return await store.update(
    (o) => o.id === id,
    (o) => ({
      ...o,
      externalId: data.externalId,
      checkoutUrl: data.checkoutUrl ?? null,
      qrCode: data.qrCode ?? null,
      status: data.status,
      ...(data.gatewayId ? { gatewayId: data.gatewayId } : {}),
      ...(data.gatewayProvider ? { gatewayProvider: data.gatewayProvider } : {}),
      ...(data.installmentId ? { gatewayInstallmentId: data.installmentId } : {}),
      updatedAt: new Date().toISOString(),
      events: [
        ...o.events,
        {
          ts: new Date().toISOString(),
          status: data.status,
          note: `Gateway respondeu (externalId ${data.externalId})`,
        },
      ],
    }),
  );
}

export async function updateStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<Order | null> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const atual = await findById(id);
    if (!atual) return null;
    const agora = new Date().toISOString();
    const rows = await db
      .update(schema.paymentOrders)
      .set({
        status,
        updatedAt: agora,
        // paidAt é gravado uma vez só: o primeiro "paid" manda. Reprocessar
        // webhook não pode reescrever a data em que o dinheiro entrou.
        ...(status === 'paid' && !atual.paidAt ? { paidAt: agora } : {}),
        events: [...atual.events, { ts: agora, status, note }],
      })
      .where(eq(schema.paymentOrders.id, id))
      .returning();
    return rows[0] ? daLinha(rows[0]) : null;
  }
  return await store.update(
    (o) => o.id === id,
    (o) => {
      const now = new Date().toISOString();
      return {
        ...o,
        status,
        updatedAt: now,
        ...(status === 'paid' && !o.paidAt ? { paidAt: now } : {}),
        events: [...o.events, { ts: now, status, note }],
      };
    },
  );
}

/**
 * Edição de um pedido pelo admin.
 *
 * Existe porque a tela de pedidos passou a ser CRUD (1/set/2026), e porque
 * pedido importado do histórico chega com o que o WooCommerce sabia — nem
 * sempre certo. Campos de gateway (`externalId`, `checkoutUrl`, `qrCode`) não
 * entram: quem os escreve é a resposta do provedor, e deixar o admin digitá-los
 * criaria pedido que aponta para cobrança que não existe.
 *
 * Toda alteração vira evento, para que a linha do tempo do pedido não tenha
 * buraco — é ela que explica, meses depois, por que o valor mudou.
 */
export interface UpdateInput {
  status?: OrderStatus;
  amountCents?: number;
  currency?: string;
  userEmail?: string;
  productSnapshot?: Order['productSnapshot'];
  attribution?: Order['attribution'];
  paidAt?: string | null;
  nota?: string;
}

export async function updateOrder(id: string, patch: UpdateInput): Promise<Order | null> {
  const atual = await findById(id);
  if (!atual) return null;
  const now = new Date().toISOString();

  const mudou: string[] = [];
  if (patch.status && patch.status !== atual.status) mudou.push(`status ${atual.status} → ${patch.status}`);
  if (patch.amountCents !== undefined && patch.amountCents !== atual.amountCents) {
    mudou.push(`valor ${(atual.amountCents / 100).toFixed(2)} → ${(patch.amountCents / 100).toFixed(2)}`);
  }
  if (patch.userEmail && patch.userEmail !== atual.userEmail) mudou.push(`e-mail ${atual.userEmail} → ${patch.userEmail}`);

  const proximo: Order = {
    ...atual,
    status: patch.status ?? atual.status,
    amountCents: patch.amountCents ?? atual.amountCents,
    currency: patch.currency ?? atual.currency,
    userEmail: patch.userEmail ?? atual.userEmail,
    productSnapshot: patch.productSnapshot ?? atual.productSnapshot,
    attribution: patch.attribution !== undefined ? patch.attribution : atual.attribution,
    paidAt: patch.paidAt !== undefined ? patch.paidAt : atual.paidAt,
    updatedAt: now,
    events: [
      ...atual.events,
      {
        ts: now,
        status: patch.status ?? atual.status,
        note: `editado pelo admin${mudou.length ? ': ' + mudou.join(' · ') : ''}${patch.nota ? ` — ${patch.nota}` : ''}`,
      },
    ],
  };

  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    await db
      .update(schema.paymentOrders)
      .set({
        status: proximo.status,
        amountCents: proximo.amountCents,
        currency: proximo.currency,
        userEmail: proximo.userEmail,
        productSnapshot: proximo.productSnapshot,
        attribution: proximo.attribution ?? null,
        paidAt: proximo.paidAt ?? null,
        events: proximo.events,
        updatedAt: now,
      })
      .where(eq(schema.paymentOrders.id, id));
    return proximo;
  }
  return await store.update((o) => o.id === id, () => proximo);
}

/**
 * Apaga um pedido.
 *
 * Só o admin chega aqui, e é a única operação desta casa que perde informação —
 * por isso não mexe em matrícula nenhuma. Apagar o pedido de quem tem acesso
 * deixaria o acesso sem lastro, e é escolha de quem apaga, não efeito
 * automático de um DELETE.
 */
export async function deleteOrder(id: string): Promise<boolean> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const r = await db.delete(schema.paymentOrders).where(eq(schema.paymentOrders.id, id)).returning({ id: schema.paymentOrders.id });
    return r.length > 0;
  }
  return await store.remove((o) => o.id === id);
}
