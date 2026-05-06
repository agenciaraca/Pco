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

export function computeModuleLock(
  module: { releaseAt?: string | Date | null },
  nowMs: number = Date.now(),
): ModuleLockInfo {
  if (!module.releaseAt) return NEVER;
  const releaseMs =
    typeof module.releaseAt === 'string'
      ? new Date(module.releaseAt).getTime()
      : module.releaseAt.getTime();
  if (!Number.isFinite(releaseMs)) return NEVER;
  if (releaseMs <= nowMs) return NEVER;
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
  course: { modules: { id: string; releaseAt?: string | Date | null; lessons: { id: string }[] }[] },
  lessonId: string,
  nowMs: number = Date.now(),
): { moduleId: string; lock: ModuleLockInfo } | null {
  for (const m of course.modules) {
    if (m.lessons.some((l) => l.id === lessonId)) {
      return { moduleId: m.id, lock: computeModuleLock(m, nowMs) };
    }
  }
  return null;
}
