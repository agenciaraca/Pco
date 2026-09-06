// Pedidos de exclusão de conta (LGPD direito à exclusão).
// Aluno solicita; admin valida e processa manualmente. Não deleta automaticamente.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type DeletionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface DeletionRequest {
  id: string;
  userId: string;
  userEmail: string;
  reason?: string;
  status: DeletionStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  /**
   * O expurgo que de fato rodou para esta solicitação.
   *
   * Existe porque `completed` era um carimbo: gravava o campo e a nota, e
   * **nada era apagado**. Sem este registro não há como distinguir "a escola
   * apagou os dados" de "alguém marcou a caixinha".
   */
  expurgo?: {
    executadoEm: string;
    executadoPor: string;
    /** Toda categoria foi tratada sem erro? */
    completo: boolean;
    /** Categorias apagadas ou anonimizadas, e quantos registros em cada. */
    tratadas: Array<{ categoria: string; destino: string; tratados: number }>;
    /** Categorias retidas, com o motivo — retenção sem justificativa é indevida. */
    retidas: Array<{ categoria: string; motivo: string }>;
    /** Categorias que não puderam ser tratadas, com o porquê. */
    pendentes: Array<{ categoria: string; erro: string }>;
  };
}

const store = new JsonStore<DeletionRequest>('deletion-requests.json', () => []);

function newId(): string {
  return `del-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<DeletionRequest[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (a.requestedAt > b.requestedAt ? -1 : 1));
}

export async function findActiveForUser(
  userId: string,
): Promise<DeletionRequest | null> {
  return await store.findOne(
    (r) =>
      r.userId === userId &&
      (r.status === 'pending' || r.status === 'approved'),
  );
}

export async function create(input: {
  userId: string;
  userEmail: string;
  reason?: string;
}): Promise<DeletionRequest> {
  const existing = await findActiveForUser(input.userId);
  if (existing) {
    throw new Error('Já existe uma solicitação ativa para este usuário.');
  }
  const r: DeletionRequest = {
    id: newId(),
    userId: input.userId,
    userEmail: input.userEmail,
    reason: input.reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  await store.unshift(r);
  return r;
}

export async function cancel(id: string, userId: string): Promise<boolean> {
  const updated = await store.update(
    (r) => r.id === id && r.userId === userId && r.status === 'pending',
    (r) => ({
      ...r,
      status: 'rejected',
      resolvedAt: new Date().toISOString(),
      resolutionNote: 'Cancelado pelo aluno',
    }),
  );
  return !!updated;
}

export async function setStatus(
  id: string,
  status: DeletionStatus,
  resolvedBy: string,
  note?: string,
): Promise<DeletionRequest | null> {
  return await store.update(
    (r) => r.id === id,
    (r) => ({
      ...r,
      status,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      resolutionNote: note,
    }),
  );
}

/** Guarda o resultado do expurgo na solicitação. */
export async function registrarExpurgo(
  id: string,
  expurgo: NonNullable<DeletionRequest['expurgo']>,
): Promise<DeletionRequest | null> {
  return await store.update(
    (r) => r.id === id,
    (r) => ({ ...r, expurgo }),
  );
}
