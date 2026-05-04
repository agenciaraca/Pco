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
    c.set('apiToken', token);
    return await next();
  };
}
