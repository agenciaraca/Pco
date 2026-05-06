import type { Context, Next } from 'hono';
import { isActionBlockedDuringImpersonation, type BlockedAction } from './impersonation';

/**
 * Bloqueia ações sensíveis quando a sessão atual é de impersonation
 * (i.e., JWT contém claim `act` apontando para o admin original).
 *
 * Use logo após `requireAuth(...)` em rotas que mexem em estado destrutivo
 * ou de credenciais. A lista canônica de ações bloqueadas vive em
 * `BLOCKED_ACTIONS_DURING_IMPERSONATION` (server/auth/impersonation.ts).
 *
 * Retorna 403 com code=IMPERSONATION_BLOCKED se a ação for bloqueada
 * dentro de uma sessão impersonada. Em sessão normal, é no-op.
 */
export function blockDuringImpersonation(action: BlockedAction) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (user?.act && isActionBlockedDuringImpersonation(action)) {
      return c.json(
        {
          error: {
            code: 'IMPERSONATION_BLOCKED',
            message:
              'Esta ação não pode ser feita enquanto você está visualizando como outro usuário. Saia da visualização e tente novamente.',
            details: { action },
          },
        },
        403,
      );
    }
    await next();
  };
}
