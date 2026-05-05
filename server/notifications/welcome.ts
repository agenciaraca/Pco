// Email de boas-vindas para novos alunos. Envia link de login + senha
// temporária + lista de cursos liberados (opcional).

import { sendSafe } from './sender';

export interface WelcomeEmailInput {
  email: string;
  name: string;
  tempPassword?: string; // se omitido, omite seção "sua senha"
  enrolledCourseTitles?: string[];
  loginUrl?: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const loginUrl = input.loginUrl ?? 'https://ava.psicanaliseclinica.online/login';
  const subject = `Bem-vindo(a) ao AVA PCO, ${input.name}!`;

  const coursesBlock =
    input.enrolledCourseTitles && input.enrolledCourseTitles.length > 0
      ? `<h3 style="font-size:14px;margin:18px 0 6px;color:#0f172a">Cursos liberados</h3>
         <ul style="margin:0 0 12px 16px;padding:0;color:#334155;font-size:13px">
           ${input.enrolledCourseTitles.map((t) => `<li style="margin:4px 0">${escapeHtml(t)}</li>`).join('')}
         </ul>`
      : '';

  const passwordBlock = input.tempPassword
    ? `<div style="margin:14px 0;padding:12px 14px;background:#fefce8;border-left:3px solid #facc15;border-radius:4px">
        <div style="font-size:11px;color:#854d0e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Sua senha temporária</div>
        <div style="font-family:Menlo,Consolas,monospace;font-size:14px;color:#0f172a;font-weight:700">${escapeHtml(input.tempPassword)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:6px">Recomendamos trocar no primeiro acesso (Perfil → Alterar senha).</div>
       </div>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#0097B2,#0CC0DF);color:#fff;padding:20px 24px">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AVA PCO · Boas-vindas</div>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700">Olá, ${escapeHtml(input.name)}!</h1>
  </div>
  <div style="padding:20px 24px">
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px">Sua conta no Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online foi criada com sucesso.</p>
    ${passwordBlock}
    ${coursesBlock}
    <p style="margin:20px 0 14px">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0097B2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Acessar minha conta</a>
    </p>
    <p style="font-size:12px;color:#64748b;margin:20px 0 0">Se você não esperava este e-mail, pode ignorá-lo.</p>
  </div>
  <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    AVA PCO — Psicanálise Clínica Online
  </div>
</div>
</body></html>`;

  const text = [
    `Olá, ${input.name}!`,
    '',
    'Sua conta no AVA PCO foi criada com sucesso.',
    input.tempPassword ? `Senha temporária: ${input.tempPassword}` : '',
    input.enrolledCourseTitles && input.enrolledCourseTitles.length > 0
      ? `\nCursos liberados:\n${input.enrolledCourseTitles.map((t) => `- ${t}`).join('\n')}`
      : '',
    '',
    `Acesse: ${loginUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { subject, html, text } = renderWelcomeEmail(input);
  return sendSafe({
    to: { email: input.email, name: input.name },
    subject,
    html,
    text,
    tag: 'welcome',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
