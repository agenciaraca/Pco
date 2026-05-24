// Store das configurações de IA. In-memory por enquanto, mas a interface
// está pronta para virar tabela Postgres com Drizzle.
//
// Quando a chave for persistida em DB, ela DEVE ser criptografada com AES-GCM
// usando uma key derivada de uma master key em env (AI_KEY_ENCRYPTION_SECRET).
// Aqui mantemos a chave plena no servidor; ela nunca volta ao cliente.

import type { ProviderId } from './types';

export type AiModule =
  | 'tutor'
  | 'recovery_plan'
  | 'evasion'
  | 'recommendations'
  | 'support'
  | 'summaries'
  | 'grading'
  | 'question_generation';

export interface AiConfig {
  id: string;
  module: AiModule;
  provider: ProviderId;
  model: string;
  /** Chave em claro no servidor — NUNCA retornar ao cliente. */
  apiKey: string;
  temperature: number;
  maxTokens: number;
  perStudentLimit: number;
  perDayLimit: number;
  perMonthLimit: number;
  monthlyCostCap: number;
  systemMessage: string;
  allowedScopes: string[];
  blockedTopics: string[];
  fallbackResponse: string;
  active: boolean;
  updatedAt: string;
}

const DEFAULT_TUTOR_SYSTEM = `Você é o Tutor Virtual da PCO (Psicanálise Clínica Online).
Responde APENAS dúvidas pedagógicas relacionadas aos cursos da PCO.
Linguagem adulta, acolhedora, em português brasileiro.

NUNCA:
- Fornecer diagnóstico psicológico, médico ou jurídico.
- Substituir supervisão clínica, atendimento profissional ou orientação legal.
- Discutir temas fora do escopo dos cursos da PCO.

Quando a pergunta for fora de escopo, responda exatamente:
"Esta pergunta está fora do escopo pedagógico do Tutor Virtual da PCO. Recomendo conversar com seu professor, supervisor ou profissional adequado."`;

const DEFAULT_RECOVERY_SYSTEM = `Você gera planos de retomada acolhedores e personalizados para alunos em risco
de evasão na PCO. A IA sugere — a decisão final é da equipe pedagógica.
Linguagem em português brasileiro, tom adaptável (acolhedor/direto/motivacional).
Sempre incluir: aula recomendada, recurso de apoio, meta de 7 dias.`;

const initial: AiConfig[] = [
  {
    id: 'ai-tutor',
    module: 'tutor',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 1200,
    perStudentLimit: 50,
    perDayLimit: 5000,
    perMonthLimit: 120000,
    monthlyCostCap: 800,
    systemMessage: DEFAULT_TUTOR_SYSTEM,
    allowedScopes: ['cursos PCO', 'aulas', 'leituras', 'avaliações'],
    blockedTopics: [
      'diagnóstico psicológico',
      'orientação médica',
      'orientação jurídica',
      'supervisão clínica individual',
      'prescrição de tratamento',
    ],
    fallbackResponse:
      'Esta pergunta está fora do escopo pedagógico do Tutor Virtual da PCO.',
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ai-recovery',
    module: 'recovery_plan',
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    temperature: 0.5,
    maxTokens: 1500,
    perStudentLimit: 4,
    perDayLimit: 200,
    perMonthLimit: 6000,
    monthlyCostCap: 200,
    systemMessage: DEFAULT_RECOVERY_SYSTEM,
    allowedScopes: ['retenção', 'reengajamento'],
    blockedTopics: ['cobrança', 'venda'],
    fallbackResponse: 'Plano não pôde ser gerado automaticamente.',
    active: true,
    updatedAt: new Date().toISOString(),
  },
];

const store = new Map<string, AiConfig>(initial.map((c) => [c.id, c]));

/** Mascara a chave para exibição segura no admin. */
export function maskKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '•'.repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}${'•'.repeat(Math.max(8, apiKey.length - 8))}${apiKey.slice(-4)}`;
}

/** Versão segura para retornar ao cliente (sem chave em claro). */
export interface AiConfigPublic extends Omit<AiConfig, 'apiKey'> {
  apiKeyMasked: string;
  apiKeyConfigured: boolean;
}

export function toPublic(c: AiConfig): AiConfigPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey, ...rest } = c;
  return {
    ...rest,
    apiKeyMasked: maskKey(apiKey),
    apiKeyConfigured: apiKey.length > 0,
  };
}

export function listConfigs(): AiConfigPublic[] {
  return Array.from(store.values()).map(toPublic);
}

export function getConfig(id: string): AiConfig | null {
  return store.get(id) ?? null;
}

export function upsertConfig(cfg: AiConfig): AiConfig {
  store.set(cfg.id, cfg);
  return cfg;
}

export function deleteConfig(id: string): boolean {
  return store.delete(id);
}

export function getActiveByModule(module: AiModule): AiConfig | null {
  for (const c of store.values()) {
    if (c.module === module && c.active && c.apiKey) return c;
  }
  return null;
}

export interface UpdateAiConfigInput {
  provider?: ProviderId;
  model?: string;
  /** Se string vazia, mantém a key existente. Use null para remover. */
  apiKey?: string | null;
  temperature?: number;
  maxTokens?: number;
  perStudentLimit?: number;
  perDayLimit?: number;
  perMonthLimit?: number;
  monthlyCostCap?: number;
  systemMessage?: string;
  allowedScopes?: string[];
  blockedTopics?: string[];
  fallbackResponse?: string;
  active?: boolean;
}

export function updateConfig(id: string, patch: UpdateAiConfigInput): AiConfig | null {
  const existing = store.get(id);
  if (!existing) return null;

  const next: AiConfig = {
    ...existing,
    ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.temperature !== undefined ? { temperature: patch.temperature } : {}),
    ...(patch.maxTokens !== undefined ? { maxTokens: patch.maxTokens } : {}),
    ...(patch.perStudentLimit !== undefined ? { perStudentLimit: patch.perStudentLimit } : {}),
    ...(patch.perDayLimit !== undefined ? { perDayLimit: patch.perDayLimit } : {}),
    ...(patch.perMonthLimit !== undefined ? { perMonthLimit: patch.perMonthLimit } : {}),
    ...(patch.monthlyCostCap !== undefined ? { monthlyCostCap: patch.monthlyCostCap } : {}),
    ...(patch.systemMessage !== undefined ? { systemMessage: patch.systemMessage } : {}),
    ...(patch.allowedScopes !== undefined ? { allowedScopes: patch.allowedScopes } : {}),
    ...(patch.blockedTopics !== undefined ? { blockedTopics: patch.blockedTopics } : {}),
    ...(patch.fallbackResponse !== undefined ? { fallbackResponse: patch.fallbackResponse } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    apiKey:
      patch.apiKey === null
        ? ''
        : patch.apiKey && patch.apiKey.length > 0
          ? patch.apiKey
          : existing.apiKey,
    updatedAt: new Date().toISOString(),
  };

  store.set(id, next);
  return next;
}

// ---- Usage tracking (in-memory, sempre janela rolante de 30d) ----

interface UsageEntry {
  configId: string;
  studentId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  occurredAt: string;
  successful: boolean;
}

const usage: UsageEntry[] = [];

export function recordUsage(entry: Omit<UsageEntry, 'occurredAt'> & { occurredAt?: string }) {
  usage.push({ ...entry, occurredAt: entry.occurredAt ?? new Date().toISOString() });
  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  while (usage.length > 0 && new Date(usage[0].occurredAt).getTime() < cutoff) {
    usage.shift();
  }
}

export function listRecentUsage(configId?: string, limit = 50) {
  const items = configId ? usage.filter((u) => u.configId === configId) : usage;
  return items.slice(-limit).reverse();
}

export function aggregateUsage(configId: string) {
  const items = usage.filter((u) => u.configId === configId);
  const inputTokens = items.reduce((s, u) => s + u.inputTokens, 0);
  const outputTokens = items.reduce((s, u) => s + u.outputTokens, 0);
  const costUsd = items.reduce((s, u) => s + u.costUsd, 0);
  const successCount = items.filter((u) => u.successful).length;
  const total = items.length;
  return {
    inputTokens,
    outputTokens,
    costUsd: Number(costUsd.toFixed(4)),
    total,
    successCount,
    successRate: total > 0 ? Number((successCount / total).toFixed(2)) : 1,
  };
}

export function countUsageInWindow(
  configId: string,
  studentId: string | undefined,
  windowMs: number,
): number {
  const cutoff = Date.now() - windowMs;
  return usage.filter(
    (u) =>
      u.configId === configId &&
      (studentId === undefined || u.studentId === studentId) &&
      new Date(u.occurredAt).getTime() >= cutoff,
  ).length;
}
