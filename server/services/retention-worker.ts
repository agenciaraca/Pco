// Worker que recalcula o risco de evasão periodicamente (default: 6h).
// Atualiza riskScore + status em admin-students.json e regrava
// retention-risks.json com snapshot novo.

import { recomputeAllRisks } from './retention-calculator';
import { listCourses } from '../repositories/courses';
import { novoRegistro, comRegistro } from '../jobs/registro-de-tick';

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

/** O carimbo é do SUCESSO. Falha vai para o registro, não para o relógio. */
async function tickComCarimbo(): Promise<void> {
  await tick();
  lastTickAt = new Date().toISOString();
  totalTicks++;
}

/**
 * Saúde do ciclo. Este roda de 6 em 6h: um ciclo perdido em silêncio é um
 * quarto de dia sem recalcular risco de evasão, e nada denunciava.
 */
const registro = novoRegistro();

export function startWorker(intervalMs = 6 * 60 * 60 * 1000): void {
  if (interval) return;
  // Tick imediato no boot (após delay curto, para não competir com outros workers)
  setTimeout(() => {
    void comRegistro(registro, tickComCarimbo, 'retention');
  }, 30_000);
  interval = setInterval(() => {
    void comRegistro(registro, tickComCarimbo, 'retention');
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
    ...registro,
    lastTickAt,
    totalTicks,
    totalUpdated,
    lastSummary,
  };
}
