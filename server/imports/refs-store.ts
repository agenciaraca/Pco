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
