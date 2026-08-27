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
import { eq } from 'drizzle-orm';
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
    externalId: r.externalId ?? null,
    status: r.status as OrderStatus,
    amountCents: r.amountCents,
    currency: r.currency,
    events: (r.events ?? []) as Order['events'],
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

export async function findByExternalId(externalId: string): Promise<Order | null> {
  const db = await bancoSeTabelaExiste('payment_orders');
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentOrders)
      .where(eq(schema.paymentOrders.externalId, externalId));
    if (rows[0]) return daLinha(rows[0]);
  }
  return await store.findOne((o) => o.externalId === externalId);
}

interface CreateInput {
  userId: string;
  userEmail: string;
  productId: string;
  productSnapshot: Order['productSnapshot'];
  gatewayId: string;
  gatewayProvider: Order['gatewayProvider'];
  amountCents: number;
  currency: string;
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
    externalId: null,
    status: 'pending',
    amountCents: input.amountCents,
    currency: input.currency,
    events: [{ ts: now, status: 'pending', note: 'Order criada' }],
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
  data: { externalId: string; checkoutUrl?: string; qrCode?: string; status: OrderStatus },
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
        updatedAt: agora,
        events: [
          ...atual.events,
          {
            ts: agora,
            status: data.status,
            note: `Gateway respondeu (externalId ${data.externalId})`,
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
