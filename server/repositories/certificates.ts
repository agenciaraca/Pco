import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { certificates as seed } from '../../src/app/data/seed';
import type { Certificate } from '../../src/app/types/schema';

export async function listCertificatesForStudent(studentId: string): Promise<Certificate[]> {
  const db = getDb();
  if (!db) return seed.filter((c) => c.studentId === studentId);

  const rows = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.studentId, studentId));
  if (rows.length === 0) return seed.filter((c) => c.studentId === studentId);

  return rows.map((r) => ({
    id: r.id,
    courseId: r.courseId,
    studentId: r.studentId,
    issuedAt: r.issuedAt?.toISOString(),
    validationCode: r.validationCode,
    qrCodeMockUrl: r.qrCodeMockUrl,
    status: r.status as Certificate['status'],
    progress: r.progress,
  }));
}
