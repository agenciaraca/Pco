import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { certificates as defaults } from '../../src/app/data/seed';
import type { Certificate } from '../../src/app/types/schema';

const store = new JsonStore<Certificate>('certificates.json', () =>
  defaults.map((c) => ({ ...c })),
);

export async function listCertificatesForStudent(studentId: string): Promise<Certificate[]> {
  const db = getDb();
  if (!db) {
    const all = await store.getAll();
    return all.filter((c) => c.studentId === studentId);
  }

  const rows = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.studentId, studentId));
  if (rows.length === 0) {
    const all = await store.getAll();
    return all.filter((c) => c.studentId === studentId);
  }

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

export async function listAllCertificates(): Promise<Certificate[]> {
  const db = getDb();
  if (!db) return await store.getAll();
  const rows = await db.select().from(schema.certificates);
  if (rows.length === 0) return await store.getAll();
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

export async function findByValidationCode(code: string): Promise<Certificate | null> {
  const db = getDb();
  if (!db) return await store.findOne((c) => c.validationCode === code);
  const rows = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.validationCode, code));
  if (rows.length === 0) return await store.findOne((c) => c.validationCode === code);
  const r = rows[0];
  return {
    id: r.id,
    courseId: r.courseId,
    studentId: r.studentId,
    issuedAt: r.issuedAt?.toISOString(),
    validationCode: r.validationCode,
    qrCodeMockUrl: r.qrCodeMockUrl,
    status: r.status as Certificate['status'],
    progress: r.progress,
  };
}

interface IssueInput {
  studentId: string;
  courseId: string;
}

function generateCode(): string {
  const part = () =>
    Array.from(
      { length: 3 },
      () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
    ).join('');
  return `PCO-${part()}-${part()}-${part()}`;
}

export async function issueCertificate(input: IssueInput): Promise<Certificate> {
  const id = `cert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const cert: Certificate = {
    id,
    courseId: input.courseId,
    studentId: input.studentId,
    issuedAt: new Date().toISOString(),
    validationCode: generateCode(),
    qrCodeMockUrl: '#',
    status: 'issued',
    progress: 100,
  };

  const db = getDb();
  if (!db) return await store.unshift(cert);

  await db.insert(schema.certificates).values({
    id: cert.id,
    courseId: cert.courseId,
    studentId: cert.studentId,
    issuedAt: new Date(cert.issuedAt!),
    validationCode: cert.validationCode,
    qrCodeMockUrl: cert.qrCodeMockUrl,
    status: cert.status,
    progress: cert.progress,
  });
  return cert;
}

export async function deleteCertificate(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return await store.remove((c) => c.id === id);
  const rows = await db
    .delete(schema.certificates)
    .where(eq(schema.certificates.id, id))
    .returning({ id: schema.certificates.id });
  return rows.length > 0;
}
