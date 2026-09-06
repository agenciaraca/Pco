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

export async function listAllTickets(): Promise<SupportTicket[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export async function findTicket(id: string): Promise<SupportTicket | null> {
  return await store.findOne((t) => t.id === id);
}

export async function updateTicketStatus(
  id: string,
  status: SupportTicket['status'],
): Promise<SupportTicket | null> {
  return await store.update(
    (t) => t.id === id,
    (t) => ({ ...t, status, updatedAt: new Date().toISOString() }),
  );
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

/**
 * Apaga os chamados desta pessoa. Expurgo de dados (LGPD, art. 18, VI).
 *
 * **Os dois caminhos** — em produção há banco, e limpar só o JSON diria
 * "apagado" sem apagar.
 */
export async function clearForUser(studentId: string): Promise<number> {
  const db = getDb();
  let removidos = 0;
  if (db) {
    const r = await db
      .delete(schema.supportTickets)
      .where(eq(schema.supportTickets.studentId, studentId))
      .returning();
    removidos += r.length;
  }
  const all = await store.getAll();
  const remaining = all.filter((x) => x.studentId !== studentId);
  removidos += all.length - remaining.length;
  if (all.length !== remaining.length) await store.setAll(remaining);
  return removidos;
}
