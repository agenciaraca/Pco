// Analytics de vendas: agrega Orders em séries temporais, top produtos,
// distribuição de status. Tudo em memória — para volumes ≤ 10k orders fica
// sub-100ms. Para volumes maiores, vale virar query em DB.

import * as ordersRepo from './orders-repo';
import type { Order, OrderStatus } from './types';

export interface SalesSummary {
  range: { from: string; to: string; days: number };
  series: Array<{ date: string; revenueCents: number; orders: number }>;
  totals: {
    revenueCents: number; // pago no período
    refundedCents: number;
    paidOrders: number;
    pendingOrders: number;
    canceledOrders: number;
    refundedOrders: number;
    failedOrders: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    revenueCents: number;
    orders: number;
  }>;
  statusDistribution: Record<OrderStatus, number>;
  comparison: {
    previousRange: { from: string; to: string };
    revenuePctChange: number | null; // null se previous === 0
    ordersPctChange: number | null;
  };
}

const STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'paid',
  'failed',
  'canceled',
  'refunded',
];

/** Pega o timestamp relevante para "data da venda" — paidAt se houver, senão createdAt. */
function orderEffectiveTs(o: Order): number {
  if (o.paidAt) return new Date(o.paidAt).getTime();
  return new Date(o.createdAt).getTime();
}

/** Converte timestamp para chave 'YYYY-MM-DD' UTC. */
function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function buildSalesSummary(days = 30): Promise<SalesSummary> {
  const clampedDays = Math.max(1, Math.min(days, 365));
  const now = Date.now();
  const fromMs = now - clampedDays * 24 * 60 * 60_000;
  const previousFromMs = fromMs - clampedDays * 24 * 60 * 60_000;
  const previousToMs = fromMs;

  const all = await ordersRepo.listAll();
  const inRange = all.filter((o) => {
    const t = orderEffectiveTs(o);
    return t >= fromMs && t <= now;
  });
  const inPrevious = all.filter((o) => {
    const t = orderEffectiveTs(o);
    return t >= previousFromMs && t < previousToMs;
  });

  // Inicializa série com 0 em todas as datas
  const series = new Map<string, { revenueCents: number; orders: number }>();
  for (let i = 0; i < clampedDays; i++) {
    const ts = fromMs + i * 24 * 60 * 60_000;
    series.set(dayKey(ts), { revenueCents: 0, orders: 0 });
  }

  const totals = {
    revenueCents: 0,
    refundedCents: 0,
    paidOrders: 0,
    pendingOrders: 0,
    canceledOrders: 0,
    refundedOrders: 0,
    failedOrders: 0,
  };
  const statusDistribution = STATUSES.reduce<Record<OrderStatus, number>>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<OrderStatus, number>,
  );
  const productAcc = new Map<
    string,
    { name: string; revenueCents: number; orders: number }
  >();

  for (const o of inRange) {
    statusDistribution[o.status]++;
    if (o.status === 'paid') {
      totals.revenueCents += o.amountCents;
      totals.paidOrders++;
      const day = dayKey(orderEffectiveTs(o));
      const cur = series.get(day);
      if (cur) {
        cur.revenueCents += o.amountCents;
        cur.orders++;
      }
      const acc = productAcc.get(o.productId) ?? {
        name: o.productSnapshot.name,
        revenueCents: 0,
        orders: 0,
      };
      acc.revenueCents += o.amountCents;
      acc.orders++;
      productAcc.set(o.productId, acc);
    } else if (o.status === 'refunded') {
      totals.refundedCents += o.amountCents;
      totals.refundedOrders++;
    } else if (o.status === 'pending' || o.status === 'processing') {
      totals.pendingOrders++;
    } else if (o.status === 'canceled') {
      totals.canceledOrders++;
    } else if (o.status === 'failed') {
      totals.failedOrders++;
    }
  }

  const previousRevenue = inPrevious
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + o.amountCents, 0);
  const previousOrders = inPrevious.filter((o) => o.status === 'paid').length;

  const revenuePctChange =
    previousRevenue === 0
      ? null
      : Math.round(
          ((totals.revenueCents - previousRevenue) / previousRevenue) * 1000,
        ) / 10;
  const ordersPctChange =
    previousOrders === 0
      ? null
      : Math.round(((totals.paidOrders - previousOrders) / previousOrders) * 1000) /
        10;

  const seriesArray = Array.from(series.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, v]) => ({ date, ...v }));

  const topProducts = Array.from(productAcc.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);

  return {
    range: {
      from: new Date(fromMs).toISOString(),
      to: new Date(now).toISOString(),
      days: clampedDays,
    },
    series: seriesArray,
    totals,
    topProducts,
    statusDistribution,
    comparison: {
      previousRange: {
        from: new Date(previousFromMs).toISOString(),
        to: new Date(previousToMs).toISOString(),
      },
      revenuePctChange,
      ordersPctChange,
    },
  };
}
