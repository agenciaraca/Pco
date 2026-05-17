// A/B testing experiments store.
//
// Cada experiment tem:
//  - id: slug (ex: 'new-checkout-flow')
//  - variants: ['control', 'variant-a', ...]
//  - traffic: % do total recebendo experiment (0-100). Resto fica fora.
//  - status: draft | running | concluded
//
// Atribuição: hash(userId|sessionId + experimentId) % variantCount
// (estável: mesmo user sempre na mesma variante)
//
// Métricas: events com {experimentId, variant, eventName, userId, ts}
// agregados em runtime via aggregate().

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  variants: string[];
  traffic: number; // 0-100 (% inclusos)
  status: 'draft' | 'running' | 'concluded';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  concludedAt?: string;
  winnerVariant?: string;
}

export interface ExperimentEvent {
  id: string;
  experimentId: string;
  variant: string;
  eventName: 'assigned' | 'converted' | string;
  userId?: string;
  sessionId?: string;
  ts: string;
  meta?: Record<string, unknown>;
}

const experiments = new JsonStore<Experiment>('experiments.json', () => []);
const events = new JsonStore<ExperimentEvent>('experiment-events.json', () => []);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listExperiments(): Promise<Experiment[]> {
  return await experiments.getAll();
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  return await experiments.findOne((e) => e.id === id);
}

/** Retorna apenas experiments com status='running'. */
export async function getRunningExperiments(): Promise<Experiment[]> {
  const all = await experiments.getAll();
  return all.filter((e) => e.status === 'running');
}

export interface CreateExperimentInput {
  id?: string; // se omitido, derivado do name
  name: string;
  description?: string;
  variants: string[];
  traffic?: number;
}

export async function createExperiment(
  input: CreateExperimentInput,
): Promise<Experiment> {
  const slug = (input.id ?? input.name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (input.variants.length < 2) {
    throw new Error('Experiment precisa de pelo menos 2 variantes');
  }
  const now = new Date().toISOString();
  const exp: Experiment = {
    id: slug,
    name: input.name,
    description: input.description,
    variants: input.variants,
    traffic: Math.min(100, Math.max(0, input.traffic ?? 100)),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await experiments.unshift(exp);
  return exp;
}

export async function updateExperiment(
  id: string,
  patch: Partial<Pick<Experiment, 'name' | 'description' | 'status' | 'traffic' | 'winnerVariant'>>,
): Promise<Experiment | null> {
  return await experiments.update(
    (e) => e.id === id,
    (e) => {
      const updated = { ...e, ...patch, updatedAt: new Date().toISOString() };
      if (patch.status === 'running' && !e.startedAt) {
        updated.startedAt = new Date().toISOString();
      }
      if (patch.status === 'concluded' && !e.concludedAt) {
        updated.concludedAt = new Date().toISOString();
      }
      return updated;
    },
  );
}

export async function deleteExperiment(id: string): Promise<boolean> {
  return await experiments.modify((rows) => {
    const idx = rows.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  });
}

/**
 * Atribuição determinística: hash do `key` (userId ou sessionId) + experimentId
 * modulo o número de variantes. Retorna null se fora da janela de traffic.
 */
export function assignVariant(
  key: string,
  exp: Pick<Experiment, 'id' | 'variants' | 'traffic'>,
): string | null {
  if (!key || exp.variants.length === 0) return null;
  const h = crypto.createHash('md5').update(`${exp.id}:${key}`).digest();
  // Primeiro byte (0-255) determina se está dentro do traffic
  const trafficByte = h[0]!;
  const trafficThreshold = Math.floor((exp.traffic / 100) * 256);
  if (trafficByte >= trafficThreshold) return null;
  // Bytes 1-4 viram um int; mod numero de variantes
  const variantHash = ((h[1]! << 24) | (h[2]! << 16) | (h[3]! << 8) | h[4]!) >>> 0;
  return exp.variants[variantHash % exp.variants.length] ?? null;
}

export async function recordEvent(
  input: Omit<ExperimentEvent, 'id' | 'ts'>,
): Promise<void> {
  const event: ExperimentEvent = {
    id: newId('evt'),
    ts: new Date().toISOString(),
    ...input,
  };
  await events.unshift(event);
}

export interface AggregateRow {
  variant: string;
  assigned: number;
  converted: number;
  conversionRate: number; // 0-1
}

export async function aggregate(experimentId: string): Promise<AggregateRow[]> {
  const exp = await getExperiment(experimentId);
  if (!exp) return [];
  const all = await events.getAll();
  const filtered = all.filter((e) => e.experimentId === experimentId);
  const byVariant = new Map<string, { assigned: number; converted: number }>();
  for (const v of exp.variants) {
    byVariant.set(v, { assigned: 0, converted: 0 });
  }
  for (const e of filtered) {
    const row = byVariant.get(e.variant);
    if (!row) continue;
    if (e.eventName === 'assigned') row.assigned++;
    else if (e.eventName === 'converted') row.converted++;
  }
  return Array.from(byVariant.entries()).map(([variant, r]) => ({
    variant,
    assigned: r.assigned,
    converted: r.converted,
    conversionRate: r.assigned > 0 ? r.converted / r.assigned : 0,
  }));
}
