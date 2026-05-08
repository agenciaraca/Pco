// Tests do OAuth Microsoft Entra ID (sprint 558).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildMicrosoftAuthUrl,
  exchangeCodeForToken,
  fetchMicrosoftUserInfo,
  generateState,
  microsoftConfigFromEnv,
  extractEmail,
} from '../server/auth/oauth-microsoft';

const baseConfig = {
  clientId: 'ms-cli-id',
  clientSecret: 'ms-secret',
  redirectUri: 'https://app.example.com/api/auth/oauth/microsoft/callback',
  tenant: 'common',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.MICROSOFT_TENANT;
  delete process.env.MICROSOFT_REDIRECT_URI;
  delete process.env.PUBLIC_ORIGIN;
});

describe('microsoftConfigFromEnv', () => {
  it('null sem env vars', () => {
    expect(microsoftConfigFromEnv()).toBeNull();
  });
  it('default tenant=common', () => {
    process.env.MICROSOFT_CLIENT_ID = 'a';
    process.env.MICROSOFT_CLIENT_SECRET = 'b';
    expect(microsoftConfigFromEnv()!.tenant).toBe('common');
  });
  it('respeita MICROSOFT_TENANT', () => {
    process.env.MICROSOFT_CLIENT_ID = 'a';
    process.env.MICROSOFT_CLIENT_SECRET = 'b';
    process.env.MICROSOFT_TENANT = 'organizations';
    expect(microsoftConfigFromEnv()!.tenant).toBe('organizations');
  });
});

describe('buildMicrosoftAuthUrl', () => {
  it('endpoint inclui tenant', () => {
    const url = new URL(
      buildMicrosoftAuthUrl({ config: baseConfig, state: 'sx' }),
    );
    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');
  });

  it('tenant uuid eh URL-encoded', () => {
    const url = new URL(
      buildMicrosoftAuthUrl({
        config: { ...baseConfig, tenant: '11111111-2222-3333-4444-555555555555' },
        state: 'sx',
      }),
    );
    expect(url.pathname).toContain('11111111-2222-3333-4444-555555555555');
  });

  it('inclui scope default openid email profile User.Read', () => {
    const url = new URL(
      buildMicrosoftAuthUrl({ config: baseConfig, state: 'x' }),
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile User.Read');
    expect(url.searchParams.get('response_mode')).toBe('query');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('aceita scope + prompt + login_hint custom', () => {
    const url = new URL(
      buildMicrosoftAuthUrl({
        config: baseConfig,
        state: 'x',
        scope: 'openid email',
        prompt: 'consent',
        loginHint: 'a@b.c',
      }),
    );
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('login_hint')).toBe('a@b.c');
  });
});

describe('generateState', () => {
  it('hex 48 chars', () => {
    expect(generateState()).toMatch(/^[0-9a-f]{48}$/);
  });
});

describe('exchangeCodeForToken', () => {
  it('POST tenant token endpoint', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'at-1' }), { status: 200 }),
    );
    await exchangeCodeForToken('code-x', baseConfig);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    );
  });
  it('lanca em HTTP 400', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('AADSTS70008', { status: 400 }),
    );
    await expect(exchangeCodeForToken('bad', baseConfig)).rejects.toThrow(/400/);
  });
});

describe('fetchMicrosoftUserInfo', () => {
  it('GET graph.microsoft.com/v1.0/me com Bearer', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'aad-id',
          displayName: 'Aluno',
          mail: 'aluno@x.com',
          userPrincipalName: 'aluno@x.onmicrosoft.com',
        }),
        { status: 200 },
      ),
    );
    const u = await fetchMicrosoftUserInfo('at-1');
    expect(u.mail).toBe('aluno@x.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://graph.microsoft.com/v1.0/me');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer at-1',
    });
  });
});

describe('extractEmail', () => {
  it('prefere mail', () => {
    expect(
      extractEmail({
        id: 'x',
        mail: 'a@b.c',
        userPrincipalName: 'a@x.onmicrosoft.com',
      }),
    ).toBe('a@b.c');
  });
  it('cai no userPrincipalName se mail vazio', () => {
    expect(
      extractEmail({
        id: 'x',
        mail: null,
        userPrincipalName: 'a@x.onmicrosoft.com',
      }),
    ).toBe('a@x.onmicrosoft.com');
  });
  it('lowercase', () => {
    expect(
      extractEmail({ id: 'x', mail: 'A@B.com' }),
    ).toBe('a@b.com');
  });
  it('null se nem mail nem upn sao email', () => {
    expect(
      extractEmail({ id: 'x', mail: null, userPrincipalName: 'no-at-sign' }),
    ).toBeNull();
  });
});
