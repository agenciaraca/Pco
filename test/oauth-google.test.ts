// Tests do OAuth Google (funcoes puras + flow basic).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildGoogleAuthUrl,
  exchangeCodeForToken,
  fetchGoogleUserInfo,
  generateState,
  googleConfigFromEnv,
} from '../server/auth/oauth-google';

const baseConfig = {
  clientId: 'cli-id-123',
  clientSecret: 'sec-789',
  redirectUri: 'https://app.example.com/api/auth/oauth/google/callback',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  delete process.env.PUBLIC_ORIGIN;
});

describe('googleConfigFromEnv', () => {
  it('null sem env vars', () => {
    expect(googleConfigFromEnv()).toBeNull();
  });
  it('null com apenas client_id', () => {
    process.env.GOOGLE_CLIENT_ID = 'a';
    expect(googleConfigFromEnv()).toBeNull();
  });
  it('retorna config com defaults de redirect', () => {
    process.env.GOOGLE_CLIENT_ID = 'a';
    process.env.GOOGLE_CLIENT_SECRET = 'b';
    process.env.PUBLIC_ORIGIN = 'https://x.com';
    const c = googleConfigFromEnv();
    expect(c).not.toBeNull();
    expect(c!.clientId).toBe('a');
    expect(c!.redirectUri).toBe('https://x.com/api/auth/oauth/google/callback');
  });
  it('respeita GOOGLE_REDIRECT_URI explicito', () => {
    process.env.GOOGLE_CLIENT_ID = 'a';
    process.env.GOOGLE_CLIENT_SECRET = 'b';
    process.env.GOOGLE_REDIRECT_URI = 'https://override.com/cb';
    expect(googleConfigFromEnv()!.redirectUri).toBe('https://override.com/cb');
  });
});

describe('buildGoogleAuthUrl', () => {
  it('inclui client_id, redirect_uri, scope, state', () => {
    const url = new URL(
      buildGoogleAuthUrl({ config: baseConfig, state: 'state-xyz' }),
    );
    expect(url.host).toBe('accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('cli-id-123');
    expect(url.searchParams.get('redirect_uri')).toBe(baseConfig.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-xyz');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('aceita scope custom + login_hint', () => {
    const url = new URL(
      buildGoogleAuthUrl({
        config: baseConfig,
        state: 's',
        scope: 'openid email',
        loginHint: 'aluno@x.com',
      }),
    );
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('login_hint')).toBe('aluno@x.com');
  });
});

describe('generateState', () => {
  it('produz hex 48 chars (24 bytes)', () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{48}$/);
  });
  it('valores únicos', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe('exchangeCodeForToken', () => {
  it('POST x-www-form-urlencoded com code/clientId/secret/redirectUri', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: 'at-1', expires_in: 3600, id_token: 'idt' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const r = await exchangeCodeForToken('thecode', baseConfig);
    expect(r.access_token).toBe('at-1');
    expect(r.id_token).toBe('idt');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://oauth2.googleapis.com/token');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as string;
    expect(body).toContain('code=thecode');
    expect(body).toContain('client_id=cli-id-123');
    expect(body).toContain('grant_type=authorization_code');
  });

  it('lanca em HTTP non-2xx', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('invalid_grant', { status: 400 }),
    );
    await expect(exchangeCodeForToken('bad', baseConfig)).rejects.toThrow(/400/);
  });
});

describe('fetchGoogleUserInfo', () => {
  it('GET userinfo com Bearer access token', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'gid-42',
          email: 'aluno@x.com',
          verified_email: true,
          name: 'Aluno',
          picture: 'https://lh.../pic.jpg',
        }),
        { status: 200 },
      ),
    );
    const u = await fetchGoogleUserInfo('at-1');
    expect(u.email).toBe('aluno@x.com');
    expect(u.name).toBe('Aluno');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('userinfo');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer at-1',
    });
  });
  it('lanca em HTTP non-2xx', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    await expect(fetchGoogleUserInfo('bad')).rejects.toThrow(/401/);
  });
});
