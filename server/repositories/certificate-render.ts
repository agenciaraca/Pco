// Renderiza HTML do certificado de conclusão. PDF é gerado pelo browser via
// print-to-PDF. Layout em paisagem com bordas decorativas e código de validação.

import type { Certificate } from '../../src/app/types/schema';

export interface CertificateTemplate {
  title?: string;
  preamble?: string;
  bodyText?: string;
  accentColor?: string;
  ribbonColor?: string;
  orgName?: string;
  signatureName?: string;
  signatureRole?: string;
  logoUrl?: string;
}

export interface CertificateRenderContext {
  certificate: Certificate;
  studentName: string;
  courseName: string;
  courseHours?: number;
  orgName?: string;
  signatureName?: string;
  signatureRole?: string;
  validationBaseUrl?: string;
  /** Customização per-curso (sobrescreve defaults). */
  template?: CertificateTemplate;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function renderCertificateHtml(ctx: CertificateRenderContext): string {
  const tpl = ctx.template ?? {};
  const title = tpl.title ?? 'Certificado de Conclusão';
  const preamble = tpl.preamble ?? 'Certificamos que';
  const orgName = tpl.orgName ?? ctx.orgName ?? 'Psicanálise Clínica Online';
  const signatureName =
    tpl.signatureName ?? ctx.signatureName ?? 'Direção Acadêmica';
  const signatureRole = tpl.signatureRole ?? ctx.signatureRole ?? 'PCO';
  const accentColor = tpl.accentColor ?? '#0097B2';
  const accentColorLight = tpl.accentColor ?? '#0CC0DF';
  const ribbonColor = tpl.ribbonColor ?? '#FE9002';
  const logoUrl = tpl.logoUrl ?? '';
  const issued = formatDate(ctx.certificate.issuedAt);
  const validationUrl = ctx.validationBaseUrl
    ? `${ctx.validationBaseUrl}/verificar/${ctx.certificate.validationCode}`
    : `/verificar/${ctx.certificate.validationCode}`;
  const hoursText = ctx.courseHours ? `${ctx.courseHours}h de carga horária` : '';
  // bodyText pode usar tokens {{course}} e {{hours}}
  const defaultBody = `concluiu com aproveitamento o curso<br><strong>${escapeHtml(ctx.courseName)}</strong>${
    hoursText ? `<br><span style="color:#64748b;font-size:13px">${escapeHtml(hoursText)}</span>` : ''
  }`;
  const customBody = tpl.bodyText
    ? escapeHtml(tpl.bodyText)
        .replace(/\{\{course\}\}/g, `<strong>${escapeHtml(ctx.courseName)}</strong>`)
        .replace(/\{\{hours\}\}/g, ctx.courseHours ? `${ctx.courseHours}h` : '')
        .replace(/\n/g, '<br>')
    : null;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certificado — ${escapeHtml(ctx.studentName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: Georgia, "Times New Roman", serif;
    background: #f8fafc;
  }
  .cert {
    width: 297mm;
    height: 210mm;
    margin: 0 auto;
    background: #fff;
    position: relative;
    padding: 40px 60px;
    box-sizing: border-box;
    background-image:
      radial-gradient(circle at 0% 0%, rgba(0,151,178,0.08) 0%, transparent 50%),
      radial-gradient(circle at 100% 100%, rgba(254,144,2,0.08) 0%, transparent 50%);
  }
  .border-decor {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    bottom: 20px;
    border: 3px solid ${accentColor};
    border-radius: 4px;
    pointer-events: none;
  }
  .border-decor::before {
    content: '';
    position: absolute;
    top: -8px; left: -8px; right: -8px; bottom: -8px;
    border: 1px solid ${accentColorLight};
    border-radius: 8px;
  }
  .org {
    text-align: center;
    color: ${accentColor};
    font-size: 14px;
    letter-spacing: .15em;
    text-transform: uppercase;
    font-weight: 700;
    margin-top: 30px;
    position: relative;
  }
  .logo {
    text-align: center;
    margin-top: 20px;
    position: relative;
  }
  .logo img {
    max-height: 80px;
    max-width: 200px;
  }
  .title {
    text-align: center;
    font-size: 42px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: .04em;
    margin: 30px 0 18px;
    position: relative;
  }
  .title::after {
    content: '';
    display: block;
    width: 80px;
    height: 3px;
    background: ${ribbonColor};
    margin: 16px auto 0;
  }
  .preamble {
    text-align: center;
    color: #475569;
    font-size: 14px;
    line-height: 1.6;
    margin: 30px auto 0;
    max-width: 80%;
    position: relative;
  }
  .student-name {
    text-align: center;
    font-size: 36px;
    font-weight: 700;
    color: ${accentColor};
    margin: 12px 0;
    font-family: "Brush Script MT", cursive, Georgia, serif;
    font-style: italic;
    position: relative;
  }
  .course {
    text-align: center;
    color: #0f172a;
    font-size: 16px;
    line-height: 1.6;
    margin-top: 18px;
    position: relative;
  }
  .course strong {
    font-size: 20px;
    color: #0f172a;
  }
  .footer {
    position: absolute;
    bottom: 60px;
    left: 60px;
    right: 60px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 12px;
    color: #475569;
  }
  .signature {
    text-align: center;
    border-top: 1px solid #94a3b8;
    padding-top: 6px;
    min-width: 220px;
  }
  .signature-name { font-weight: 700; color: #0f172a; }
  .signature-role { font-size: 11px; color: #64748b; }
  .meta {
    text-align: right;
    font-size: 11px;
    color: #64748b;
    line-height: 1.6;
  }
  .meta strong { color: #0f172a; }
  .actions {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10;
  }
  .actions button {
    background: ${accentColor};
    color: #fff;
    border: none;
    padding: 8px 18px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  @media print {
    body { background: #fff; }
    .actions { display: none; }
  }
</style>
</head>
<body>
<div class="actions">
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
</div>
<div class="cert">
  <div class="border-decor"></div>
  ${logoUrl ? `<div class="logo"><img src="${escapeHtml(logoUrl)}" alt="logo"></div>` : ''}
  <div class="org">${escapeHtml(orgName)}</div>
  <div class="title">${escapeHtml(title)}</div>
  <p class="preamble">${escapeHtml(preamble)}</p>
  <h1 class="student-name">${escapeHtml(ctx.studentName)}</h1>
  <p class="course">
    ${customBody ?? defaultBody}
  </p>
  <div class="footer">
    <div class="signature">
      <div class="signature-name">${escapeHtml(signatureName)}</div>
      <div class="signature-role">${escapeHtml(signatureRole)}</div>
    </div>
    <div class="meta">
      <div>Emitido em <strong>${escapeHtml(issued)}</strong></div>
      <div>Código de validação: <strong>${escapeHtml(ctx.certificate.validationCode)}</strong></div>
      <div style="margin-top:4px;font-size:10px;word-break:break-all">${escapeHtml(validationUrl)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
