// Middleware que registra automaticamente toda mutação em rotas /admin/*.
// Roda DEPOIS do handler — só grava se a resposta foi ok (status < 400).

import type { MiddlewareHandler } from 'hono';
import { recordAudit } from './log';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function actionFromRoute(method: string, path: string): {
  action: string;
  targetType: string | null;
  targetId: string | null;
} {
  // Remove /api prefix se presente, e /admin/
  const clean = path.replace(/^\/api/, '').replace(/^\/admin\//, '');
  const segments = clean.split('/').filter(Boolean);
  // Heurística: primeira seção = entidade, último segmento UUID-like = id
  const targetType = segments[0] ?? null;
  let targetId: string | null = null;
  if (segments.length > 1) {
    const last = segments[segments.length - 1]!;
    // se for verbo (block, unblock, status, password, test) — não é id
    const isVerb = /^[a-z-]+$/i.test(last) && !/^[a-z0-9-]{6,}$/i.test(last)
      ? !/^\d/.test(last) && last.length < 12
      : false;
    if (!isVerb) targetId = last;
  }
  // ação canonical: METHOD entitytype.subaction?
  const verbSegment = segments.length > 2 ? segments[segments.length - 1]! : null;
  const verbSuffix = verbSegment && /^[a-z-]+$/i.test(verbSegment) ? `.${verbSegment}` : '';
  const action = `${targetType}${verbSuffix}.${method.toLowerCase()}`;
  return { action, targetType, targetId };
}

export const auditMiddleware: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  // Só atua em /admin/* mutativo. /admin/* GETs não geram log (ruidoso).
  const isAdmin = path.includes('/admin/');
  const isMutation = MUTATING_METHODS.has(method);
  if (!isAdmin || !isMutation) {
    await next();
    return;
  }

  await next();

  const status = c.res.status;
  if (status >= 400) {
    // Falhas também são interessantes — registra como error
    const { action, targetType, targetId } = actionFromRoute(method, path);
    await recordAudit(c, {
      action,
      targetType,
      targetId,
      meta: { status },
      status: 'error',
    });
    return;
  }

  const { action, targetType, targetId } = actionFromRoute(method, path);
  await recordAudit(c, { action, targetType, targetId });
};
