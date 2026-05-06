import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getJson, paginate, ConnectorError } from '../server/imports/connectors/http';

describe('imports/connectors/http', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getJson', () => {
    it('faz GET e parsa JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [{ id: 1 }],
        text: async () => '',
      } as unknown as Response);
      const r = await getJson({
        baseUrl: 'https://api.x',
        path: 'users',
      });
      expect(r.data).toEqual([{ id: 1 }]);
    });

    it('lança ConnectorError em HTTP !ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => 'Unauthorized',
      } as unknown as Response);
      await expect(
        getJson({ baseUrl: 'https://api.x', path: 'users' }),
      ).rejects.toBeInstanceOf(ConnectorError);
    });

    it('lê headers X-WP-Total e X-WP-TotalPages', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-wp-total': '147',
          'x-wp-totalpages': '15',
        }),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      const r = await getJson({
        baseUrl: 'https://api.x',
        path: 'users',
      });
      expect(r.total).toBe(147);
      expect(r.totalPages).toBe(15);
    });

    it('inclui Authorization Basic quando username+password', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
      await getJson({
        baseUrl: 'https://api.x',
        path: 'users',
        username: 'admin',
        password: 'secret',
      });
      const init = fetchSpy.mock.calls[0]![1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toContain('Basic ');
      // base64('admin:secret') = YWRtaW46c2VjcmV0
      expect(headers.Authorization).toContain('YWRtaW46c2VjcmV0');
    });

    it('omite Authorization sem creds', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
      await getJson({ baseUrl: 'https://api.x', path: 'users' });
      const init = fetchSpy.mock.calls[0]![1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('inclui query params na URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
      await getJson({
        baseUrl: 'https://api.x/wp-json',
        path: 'wp/v2/users',
        query: { context: 'edit', per_page: 100 },
      });
      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain('context=edit');
      expect(url).toContain('per_page=100');
    });

    it('skipa query values undefined/null/string vazia', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
      await getJson({
        baseUrl: 'https://api.x',
        path: 'users',
        query: { a: 'ok', b: undefined as unknown as string, c: '' },
      });
      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain('a=ok');
      expect(url).not.toContain('b=');
      expect(url).not.toContain('c=');
    });
  });

  describe('paginate', () => {
    it('itera múltiplas páginas até totalPages do header', async () => {
      const responses = [
        {
          ok: true,
          headers: new Headers({ 'x-wp-totalpages': '3' }),
          json: async () => [{ id: 1 }, { id: 2 }],
          text: async () => '',
        },
        {
          ok: true,
          headers: new Headers({ 'x-wp-totalpages': '3' }),
          json: async () => [{ id: 3 }, { id: 4 }],
          text: async () => '',
        },
        {
          ok: true,
          headers: new Headers({ 'x-wp-totalpages': '3' }),
          json: async () => [{ id: 5 }],
          text: async () => '',
        },
      ];
      let i = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return responses[i++] as unknown as Response;
      });
      const all: unknown[] = [];
      for await (const batch of paginate({
        baseUrl: 'https://api.x',
        path: 'users',
      })) {
        all.push(...batch);
      }
      expect(all).toHaveLength(5);
    });

    it('pára quando vem página vazia (sem header)', async () => {
      const responses = [
        {
          ok: true,
          headers: new Headers(),
          json: async () => [{ id: 1 }],
          text: async () => '',
        },
        {
          ok: true,
          headers: new Headers(),
          json: async () => [],
          text: async () => '',
        },
      ];
      let i = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return responses[i++] as unknown as Response;
      });
      const all: unknown[] = [];
      for await (const batch of paginate({
        baseUrl: 'https://api.x',
        path: 'users',
      })) {
        all.push(...batch);
      }
      expect(all).toHaveLength(1);
    });

    it('passa per_page e page nas queries', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response);
      globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
      const it2 = paginate(
        { baseUrl: 'https://api.x', path: 'users' },
        50,
      );
      // chama generator pelo menos 1 vez (vai parar com array vazio)
      await it2.next();
      const url = fetchSpy.mock.calls[0]![0] as string;
      expect(url).toContain('page=1');
      expect(url).toContain('per_page=50');
    });
  });

  describe('ConnectorError', () => {
    it('preserva status + body', () => {
      const e = new ConnectorError('msg', 404, { code: 'not_found' });
      expect(e.status).toBe(404);
      expect(e.body).toEqual({ code: 'not_found' });
      expect(e.message).toBe('msg');
    });
  });
});
