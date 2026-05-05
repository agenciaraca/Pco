// Worker que verifica schedules de import e dispara os que estão na hora.
// Tick padrão: a cada 60s. Usa nextRunAt para decidir quando executar.

import * as schedules from './schedules-store';
import * as importConnections from './connections-store';
import { triggerApiImport } from './runner';
import type {
  EnrollmentExpirationRule,
  EnrollmentStartRule,
  ImportEnrollmentConfig,
} from './types';

let interval: NodeJS.Timeout | null = null;
let lastTickAt: string | null = null;
let totalTicks = 0;
let totalDispatched = 0;

export async function tickWorker(now: Date = new Date()): Promise<{
  dispatched: number;
  errors: number;
}> {
  const all = await schedules.listSchedules();
  let dispatched = 0;
  let errors = 0;

  for (const s of all) {
    if (!s.enabled) continue;
    if (!s.nextRunAt) continue;
    if (new Date(s.nextRunAt).getTime() > now.getTime()) continue;

    try {
      const conn = await importConnections.getConnection(s.connectionId);
      if (!conn) {
        await schedules.updateSchedule(s.id, { enabled: false });
        continue;
      }

      const enrollmentRules: ImportEnrollmentConfig = {
        startRule: (s.enrollment?.startRule ?? 'paid_date') as EnrollmentStartRule,
        expirationRule: (s.enrollment?.expirationRule ??
          'start_plus_duration') as EnrollmentExpirationRule,
        defaultAccessDurationDays: s.enrollment?.defaultAccessDurationDays,
        wcStatusMap: {},
        userMatchKeys: s.enrollment?.userMatchKeys ?? conn.defaultUserMatchKeys,
        unmatchedUserPolicy: s.enrollment?.unmatchedUserPolicy,
        conflictStrategy:
          s.enrollment?.conflictStrategy ?? conn.defaultConflictStrategy,
      };

      const r = await triggerApiImport({
        connectionId: s.connectionId,
        entities: s.entities,
        dryRun: s.dryRun,
        enrollmentRules,
        startedBy: 'scheduler',
        startedById: s.id,
      });

      await schedules.recordRun(s.id, r.jobId);
      dispatched++;
      totalDispatched++;
    } catch (err) {
      errors++;
      // eslint-disable-next-line no-console
      console.error(
        `[schedules-worker] erro em ${s.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { dispatched, errors };
}

export function startWorker(intervalMs = 60_000): void {
  if (interval) return;
  interval = setInterval(() => {
    void (async () => {
      try {
        await tickWorker();
        lastTickAt = new Date().toISOString();
        totalTicks++;
      } catch {
        /* swallow */
      }
    })();
  }, intervalMs);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return {
    name: 'imports-scheduler',
    enabled: interval !== null,
    lastTickAt,
    totalTicks,
    totalDispatched,
  };
}
