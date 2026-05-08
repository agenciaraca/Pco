// Captura de erros não tratados — append-only em data/errors.json.
// Limita a 2.000 entries (descarta os mais antigos).

import crypto from 'node:crypto';
import type { Context } from 'hono';
import { JsonStore } from '../db/json-store';
import { captureException } from '../observability/sentry';

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

interface ClientErrorInput {
  message: string;
  stack?: string | null;
  path?: string | null;
  userAgent?: string | null;
}

export async function recordClientError(c: Context, input: ClientErrorInput): Promise<void> {
  try {
    const u = c.get('user') as
      | { sub: string; email?: string; role?: string }
      | undefined
      | null;
    const entry: ErrorEntry = {
      id: `c-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      ts: new Date().toISOString(),
      message: input.message.slice(0, 1000),
      stack: input.stack ? input.stack.slice(0, 5000) : null,
      method: 'CLIENT',
      path: (input.path ?? '').slice(0, 500),
      status: 0,
      actorId: u?.sub ?? null,
      actorEmail: u?.email ?? null,
      ip: clientIp(c),
      userAgent: (input.userAgent ?? c.req.header('user-agent') ?? '').slice(0, 500),
    };
    await store.unshift(entry);
    const all = await store.getAll();
    if (all.length > MAX_ENTRIES) await store.setAll(all.slice(0, MAX_ENTRIES));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[client-errors] failed to record:', e);
  }
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
    // Forward para Sentry server-side se SENTRY_DSN definido.
    // Fire-and-forget: erro do Sentry nunca quebra o handler.
    void captureException(err, {
      level: status >= 500 ? 'error' : 'warning',
      user: u ? { id: u.sub, email: u.email } : undefined,
      request: {
        method: c.req.method,
        url: c.req.url,
      },
      tags: { status: String(status) },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[errors] failed to record:', e);
  }
}

export interface ErrorsQuery {
  limit?: number;
  since?: string;
}

export async function errorsByDay(
  days = 7,
): Promise<Array<{ day: string; client: number; server: number; total: number }>> {
  const all = await store.getAll();
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const buckets = new Map<string, { client: number; server: number; total: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    buckets.set(key, { client: 0, server: 0, total: 0 });
  }
  for (const e of all) {
    if (new Date(e.ts).getTime() < cutoff) continue;
    const key = e.ts.slice(0, 10);
    const b = buckets.get(key) ?? { client: 0, server: 0, total: 0 };
    if (e.method === 'CLIENT') b.client += 1;
    else b.server += 1;
    b.total += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries()).map(([day, b]) => ({ day, ...b }));
}

export async function listErrors(q: ErrorsQuery = {}): Promise<ErrorEntry[]> {
  const all = await store.getAll();
  let filtered = all;
  if (q.since) filtered = filtered.filter((e) => e.ts >= q.since!);
  return filtered.slice(0, Math.max(1, Math.min(q.limit ?? 200, 1000)));
}
