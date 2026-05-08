// OAuth 2.0 com Microsoft Entra ID (ex-Azure AD).
// Env-gated:
//   MICROSOFT_CLIENT_ID
//   MICROSOFT_CLIENT_SECRET
//   MICROSOFT_TENANT (default 'common' — aceita qualquer conta MS;
//                     ou 'organizations' / 'consumers' / <tenant-uuid>)
//   MICROSOFT_REDIRECT_URI (default <PUBLIC_ORIGIN>/api/auth/oauth/microsoft/callback)
//
// Fluxo identico ao Google (sprint 551).

import crypto from 'node:crypto';

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenant: string;
}

export interface MicrosoftUserInfo {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  /** mail eh o email primario (Exchange). userPrincipalName eh o login (geralmente email). */
  mail?: string | null;
  userPrincipalName?: string;
  preferredLanguage?: string;
}

export function microsoftConfigFromEnv(): MicrosoftOAuthConfig | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const tenant = process.env.MICROSOFT_TENANT ?? 'common';
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    `${process.env.PUBLIC_ORIGIN ?? 'http://localhost:3001'}/api/auth/oauth/microsoft/callback`;
  return { clientId, clientSecret, redirectUri, tenant };
}

function authBase(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
}

export interface BuildAuthUrlInput {
  config: MicrosoftOAuthConfig;
  state: string;
  scope?: string;
  loginHint?: string;
  /** 'select_account' para sempre mostrar account picker. */
  prompt?: 'login' | 'consent' | 'select_account' | 'none';
}

export function buildMicrosoftAuthUrl(input: BuildAuthUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.config.clientId,
    redirect_uri: input.config.redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: input.scope ?? 'openid email profile User.Read',
    state: input.state,
    prompt: input.prompt ?? 'select_account',
  });
  if (input.loginHint) params.set('login_hint', input.loginHint);
  return `${authBase(input.config.tenant)}/authorize?${params.toString()}`;
}

export function generateState(): string {
  return crypto.randomBytes(24).toString('hex');
}

export interface TokenExchangeResult {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  refresh_token?: string;
}

export async function exchangeCodeForToken(
  code: string,
  config: MicrosoftOAuthConfig,
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(`${authBase(config.tenant)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft token exchange failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export async function fetchMicrosoftUserInfo(
  accessToken: string,
): Promise<MicrosoftUserInfo> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Microsoft graph failed: HTTP ${res.status}`);
  }
  return (await res.json()) as MicrosoftUserInfo;
}

/**
 * Helper: extrai email confiavel — prefere mail, senao userPrincipalName
 * se for um email valido.
 */
export function extractEmail(u: MicrosoftUserInfo): string | null {
  if (u.mail && u.mail.includes('@')) return u.mail.toLowerCase();
  if (u.userPrincipalName && u.userPrincipalName.includes('@')) {
    return u.userPrincipalName.toLowerCase();
  }
  return null;
}
