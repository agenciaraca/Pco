// Relatório semanal (segunda-feira 9h UTC default): snapshot consolidado
// pra admins com revenue, students, completion, satisfaction da semana
// passada vs. a anterior.

import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';
import * as ordersRepo from '../payments/orders-repo';
import * as certsRepo from '../repositories/certificates';
import * as courseReviews from '../reviews/store';
import * as supportRepo from '../repositories/support';
import { sendSafe } from './sender';

export interface WeeklyReportConfig {
  enabled: boolean;
  /** 0=domingo, 1=segunda, ... 6=sábado. Default: segunda */
  dayOfWeekUtc: number;
  hourUtc: number;
  recipientRoles: Array<'admin' | 'superadmin'>;
}

const DEFAULT_CFG: WeeklyReportConfig = {
  enabled: false,
  dayOfWeekUtc: 1, // segunda
  hourUtc: 9,
  recipientRoles: ['admin', 'superadmin'],
};

const cfgStore = new JsonStore<WeeklyReportConfig>(
  'admin-weekly-config.json',
  () => [DEFAULT_CFG],
);

export async function getConfig(): Promise<WeeklyReportConfig> {
  const all = await cfgStore.getAll();
  return all[0] ?? DEFAULT_CFG;
}

export async function setConfig(
  patch: Partial<WeeklyReportConfig>,
): Promise<WeeklyReportConfig> {
  const cur = await getConfig();
  const next: WeeklyReportConfig = { ...cur, ...patch };
  if (next.hourUtc < 0) next.hourUtc = 0;
  if (next.hourUtc > 23) next.hourUtc = 23;
  if (next.dayOfWeekUtc < 0 || next.dayOfWeekUtc > 6) next.dayOfWeekUtc = 1;
  await cfgStore.setAll([next]);
  return next;
}

export interface WeeklyReportData {
  windowFrom: string;
  windowTo: string;
  prevWindowFrom: string;
  revenue: {
    currentCents: number;
    previousCents: number;
    deltaPct: number;
  };
  newStudents: {
    current: number;
    previous: number;
    deltaPct: number;
  };
  certificatesIssued: number;
  reviews: {
    new: number;
    averageRating: number;
  };
  support: {
    opened: number;
    closed: number;
  };
  topProducts: Array<{ name: string; revenueCents: number; count: number }>;
}

const WEEK_MS = 7 * 24 * 60 * 60_000;

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function buildReport(
  now: Date = new Date(),
): Promise<WeeklyReportData> {
  const toMs = now.getTime();
  const fromMs = toMs - WEEK_MS;
  const prevFromMs = fromMs - WEEK_MS;

  const orders = await ordersRepo.listAll();
  const paid = orders.filter((o) => o.status === 'paid');
  const inWindow = paid.filter((o) => {
    if (!o.paidAt) return false;
    const t = new Date(o.paidAt).getTime();
    return t >= fromMs && t < toMs;
  });
  const inPrevWindow = paid.filter((o) => {
    if (!o.paidAt) return false;
    const t = new Date(o.paidAt).getTime();
    return t >= prevFromMs && t < fromMs;
  });
  const revenueCurrent = inWindow.reduce((s, o) => s + o.amountCents, 0);
  const revenuePrev = inPrevWindow.reduce((s, o) => s + o.amountCents, 0);

  const productAcc = new Map<
    string,
    { name: string; revenueCents: number; count: number }
  >();
  for (const o of inWindow) {
    const acc = productAcc.get(o.productId) ?? {
      name: o.productSnapshot.name,
      revenueCents: 0,
      count: 0,
    };
    acc.revenueCents += o.amountCents;
    acc.count++;
    productAcc.set(o.productId, acc);
  }
  const topProducts = Array.from(productAcc.values())
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  const users = await usersStore.listUsers();
  const students = users.filter((u) => u.role === 'student');
  const newCurrent = students.filter((s) => {
    if (!s.createdAt) return false;
    const t = new Date(s.createdAt).getTime();
    return t >= fromMs && t < toMs;
  }).length;
  const newPrev = students.filter((s) => {
    if (!s.createdAt) return false;
    const t = new Date(s.createdAt).getTime();
    return t >= prevFromMs && t < fromMs;
  }).length;

  const certs = await certsRepo.listAllCertificates();
  const certIssuedCount = certs.filter((c) => {
    if (!c.issuedAt) return false;
    const t = new Date(c.issuedAt).getTime();
    return t >= fromMs && t < toMs;
  }).length;

  const reviews = await courseReviews.listAll();
  const newReviews = reviews.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t >= fromMs && t < toMs;
  });
  const avgRating =
    newReviews.length === 0
      ? 0
      : newReviews.reduce((s, r) => s + r.rating, 0) / newReviews.length;

  const tickets = await supportRepo.listAllTickets();
  const opened = tickets.filter((t) => {
    const ts = new Date(t.createdAt).getTime();
    return ts >= fromMs && ts < toMs;
  }).length;
  const closed = tickets.filter((t) => {
    if (t.status !== 'closed') return false;
    const ts = new Date(t.updatedAt ?? t.createdAt).getTime();
    return ts >= fromMs && ts < toMs;
  }).length;

  return {
    windowFrom: new Date(fromMs).toISOString(),
    windowTo: new Date(toMs).toISOString(),
    prevWindowFrom: new Date(prevFromMs).toISOString(),
    revenue: {
      currentCents: revenueCurrent,
      previousCents: revenuePrev,
      deltaPct: pctDelta(revenueCurrent, revenuePrev),
    },
    newStudents: {
      current: newCurrent,
      previous: newPrev,
      deltaPct: pctDelta(newCurrent, newPrev),
    },
    certificatesIssued: certIssuedCount,
    reviews: {
      new: newReviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
    },
    support: { opened, closed },
    topProducts,
  };
}

export function renderEmailHtml(data: WeeklyReportData): {
  subject: string;
  html: string;
  text: string;
} {
  const fmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const arrow = (pct: number): string =>
    pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  const subject = `Relatório semanal AVA PCO — ${fmt.format(
    data.revenue.currentCents / 100,
  )} em receita`;

  const topProductsHtml =
    data.topProducts.length === 0
      ? '<p style="color:#64748b">Sem vendas na semana.</p>'
      : `<ul style="margin:0;padding-left:20px;color:#0f172a">${data.topProducts
          .map(
            (p) =>
              `<li><strong>${escapeHtml(p.name)}</strong> — ${fmt.format(p.revenueCents / 100)} (${p.count})</li>`,
          )
          .join('')}</ul>`;

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <h1 style="color:#0097B2;font-size:22px;margin:0 0 8px">📊 Relatório semanal</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">
      ${formatDate(data.windowFrom)} a ${formatDate(data.windowTo)}
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="padding:12px;background:#f8fafc;border-radius:6px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase">Receita</div>
        <div style="font-size:20px;font-weight:bold;color:#0f172a">
          ${fmt.format(data.revenue.currentCents / 100)}
        </div>
        <div style="font-size:12px;color:#64748b">
          ${arrow(data.revenue.deltaPct)} ${Math.abs(data.revenue.deltaPct)}% vs. semana anterior
        </div>
      </div>
      <div style="padding:12px;background:#f8fafc;border-radius:6px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase">Novos alunos</div>
        <div style="font-size:20px;font-weight:bold;color:#0f172a">
          ${data.newStudents.current}
        </div>
        <div style="font-size:12px;color:#64748b">
          ${arrow(data.newStudents.deltaPct)} ${Math.abs(data.newStudents.deltaPct)}% vs. anterior
        </div>
      </div>
      <div style="padding:12px;background:#f8fafc;border-radius:6px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase">Certificados</div>
        <div style="font-size:20px;font-weight:bold;color:#0f172a">
          ${data.certificatesIssued}
        </div>
      </div>
      <div style="padding:12px;background:#f8fafc;border-radius:6px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase">Avaliações</div>
        <div style="font-size:20px;font-weight:bold;color:#0f172a">
          ${data.reviews.averageRating.toFixed(1)} ★
        </div>
        <div style="font-size:12px;color:#64748b">${data.reviews.new} novas</div>
      </div>
    </div>

    <h2 style="font-size:15px;color:#0f172a;margin:0 0 8px">Top produtos</h2>
    ${topProductsHtml}

    <h2 style="font-size:15px;color:#0f172a;margin:20px 0 8px">Suporte</h2>
    <p style="margin:0;color:#0f172a">
      ${data.support.opened} ticket(s) aberto(s) · ${data.support.closed} fechado(s)
    </p>
  </div>
</body></html>`;

  const text = [
    'Relatório semanal AVA PCO',
    `Período: ${formatDate(data.windowFrom)} a ${formatDate(data.windowTo)}`,
    '',
    `Receita: ${fmt.format(data.revenue.currentCents / 100)} (${arrow(data.revenue.deltaPct)} ${Math.abs(data.revenue.deltaPct)}% vs. semana anterior)`,
    `Novos alunos: ${data.newStudents.current} (${arrow(data.newStudents.deltaPct)} ${Math.abs(data.newStudents.deltaPct)}%)`,
    `Certificados emitidos: ${data.certificatesIssued}`,
    `Avaliações: ${data.reviews.averageRating.toFixed(1)} ★ (${data.reviews.new} novas)`,
    `Suporte: ${data.support.opened} aberto(s), ${data.support.closed} fechado(s)`,
    '',
    'Top produtos:',
    ...data.topProducts.map(
      (p) => `  • ${p.name}: ${fmt.format(p.revenueCents / 100)} (${p.count})`,
    ),
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

let lastFiredKey = '';

/** Tick chamado a cada hora — dispara apenas se for o slot configurado. */
export async function tickWorker(now: Date = new Date()): Promise<{
  fired: boolean;
}> {
  const cfg = await getConfig();
  if (!cfg.enabled) return { fired: false };
  if (now.getUTCDay() !== cfg.dayOfWeekUtc) return { fired: false };
  if (now.getUTCHours() !== cfg.hourUtc) return { fired: false };
  // Idempotência: chave por dia
  const key = `${now.toISOString().slice(0, 10)}-${cfg.hourUtc}`;
  if (key === lastFiredKey) return { fired: false };
  lastFiredKey = key;

  const data = await buildReport(now);
  const email = renderEmailHtml(data);
  const users = await usersStore.listUsers();
  const recipients = users
    .filter(
      (u) =>
        u.active &&
        cfg.recipientRoles.includes(u.role as 'admin' | 'superadmin'),
    )
    .map((u) => u.email);

  for (const to of recipients) {
    await sendSafe({
      to: { email: to },
      subject: email.subject,
      html: email.html,
      text: email.text,
      tag: 'admin-weekly-report',
    });
  }
  return { fired: true };
}

export function startWorker(intervalMs = 60 * 60_000): NodeJS.Timeout {
  return setInterval(() => {
    void tickWorker().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[weekly-report] erro:', err);
    });
  }, intervalMs);
}

export async function _resetForTests(): Promise<void> {
  await cfgStore.setAll([DEFAULT_CFG]);
  lastFiredKey = '';
}
