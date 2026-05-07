import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pingLd } from '../server/imports/connectors/ld';
import type { ImportConnection } from '../server/imports/connections-store';

// 'dev:' prefix permite decryptApiKey funcionar sem master key em test
const devEncode = (s: string) => `dev:${Buffer.from(s, 'utf8').toString('base64')}`;

const baseConn: ImportConnection = {
  id: 'c1',
  name: 'PCO',
  kind: 'wp_ld_wc',
  siteUrl: 'https://psicanaliseclinica.online',
  wpUsername: 'admin',
  wpAppPassword: devEncode('secret'),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('pingLd — fallback de namespace e mensagens claras', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('OK em ldlms/v2 retorna mensagem detalhada', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-wp-total': '12' }),
      json: async () => [{ id: 1 }],
      text: async () => '',
    } as unknown as Response);
    const r = await pingLd(baseConn);
    expect(r.ok).toBe(true);
    expect(r.message).toContain('ldlms/v2');
    expect(r.message).toContain('1 curso');
    expect(r.message).toContain('total 12');
  });

  it('404 em ldlms/v2 cai pra wp/v2/sfwd-courses', async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      call += 1;
      if (call === 1) {
        // ldlms/v2 → 404
        return {
          ok: false,
          status: 404,
          headers: new Headers(),
          text: async () => '{"code":"rest_no_route"}',
        } as unknown as Response;
      }
      // wp/v2 → 200
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
        text: async () => '',
      } as unknown as Response;
    });
    const r = await pingLd(baseConn);
    expect(r.ok).toBe(true);
    expect(r.message).toContain('wp/v2');
  });

  it('401 em ldlms/v2 retorna mensagem clara sem tentar fallback', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => '{"code":"rest_forbidden"}',
    } as unknown as Response);
    const r = await pingLd(baseConn);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('HTTP 401');
    expect(r.message).toContain('administrator');
  });

  it('403 retorna mensagem orientativa', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () => '{"code":"rest_cannot_view"}',
    } as unknown as Response);
    const r = await pingLd(baseConn);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('HTTP 403');
  });

  it('todos namespaces 404 → mensagem orientando ativar plugin', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => '',
    } as unknown as Response);
    const r = await pingLd(baseConn);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('LearnDash LMS está ativo');
  });
});
