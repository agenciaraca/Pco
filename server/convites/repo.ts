/**
 * Monta a lista de candidatos ao convite e lembra quem já recebeu.
 *
 * O registro de enviados fica em `JsonStore` e não numa tabela porque é log
 * operacional de uma migração — some junto com ela. O que não pode acontecer é
 * alguém receber o convite duas vezes por causa de um lote interrompido, e para
 * isso o arquivo basta.
 */

import { getDb, schema } from '../db/client';
import { eq, sql } from 'drizzle-orm';
import { JsonStore } from '../db/json-store';
import type { AlunoParaConvite } from './elegibilidade';

interface ConviteEnviado {
  id: string;
  studentId: string;
  email: string;
  enviadoEm: string;
}

const store = new JsonStore<ConviteEnviado>('convites-enviados.json', () => []);

export async function jaConvidados(): Promise<Set<string>> {
  const todos = await store.getAll();
  return new Set(todos.map((c) => c.email.toLowerCase()));
}

export async function registrarConvite(studentId: string, email: string): Promise<void> {
  await store.add({
    id: `conv-${studentId}-${Date.now()}`,
    studentId,
    email: email.toLowerCase(),
    enviadoEm: new Date().toISOString(),
  });
}

export async function listarConvitesEnviados(): Promise<ConviteEnviado[]> {
  return await store.getAll();
}

/**
 * Junta, numa consulta só, tudo que a regra de elegibilidade precisa saber:
 * quem já entrou, quantas matrículas tem, quantas venceram e qual era o papel
 * na plataforma de origem.
 */
export async function montarListaConvite(): Promise<AlunoParaConvite[]> {
  const db = getDb();
  const convidados = await jaConvidados();
  if (!db) return [];

  const linhas = (await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      lastLoginAt: schema.users.lastLoginAt,
      sourceRole: schema.students.sourceRole,
      matriculas: sql<number>`(select count(*)::int from enrollments e where e.student_id = ${schema.users.id})`,
      expiradas: sql<number>`(select count(*)::int from enrollments e where e.student_id = ${schema.users.id} and e.expires_at is not null and e.expires_at < now())`,
    })
    .from(schema.users)
    .leftJoin(schema.students, eq(schema.students.id, schema.users.id))
    .where(eq(schema.users.role, 'student'))) as Array<{
    id: string;
    email: string;
    name: string;
    lastLoginAt: Date | null;
    sourceRole: string | null;
    matriculas: number;
    expiradas: number;
  }>;

  return linhas.map((r) => ({
    id: r.id,
    email: r.email ?? '',
    name: r.name ?? r.email ?? r.id,
    jaEntrou: r.lastLoginAt !== null,
    matriculas: Number(r.matriculas ?? 0),
    matriculasExpiradas: Number(r.expiradas ?? 0),
    sourceRole: r.sourceRole,
    jaConvidado: convidados.has((r.email ?? '').toLowerCase()),
  }));
}
