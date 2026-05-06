// Agendamentos de import — recorrência diária ou semanal por conexão.
// Worker em-processo varre periodicamente e dispara dryRun ou execução real.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type {
  ConflictStrategy,
  EnrollmentExpirationRule,
  EnrollmentStartRule,
  ImportEntityType,
  UserMatchKey,
} from './types';

export type ScheduleFrequency = 'daily' | 'weekly';
// 0 = domingo, 6 = sábado
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ImportSchedule {
  id: string;
  name: string;
  connectionId: string;
  enabled: boolean;
  frequency: ScheduleFrequency;
  hourUtc: number; // 0-23
  minute: number; // 0-59
  // weekly only
  weekday?: Weekday;
  // entidades a importar
  entities: ImportEntityType[];
  dryRun: boolean;
  enrollment?: {
    startRule?: EnrollmentStartRule;
    expirationRule?: EnrollmentExpirationRule;
    defaultAccessDurationDays?: number;
    userMatchKeys?: UserMatchKey[];
    conflictStrategy?: ConflictStrategy;
    unmatchedUserPolicy?: 'skip' | 'create_stub' | 'error';
  };
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastJobId?: string;
  nextRunAt?: string;
}

const store = new JsonStore<ImportSchedule>('import-schedules.json', () => []);

function newId(): string {
  return `sch-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listSchedules(): Promise<ImportSchedule[]> {
  return store.getAll();
}

export async function findSchedule(id: string): Promise<ImportSchedule | null> {
  return store.findOne((s) => s.id === id);
}

export interface ScheduleInput {
  name: string;
  connectionId: string;
  enabled?: boolean;
  frequency: ScheduleFrequency;
  hourUtc: number;
  minute: number;
  weekday?: Weekday;
  entities: ImportEntityType[];
  dryRun?: boolean;
  enrollment?: ImportSchedule['enrollment'];
}

export async function createSchedule(input: ScheduleInput): Promise<ImportSchedule> {
  const now = new Date().toISOString();
  const sched: ImportSchedule = {
    id: newId(),
    name: input.name,
    connectionId: input.connectionId,
    enabled: input.enabled ?? true,
    frequency: input.frequency,
    hourUtc: clampInt(input.hourUtc, 0, 23),
    minute: clampInt(input.minute, 0, 59),
    weekday: input.frequency === 'weekly' ? input.weekday ?? 1 : undefined,
    entities: input.entities,
    dryRun: input.dryRun ?? true,
    enrollment: input.enrollment,
    createdAt: now,
    updatedAt: now,
    nextRunAt: computeNextRun(input).toISOString(),
  };
  await store.unshift(sched);
  return sched;
}

export async function updateSchedule(
  id: string,
  patch: Partial<ScheduleInput>,
): Promise<ImportSchedule | null> {
  return store.update(
    (s) => s.id === id,
    (s) => {
      const merged: ImportSchedule = {
        ...s,
        ...patch,
        weekday:
          (patch.frequency ?? s.frequency) === 'weekly'
            ? (patch.weekday ?? s.weekday ?? 1)
            : undefined,
        hourUtc:
          patch.hourUtc !== undefined ? clampInt(patch.hourUtc, 0, 23) : s.hourUtc,
        minute:
          patch.minute !== undefined ? clampInt(patch.minute, 0, 59) : s.minute,
        updatedAt: new Date().toISOString(),
      };
      merged.nextRunAt = computeNextRun(merged).toISOString();
      return merged;
    },
  );
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((s) => s.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

export async function recordRun(
  id: string,
  jobId: string,
): Promise<ImportSchedule | null> {
  return store.update(
    (s) => s.id === id,
    (s) => ({
      ...s,
      lastRunAt: new Date().toISOString(),
      lastJobId: jobId,
      nextRunAt: computeNextRun(s, new Date()).toISOString(),
    }),
  );
}

/**
 * Calcula próximo timestamp de execução para um schedule.
 * Sempre retorna data >= now.
 */
export function computeNextRun(
  s: Pick<ImportSchedule, 'frequency' | 'hourUtc' | 'minute' | 'weekday'>,
  now: Date = new Date(),
): Date {
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      s.hourUtc,
      s.minute,
      0,
      0,
    ),
  );
  if (s.frequency === 'daily') {
    if (candidate.getTime() <= now.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
  }
  // weekly: avança para o próximo dia da semana correto
  const targetDay = s.weekday ?? 1;
  while (
    candidate.getUTCDay() !== targetDay ||
    candidate.getTime() <= now.getTime()
  ) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

function clampInt(n: number, min: number, max: number): number {
  const i = Math.trunc(n);
  if (Number.isNaN(i)) return min;
  return Math.max(min, Math.min(max, i));
}

// Test-only helper
export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}

// Test-only helper: força nextRunAt sem recomputar
export async function _setNextRunAtForTests(
  id: string,
  nextRunAt: string | null,
): Promise<void> {
  await store.update(
    (s) => s.id === id,
    (s) => ({
      ...s,
      nextRunAt: nextRunAt === null ? undefined : nextRunAt,
    }),
  );
}
