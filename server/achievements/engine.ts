// Engine de achievements — chamada após eventos relevantes (aula concluída, etc).
// Olha o estado atual do aluno e concede badges merecidos.

import * as achievements from './store';
import * as studentsRepo from '../repositories/students';
import * as coursesRepo from '../repositories/courses';
import * as progressRepo from '../repositories/progress';

export interface EvaluateResult {
  granted: achievements.AwardedBadge[];
}

/**
 * Avalia todas as condições para um aluno e concede badges aplicáveis.
 * Idempotente — chamadas repetidas não duplicam.
 */
export async function evaluate(userId: string): Promise<EvaluateResult> {
  const granted: achievements.AwardedBadge[] = [];
  const student = await studentsRepo.findAdminStudent(userId);
  if (!student) return { granted };

  const completedLessons = await progressRepo.getCompletedLessons(userId);

  // 1) first_lesson
  if (completedLessons.length >= 1) {
    const a = await achievements.grant(userId, 'first_lesson');
    if (a) granted.push(a);
  }

  // 2) first_course / three_courses — quantos cursos integralmente concluídos?
  const courses = await coursesRepo.listCourses();
  const completedSet = new Set(completedLessons);
  let coursesCompleted = 0;
  for (const c of courses) {
    const allLessons = (c.modules ?? []).flatMap((m) => m.lessons ?? []);
    if (allLessons.length === 0) continue;
    const done = allLessons.every((l) => completedSet.has(l.id));
    if (done) coursesCompleted++;
  }
  if (coursesCompleted >= 1) {
    const a = await achievements.grant(userId, 'first_course');
    if (a) granted.push(a);
  }
  if (coursesCompleted >= 3) {
    const a = await achievements.grant(userId, 'three_courses');
    if (a) granted.push(a);
  }

  // 3) streak — usa lastAccessAt + login history aproximado.
  // Aproximação simples: se lastAccessAt foi em N dias diferentes nos últimos N dias,
  // assume streak. Sem login history detalhado, esse check é melhor-esforço.
  // Por ora, só checa se progress eventos existem em N dias distintos.
  const progressDays = await progressRepo.distinctActivityDays(userId, 30);
  if (progressDays >= 7) {
    const a = await achievements.grant(userId, 'streak_7');
    if (a) granted.push(a);
  }
  if (progressDays >= 30) {
    const a = await achievements.grant(userId, 'streak_30');
    if (a) granted.push(a);
  }

  return { granted };
}
