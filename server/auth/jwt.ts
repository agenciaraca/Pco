// Helpers JWT — usa hono/jwt.
// JWT_SECRET vem de env. Se ausente, geramos um fallback aleatório por
// processo (tokens expiram quando o servidor reinicia). Em produção
// SEMPRE defina JWT_SECRET fixo.

import { sign, verify } from 'hono/jwt';
import crypto from 'node:crypto';
import type { Role } from './users-store';

const SECRET = (() => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(
      '[jwt] JWT_SECRET ausente ou < 32 chars — usando segredo aleatório de processo (sessões caem ao reiniciar).',
    );
  }
  return crypto.randomBytes(48).toString('hex');
})();

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  tv: number; // tokenVersion — invalida quando user.tokenVersion bumpa
  iat: number;
  exp: number;
  /**
   * Claim de impersonation. Quando presente, o token foi gerado por um admin
   * "entrando como" outro usuário (student). `act.sub` é o admin real que
   * iniciou a sessão; `sub` é o usuário visualizado.
   *
   * Tokens com `act` têm TTL curto (30 min) e são gerados via
   * /api/admin/impersonate/:userId.
   */
  act?: {
    sub: string;
    email: string;
    role: Role;
  };
}

export async function signToken(
  payload: { sub: string; email: string; role: Role; tv: number } & Record<
    string,
    unknown
  >,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + ttlSeconds };
  return sign(full, SECRET, 'HS256');
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = (await verify(token, SECRET, 'HS256')) as unknown as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}
