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
 * As claims que um token de SESSAO pode carregar. Lista branca.
 *
 * `sub`, `email`, `role`, `tv`, `iat` e `exp` sao o token normal de login;
 * `act` e a personificacao (admin agindo como aluno), que e sessao legitima.
 * **Qualquer outra claim significa token de proposito especifico**, e token de
 * proposito especifico nao e sessao.
 *
 * ## Por que lista branca, e nao lista negra
 *
 * A primeira versao desta funcao, escrita em 3/set/2026 para fechar o buraco do
 * 2FA, era `payload.totp === 'pending'` — e o comentario dela afirmava negar
 * "pela PRESENCA da claim, para que claim nova que ninguem lembrar de listar
 * continue sendo recusada por padrao". O comentario descrevia lista branca; o
 * codigo era lista negra de um item so.
 *
 * E a claim que "ninguem lembrou de listar" **ja existia no repositorio naquele
 * momento**: `server/notifications/broadcasts.ts` assina, para CADA
 * destinatario de comunicado, um token com `sub`, `email`, `role: 'student'`,
 * `tv: 0` e `scope: 'unsubscribe'`, com **TTL de um ano**, e o entrega na query
 * string do link de descadastro — dentro do e-mail. Como `attachUser` nao o
 * recusava, `Authorization: Bearer <aquele token>` era uma sessao de aluno
 * plena por 365 dias, para qualquer pessoa cujo `tokenVersion` fosse 0 (o
 * padrao de quem nunca trocou a senha). Um token de sessao de um ano em caixa
 * de e-mail, em historico de navegador e em log de servidor de correio.
 *
 * Por isso: acrescentar claim nova aqui e uma decisao explicita. Esquecer de
 * acrescentar falha fechado, que e o unico lado seguro para errar.
 */
const CLAIMS_DE_SESSAO = new Set(['sub', 'email', 'role', 'tv', 'iat', 'exp', 'act']);

export function ehTicketRestrito(payload: JwtPayload): boolean {
  return Object.keys(payload).some((claim) => !CLAIMS_DE_SESSAO.has(claim));
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
