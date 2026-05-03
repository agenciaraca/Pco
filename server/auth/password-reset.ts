// Password reset tokens em memória.
// Token expira em 30 minutos. Cada novo pedido invalida tokens antigos
// do mesmo usuário.

import crypto from 'node:crypto';

interface ResetToken {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const TTL_MS = 30 * 60 * 1000; // 30 min
const tokens = new Map<string, ResetToken>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of tokens.entries()) {
    if (v.expiresAt < now || v.used) tokens.delete(k);
  }
}

export function createResetToken(userId: string, email: string): ResetToken {
  // Invalida tokens anteriores do mesmo userId
  for (const [k, v] of tokens.entries()) {
    if (v.userId === userId) tokens.delete(k);
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const entry: ResetToken = {
    token,
    userId,
    email,
    createdAt: now,
    expiresAt: now + TTL_MS,
    used: false,
  };
  tokens.set(token, entry);
  purgeExpired();
  return entry;
}

export function consumeResetToken(token: string): ResetToken | null {
  purgeExpired();
  const entry = tokens.get(token);
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null;
  entry.used = true;
  tokens.set(token, entry);
  return entry;
}

export function peekResetToken(token: string): ResetToken | null {
  purgeExpired();
  const entry = tokens.get(token);
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null;
  return entry;
}
