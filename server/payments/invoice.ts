// Renderiza HTML do recibo/invoice para um Order. O PDF real é gerado pelo
// browser via print-to-PDF (Cmd+P → Save as PDF). Mantém zero deps de servidor.

import type { Order } from './types';

export interface InvoiceContext {
  order: Order;
  user: { name: string; email: string; document?: string | null };
  orgName?: string;
  orgAddress?: string;
}

function fmt(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInvoiceHtml(ctx: InvoiceContext): string {
  const o = ctx.order;
  const orgName = ctx.orgName ?? 'Psicanálise Clínica Online';
  const orgAddress = ctx.orgAddress ?? '';
  const issueDate = new Date(o.paidAt ?? o.createdAt).toLocaleDateString('pt-BR');
  const number = o.id;
  const status = o.status === 'paid' ? 'PAGO' : o.status.toUpperCase();
  const subtotal = o.amountCents;
  const total = o.amountCents;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Recibo ${escapeHtml(number)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 32px;
    background: #fff;
    line-height: 1.4;
  }
  .invoice {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2px solid #0097B2;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .org h1 {
    margin: 0;
    font-size: 22px;
    color: #0097B2;
  }
  .org p {
    margin: 2px 0 0;
    font-size: 12px;
    color: #64748b;
  }
  .meta {
    text-align: right;
    font-size: 12px;
  }
  .meta .label { color: #64748b; text-transform: uppercase; letter-spacing: .05em; font-size: 10px; }
  .meta .value { font-size: 14px; font-weight: 700; }
  .badge {
    display: inline-block;
    background: #15803d;
    color: #fff;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    margin-top: 4px;
  }
  .badge.pending { background: #f59e0b; }
  .badge.refunded { background: #0CC0DF; }
  .badge.canceled { background: #94a3b8; }
  .badge.failed { background: #dc2626; }
  .section {
    margin-bottom: 24px;
  }
  .section h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #64748b;
    margin: 0 0 6px;
  }
  .section p, .section .row { font-size: 13px; margin: 2px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 13px;
  }
  th, td {
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  th {
    background: #f8fafc;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #64748b;
  }
  td.amount, th.amount { text-align: right; }
  .totals {
    margin-top: 16px;
    width: 100%;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 13px;
  }
  .totals .total {
    border-top: 2px solid #0f172a;
    margin-top: 6px;
    padding-top: 8px;
    font-size: 16px;
    font-weight: 700;
  }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
  }
  .actions {
    margin-bottom: 16px;
    text-align: right;
  }
  .actions button {
    background: #0097B2;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }
  @media print {
    body { padding: 0; }
    .actions { display: none; }
  }
</style>
</head>
<body>
<div class="invoice">
  <div class="actions">
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
  <div class="header">
    <div class="org">
      <h1>${escapeHtml(orgName)}</h1>
      ${orgAddress ? `<p>${escapeHtml(orgAddress)}</p>` : ''}
    </div>
    <div class="meta">
      <div class="label">Recibo</div>
      <div class="value">${escapeHtml(number)}</div>
      <div class="label" style="margin-top:8px">Emitido em</div>
      <div class="value">${escapeHtml(issueDate)}</div>
      <div><span class="badge ${o.status}">${escapeHtml(status)}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Pago por</h2>
    <p><strong>${escapeHtml(ctx.user.name)}</strong></p>
    <p>${escapeHtml(ctx.user.email)}</p>
    ${ctx.user.document ? `<p>CPF/CNPJ: ${escapeHtml(ctx.user.document)}</p>` : ''}
  </div>

  <div class="section">
    <h2>Item</h2>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="amount">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(o.productSnapshot.name)}</td>
          <td class="amount">${fmt(subtotal, o.currency)}</td>
        </tr>
      </tbody>
    </table>
    <div class="totals">
      <div class="row total">
        <span>Total pago</span>
        <span>${fmt(total, o.currency)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Pagamento</h2>
    <p>Gateway: <strong>${escapeHtml(o.gatewayProvider)}</strong></p>
    ${o.externalId ? `<p>Transação externa: ${escapeHtml(o.externalId)}</p>` : ''}
    ${o.paidAt ? `<p>Confirmado em: ${escapeHtml(new Date(o.paidAt).toLocaleString('pt-BR'))}</p>` : ''}
  </div>

  <div class="footer">
    Este é um recibo eletrônico. Documento sem valor fiscal —
    para nota fiscal, contate o suporte.
  </div>
</div>
</body>
</html>`;
}
