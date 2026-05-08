// OAuth 2.0 + OIDC com Google. Env-gated por:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI (default: <PUBLIC_ORIGIN>/api/auth/oauth/google/callback)
//
// Fluxo: /auth/oauth/google → Google → redirect_uri (callback) →
// exchange code por id_token + access_token → fetch userinfo →
// create/update local user com role=student → emit JWT → redirect SPA.
//
// Implementacao zero-deps usando fetch.

import crypto from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  hd?: string; // hosted domain (G Suite)
}

export function googleConfigFromEnv(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.PUBLIC_ORIGIN ?? 'http://localhost:3001'}/api/auth/oauth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export interface BuildAuthUrlInput {
  config: GoogleOAuthConfig;
  /** State CSRF token — gere via generateState. */
  state: string;
  /** Default: 'openid email profile'. */
  scope?: string;
  /** Hint email pre-preenchido na tela de login Google. */
  loginHint?: string;
}

export function buildGoogleAuthUrl(input: BuildAuthUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.config.clientId,
    redirect_uri: input.config.redirectUri,
    response_type: 'code',
    scope: input.scope ?? 'openid email profile',
    state: input.state,
    access_type: 'online',
    prompt: 'select_account',
  });
  if (input.loginHint) params.set('login_hint', input.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
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
  config: GoogleOAuthConfig,
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenExchangeResult;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: HTTP ${res.status}`);
  }
  return (await res.json()) as GoogleUserInfo;
}
