// API tokens públicos para integrações externas (BI, Zapier, n8n, etc).
// Escopos read-only por enquanto. Token armazenado como hash SHA-256.
// O segredo claro só é mostrado no momento da criação.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type ApiTokenScope =
  | 'stats:read'
  | 'students:read'
  | 'orders:read'
  | 'courses:read'
  | 'certificates:read'
  | 'products:read'
  | 'all:read';

export const ALL_SCOPES: ApiTokenScope[] = [
  'stats:read',
  'students:read',
  'orders:read',
  'courses:read',
  'certificates:read',
  'products:read',
  'all:read',
];

export interface ApiToken {
  id: string;
  name: string;
  // SHA-256 hex do segredo
  secretHash: string;
  // Prefixo público pra identificação na UI: "pcok_xxxxxxxx"
  prefix: string;
  scopes: ApiTokenScope[];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  active: boolean;
}

export interface ApiTokenPublic extends Omit<ApiToken, 'secretHash'> {
  // sem secretHash
}

const store = new JsonStore<ApiToken>('api-tokens.json', () => []);

function newId(): string {
  return `apt-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function genSecret(): { plain: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(24).toString('base64url');
  const plain = `pcok_${raw}`;
  const prefix = plain.slice(0, 12);
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, prefix, hash };
}

function toPublic(t: ApiToken): ApiTokenPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secretHash, ...rest } = t;
  return rest;
}

export async function listTokens(): Promise<ApiTokenPublic[]> {
  const all = await store.getAll();
  return all.map(toPublic).sort((a, b) =>
    b.createdAt > a.createdAt ? 1 : -1,
  );
}

export interface CreateTokenInput {
  name: string;
  scopes: ApiTokenScope[];
  expiresAt?: string;
  createdBy: string;
}

export interface CreateTokenResult {
  token: ApiTokenPublic;
  // Segredo em CLARO — só retornado nesta chamada
  secret: string;
}

export async function createToken(input: CreateTokenInput): Promise<CreateTokenResult> {
  const { plain, prefix, hash } = genSecret();
  const t: ApiToken = {
    id: newId(),
    name: input.name,
    secretHash: hash,
    prefix,
    scopes: input.scopes,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    usageCount: 0,
    active: true,
  };
  await store.unshift(t);
  return { token: toPublic(t), secret: plain };
}

export async function revokeToken(id: string): Promise<boolean> {
  return !!(await store.update(
    (t) => t.id === id,
    (t) => ({ ...t, active: false }),
  ));
}

export async function deleteToken(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((t) => t.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

/**
 * Valida um token Bearer. Retorna o token válido ou null.
 * Atualiza lastUsedAt + usageCount em background.
 */
export async function verifyToken(plain: string): Promise<ApiToken | null> {
  if (!plain || !plain.startsWith('pcok_')) return null;
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  const found = await store.findOne((t) => t.secretHash === hash);
  if (!found) return null;
  if (!found.active) return null;
  if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
    return null;
  }
  // Update best-effort, não bloqueia
  void store
    .update(
      (t) => t.id === found.id,
      (t) => ({
        ...t,
        lastUsedAt: new Date().toISOString(),
        usageCount: t.usageCount + 1,
      }),
    )
    .catch(() => {});
  return found;
}

export function hasScope(token: ApiToken, scope: ApiTokenScope): boolean {
  return token.scopes.includes('all:read') || token.scopes.includes(scope);
}
