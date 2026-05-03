import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import {
  supportTickets as defaults,
  currentStudent,
} from '../../src/app/data/seed';
import type { SupportTicket } from '../../src/app/types/schema';

const store = new JsonStore<SupportTicket>('support-tickets.json', () =>
  defaults.map((t) => ({ ...t })),
);

export async function listTicketsForStudent(studentId: string): Promise<SupportTicket[]> {
  const db = getDb();
  if (!db) {
    const all = await store.getAll();
    return all
      .filter((t) => t.studentId === studentId)
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  }

  const rows = await db
    .select()
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.studentId, studentId))
    .orderBy(desc(schema.supportTickets.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    subject: r.subject,
    category: r.category,
    status: r.status,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

interface CreateInput {
  studentId?: string;
  subject: string;
  category: SupportTicket['category'];
  message: string;
}

export async function createTicket(input: CreateInput): Promise<SupportTicket> {
  const db = getDb();
  const studentId = input.studentId ?? currentStudent.id;
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!db) {
    const ticket: SupportTicket = {
      id,
      studentId,
      subject: input.subject,
      category: input.category,
      status: 'open',
      message: input.message,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return await store.unshift(ticket);
  }

  const rows = await db
    .insert(schema.supportTickets)
    .values({
      id,
      studentId,
      subject: input.subject,
      category: input.category,
      status: 'open',
      message: input.message,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const r = rows[0];
  return {
    id: r.id,
    studentId: r.studentId,
    subject: r.subject,
    category: r.category,
    status: r.status,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
