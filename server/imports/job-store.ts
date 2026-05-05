// Job store — persiste cada importação com snapshot de configs, stats e logs.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { ImportJob, ImportJobStatus, ImportEntityType } from './types';

const store = new JsonStore<ImportJob>('import-jobs.json', () => []);

const MAX_ERROR_ENTRIES = 1000;
const MAX_NOTE_ENTRIES = 500;

function newId(): string {
  return `imp-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listJobs(limit = 100): Promise<ImportJob[]> {
  const all = await store.getAll();
  return [...all]
    .sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, 1000)));
}

export async function findJob(id: string): Promise<ImportJob | null> {
  return await store.findOne((j) => j.id === id);
}

export async function createJob(
  init: Omit<ImportJob, 'id' | 'startedAt' | 'stats' | 'perEntity' | 'createdRefs' | 'errorsLog' | 'notes' | 'status'> & {
    status?: ImportJobStatus;
  },
): Promise<ImportJob> {
  const now = new Date().toISOString();
  const job: ImportJob = {
    id: newId(),
    startedAt: now,
    status: init.status ?? 'pending',
    stats: {
      totalRead: 0,
      valid: 0,
      invalid: 0,
      created: 0,
      updated: 0,
      ignored: 0,
      errors: 0,
      durationMs: 0,
    },
    perEntity: {},
    createdRefs: [],
    errorsLog: [],
    notes: [],
    ...init,
  };
  await store.unshift(job);
  return job;
}

export async function setStatus(
  id: string,
  status: ImportJobStatus,
  finished = false,
): Promise<ImportJob | null> {
  return await store.update(
    (j) => j.id === id,
    (j) => ({
      ...j,
      status,
      ...(finished ? { finishedAt: new Date().toISOString() } : {}),
    }),
  );
}

export async function addNote(
  id: string,
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  await store.update(
    (j) => j.id === id,
    (j) => {
      const notes = [...j.notes, { ts: new Date().toISOString(), level, message }];
      if (notes.length > MAX_NOTE_ENTRIES) notes.splice(0, notes.length - MAX_NOTE_ENTRIES);
      return { ...j, notes };
    },
  );
}

export async function addError(
  id: string,
  err: ImportJob['errorsLog'][number],
): Promise<void> {
  await store.update(
    (j) => j.id === id,
    (j) => {
      const errorsLog = [...j.errorsLog, err];
      if (errorsLog.length > MAX_ERROR_ENTRIES)
        errorsLog.splice(0, errorsLog.length - MAX_ERROR_ENTRIES);
      return {
        ...j,
        errorsLog,
        stats: { ...j.stats, errors: j.stats.errors + 1 },
      };
    },
  );
}

export async function bumpEntityStat(
  id: string,
  entity: ImportEntityType,
  field: keyof NonNullable<ImportJob['perEntity'][ImportEntityType]>,
  amount = 1,
): Promise<void> {
  await store.update(
    (j) => j.id === id,
    (j) => {
      const cur = j.perEntity[entity] ?? {
        read: 0,
        valid: 0,
        invalid: 0,
        created: 0,
        updated: 0,
        ignored: 0,
        errors: 0,
      };
      cur[field] = (cur[field] ?? 0) + amount;
      const next = { ...j, perEntity: { ...j.perEntity, [entity]: cur } };
      // Atualiza stats agregadas de campos comuns
      if (
        field === 'read' ||
        field === 'valid' ||
        field === 'invalid' ||
        field === 'created' ||
        field === 'updated' ||
        field === 'ignored' ||
        field === 'errors'
      ) {
        next.stats = {
          ...j.stats,
          [field === 'read' ? 'totalRead' : field]:
            j.stats[field === 'read' ? 'totalRead' : (field as keyof ImportJob['stats'])] +
            amount,
        };
      }
      return next;
    },
  );
}

export async function appendCreatedRef(
  id: string,
  ref: ImportJob['createdRefs'][number],
): Promise<void> {
  await store.update(
    (j) => j.id === id,
    (j) => ({ ...j, createdRefs: [...j.createdRefs, ref] }),
  );
}

export async function setDuration(id: string, ms: number): Promise<void> {
  await store.update(
    (j) => j.id === id,
    (j) => ({ ...j, stats: { ...j.stats, durationMs: ms } }),
  );
}

// Set em-memória para cancel rápido — runReal/runDryRun checa entre rows
const cancelRequested = new Set<string>();

export function requestCancel(id: string): void {
  cancelRequested.add(id);
}

export function isCancelRequested(id: string): boolean {
  return cancelRequested.has(id);
}

export function clearCancel(id: string): void {
  cancelRequested.delete(id);
}

/** Drop jobs com mais de N dias (helper opcional). */
export async function purgeOlderThan(days: number): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60_000;
  const all = await store.getAll();
  const keep = all.filter((j) => new Date(j.startedAt).getTime() >= cutoff);
  const removed = all.length - keep.length;
  if (removed > 0) await store.setAll(keep);
  return removed;
}
