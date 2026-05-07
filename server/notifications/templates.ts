// Templates HTML básicos. Stateless — recebem dados, retornam {subject, html, text}.

interface RenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface LayoutOverride {
  brandColor?: string;
  logoUrl?: string;
  orgName?: string;
  greeting?: string;
  footerNote?: string;
}

const DEFAULT_BRAND = '#0a2540';
const DEFAULT_ACCENT = '#0070f3';

function layout(opts: {
  heading: string;
  body: string;
  cta?: { url: string; label: string };
  override?: LayoutOverride;
}) {
  const o = opts.override ?? {};
  const brand = o.brandColor || DEFAULT_BRAND;
  const accent = o.brandColor || DEFAULT_ACCENT;
  const orgName = o.orgName || 'AVA PCO';
  const headerLogo = o.logoUrl
    ? `<img src="${escapeAttr(o.logoUrl)}" alt="${escapeAttr(orgName)}" style="max-height:32px;display:block;">`
    : `<strong style="font-size:18px;">${escapeHtml(orgName)}</strong><span style="font-size:13px;opacity:.85;"> · Psicanálise Clínica Online</span>`;
  const greetingHtml = o.greeting
    ? `<p style="margin:0 0 16px;color:#0f172a;font-style:italic;">${escapeHtml(o.greeting)}</p>`
    : '';
  const footerNoteHtml = o.footerNote
    ? `<div style="padding:12px 32px;background:#fff;color:#475569;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;">${escapeHtml(o.footerNote)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" style="background:#f6f7f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:24px 32px;background:${brand};color:#fff;">
          ${headerLogo}
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:${brand};">${escapeHtml(opts.heading)}</h1>
          ${greetingHtml}
          ${opts.body}
          ${
            opts.cta
              ? `<p style="margin:24px 0;"><a href="${escapeAttr(opts.cta.url)}" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(opts.cta.label)}</a></p>`
              : ''
          }
        </td></tr>
        ${footerNoteHtml}
        <tr><td style="padding:16px 32px;background:#fafafa;color:#666;font-size:12px;text-align:center;">
          ${escapeHtml(orgName)} · ava.psicanaliseclinica.online
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    m === '&'
      ? '&amp;'
      : m === '<'
        ? '&lt;'
        : m === '>'
          ? '&gt;'
          : m === '"'
            ? '&quot;'
            : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return s.replace(/[<>"']/g, (m) =>
    m === '<' ? '&lt;' : m === '>' ? '&gt;' : m === '"' ? '&quot;' : '&#39;',
  );
}

// ---------- Recovery password ----------

export function renderPasswordReset(opts: {
  userName?: string;
  resetUrl: string;
  expiresInMinutes: number;
  override?: { subject?: string } & LayoutOverride;
}): RenderResult {
  const subject = opts.override?.subject || 'Redefinição de senha — AVA PCO';
  const html = layout({
    heading: 'Redefinir sua senha',
    body: `
      <p>Olá${opts.userName ? `, ${escapeHtml(opts.userName)}` : ''},</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no AVA PCO. Clique no botão abaixo para escolher uma nova senha:</p>
      <p style="font-size:13px;color:#666;">Este link expira em <strong>${opts.expiresInMinutes} minutos</strong>.</p>
      <p style="font-size:13px;color:#666;">Se você não solicitou, ignore esta mensagem — sua senha continua a mesma.</p>
    `,
    cta: { url: opts.resetUrl, label: 'Redefinir senha' },
    override: opts.override,
  });
  const text = `Olá${opts.userName ? `, ${opts.userName}` : ''}.\n\nRedefina sua senha em: ${opts.resetUrl}\nExpira em ${opts.expiresInMinutes} minutos.`;
  return { subject, html, text };
}

// ---------- Order paid ----------

export function renderOrderPaid(opts: {
  userName?: string;
  productName: string;
  amountFormatted: string;
  orderUrl?: string;
  override?: { subject?: string } & LayoutOverride;
}): RenderResult {
  const subject =
    opts.override?.subject || `Pagamento confirmado — ${opts.productName}`;
  const html = layout({
    heading: 'Pagamento confirmado',
    body: `
      <p>Olá${opts.userName ? `, ${escapeHtml(opts.userName)}` : ''},</p>
      <p>Recebemos o seu pagamento de <strong>${escapeHtml(opts.amountFormatted)}</strong> para <strong>${escapeHtml(opts.productName)}</strong>.</p>
      <p>Já liberamos o acesso na sua área do aluno.</p>
    `,
    cta: opts.orderUrl ? { url: opts.orderUrl, label: 'Ver pedido' } : undefined,
    override: opts.override,
  });
  const text = `Pagamento de ${opts.amountFormatted} para ${opts.productName} confirmado. Acesse seu painel no AVA PCO.`;
  return { subject, html, text };
}

// ---------- Course enrolled ----------

export function renderCourseEnrolled(opts: {
  userName?: string;
  courseTitle: string;
  courseUrl?: string;
  expiresAt?: string;
  override?: { subject?: string } & LayoutOverride;
}): RenderResult {
  const subject =
    opts.override?.subject || `Matrícula confirmada — ${opts.courseTitle}`;
  const html = layout({
    heading: 'Você está matriculado!',
    body: `
      <p>Olá${opts.userName ? `, ${escapeHtml(opts.userName)}` : ''},</p>
      <p>Sua matrícula em <strong>${escapeHtml(opts.courseTitle)}</strong> foi confirmada.</p>
      ${opts.expiresAt ? `<p style="font-size:13px;color:#666;">Acesso válido até <strong>${escapeHtml(new Date(opts.expiresAt).toLocaleDateString('pt-BR'))}</strong>.</p>` : ''}
    `,
    cta: opts.courseUrl ? { url: opts.courseUrl, label: 'Acessar curso' } : undefined,
    override: opts.override,
  });
  const text = `Matrícula em ${opts.courseTitle} confirmada${opts.expiresAt ? ` (até ${new Date(opts.expiresAt).toLocaleDateString('pt-BR')})` : ''}. Acesse no AVA PCO.`;
  return { subject, html, text };
}

// ---------- Welcome ----------

export function renderWelcome(opts: {
  userName?: string;
  loginUrl: string;
  tempPassword?: string;
  override?: { subject?: string } & LayoutOverride;
}): RenderResult {
  const subject = opts.override?.subject || 'Bem-vindo(a) ao AVA PCO';
  const html = layout({
    heading: `Bem-vindo(a)${opts.userName ? ', ' + escapeHtml(opts.userName) : ''}!`,
    body: `
      <p>Sua conta foi criada no AVA PCO — Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online.</p>
      ${opts.tempPassword ? `<p>Senha temporária: <strong>${escapeHtml(opts.tempPassword)}</strong></p><p style="font-size:13px;color:#666;">Recomendamos trocar a senha no primeiro acesso.</p>` : ''}
    `,
    cta: { url: opts.loginUrl, label: 'Entrar no AVA' },
    override: opts.override,
  });
  const text = `Bem-vindo(a) ao AVA PCO. Acesse: ${opts.loginUrl}${opts.tempPassword ? `\nSenha temporária: ${opts.tempPassword}` : ''}`;
  return { subject, html, text };
}

// ---------- Generic / preview ----------

export function previewTemplate(
  name: string,
  override?: { subject?: string } & LayoutOverride,
): RenderResult {
  switch (name) {
    case 'password_reset':
      return renderPasswordReset({
        userName: 'Maria Silva',
        resetUrl: 'https://ava.psicanaliseclinica.online/redefinir-senha?token=preview',
        expiresInMinutes: 30,
        override,
      });
    case 'order_paid':
      return renderOrderPaid({
        userName: 'João Souza',
        productName: 'Curso de Introdução à Psicanálise',
        amountFormatted: 'R$ 497,00',
        orderUrl: 'https://ava.psicanaliseclinica.online/pedidos',
        override,
      });
    case 'course_enrolled':
      return renderCourseEnrolled({
        userName: 'Ana Costa',
        courseTitle: 'Análise e Supervisão',
        courseUrl: 'https://ava.psicanaliseclinica.online/curso/abc123',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
        override,
      });
    case 'welcome':
      return renderWelcome({
        userName: 'Carlos Pereira',
        loginUrl: 'https://ava.psicanaliseclinica.online/login',
        tempPassword: 'pco-temp-1234',
        override,
      });
    default:
      throw new Error(`Template desconhecido: ${name}`);
  }
}

export const TEMPLATE_NAMES = [
  'password_reset',
  'order_paid',
  'course_enrolled',
  'welcome',
] as const;
