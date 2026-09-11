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

/*
  Os três abaixo só liam o `JsonStore`, enquanto `listTicketsForStudent` e
  `createTicket` (acima) já sabiam ler/gravar o banco quando ele existe. Em
  produção (`DATABASE_URL` definida) o aluno abre o chamado e ele vai para o
  Postgres — e a tela do admin, que lê por aqui, olhava só o JSON, que fica
  parado nos dois tickets de semente. Achado em 11/set/2026, relatado pelo
  dono como "suporte não aparece os abertos": 5 chamados reais no banco,
  zero visíveis para quem precisa responder.
*/

export async function listAllTickets(): Promise<SupportTicket[]> {
  const db = getDb();
  if (!db) {
    const all = await store.getAll();
    return [...all].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  }
  const rows = await db.select().from(schema.supportTickets).orderBy(desc(schema.supportTickets.updatedAt));
  return rows.map(rowParaTicket);
}

export async function findTicket(id: string): Promise<SupportTicket | null> {
  const db = getDb();
  if (!db) return await store.findOne((t) => t.id === id);
  const rows = await db
    .select()
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.id, id))
    .limit(1);
  return rows[0] ? rowParaTicket(rows[0]) : null;
}

export async function updateTicketStatus(
  id: string,
  status: SupportTicket['status'],
): Promise<SupportTicket | null> {
  const db = getDb();
  if (!db) {
    return await store.update(
      (t) => t.id === id,
      (t) => ({ ...t, status, updatedAt: new Date().toISOString() }),
    );
  }
  const rows = await db
    .update(schema.supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.supportTickets.id, id))
    .returning();
  return rows[0] ? rowParaTicket(rows[0]) : null;
}

function rowParaTicket(r: typeof schema.supportTickets.$inferSelect): SupportTicket {
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
  // Ver o comentário de `modify` em `server/repositories/progress.ts`: o par
  // `getAll` + `setAll` perde escrita concorrente ocorrida entre as duas.
  removidos += await store.modify((items) => {
    const antes = items.length;
    const restantes = items.filter((x) => x.studentId !== studentId);
    items.length = 0;
    items.push(...restantes);
    return antes - items.length;
  });
  return removidos;
}
