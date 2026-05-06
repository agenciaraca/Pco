// Drip content (phase 1): controla liberação de módulos por data fixa
// (releaseAt). Módulos sem releaseAt são sempre acessíveis. Módulos com
// releaseAt no futuro são "locked".
//
// Usage:
//   const lock = computeModuleLock(module);
//   if (lock.locked) return jsonError(c, 423, 'LOCKED', `Aula liberada em ${lock.lockedUntil}`);
//
// Phase 2 (futuro): drip relativo ("N dias após matrícula").

export interface ModuleLockInfo {
  locked: boolean;
  /** ISO 8601 — quando o módulo será liberado. Null se sem release. */
  lockedUntil: string | null;
  /** Segundos até a liberação (>= 0). 0 se já liberado ou sem release. */
  secondsUntilUnlock: number;
}

const NEVER: ModuleLockInfo = {
  locked: false,
  lockedUntil: null,
  secondsUntilUnlock: 0,
};

export interface ModuleLockContext {
  /** ISO date em que o aluno se matriculou no curso. Se omitido, drip
   *  relativo é ignorado (visitante público ou aluno não matriculado). */
  enrolledAt?: string | Date | null;
}

export function computeModuleLock(
  module: {
    releaseAt?: string | Date | null;
    releaseAfterEnrollmentDays?: number | null;
  },
  nowMs: number = Date.now(),
  ctx: ModuleLockContext = {},
): ModuleLockInfo {
  // Calcula o instante mais tardio de release (absoluto + relativo).
  // Se ambos definidos, o módulo só libera quando os DOIS já passaram.
  let releaseMs: number | null = null;

  if (module.releaseAt) {
    const ms =
      typeof module.releaseAt === 'string'
        ? new Date(module.releaseAt).getTime()
        : module.releaseAt.getTime();
    if (Number.isFinite(ms)) releaseMs = ms;
  }

  if (
    typeof module.releaseAfterEnrollmentDays === 'number' &&
    module.releaseAfterEnrollmentDays > 0 &&
    ctx.enrolledAt
  ) {
    const enrolledMs =
      typeof ctx.enrolledAt === 'string'
        ? new Date(ctx.enrolledAt).getTime()
        : ctx.enrolledAt.getTime();
    if (Number.isFinite(enrolledMs)) {
      const relMs =
        enrolledMs + module.releaseAfterEnrollmentDays * 24 * 60 * 60 * 1000;
      releaseMs = releaseMs !== null ? Math.max(releaseMs, relMs) : relMs;
    }
  }

  if (releaseMs === null || releaseMs <= nowMs) return NEVER;
  return {
    locked: true,
    lockedUntil: new Date(releaseMs).toISOString(),
    secondsUntilUnlock: Math.ceil((releaseMs - nowMs) / 1000),
  };
}

/**
 * Encontra o módulo que contém uma lesson e retorna sua lock info.
 * Atalho usado em rotas de "completar aula" pra bloquear aulas em módulos
 * ainda não liberados.
 */
export function findModuleLockForLesson(
  course: {
    modules: {
      id: string;
      releaseAt?: string | Date | null;
      releaseAfterEnrollmentDays?: number | null;
      lessons: { id: string }[];
    }[];
  },
  lessonId: string,
  nowMs: number = Date.now(),
  ctx: ModuleLockContext = {},
): { moduleId: string; lock: ModuleLockInfo } | null {
  for (const m of course.modules) {
    if (m.lessons.some((l) => l.id === lessonId)) {
      return { moduleId: m.id, lock: computeModuleLock(m, nowMs, ctx) };
    }
  }
  return null;
}
