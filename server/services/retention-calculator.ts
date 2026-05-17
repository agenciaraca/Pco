/**
 * Calcula o risco de evasão de cada aluno baseado em dados reais.
 *
 * Score 0-100 (maior = mais risco). Componentes:
 *  - Inatividade (peso 40): dias desde lastAccessAt
 *  - Progresso estagnado vs esperado (peso 30): progresso real menor que o
 *    esperado pelo tempo de matrícula
 *  - Cursos travados (peso 20): cursos com progresso muito baixo após semanas
 *    de matrícula
 *  - Sem matrículas ou conta nova abandonada (peso 10)
 *
 * Level mapping:
 *  - 0-30: baixo
 *  - 31-55: medio
 *  - 56-75: alto
 *  - 76-100: critico
 *
 * Atualiza:
 *  - admin-students: riskScore + status (em_risco se score >= 56, ativo caso
 *    contrário, sem mexer em bloqueado/inativo)
 *  - retention-risks: snapshot completo com reasons + recommendedAction
 */

import { JsonStore } from '../db/json-store';
import type { AdminStudentRow } from '../../src/app/data/seed';
import type { RetentionRisk } from '../../src/app/types/schema';

const adminStudentsStore = new JsonStore<AdminStudentRow>(
  'admin-students.json',
  () => [],
);
const retentionRisksStore = new JsonStore<RetentionRisk>(
  'retention-risks.json',
  () => [],
);

const DAY_MS = 86_400_000;
const HOURS_PER_DAY_DEFAULT = 1; // ritmo esperado por aluno (1h por dia)

export interface RetentionCalcOptions {
  /** Ritmo esperado em horas/dia. Default 1h/dia. */
  hoursPerDay?: number;
  /**
   * Função opcional que retorna a carga horária estimada de um curso por id.
   * Default: 30h se desconhecida.
   */
  courseHours?: (courseId: string) => number;
  /** Override do "agora" para testes. */
  now?: Date;
}

export interface RetentionCalcResult {
  score: number;
  level: RetentionRisk['level'];
  reasons: string[];
  expectedProgress: number; // 0-100 média esperada entre cursos matriculados
  realProgress: number; // 0-100 média real
  pendingAssessments: number;
  recommendedAction: string;
}

export function computeStudentRisk(
  student: AdminStudentRow,
  opts: RetentionCalcOptions = {},
): RetentionCalcResult {
  const now = opts.now ?? new Date();
  const hoursPerDay = opts.hoursPerDay ?? HOURS_PER_DAY_DEFAULT;
  const reasons: string[] = [];

  // --- 1. Inatividade (0-40 pts) ---
  const lastAccess = student.lastAccessAt
    ? new Date(student.lastAccessAt)
    : null;
  const daysSinceAccess = lastAccess
    ? Math.max(0, Math.floor((now.getTime() - lastAccess.getTime()) / DAY_MS))
    : 9999;
  let inactivityScore = 0;
  if (daysSinceAccess > 90) {
    inactivityScore = 40;
    reasons.push(`Sem acesso há ${daysSinceAccess} dias`);
  } else if (daysSinceAccess > 60) {
    inactivityScore = 35;
    reasons.push(`Sem acesso há ${daysSinceAccess} dias`);
  } else if (daysSinceAccess > 30) {
    inactivityScore = 25;
    reasons.push(`Sem acesso há ${daysSinceAccess} dias`);
  } else if (daysSinceAccess > 14) {
    inactivityScore = 15;
    reasons.push(`Sem acesso há ${daysSinceAccess} dias`);
  } else if (daysSinceAccess > 7) {
    inactivityScore = 8;
  }

  // --- 2. Progresso estagnado vs esperado (0-30 pts) ---
  const enrolled = student.enrolledCourseIds ?? [];
  let totalExpected = 0;
  let totalReal = 0;
  let stagnantCourses = 0;
  for (const courseId of enrolled) {
    const enrollDate =
      student.enrollmentDates?.[courseId] ?? student.createdAt;
    const enrollAt = enrollDate ? new Date(enrollDate) : null;
    if (!enrollAt) continue;
    const daysEnrolled = Math.max(
      0,
      Math.floor((now.getTime() - enrollAt.getTime()) / DAY_MS),
    );
    const courseHours = opts.courseHours ? opts.courseHours(courseId) : 30;
    const daysToFinish = Math.max(1, Math.ceil(courseHours / hoursPerDay));
    const expected = Math.min(100, (daysEnrolled / daysToFinish) * 100);
    const real = student.progressByCourse?.[courseId] ?? 0;
    totalExpected += expected;
    totalReal += real;
    if (daysEnrolled > 30 && real < expected - 25) {
      stagnantCourses += 1;
    }
  }
  const avgExpected = enrolled.length > 0 ? totalExpected / enrolled.length : 0;
  const avgReal = enrolled.length > 0 ? totalReal / enrolled.length : 0;
  const gap = Math.max(0, avgExpected - avgReal);
  // gap 0-100 → 0-30 pts (clamp)
  const stagnationScore = Math.min(30, Math.round((gap / 100) * 30));
  if (stagnationScore >= 15) {
    reasons.push(
      `Progresso ${Math.round(avgReal)}% (esperado ${Math.round(avgExpected)}%)`,
    );
  }

  // --- 3. Cursos travados (0-20 pts) ---
  // Cada curso "estagnado" soma 7 pts (max 20)
  const stuckScore = Math.min(20, stagnantCourses * 7);
  if (stagnantCourses > 0) {
    reasons.push(
      `${stagnantCourses} curso${stagnantCourses === 1 ? '' : 's'} parado${stagnantCourses === 1 ? '' : 's'}`,
    );
  }

  // --- 4. Conta nova sem engajamento ou sem matrículas (0-10 pts) ---
  let onboardingScore = 0;
  if (enrolled.length === 0) {
    onboardingScore = 10;
    reasons.push('Sem cursos matriculados');
  } else {
    const createdAt = student.createdAt ? new Date(student.createdAt) : null;
    if (createdAt) {
      const daysSinceCreated = Math.floor(
        (now.getTime() - createdAt.getTime()) / DAY_MS,
      );
      if (daysSinceCreated > 14 && avgReal < 5) {
        onboardingScore = 10;
        reasons.push('Sem progresso desde a matrícula');
      } else if (daysSinceCreated > 7 && avgReal < 1) {
        onboardingScore = 6;
      }
    }
  }

  let score = inactivityScore + stagnationScore + stuckScore + onboardingScore;
  score = Math.min(100, Math.max(0, score));

  let level: RetentionRisk['level'];
  if (score >= 76) level = 'critico';
  else if (score >= 56) level = 'alto';
  else if (score >= 31) level = 'medio';
  else level = 'baixo';

  let recommendedAction: string;
  if (level === 'critico') {
    recommendedAction =
      'Contato imediato (telefone/WhatsApp) + plano de retomada IA personalizado.';
  } else if (level === 'alto') {
    recommendedAction =
      'E-mail de reengajamento + lembrete da meta semanal. Avaliar contato direto se persistir.';
  } else if (level === 'medio') {
    recommendedAction =
      'Notificação in-app destacando próxima aula. Acompanhar nos próximos 7 dias.';
  } else {
    recommendedAction = 'Monitorar engajamento. Continuar acompanhamento padrão.';
  }

  return {
    score,
    level,
    reasons: reasons.length > 0 ? reasons : ['Engajamento dentro do esperado'],
    expectedProgress: Math.round(avgExpected),
    realProgress: Math.round(avgReal),
    pendingAssessments: 0, // placeholder: integraria com assessments-store em sprint futura
    recommendedAction,
  };
}

export interface RetentionRecomputeSummary {
  total: number;
  byLevel: Record<RetentionRisk['level'], number>;
  updated: number;
  durationMs: number;
}

export async function recomputeAllRisks(
  opts: RetentionCalcOptions = {},
): Promise<RetentionRecomputeSummary> {
  const t0 = Date.now();
  const students = await adminStudentsStore.getAll();
  const now = opts.now ?? new Date();
  const risks: RetentionRisk[] = [];
  const summary: RetentionRecomputeSummary = {
    total: students.length,
    byLevel: { baixo: 0, medio: 0, alto: 0, critico: 0 },
    updated: 0,
    durationMs: 0,
  };

  await adminStudentsStore.modify((rows) => {
    for (const s of rows) {
      const result = computeStudentRisk(s, { ...opts, now });
      summary.byLevel[result.level] += 1;
      // Atualiza riskScore + status (sem mexer em bloqueado/inativo)
      if (s.status !== 'bloqueado' && s.status !== 'inativo') {
        const newStatus: AdminStudentRow['status'] =
          result.score >= 56 ? 'em_risco' : 'ativo';
        if (s.riskScore !== result.score || s.status !== newStatus) {
          summary.updated += 1;
        }
        s.riskScore = result.score;
        s.status = newStatus;
      } else {
        if (s.riskScore !== result.score) summary.updated += 1;
        s.riskScore = result.score;
      }

      risks.push({
        studentId: s.id,
        studentName: s.name,
        score: result.score,
        level: result.level,
        reasons: result.reasons,
        lastAccessAt: s.lastAccessAt,
        expectedProgress: result.expectedProgress,
        realProgress: result.realProgress,
        pendingAssessments: result.pendingAssessments,
        tutorUsage: 0,
        podConsumption: 0,
        libraryInteractions: 0,
        recommendedAction: result.recommendedAction,
      });
    }
    return null;
  });

  // Substitui retention-risks por inteiro (snapshot do recompute)
  await retentionRisksStore.setAll(risks);

  summary.durationMs = Date.now() - t0;
  return summary;
}
