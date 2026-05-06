// Middleware de autenticação por API token (paralelo ao JWT).
// Lê Authorization: Bearer pcok_... e injeta o token no contexto.

import type { MiddlewareHandler } from 'hono';
import {
  verifyToken,
  hasScope,
  type ApiToken,
  type ApiTokenScope,
} from './api-tokens';

declare module 'hono' {
  interface ContextVariableMap {
    apiToken?: ApiToken;
  }
}

// Rate limit in-memory por tokenId. Janela rolante de 60s.
// Default 60 reqs/min — suficiente pra polling de BI/Zapier sem flood.
const RL_WINDOW_MS = 60_000;
const RL_MAX = Number(process.env.API_TOKEN_RATE_LIMIT ?? '60');
const rlBuckets = new Map<string, number[]>();

function checkRateLimit(tokenId: string): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
} {
  const now = Date.now();
  const cutoff = now - RL_WINDOW_MS;
  const bucket = rlBuckets.get(tokenId) ?? [];
  // Limpa entradas antigas
  const recent = bucket.filter((ts) => ts >= cutoff);
  if (recent.length >= RL_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: recent[0]! + RL_WINDOW_MS - now,
    };
  }
  recent.push(now);
  rlBuckets.set(tokenId, recent);
  return {
    allowed: true,
    remaining: RL_MAX - recent.length,
    resetMs: RL_WINDOW_MS,
  };
}

export function requireApiToken(scope?: ApiTokenScope): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('authorization') ?? '';
    const m = auth.match(/^Bearer\s+(pcok_\S+)/i);
    if (!m) {
      return c.json({ error: { code: 'NO_TOKEN', message: 'Bearer pcok_... ausente.' } }, 401);
    }
    const token = await verifyToken(m[1]!);
    if (!token) {
      return c.json(
        { error: { code: 'INVALID_TOKEN', message: 'Token inválido, revogado ou expirado.' } },
        401,
      );
    }
    if (scope && !hasScope(token, scope)) {
      return c.json(
        {
          error: {
            code: 'INSUFFICIENT_SCOPE',
            message: `Token sem escopo "${scope}". Escopos: ${token.scopes.join(', ')}`,
          },
        },
        403,
      );
    }
    // Rate limit por token
    const rl = checkRateLimit(token.id);
    c.header('X-RateLimit-Limit', String(RL_MAX));
    c.header('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      c.header('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: `Limite excedido (${RL_MAX} reqs/min). Tente em ${Math.ceil(rl.resetMs / 1000)}s.`,
          },
        },
        429,
      );
    }
    c.set('apiToken', token);
    return await next();
  };
}
