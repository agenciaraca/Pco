// Cliente HTTP fino pra API do Google Ads (REST v18) — sem SDK, só `fetch`,
// no mesmo espírito do `gaql.mjs` que a Academia Enlevo usa pra ler a conta
// dela pela API (a UI do Ads não abre atrás de bloqueador nenhures). Aqui é
// upload (mutate), não leitura de relatório, mas a autenticação é idêntica.
//
// Duas peças reaproveitáveis por quem for ler este arquivo:
//   - `getAccessToken` — troca o refresh_token por um access_token de ~1h.
//   - `normalizeAndHash*` — a normalização EXATA que o Google exige antes do
//     SHA-256 (e-mail minúsculo sem espaço; telefone em E.164). Upload com
//     normalização errada não dá erro — só casa com ninguém, silenciosamente.

import { createHash } from 'node:crypto';
import { getDecryptedConfig } from './google-ads-config';

const API_VERSION = 'v18';
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export class GoogleAdsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'GoogleAdsError';
  }
}

export async function getAccessToken(creds: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new GoogleAdsError(
      `Falha ao renovar o token OAuth: ${json.error ?? res.status} ${json.error_description ?? ''}`,
      res.status,
      json,
    );
  }
  return json.access_token;
}

export interface AdsRequestContext {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}

/** Monta o contexto autenticado a partir da config salva. Lança se não houver config completa. */
export async function buildContext(): Promise<AdsRequestContext> {
  const cfg = await getDecryptedConfig();
  if (!cfg || !cfg.developerToken || !cfg.clientSecret || !cfg.refreshToken || !cfg.customerId) {
    throw new GoogleAdsError('Conexão com o Google Ads não configurada.', 400, null);
  }
  const accessToken = await getAccessToken({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    refreshToken: cfg.refreshToken,
  });
  return {
    accessToken,
    developerToken: cfg.developerToken,
    customerId: cfg.customerId,
    loginCustomerId: cfg.loginCustomerId,
  };
}

function headers(ctx: AdsRequestContext): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${ctx.accessToken}`,
    'developer-token': ctx.developerToken,
    'Content-Type': 'application/json',
  };
  if (ctx.loginCustomerId) h['login-customer-id'] = ctx.loginCustomerId;
  return h;
}

/** GAQL de leitura (`searchStream` simplificado, sem paginação — usado só pra teste de conexão e lookups pequenos). */
export async function gaqlSearch(
  ctx: AdsRequestContext,
  query: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/customers/${ctx.customerId}/googleAds:search`, {
    method: 'POST',
    headers: headers(ctx),
    body: JSON.stringify({ query }),
  });
  const json = (await res.json()) as { results?: Record<string, unknown>[]; error?: unknown };
  if (!res.ok) throw new GoogleAdsError('Falha na consulta GAQL.', res.status, json.error ?? json);
  return json.results ?? [];
}

/** POST genérico pra qualquer `:xxx` de serviço (mutate, run job, etc), relativo a `customers/{id}`. */
export async function adsPost(
  ctx: AdsRequestContext,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  return adsPostUrl(ctx, `${BASE}/customers/${ctx.customerId}${path}`, body);
}

/**
 * Igual a `adsPost`, mas pra quando o alvo já é um resourceName ABSOLUTO
 * (`customers/{id}/offlineUserDataJobs/{jobId}:run`, devolvido por uma
 * chamada anterior) — sem isto, prefixar `customers/{id}` de novo duplica o
 * caminho e o Google devolve 404.
 */
export async function adsPostAbsolute(
  ctx: AdsRequestContext,
  resourcePath: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  return adsPostUrl(ctx, `${BASE}/${resourcePath}`, body);
}

async function adsPostUrl(
  ctx: AdsRequestContext,
  url: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(ctx),
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new GoogleAdsError(`Google Ads recusou ${url}: ${res.status}`, res.status, json);
  }
  return json;
}

// ---------- Normalização + hash pro Customer Match ----------
// Regra do Google (Customer Match data requirements): e-mail em minúsculo e
// sem espaço nas pontas; telefone em E.164 (+ código do país, só dígitos);
// nome em minúsculo e sem acento — SHA-256 de cada campo, hex, minúsculo.
// Sem isso o upload não erra, só não casa com ninguém.

export function hashSha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function hashEmail(raw: string): string {
  return hashSha256(normalizeEmail(raw));
}

/** Aceita qualquer formatação BR e devolve E.164 (+55DDDNNNNNNNNN) ou '' se não der pra validar. */
export function normalizePhoneBR(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = (raw.match(/\d/g) || []).join('');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  if (digits.length >= 11 && digits.length <= 13) return '+' + digits;
  return '';
}

export function hashPhone(raw: string | null | undefined): string {
  const e164 = normalizePhoneBR(raw);
  return e164 ? hashSha256(e164) : '';
}

function stripAccents(s: string): string {
  // U+0300 a U+036F: o intervalo de marcas combinantes que sobram depois do
  // NFD separar acento de letra. Escapado com contrabarra-u, nao como
  // caractere literal dentro do range -- a barra invertida ja sumiu neste
  // projeto mais de uma vez em codigo gerado por heredoc, virando esse mesmo
  // caractere invisivel.
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function hashName(raw: string | null | undefined): string {
  const clean = stripAccents((raw || '').trim().toLowerCase()).replace(/[^a-z]/g, '');
  return clean ? hashSha256(clean) : '';
}
