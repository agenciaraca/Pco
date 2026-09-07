// External references — mapeia (sourceType, externalEntityType, externalId) → registro interno.
// Usado por idempotência (re-import não duplica) e para resolver relacionamentos cross-entity.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { ExternalReference, ImportEntityType, ImportSource } from './types';

const store = new JsonStore<ExternalReference>('external-references.json', () => []);

function newId(): string {
  return `xref-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function find(
  sourceType: ImportSource,
  externalEntityType: ImportEntityType,
  externalId: string,
): Promise<ExternalReference | null> {
  return await store.findOne(
    (r) =>
      r.sourceType === sourceType &&
      r.externalEntityType === externalEntityType &&
      r.externalId === externalId,
  );
}

export async function listByJob(jobId: string): Promise<ExternalReference[]> {
  return await store.filter((r) => r.jobId === jobId);
}

export async function listForInternal(
  internalEntityType: ImportEntityType,
  internalId: string,
): Promise<ExternalReference[]> {
  return await store.filter(
    (r) => r.internalEntityType === internalEntityType && r.internalId === internalId,
  );
}

/**
 * As referências que apontam para a CONTA de uma pessoa.
 *
 * `internalId` só é igual ao id do usuário nas referências de `student` — as
 * de pedido e de matrícula carregam o id do pedido e o da matrícula. Por isso
 * a busca é pelo id, sem filtrar o tipo: ela acerta exatamente a linha de
 * identidade e não encosta nas outras.
 *
 * Existe para o expurgo da LGPD. Cada linha destas amarra a conta a um usuário
 * do WordPress de origem (`psi:1234`, `portal:567`) — depois de a conta ser
 * anonimizada, ela continuaria sendo o caminho de volta ao nome real.
 */
export async function listForUser(userId: string): Promise<ExternalReference[]> {
  return await store.filter((r) => r.internalId === userId);
}

/**
 * Apaga as referências da conta. Devolve quantas saíram.
 *
 * **A consequência operacional, escrita porque não é óbvia:** sem a
 * referência, uma reimportação da mesma origem deixa de reconhecer a pessoa e
 * criaria uma conta nova — ressuscitando o que o titular pediu para apagar. O
 * conserto disso não é guardar o vínculo, é a escola remover o titular na
 * ORIGEM, que é obrigação dela do mesmo jeito. Guardar o mapeamento "para o
 * caso de reimportar" seria manter o identificador exatamente pelo motivo que
 * a anonimização existe para eliminar.
 *
 * Usa `modify` e não `getAll` + `setAll`: o par monta um array novo fora da
 * lista viva e o instala por cima, e entre as duas chamadas há `await` — toda
 * escrita concorrente no intervalo se perde sem erro.
 */
export async function clearForUser(userId: string): Promise<number> {
  return await store.modify((items) => {
    let removidas = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i]!.internalId === userId) {
        items.splice(i, 1);
        removidas++;
      }
    }
    return removidas;
  });
}

interface UpsertInput {
  sourceType: ImportSource;
  externalEntityType: ImportEntityType;
  externalId: string;
  internalEntityType: ImportEntityType;
  internalId: string;
  jobId: string;
  metadata?: Record<string, unknown>;
}

export async function upsert(input: UpsertInput): Promise<ExternalReference> {
  const existing = await find(input.sourceType, input.externalEntityType, input.externalId);
  if (existing) {
    const updated = await store.update(
      (r) => r.id === existing.id,
      (r) => ({
        ...r,
        internalEntityType: input.internalEntityType,
        internalId: input.internalId,
        metadata: input.metadata ?? r.metadata,
        updatedAt: new Date().toISOString(),
      }),
    );
    return updated!;
  }
  const now = new Date().toISOString();
  const ref: ExternalReference = {
    id: newId(),
    sourceType: input.sourceType,
    externalEntityType: input.externalEntityType,
    externalId: input.externalId,
    internalEntityType: input.internalEntityType,
    internalId: input.internalId,
    metadata: input.metadata,
    jobId: input.jobId,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(ref);
  return ref;
}

export async function deleteByJob(jobId: string): Promise<number> {
  const all = await store.getAll();
  const keep = all.filter((r) => r.jobId !== jobId);
  const removed = all.length - keep.length;
  if (removed > 0) await store.setAll(keep);
  return removed;
}
