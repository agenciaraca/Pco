// Log de envios — cap em 1000 entradas, mais antigas são descartadas.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { EmailLog } from './types';

const MAX = 1000;
const store = new JsonStore<EmailLog>('email-logs.json', () => []);

function newId(): string {
  return `eml-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listLogs(limit = 200): Promise<EmailLog[]> {
  const all = await store.getAll();
  return [...all]
    .sort((a, b) => (b.ts > a.ts ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, MAX)));
}

export async function pushLog(log: Omit<EmailLog, 'id' | 'ts'>): Promise<EmailLog> {
  const entry: EmailLog = {
    id: newId(),
    ts: new Date().toISOString(),
    ...log,
  };
  const all = await store.getAll();
  const next = [entry, ...all].slice(0, MAX);
  await store.setAll(next);
  return entry;
}
