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
