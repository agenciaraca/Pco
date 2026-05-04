// Configuração do reengajamento automático.
// Singleton: uma única configuração global por instância.

import { JsonStore } from '../db/json-store';

export interface ReengagementConfig {
  enabled: boolean;
  // Aluno é considerado inativo se lastAccessAt > N dias
  inactivityDays: number;
  // Cooldown — não envia outro e-mail antes de M dias
  cooldownDays: number;
  // Apenas alunos com cursos ativos
  onlyEnrolled: boolean;
  // Subject + body em texto livre. Variáveis: {{name}}, {{lastAccess}}, {{loginUrl}}
  subject: string;
  bodyHtml: string;
  // Campos auditáveis
  updatedAt: string;
}

export interface ReengagementSent {
  userId: string;
  email: string;
  ts: string;
}

const DEFAULT_CONFIG: ReengagementConfig = {
  enabled: false,
  inactivityDays: 14,
  cooldownDays: 14,
  onlyEnrolled: true,
  subject: 'Sentimos sua falta no AVA PCO',
  bodyHtml: `<p>Olá {{name}},</p>
<p>Notamos que você está há um tempo sem entrar no AVA PCO. Sua jornada de aprendizagem está esperando por você!</p>
<p>Continue de onde parou:</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{{loginUrl}}" style="display:inline-block;background:#0070f3;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Voltar a estudar</a>
</p>
<p style="font-size:13px;color:#666;">Última visita: {{lastAccess}}</p>`,
  updatedAt: new Date(0).toISOString(),
};

const configStore = new JsonStore<ReengagementConfig>(
  'reengagement-config.json',
  () => [DEFAULT_CONFIG],
);
const sentStore = new JsonStore<ReengagementSent>(
  'reengagement-sent.json',
  () => [],
);

export async function getConfig(): Promise<ReengagementConfig> {
  const all = await configStore.getAll();
  return all[0] ?? DEFAULT_CONFIG;
}

export async function setConfig(
  patch: Partial<ReengagementConfig>,
): Promise<ReengagementConfig> {
  const cur = await getConfig();
  const next: ReengagementConfig = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await configStore.setAll([next]);
  return next;
}

export async function listRecentSends(limit = 200): Promise<ReengagementSent[]> {
  const all = await sentStore.getAll();
  return [...all]
    .sort((a, b) => (b.ts > a.ts ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, 1000)));
}

export async function recordSent(userId: string, email: string): Promise<void> {
  const all = await sentStore.getAll();
  const next = [{ userId, email, ts: new Date().toISOString() }, ...all].slice(0, 5000);
  await sentStore.setAll(next);
}

export async function lastSentForUser(userId: string): Promise<string | null> {
  const all = await sentStore.getAll();
  let last: string | null = null;
  for (const s of all) {
    if (s.userId === userId && (last === null || s.ts > last)) last = s.ts;
  }
  return last;
}
