// Log de mensageria — append-only em data/messaging-log.json (cap 5000 entries).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { MessagingProviderId } from './types';

const MAX_ENTRIES = 5000;

export type MessagingLogStatus = 'sent' | 'queued' | 'failed';

export interface MessagingLogEntry {
  id: string;
  ts: string;
  provider: MessagingProviderId;
  to: string;
  body: string;
  tag?: string;
  status: MessagingLogStatus;
  externalId?: string;
  error?: string;
}

const store = new JsonStore<MessagingLogEntry>('messaging-log.json', () => []);

function newId(): string {
  return `msg-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function recordMessage(input: Omit<MessagingLogEntry, 'id' | 'ts'>): Promise<MessagingLogEntry> {
  const entry: MessagingLogEntry = {
    ...input,
    id: newId(),
    ts: new Date().toISOString(),
  };
  await store.unshift(entry);
  const all = await store.getAll();
  if (all.length > MAX_ENTRIES) await store.setAll(all.slice(0, MAX_ENTRIES));
  return entry;
}

export interface MessagingLogQuery {
  limit?: number;
  provider?: MessagingProviderId;
  status?: MessagingLogStatus;
  to?: string;
  since?: string;
}

export async function listLog(q: MessagingLogQuery = {}): Promise<MessagingLogEntry[]> {
  const all = await store.getAll();
  let filtered = all;
  if (q.provider) filtered = filtered.filter((e) => e.provider === q.provider);
  if (q.status) filtered = filtered.filter((e) => e.status === q.status);
  if (q.to) {
    const needle = q.to.toLowerCase();
    filtered = filtered.filter((e) => e.to.toLowerCase().includes(needle));
  }
  if (q.since) filtered = filtered.filter((e) => e.ts >= q.since!);
  return filtered.slice(0, Math.max(1, Math.min(q.limit ?? 200, MAX_ENTRIES)));
}

export async function clearLog(): Promise<void> {
  await store.setAll([]);
}

export interface MessagingStats {
  total: number;
  byProvider: Record<string, number>;
  byStatus: Record<MessagingLogStatus, number>;
  last24h: number;
  last7d: number;
  successRate: number;
  /** ISO datestrings yyyy-mm-dd → contagens. Ultimos 30 dias. */
  byDay: Array<{ day: string; total: number; sent: number; failed: number }>;
}

export async function getStats(now: Date = new Date()): Promise<MessagingStats> {
  return computeStats(await store.getAll(), now);
}

/** Versao pura de getStats — recebe entries por parametro pra facilitar tests. */
export function computeStats(all: MessagingLogEntry[], now: Date = new Date()): MessagingStats {
  const byProvider: Record<string, number> = {};
  const byStatus: Record<MessagingLogStatus, number> = {
    sent: 0,
    queued: 0,
    failed: 0,
  };
  const cutoff24h = now.getTime() - 24 * 60 * 60 * 1000;
  const cutoff7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  let last24h = 0;
  let last7d = 0;
  let successCount = 0;

  // Buckets dia (ultimos 30)
  const buckets = new Map<string, { total: number; sent: number; failed: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { total: 0, sent: 0, failed: 0 });
  }

  for (const e of all) {
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    const ts = new Date(e.ts).getTime();
    if (ts >= cutoff24h) last24h++;
    if (ts >= cutoff7d) last7d++;
    if (e.status === 'sent' || e.status === 'queued') successCount++;

    const day = e.ts.slice(0, 10);
    const b = buckets.get(day);
    if (b) {
      b.total += 1;
      if (e.status === 'sent' || e.status === 'queued') b.sent += 1;
      else if (e.status === 'failed') b.failed += 1;
    }
  }

  const total = all.length;
  const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

  return {
    total,
    byProvider,
    byStatus,
    last24h,
    last7d,
    successRate,
    byDay: Array.from(buckets.entries()).map(([day, b]) => ({ day, ...b })),
  };
}
