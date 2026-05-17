// Worker que recalcula o risco de evasão periodicamente (default: 6h).
// Atualiza riskScore + status em admin-students.json e regrava
// retention-risks.json com snapshot novo.

import { recomputeAllRisks } from './retention-calculator';
import { listCourses } from '../repositories/courses';

let interval: NodeJS.Timeout | null = null;
let lastTickAt: string | null = null;
let totalTicks = 0;
let totalUpdated = 0;
let lastSummary: {
  total: number;
  byLevel: { baixo: number; medio: number; alto: number; critico: number };
  updated: number;
  durationMs: number;
} | null = null;

async function tick(): Promise<void> {
  const courses = await listCourses();
  const hoursById = new Map(courses.map((c) => [c.id, c.totalHours ?? 30]));
  const summary = await recomputeAllRisks({
    courseHours: (id) => hoursById.get(id) ?? 30,
  });
  lastSummary = summary;
  totalUpdated += summary.updated;
}

export function startWorker(intervalMs = 6 * 60 * 60 * 1000): void {
  if (interval) return;
  // Tick imediato no boot (após delay curto, para não competir com outros workers)
  setTimeout(() => {
    void (async () => {
      try {
        await tick();
        lastTickAt = new Date().toISOString();
        totalTicks++;
      } catch {
        /* swallow */
      }
    })();
  }, 30_000);
  interval = setInterval(() => {
    void (async () => {
      try {
        await tick();
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
    name: 'retention-recompute',
    enabled: interval !== null,
    lastTickAt,
    totalTicks,
    totalUpdated,
    lastSummary,
  };
}
