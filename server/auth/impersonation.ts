// Impersonation: admin "entra" como aluno.
// Gera JWT com claim `act` (actor original) e TTL curto. Audit log registra
// toda ação com actorId = act.sub para rastreabilidade.

import { signToken, type JwtPayload } from './jwt';
import { findUserById, type SystemUserPublic, type Role } from './users-store';

/** TTL de tokens de impersonation: 30 minutos. */
export const IMPERSONATION_TTL_SECONDS = 30 * 60;

export interface ImpersonationResult {
  token: string;
  actor: { id: string; email: string; role: Role };
  target: { id: string; email: string; role: Role; name: string };
  expiresInSeconds: number;
}

/**
 * Verifica se um actor pode impersonar um target.
 * Regras:
 * - Actor deve ser admin ou superadmin
 * - Target deve ser student (não pode impersonar outro admin/superadmin)
 * - Actor não pode já estar impersonando (evita encadeamento)
 */
export function canImpersonate(
  actor: { role: Role },
  target: { role: Role },
  actorIsAlreadyImpersonating: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (actorIsAlreadyImpersonating) {
    return {
      ok: false,
      reason: 'Você já está visualizando como outro usuário. Saia dessa sessão antes de iniciar outra.',
    };
  }
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    return {
      ok: false,
      reason: 'Apenas admins e superadmins podem visualizar como outro usuário.',
    };
  }
  if (target.role !== 'student') {
    return {
      ok: false,
      reason: 'Só é permitido visualizar como aluno (student). Não é possível visualizar como outro admin.',
    };
  }
  return { ok: true };
}

/**
 * Gera token de impersonation. Assume que canImpersonate já foi validado.
 */
export async function startImpersonation(
  actor: SystemUserPublic,
  targetId: string,
): Promise<ImpersonationResult | null> {
  const target = await findUserById(targetId);
  if (!target) return null;
  if (!target.active) return null;

  const token = await signToken(
    {
      sub: target.id,
      email: target.email,
      role: target.role,
      tv: target.tokenVersion,
      act: {
        sub: actor.id,
        email: actor.email,
        role: actor.role,
      },
    },
    IMPERSONATION_TTL_SECONDS,
  );

  return {
    token,
    actor: { id: actor.id, email: actor.email, role: actor.role },
    target: {
      id: target.id,
      email: target.email,
      role: target.role,
      name: target.name,
    },
    expiresInSeconds: IMPERSONATION_TTL_SECONDS,
  };
}

/**
 * "Sai" da impersonation: gera novo token para o actor original,
 * com TTL padrão (7d).
 */
export async function exitImpersonation(payload: JwtPayload): Promise<string | null> {
  if (!payload.act) return null;
  const actor = await findUserById(payload.act.sub);
  if (!actor) return null;
  if (!actor.active) return null;
  return await signToken({
    sub: actor.id,
    email: actor.email,
    role: actor.role,
    tv: actor.tokenVersion,
  });
}

/**
 * Retorna o ID do usuário que deve ser registrado como `actorId` em audit logs.
 * Quando há impersonation, é o admin original (act.sub), não o sub.
 */
export function effectiveActorId(payload: JwtPayload): string {
  return payload.act?.sub ?? payload.sub;
}

/**
 * Retorna metadata de auditoria para uma ação feita durante impersonation.
 * Vazio se não há impersonation.
 */
export function impersonationAuditMeta(
  payload: JwtPayload,
): Record<string, unknown> | undefined {
  if (!payload.act) return undefined;
  return {
    impersonating: true,
    impersonatedUserId: payload.sub,
    impersonatedEmail: payload.email,
  };
}

/**
 * Lista de ações sensíveis BLOQUEADAS durante impersonation.
 * Admin não pode trocar senha do aluno, apagar conta, etc.
 */
export const BLOCKED_ACTIONS_DURING_IMPERSONATION = [
  'user.delete',
  'user.password.change',
  'user.email.change',
  'user.totp.disable',
  'user.totp.enable',
  'user.role.change',
  'lgpd.deletion.confirm',
  'order.refund',
  'gateway.delete',
  'apiToken.create',
] as const;

export type BlockedAction = (typeof BLOCKED_ACTIONS_DURING_IMPERSONATION)[number];

export function isActionBlockedDuringImpersonation(action: string): boolean {
  return (BLOCKED_ACTIONS_DURING_IMPERSONATION as readonly string[]).includes(action);
}
