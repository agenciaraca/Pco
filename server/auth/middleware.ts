import type { Context, Next } from 'hono';
import { verifyToken, type JwtPayload } from './jwt';
import type { Role } from './users-store';
import { findUserByEmail } from './users-store';

export interface AuthContextVar {
  user: JwtPayload;
}

declare module 'hono' {
  interface ContextVariableMap {
    user?: JwtPayload;
  }
}

/**
 * Um token so vira sessao quando NAO carrega marca de escopo restrito.
 * Hoje a unica marca e `totp: 'pending'`; qualquer outra que venha a existir
 * deve ser acrescentada aqui, e nao numa lista de rotas.
 */
export function ehTicketRestrito(payload: JwtPayload): boolean {
  return payload.totp === 'pending';
}

function readBearer(c: Context): string | null {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export async function attachUser(c: Context, next: Next) {
  const token = readBearer(c);
  if (token) {
    const payload = await verifyToken(token);
    // Ticket de 2FA nao e sessao. Ele prova a senha, nao o segundo fator, e so
    // vale em /auth/login/totp — que le a claim por conta propria. Negamos aqui
    // pela PRESENCA da claim (falha fechada): claim nova de escopo restrito
    // que ninguem lembrar de listar continua sendo recusada por padrao.
    if (payload && !ehTicketRestrito(payload)) {
      // Valida tokenVersion — se o user bumpou, esse token é inválido
      const u = await findUserByEmail(payload.email);
      if (u && u.active && (payload.tv ?? 0) === (u.tokenVersion ?? 0)) {
        c.set('user', payload);
      }
    }
  }
  await next();
}

export function requireAuth(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Token ausente ou inválido.' } }, 401);
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      // superadmin sempre passa
      if (user.role !== 'superadmin') {
        return c.json(
          { error: { code: 'FORBIDDEN', message: 'Permissão insuficiente para esta ação.' } },
          403,
        );
      }
    }
    await next();
  };
}
