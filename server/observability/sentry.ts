// Wrapper minimo Sentry — sem @sentry/node (mantem zero deps grandes).
//
// Env-gated: se SENTRY_DSN ausente, todas as funcoes sao no-op
// (warn uma vez no boot). Quando presente, faz POST direto ao endpoint
// /envelope com payload no formato Sentry SDK 7.
//
// Limitado a captureException — nao faz tracing, perfis, ou breadcrumbs.

import crypto from 'node:crypto';

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
  envelopeUrl: string;
}

let parsed: ParsedDsn | null | undefined; // undefined = nao avaliado, null = sem DSN
let warned = false;

export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  // Format: https://<publicKey>@<host>/<projectId>
  // Optional secret: https://<key>:<secret>@host/projectId (deprecated, ignore secret).
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\//, '').split('/').pop() ?? '';
    if (!publicKey || !projectId) return null;
    const host = `${u.protocol}//${u.host}`;
    return {
      host: u.host,
      projectId,
      publicKey,
      envelopeUrl: `${host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function getDsn(): ParsedDsn | null {
  if (parsed !== undefined) return parsed;
  parsed = parseDsn(process.env.SENTRY_DSN);
  if (!parsed && process.env.NODE_ENV !== 'test' && !warned) {
    // eslint-disable-next-line no-console
    console.log('[sentry] SENTRY_DSN ausente — captura desabilitada.');
    warned = true;
  }
  return parsed;
}

/** Reset para testes. */
export function resetSentryCache(): void {
  parsed = undefined;
  warned = false;
}

export interface SentryContext {
  user?: { id?: string; email?: string };
  request?: { method?: string; url?: string; headers?: Record<string, string> };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: 'node';
  level: SentryContext['level'];
  server_name?: string;
  environment?: string;
  release?: string;
  user?: SentryContext['user'];
  request?: SentryContext['request'];
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  exception: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: { frames: Array<{ filename: string; function?: string; lineno?: number }> };
    }>;
  };
}

function eventId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function parseStack(stack: string): Array<{ filename: string; function?: string; lineno?: number }> {
  const frames: Array<{ filename: string; function?: string; lineno?: number }> = [];
  const lines = stack.split('\n').slice(1, 21); // skip first line (error message)
  for (const line of lines) {
    const m = line.match(/at (?:(.+) )?\(?(.+?):(\d+):\d+\)?$/);
    if (m) {
      frames.push({ function: m[1], filename: m[2], lineno: Number(m[3]) });
    }
  }
  return frames.reverse(); // Sentry expects oldest first
}

export function buildEvent(err: unknown, ctx: SentryContext = {}): SentryEvent {
  const isError = err instanceof Error;
  const message = isError ? err.message : String(err);
  const type = isError ? err.name || 'Error' : 'NonError';
  const stack = isError && err.stack ? err.stack : null;

  return {
    event_id: eventId(),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: ctx.level ?? 'error',
    server_name: process.env.HOSTNAME,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    user: ctx.user,
    request: ctx.request,
    tags: ctx.tags,
    extra: ctx.extra,
    exception: {
      values: [
        {
          type,
          value: message.slice(0, 8192),
          stacktrace: stack ? { frames: parseStack(stack) } : undefined,
        },
      ],
    },
  };
}

export function buildEnvelope(dsn: ParsedDsn, event: SentryEvent): string {
  const header = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: process.env.SENTRY_DSN,
  });
  const itemHeader = JSON.stringify({ type: 'event' });
  const body = JSON.stringify(event);
  // Envelope: 3 NDJSON lines.
  return `${header}\n${itemHeader}\n${body}\n`;
}

/**
 * Captura uma exception. Fire-and-forget: nunca rejeita pra nao
 * impactar o caller. Falhas de POST sao logadas via console.warn.
 */
export async function captureException(err: unknown, ctx?: SentryContext): Promise<void> {
  const dsn = getDsn();
  if (!dsn) return;
  try {
    const ev = buildEvent(err, ctx);
    const envelope = buildEnvelope(dsn, ev);
    const res = await fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth':
          `Sentry sentry_version=7, sentry_client=ava-pco/0.1.0, ` +
          `sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[sentry] envelope HTTP ${res.status}`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sentry] capture failed:', e);
  }
}
