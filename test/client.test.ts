import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { http, ApiError } from '../src/app/data/client';

const originalFetch = globalThis.fetch;

describe('http client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET retorna JSON parseado', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const result = await http.get<{ ok: boolean }>('/test');
    expect(result.ok).toBe(true);
  });

  it('lança ApiError em 4xx com payload de erro estruturado', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { code: 'INVALID_INPUT', message: 'Campo obrigatório' },
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      ),
    ) as typeof fetch;

    await expect(http.post('/test', {})).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_INPUT',
    });
  });

  it('inclui Authorization quando há token em localStorage', async () => {
    localStorage.setItem(
      'ava-pco-auth',
      JSON.stringify({ token: 'abc123', user: {} }),
    );
    const fetchMock = vi.fn(async () =>
      new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    await http.get('/secure');

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer abc123');
  });

  it('serializa query string corretamente', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    await http.get('/items', { query: { search: 'foo', page: 2, ignored: undefined } });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('search=foo');
    expect(url).toContain('page=2');
    expect(url).not.toContain('ignored');
  });

  it('lança erro NETWORK quando fetch falha', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom');
    }) as typeof fetch;

    await expect(http.get('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
