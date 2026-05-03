// Repository de configurações de IA: DB quando disponível, senão in-memory.
// Quem chama (server/app.ts) não sabe a diferença.

import { eq, sql, gte, and } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { encryptApiKey, decryptApiKey } from '../db/encryption';
import {
  listConfigs as memoryList,
  getConfig as memoryGet,
  getActiveByModule as memoryGetActive,
  updateConfig as memoryUpdate,
  recordUsage as memoryRecord,
  aggregateUsage as memoryAggregate,
  countUsageInWindow as memoryCount,
  toPublic,
  maskKey,
  type AiConfig,
  type AiModule,
  type AiConfigPublic,
  type UpdateAiConfigInput,
} from '../ai/store';

export type { AiConfig, AiModule, AiConfigPublic, UpdateAiConfigInput };
export { toPublic, maskKey };

interface UsageEntry {
  configId: string;
  studentId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  successful: boolean;
}

function rowToConfig(row: typeof schema.aiConfigurations.$inferSelect): AiConfig {
  return {
    id: row.id,
    module: row.module as AiModule,
    provider: row.provider,
    model: row.model,
    apiKey: row.apiKeyEncrypted ? safeDecrypt(row.apiKeyEncrypted) : '',
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    perStudentLimit: row.perStudentLimit,
    perDayLimit: row.perDayLimit,
    perMonthLimit: row.perMonthLimit,
    monthlyCostCap: row.monthlyCostCap,
    systemMessage: row.systemMessage,
    allowedScopes: row.allowedScopes ?? [],
    blockedTopics: row.blockedTopics ?? [],
    fallbackResponse: row.fallbackResponse,
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function safeDecrypt(payload: string): string {
  try {
    return decryptApiKey(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ai-configs] falha ao descriptografar chave:', err);
    return '';
  }
}

export async function listConfigs(): Promise<AiConfigPublic[]> {
  const db = getDb();
  if (!db) return memoryList();

  const rows = await db.select().from(schema.aiConfigurations);
  return rows.map((r) => toPublic(rowToConfig(r)));
}

export async function getConfig(id: string): Promise<AiConfig | null> {
  const db = getDb();
  if (!db) return memoryGet(id);

  const rows = await db
    .select()
    .from(schema.aiConfigurations)
    .where(eq(schema.aiConfigurations.id, id));
  return rows[0] ? rowToConfig(rows[0]) : null;
}

export async function getActiveByModule(module: AiModule): Promise<AiConfig | null> {
  const db = getDb();
  if (!db) return memoryGetActive(module);

  const rows = await db
    .select()
    .from(schema.aiConfigurations)
    .where(and(eq(schema.aiConfigurations.module, module), eq(schema.aiConfigurations.active, true)));
  for (const row of rows) {
    if (row.apiKeyEncrypted) {
      const cfg = rowToConfig(row);
      if (cfg.apiKey) return cfg;
    }
  }
  return null;
}

export async function updateConfig(
  id: string,
  patch: UpdateAiConfigInput,
): Promise<AiConfig | null> {
  const db = getDb();
  if (!db) return memoryUpdate(id, patch);

  const existing = await getConfig(id);
  if (!existing) return null;

  // Resolve apiKey:
  // - undefined → mantém
  // - null → limpa
  // - string vazia → mantém (compatibilidade UI: deixar vazio = não mudar)
  // - string com conteúdo → re-encripta
  let apiKeyEncrypted: string | undefined;
  if (patch.apiKey === null) apiKeyEncrypted = '';
  else if (typeof patch.apiKey === 'string' && patch.apiKey.length > 0)
    apiKeyEncrypted = encryptApiKey(patch.apiKey);
  // else: deixa undefined (não inclui no SET)

  const update: Partial<typeof schema.aiConfigurations.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.provider !== undefined) update.provider = patch.provider;
  if (patch.model !== undefined) update.model = patch.model;
  if (apiKeyEncrypted !== undefined) update.apiKeyEncrypted = apiKeyEncrypted;
  if (patch.temperature !== undefined) update.temperature = patch.temperature;
  if (patch.maxTokens !== undefined) update.maxTokens = patch.maxTokens;
  if (patch.perStudentLimit !== undefined) update.perStudentLimit = patch.perStudentLimit;
  if (patch.perDayLimit !== undefined) update.perDayLimit = patch.perDayLimit;
  if (patch.perMonthLimit !== undefined) update.perMonthLimit = patch.perMonthLimit;
  if (patch.monthlyCostCap !== undefined) update.monthlyCostCap = patch.monthlyCostCap;
  if (patch.systemMessage !== undefined) update.systemMessage = patch.systemMessage;
  if (patch.allowedScopes !== undefined) update.allowedScopes = patch.allowedScopes;
  if (patch.blockedTopics !== undefined) update.blockedTopics = patch.blockedTopics;
  if (patch.fallbackResponse !== undefined) update.fallbackResponse = patch.fallbackResponse;
  if (patch.active !== undefined) update.active = patch.active;

  const rows = await db
    .update(schema.aiConfigurations)
    .set(update)
    .where(eq(schema.aiConfigurations.id, id))
    .returning();
  return rows[0] ? rowToConfig(rows[0]) : null;
}

export async function recordUsage(entry: UsageEntry): Promise<void> {
  const db = getDb();
  if (!db) return memoryRecord(entry);

  await db.insert(schema.aiUsageLogs).values({
    id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    configId: entry.configId,
    studentId: entry.studentId ?? null,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    costUsd: entry.costUsd,
    successful: entry.successful,
  });
}

export async function aggregateUsage(configId: string): Promise<{
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  total: number;
  successCount: number;
  successRate: number;
}> {
  const db = getDb();
  if (!db) return memoryAggregate(configId);

  const rows = await db
    .select({
      inputTokens: sql<number>`coalesce(sum(${schema.aiUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${schema.aiUsageLogs.outputTokens}), 0)`,
      costUsd: sql<number>`coalesce(sum(${schema.aiUsageLogs.costUsd}), 0)`,
      total: sql<number>`count(*)`,
      successCount: sql<number>`count(*) filter (where ${schema.aiUsageLogs.successful} = true)`,
    })
    .from(schema.aiUsageLogs)
    .where(eq(schema.aiUsageLogs.configId, configId));

  const r = rows[0] ?? { inputTokens: 0, outputTokens: 0, costUsd: 0, total: 0, successCount: 0 };
  const total = Number(r.total);
  const success = Number(r.successCount);
  return {
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
    costUsd: Number(Number(r.costUsd).toFixed(4)),
    total,
    successCount: success,
    successRate: total > 0 ? Number((success / total).toFixed(2)) : 1,
  };
}

export async function countUsageInWindow(
  configId: string,
  studentId: string | undefined,
  windowMs: number,
): Promise<number> {
  const db = getDb();
  if (!db) return memoryCount(configId, studentId, windowMs);

  const cutoff = new Date(Date.now() - windowMs);
  const conds = [
    eq(schema.aiUsageLogs.configId, configId),
    gte(schema.aiUsageLogs.occurredAt, cutoff),
  ];
  if (studentId) conds.push(eq(schema.aiUsageLogs.studentId, studentId));

  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.aiUsageLogs)
    .where(and(...conds));
  return Number(rows[0]?.n ?? 0);
}
