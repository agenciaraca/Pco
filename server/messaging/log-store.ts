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
