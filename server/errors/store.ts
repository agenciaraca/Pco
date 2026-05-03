// Captura de erros não tratados — append-only em data/errors.json.
// Limita a 2.000 entries (descarta os mais antigos).

import crypto from 'node:crypto';
import type { Context } from 'hono';
import { JsonStore } from '../db/json-store';

export interface ErrorEntry {
  id: string;
  ts: string;
  message: string;
  stack: string | null;
  method: string;
  path: string;
  status: number;
  actorId: string | null;
  actorEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}

const MAX_ENTRIES = 2000;
const store = new JsonStore<ErrorEntry>('errors.json', () => []);

function clientIp(c: Context): string | null {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    null
  );
}

export async function recordError(c: Context, err: unknown, status = 500): Promise<void> {
  try {
    const u = c.get('user') as
      | { sub: string; email?: string; role?: string }
      | undefined
      | null;
    const isError = err instanceof Error;
    const entry: ErrorEntry = {
      id: `e-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      ts: new Date().toISOString(),
      message: isError ? err.message : String(err),
      stack: isError && err.stack ? err.stack : null,
      method: c.req.method,
      path: c.req.path,
      status,
      actorId: u?.sub ?? null,
      actorEmail: u?.email ?? null,
      ip: clientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
    };
    await store.unshift(entry);
    const all = await store.getAll();
    if (all.length > MAX_ENTRIES) await store.setAll(all.slice(0, MAX_ENTRIES));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[errors] failed to record:', e);
  }
}

export interface ErrorsQuery {
  limit?: number;
  since?: string;
}

export async function listErrors(q: ErrorsQuery = {}): Promise<ErrorEntry[]> {
  const all = await store.getAll();
  let filtered = all;
  if (q.since) filtered = filtered.filter((e) => e.ts >= q.since!);
  return filtered.slice(0, Math.max(1, Math.min(q.limit ?? 200, 1000)));
}
