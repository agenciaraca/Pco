// Daily digest para admins: resumo de KPIs (vendas, novos alunos, erros) das
// últimas 24h. Worker simples que dispara diariamente às hour configurada.

import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';
import * as ordersRepo from '../payments/orders-repo';
import * as certsRepo from '../repositories/certificates';
import { sendSafe } from './sender';

export interface DigestConfig {
  enabled: boolean;
  hourUtc: number; // 0-23
  recipientRoles: Array<'admin' | 'superadmin'>;
}

const DEFAULT_CFG: DigestConfig = {
  enabled: false,
  hourUtc: 11, // 8h BRT default
  recipientRoles: ['admin', 'superadmin'],
};

const cfgStore = new JsonStore<DigestConfig>('admin-digest-config.json', () => [
  DEFAULT_CFG,
]);

export async function getConfig(): Promise<DigestConfig> {
  const all = await cfgStore.getAll();
  return all[0] ?? DEFAULT_CFG;
}

export async function setConfig(patch: Partial<DigestConfig>): Promise<DigestConfig> {
  const cur = await getConfig();
  const next = { ...cur, ...patch };
  if (next.hourUtc < 0) next.hourUtc = 0;
  if (next.hourUtc > 23) next.hourUtc = 23;
  await cfgStore.setAll([next]);
  return next;
}

export interface DigestData {
  windowFrom: string;
  windowTo: string;
  newOrders: number;
  paidOrders: number;
  revenueCents: number;
  refundedOrders: number;
  newUsers: number;
  certificatesIssued: number;
  topProducts: Array<{ name: string; revenueCents: number; count: number }>;
}

const DAY_MS = 24 * 60 * 60_000;

export async function buildDigestData(now: Date = new Date()): Promise<DigestData> {
  const fromMs = now.getTime() - DAY_MS;
  const fromIso = new Date(fromMs).toISOString();

  const orders = await ordersRepo.listAll();
  const inWindow = orders.filter((o) => new Date(o.createdAt).getTime() >= fromMs);
  const paid = inWindow.filter((o) => o.status === 'paid');
  const refunded = inWindow.filter((o) => o.status === 'refunded');
  const revenueCents = paid.reduce((s, o) => s + o.amountCents, 0);

  const productAcc = new Map<string, { name: string; revenueCents: number; count: number }>();
  for (const o of paid) {
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
  const newUsers = users.filter(
    (u) => u.role === 'student' && new Date(u.createdAt).getTime() >= fromMs,
  ).length;

  const certs = await certsRepo.listAllCertificates();
  const certificatesIssued = certs.filter(
    (c) => c.issuedAt && new Date(c.issuedAt).getTime() >= fromMs,
  ).length;

  return {
    windowFrom: fromIso,
    windowTo: now.toISOString(),
    newOrders: inWindow.length,
    paidOrders: paid.length,
    revenueCents,
    refundedOrders: refunded.length,
    newUsers,
    certificatesIssued,
    topProducts,
  };
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function renderDigestHtml(data: DigestData): { subject: string; html: string } {
  const subject = `Resumo diário PCO — ${formatBRL(data.revenueCents)} em ${data.paidOrders} venda(s)`;
  const topProductsRows = data.topProducts
    .map(
      (p) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(p.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${p.count}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatBRL(p.revenueCents)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0097B2;color:#fff;padding:16px 20px">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AVA PCO · Resumo diário</div>
    <h1 style="margin:6px 0 0;font-size:18px;font-weight:700">Atividade últimas 24h</h1>
  </div>
  <div style="padding:16px 20px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b">Receita</td><td style="text-align:right;font-weight:700">${formatBRL(data.revenueCents)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Pedidos pagos</td><td style="text-align:right">${data.paidOrders}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Pedidos criados</td><td style="text-align:right">${data.newOrders}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Reembolsos</td><td style="text-align:right">${data.refundedOrders}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Novos alunos</td><td style="text-align:right">${data.newUsers}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Certificados emitidos</td><td style="text-align:right">${data.certificatesIssued}</td></tr>
    </table>
    ${
      data.topProducts.length > 0
        ? `<h3 style="font-size:13px;margin:18px 0 6px;color:#0f172a">Top produtos</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0">
      <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;text-align:left">Produto</th><th style="padding:6px 8px;text-align:right">Pedidos</th><th style="padding:6px 8px;text-align:right">Receita</th></tr></thead>
      <tbody>${topProductsRows}</tbody>
    </table>`
        : ''
    }
  </div>
  <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    Janela: ${new Date(data.windowFrom).toLocaleString('pt-BR')} → ${new Date(data.windowTo).toLocaleString('pt-BR')}
  </div>
</div>
</body></html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SendDigestResult {
  recipientCount: number;
  sent: number;
  errors: number;
  data: DigestData;
}

/**
 * Envia o digest agora para todos admins/superadmins ativos.
 * dryRun=true não dispara emails, apenas retorna o que seria enviado.
 */
export async function sendDigestNow(opts: { dryRun?: boolean } = {}): Promise<SendDigestResult> {
  const cfg = await getConfig();
  const data = await buildDigestData();
  const { subject, html } = renderDigestHtml(data);

  const users = await usersStore.listUsers();
  const recipients = users.filter(
    (u) => u.active && cfg.recipientRoles.includes(u.role as 'admin' | 'superadmin'),
  );

  let sent = 0;
  let errors = 0;
  for (const u of recipients) {
    if (opts.dryRun) continue;
    const r = await sendSafe({
      to: { email: u.email, name: u.name },
      subject,
      html,
      tag: 'admin-digest',
    });
    if (r.ok) sent++;
    else errors++;
  }
  return { recipientCount: recipients.length, sent, errors, data };
}

let interval: NodeJS.Timeout | null = null;
let lastRunAt: string | null = null;
let lastResult: SendDigestResult | null = null;

/**
 * Worker que verifica a cada 30min se hora atual UTC == hourUtc configurado.
 * Se sim e ainda não rodou hoje, dispara.
 */
export function startWorker(): void {
  if (interval) return;
  let lastDispatchedDay: string | null = null;
  const tick = async () => {
    try {
      const cfg = await getConfig();
      if (!cfg.enabled) return;
      const now = new Date();
      if (now.getUTCHours() !== cfg.hourUtc) return;
      const today = now.toISOString().slice(0, 10);
      if (lastDispatchedDay === today) return;
      const r = await sendDigestNow();
      lastDispatchedDay = today;
      lastRunAt = new Date().toISOString();
      lastResult = r;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admin-digest] erro:', err);
    }
  };
  interval = setInterval(() => {
    void tick();
  }, 30 * 60_000);
  // Tick imediato (se hour bate, manda; senão, sai cedo)
  void tick();
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return { enabled: interval !== null, lastRunAt, lastResult };
}
