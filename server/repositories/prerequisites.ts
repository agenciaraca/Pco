// Course prerequisites: um curso pode exigir que outros estejam completos
// antes do aluno se matricular.
//
// Phase 1: hard-block na matrícula. Frontend mostra warning antes do enroll.
// Phase 2 (futuro): override admin pra permitir bypass; relatórios de
// "aluno bateu no muro de pré-requisito".

export interface PrereqCheck {
  ok: boolean;
  missing: string[]; // courseIds não-completos
  /** Para cada prereq, se está completo ou não — útil pra UI. */
  status: { courseId: string; completed: boolean }[];
}

/**
 * Verifica se o aluno completou todos os pré-requisitos do curso.
 * @param prerequisiteCourseIds Lista de courseIds requeridos
 * @param completedCourseIds Lista de courseIds que o aluno terminou (100%)
 */
export function checkPrerequisites(
  prerequisiteCourseIds: string[] | undefined,
  completedCourseIds: string[],
): PrereqCheck {
  const required = prerequisiteCourseIds ?? [];
  if (required.length === 0) {
    return { ok: true, missing: [], status: [] };
  }
  const done = new Set(completedCourseIds);
  const status = required.map((id) => ({ courseId: id, completed: done.has(id) }));
  const missing = status.filter((s) => !s.completed).map((s) => s.courseId);
  return { ok: missing.length === 0, missing, status };
}

/**
 * Helper: dado um array de cursos do sistema + progress do aluno, retorna
 * a lista de courseIds completos (100% das aulas). Usado pra alimentar
 * checkPrerequisites.
 */
export function computeCompletedCourseIds(
  courses: { id: string; modules: { lessons: { id: string }[] }[] }[],
  completedLessonIds: string[],
): string[] {
  const done = new Set(completedLessonIds);
  const out: string[] = [];
  for (const c of courses) {
    const total = c.modules.reduce((s, m) => s + m.lessons.length, 0);
    if (total === 0) continue;
    const completed = c.modules.reduce(
      (s, m) => s + m.lessons.filter((l) => done.has(l.id)).length,
      0,
    );
    if (completed === total) out.push(c.id);
  }
  return out;
}
