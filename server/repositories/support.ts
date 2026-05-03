import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import {
  supportTickets as seedTickets,
  currentStudent,
} from '../../src/app/data/seed';
import type { SupportTicket } from '../../src/app/types/schema';

export async function listTicketsForStudent(studentId: string): Promise<SupportTicket[]> {
  const db = getDb();
  if (!db) return seedTickets.filter((t) => t.studentId === studentId);

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

  if (!db) {
    const ticket: SupportTicket = {
      id,
      studentId,
      subject: input.subject,
      category: input.category,
      status: 'open',
      message: input.message,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    seedTickets.unshift(ticket);
    return ticket;
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
