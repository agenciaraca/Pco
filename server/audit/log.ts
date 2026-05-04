// Audit log — registra mutações sensíveis (admin/superadmin) em data/audit-log.json.
// Append-only do nosso lado: nunca atualizamos nem removemos entries via API.

import type { Context } from 'hono';
import { JsonStore } from '../db/json-store';

export interface AuditEntry {
  id: string;
  ts: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  meta?: Record<string, unknown>;
  status: 'ok' | 'error';
}

const MAX_ENTRIES = 5000; // truncamento de tamanho — mantém os últimos N
const store = new JsonStore<AuditEntry>('audit-log.json', () => []);

function clientIp(c: Context): string | null {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = c.req.header('x-real-ip');
  if (real) return real;
  // hono sob node-server expõe via env raw — fallback null
  return null;
}

interface RecordInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  status?: 'ok' | 'error';
}

export async function recordAudit(c: Context, input: RecordInput): Promise<void> {
  try {
    const u = c.get('user') as
      | { sub: string; email?: string; role?: string }
      | undefined
      | null;
    const entry: AuditEntry = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      actorId: u?.sub ?? null,
      actorEmail: u?.email ?? null,
      actorRole: u?.role ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ip: clientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      meta: input.meta,
      status: input.status ?? 'ok',
    };
    await store.unshift(entry);

    // Truncamento: se passar do limite, mantém os mais novos
    const all = await store.getAll();
    if (all.length > MAX_ENTRIES) {
      await store.setAll(all.slice(0, MAX_ENTRIES));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record entry:', e);
  }
}

export interface AuditQuery {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export async function auditByDay(
  days = 7,
): Promise<Array<{ day: string; ok: number; error: number; total: number }>> {
  const all = await store.getAll();
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const buckets = new Map<string, { ok: number; error: number; total: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    buckets.set(key, { ok: 0, error: 0, total: 0 });
  }
  for (const e of all) {
    if (new Date(e.ts).getTime() < cutoff) continue;
    const key = e.ts.slice(0, 10);
    const b = buckets.get(key) ?? { ok: 0, error: 0, total: 0 };
    if (e.status === 'ok') b.ok += 1;
    else b.error += 1;
    b.total += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries()).map(([day, b]) => ({ day, ...b }));
}

export async function listAudit(query: AuditQuery = {}): Promise<AuditEntry[]> {
  const all = await store.getAll();
  let filtered = all;
  if (query.action) filtered = filtered.filter((e) => e.action.startsWith(query.action!));
  if (query.actorId) filtered = filtered.filter((e) => e.actorId === query.actorId);
  if (query.targetType) filtered = filtered.filter((e) => e.targetType === query.targetType);
  if (query.targetId) filtered = filtered.filter((e) => e.targetId === query.targetId);
  if (query.since) {
    const t = query.since;
    filtered = filtered.filter((e) => e.ts >= t);
  }
  if (query.until) {
    const t = query.until;
    filtered = filtered.filter((e) => e.ts <= t);
  }
  const limit = Math.max(1, Math.min(query.limit ?? 200, 1000));
  return filtered.slice(0, limit);
}
