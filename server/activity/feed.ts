// Activity feed — agrega eventos de várias fontes em uma timeline única.

import { listAudit } from '../audit/log';
import * as emailLogs from '../notifications/log-store';
import * as webhookDeliveries from '../webhooks/delivery-store';
import * as reengagementCfg from '../reengagement/config-store';
import * as ordersRepo from '../payments/orders-repo';

export type ActivityKind =
  | 'audit'
  | 'email_sent'
  | 'email_failed'
  | 'webhook_success'
  | 'webhook_failed'
  | 'reengagement'
  | 'order_paid'
  | 'order_refunded'
  | 'order_canceled';

export interface ActivityItem {
  id: string;
  ts: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  actor?: string;
  target?: string;
  link?: string;
}

export interface FeedFilter {
  kinds?: ActivityKind[];
  since?: string;
  until?: string;
  q?: string;
  limit?: number;
}

export async function buildFeed(filter: FeedFilter = {}): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  // 1) Audit log
  try {
    const audit = await listAudit({ limit: 500 });
    for (const a of audit) {
      items.push({
        id: a.id,
        ts: a.ts,
        kind: 'audit',
        label: a.action,
        detail: a.targetType ? `${a.targetType}${a.targetId ? `:${a.targetId}` : ''}` : undefined,
        actor: a.actorEmail ?? a.actorId ?? undefined,
        target: a.targetId ?? undefined,
      });
    }
  } catch {
    // ignora
  }

  // 2) Email logs
  try {
    const logs = await emailLogs.listLogs(300);
    for (const l of logs) {
      items.push({
        id: l.id,
        ts: l.ts,
        kind: l.status === 'failed' ? 'email_failed' : 'email_sent',
        label: l.status === 'failed' ? 'E-mail falhou' : 'E-mail enviado',
        detail: l.subject + (l.tag ? ` [${l.tag}]` : ''),
        target: l.to,
      });
    }
  } catch {
    // ignora
  }

  // 3) Webhooks
  try {
    const deliveries = await webhookDeliveries.listAll(300);
    for (const d of deliveries) {
      if (d.status === 'success') {
        items.push({
          id: d.id,
          ts: d.completedAt ?? d.updatedAt,
          kind: 'webhook_success',
          label: `Webhook ${d.event}`,
          detail: `HTTP ${d.lastResponseStatus ?? '?'}`,
        });
      } else if (d.status === 'failed') {
        items.push({
          id: d.id,
          ts: d.completedAt ?? d.updatedAt,
          kind: 'webhook_failed',
          label: `Webhook ${d.event} falhou`,
          detail: d.lastError ?? `HTTP ${d.lastResponseStatus ?? '?'}`,
        });
      }
    }
  } catch {
    // ignora
  }

  // 4) Reengagement sends
  try {
    const sends = await reengagementCfg.listRecentSends(200);
    for (const s of sends) {
      items.push({
        id: `re-${s.userId}-${s.ts}`,
        ts: s.ts,
        kind: 'reengagement',
        label: 'Reengajamento enviado',
        target: s.email,
      });
    }
  } catch {
    // ignora
  }

  // 5) Orders importantes
  try {
    const orders = await ordersRepo.listAll();
    for (const o of orders.slice(0, 200)) {
      if (o.status === 'paid' && o.paidAt) {
        items.push({
          id: `order-${o.id}-paid`,
          ts: o.paidAt,
          kind: 'order_paid',
          label: 'Pedido pago',
          detail: `${o.productSnapshot.name} · ${(o.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: o.currency || 'BRL' })}`,
          target: o.userEmail,
          link: '/admin/pedidos',
        });
      } else if (o.status === 'refunded') {
        items.push({
          id: `order-${o.id}-refunded`,
          ts: o.updatedAt,
          kind: 'order_refunded',
          label: 'Pedido reembolsado',
          detail: o.productSnapshot.name,
          target: o.userEmail,
          link: '/admin/pedidos',
        });
      } else if (o.status === 'canceled') {
        items.push({
          id: `order-${o.id}-canceled`,
          ts: o.updatedAt,
          kind: 'order_canceled',
          label: 'Pedido cancelado',
          detail: o.productSnapshot.name,
          target: o.userEmail,
          link: '/admin/pedidos',
        });
      }
    }
  } catch {
    // ignora
  }

  // Ordena desc por ts e aplica filtros
  let result = items.sort((a, b) => (b.ts > a.ts ? 1 : -1));

  if (filter.kinds && filter.kinds.length > 0) {
    result = result.filter((i) => filter.kinds!.includes(i.kind));
  }
  if (filter.since) result = result.filter((i) => i.ts >= filter.since!);
  if (filter.until) result = result.filter((i) => i.ts <= filter.until!);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    result = result.filter(
      (i) =>
        (i.label && i.label.toLowerCase().includes(q)) ||
        (i.detail && i.detail.toLowerCase().includes(q)) ||
        (i.actor && i.actor.toLowerCase().includes(q)) ||
        (i.target && i.target.toLowerCase().includes(q)),
    );
  }

  return result.slice(0, Math.max(1, Math.min(filter.limit ?? 200, 1000)));
}
