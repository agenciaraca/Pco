// Tests do wrapper Sentry server-side (zero deps).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseDsn,
  buildEvent,
  buildEnvelope,
  captureException,
  resetSentryCache,
} from '../server/observability/sentry';

beforeEach(() => {
  resetSentryCache();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_RELEASE;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSentryCache();
});

describe('parseDsn', () => {
  it('parseia DSN público válido', () => {
    const r = parseDsn('https://abc123@o123.ingest.sentry.io/456');
    expect(r).not.toBeNull();
    expect(r!.publicKey).toBe('abc123');
    expect(r!.projectId).toBe('456');
    expect(r!.envelopeUrl).toBe('https://o123.ingest.sentry.io/api/456/envelope/');
  });

  it('aceita DSN com secret legado (ignora secret)', () => {
    const r = parseDsn('https://pub:sec@host/789');
    expect(r!.publicKey).toBe('pub');
    expect(r!.projectId).toBe('789');
  });

  it('retorna null pra DSN vazia/inválida', () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('not-a-url')).toBeNull();
    expect(parseDsn('https://nohost')).toBeNull();
    expect(parseDsn('https://host/no-public-key')).toBeNull();
  });
});

describe('buildEvent', () => {
  it('extrai mensagem e tipo de Error', () => {
    const err = new TypeError('algo deu ruim');
    const ev = buildEvent(err);
    expect(ev.platform).toBe('node');
    expect(ev.level).toBe('error');
    expect(ev.exception.values[0].type).toBe('TypeError');
    expect(ev.exception.values[0].value).toBe('algo deu ruim');
    expect(ev.exception.values[0].stacktrace?.frames.length).toBeGreaterThan(0);
  });

  it('aceita non-Error', () => {
    const ev = buildEvent('string err');
    expect(ev.exception.values[0].type).toBe('NonError');
    expect(ev.exception.values[0].value).toBe('string err');
    expect(ev.exception.values[0].stacktrace).toBeUndefined();
  });

  it('respeita level/tags/extra', () => {
    const ev = buildEvent(new Error('x'), {
      level: 'warning',
      tags: { feature: 'login' },
      extra: { ip: '1.2.3.4' },
      user: { id: 'u-1', email: 'a@b.c' },
    });
    expect(ev.level).toBe('warning');
    expect(ev.tags).toEqual({ feature: 'login' });
    expect(ev.extra).toEqual({ ip: '1.2.3.4' });
    expect(ev.user).toEqual({ id: 'u-1', email: 'a@b.c' });
  });

  it('event_id é hex 32 chars', () => {
    const ev = buildEvent(new Error('x'));
    expect(ev.event_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('trunca mensagens longas', () => {
    const long = 'x'.repeat(20_000);
    const ev = buildEvent(new Error(long));
    expect(ev.exception.values[0].value.length).toBeLessThanOrEqual(8192);
  });
});

describe('buildEnvelope', () => {
  it('produz NDJSON com 3 linhas', () => {
    process.env.SENTRY_DSN = 'https://k@host/1';
    const dsn = parseDsn(process.env.SENTRY_DSN)!;
    const ev = buildEvent(new Error('test'));
    const env = buildEnvelope(dsn, ev);
    const lines = env.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).event_id).toBe(ev.event_id);
    expect(JSON.parse(lines[1])).toEqual({ type: 'event' });
    expect(JSON.parse(lines[2]).exception.values[0].value).toBe('test');
  });
});

describe('captureException', () => {
  it('é no-op quando SENTRY_DSN ausente', async () => {
    delete process.env.SENTRY_DSN;
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await captureException(new Error('x'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('faz POST envelope quando DSN presente', async () => {
    process.env.SENTRY_DSN = 'https://pkey@sentry.example.com/42';
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

    await captureException(new Error('boom'), {
      tags: { route: '/api/x' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://sentry.example.com/api/42/envelope/');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-sentry-envelope');
    expect(headers['X-Sentry-Auth']).toContain('sentry_key=pkey');
    const body = (init as RequestInit).body as string;
    expect(body).toContain('"value":"boom"');
    expect(body).toContain('"route":"/api/x"');
  });

  it('não rejeita em falha de fetch', async () => {
    process.env.SENTRY_DSN = 'https://k@h/1';
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network down'),
    );
    await expect(captureException(new Error('x'))).resolves.toBeUndefined();
  });

  it('não rejeita em HTTP non-2xx', async () => {
    process.env.SENTRY_DSN = 'https://k@h/1';
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('quota exceeded', { status: 429 }),
    );
    await expect(captureException(new Error('x'))).resolves.toBeUndefined();
  });
});
