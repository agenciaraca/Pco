import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { retentionRisks as seed } from '../../src/app/data/seed';
import type { RetentionRisk } from '../../src/app/types/schema';

export async function listRetentionRisks(level?: string): Promise<RetentionRisk[]> {
  const db = getDb();
  if (!db) {
    return level && level !== 'todos'
      ? seed.filter((r) => r.level === level)
      : seed;
  }

  const baseQuery = db
    .select({
      r: schema.retentionRisks,
      name: schema.users.name,
    })
    .from(schema.retentionRisks)
    .leftJoin(schema.users, eq(schema.users.id, schema.retentionRisks.studentId))
    .orderBy(desc(schema.retentionRisks.score));

  const rows = await (level && level !== 'todos'
    ? baseQuery.where(eq(schema.retentionRisks.level, level))
    : baseQuery);

  if (rows.length === 0) {
    return level && level !== 'todos'
      ? seed.filter((r) => r.level === level)
      : seed;
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

