import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { retentionRisks as defaults } from '../../src/app/data/seed';
import type { RetentionRisk } from '../../src/app/types/schema';

const store = new JsonStore<RetentionRisk>('retention-risks.json', () =>
  defaults.map((r) => ({ ...r, reasons: [...r.reasons] })),
);

export async function listRetentionRisks(level?: string): Promise<RetentionRisk[]> {
  const db = getDb();
  if (!db) {
    const all = await store.getAll();
    return level && level !== 'todos' ? all.filter((r) => r.level === level) : all;
  }

  const baseQuery = db
    .select({ r: schema.retentionRisks, name: schema.users.name })
    .from(schema.retentionRisks)
    .leftJoin(schema.users, eq(schema.users.id, schema.retentionRisks.studentId))
    .orderBy(desc(schema.retentionRisks.score));

  const rows = await (level && level !== 'todos'
    ? baseQuery.where(eq(schema.retentionRisks.level, level))
    : baseQuery);

  if (rows.length === 0) {
    const all = await store.getAll();
    return level && level !== 'todos' ? all.filter((r) => r.level === level) : all;
  }

  return rows.map(({ r, name }) => ({
    studentId: r.studentId,
    studentName: name ?? r.studentId,
    score: r.score,
    level: r.level as RetentionRisk['level'],
    reasons: r.reasons ?? [],
    lastAccessAt: r.computedAt.toISOString(),
    expectedProgress: r.expectedProgress,
    realProgress: r.realProgress,
    pendingAssessments: r.pendingAssessments,
    tutorUsage: r.tutorUsage,
    podConsumption: r.podConsumption,
    libraryInteractions: r.libraryInteractions,
    recommendedAction: r.recommendedAction,
  }));
}
