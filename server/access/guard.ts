/**
 * "Este aluno pode estudar este curso agora?" — uma pergunta, uma resposta.
 *
 * Antes de 17/ago/2026 cada rota respondia sozinha, sempre da mesma forma:
 * `enrolledCourseIds.includes(courseId)`. Com prazo de acesso isso deixou de
 * bastar, e espalhar a nova regra por cada rota é como o portão público de
 * curso se perdeu antes (ver `isPubliclyListed`). Então: passa por aqui.
 */

import * as studentsRepo from '../repositories/students';
import * as coursesRepo from '../repositories/courses';
import { accessFor, type AccessInfo } from './course-access';

export interface CourseAccessResult {
  /** A matrícula existe? Expirar não desmatricula, então isto segue true. */
  enrolled: boolean;
  /** Prazo e estado. null quando não há matrícula. */
  access: AccessInfo | null;
  /** A pergunta que interessa à rota. */
  canStudy: boolean;
  /** Motivo da negativa, pronto para virar código de erro na API. */
  reason: 'ok' | 'not_enrolled' | 'access_expired' | 'enrollment_suspended' | 'enrollment_canceled';
}

const ALLOWED: CourseAccessResult['reason'] = 'ok';

/**
 * Resolve o acesso de um usuário a um curso.
 *
 * Admin não é tratado aqui de propósito: quem decide se admin escapa é a rota,
 * porque em algumas (comentar como aluno, contar matrícula) escapar seria errado.
 */
export async function courseAccessFor(
  userId: string,
  courseId: string,
  now: Date = new Date(),
): Promise<CourseAccessResult> {
  const [student, course] = await Promise.all([
    studentsRepo.findAdminStudent(userId),
    coursesRepo.findCourse(courseId),
  ]);

  const enrolled = (student?.enrolledCourseIds ?? []).includes(courseId);
  if (!enrolled) {
    return { enrolled: false, access: null, canStudy: false, reason: 'not_enrolled' };
  }

  // Situação da matrícula vem ANTES do prazo, e por um motivo prático: quem
  // teve o pedido estornado não deve ler "seu acesso expirou" — a mensagem
  // manda renovar, e renovar não é o que resolve o caso dele.
  const situacao = student?.enrollmentStatusByCourse?.[courseId];
  if (situacao === 'suspensa' || situacao === 'cancelada') {
    return {
      enrolled: true,
      access: null,
      canStudy: false,
      reason: situacao === 'suspensa' ? 'enrollment_suspended' : 'enrollment_canceled',
    };
  }

  const access = accessFor(
    {
      enrolledAt: student?.enrollmentDates?.[courseId] ?? student?.createdAt ?? null,
      storedExpiresAt: student?.accessExpiresByCourse?.[courseId] ?? null,
      accessMonths: (course as unknown as { accessMonths?: number | null } | null)?.accessMonths,
    },
    now,
  );

  return {
    enrolled: true,
    access,
    canStudy: access.canStudy,
    reason: access.canStudy ? ALLOWED : 'access_expired',
  };
}

/**
 * Mensagem para o aluno. Fala do que ele pode fazer, não do estado interno.
 */
export function accessDeniedMessage(result: CourseAccessResult): string {
  if (result.reason === 'enrollment_suspended') {
    return 'Seu acesso está suspenso porque há um pagamento pendente deste curso. Assim que ele for confirmado, o acesso volta sozinho.';
  }
  if (result.reason === 'enrollment_canceled') {
    return 'A matrícula neste curso foi cancelada. Se isso não confere, fale com a coordenação.';
  }
  if (result.reason === 'not_enrolled') {
    return 'Você não está matriculado neste curso.';
  }
  const até = result.access?.expiresAt
    ? new Date(result.access.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : null;
  return até
    ? `Seu acesso a este curso terminou em ${até}. Renove para continuar estudando — seu progresso está guardado.`
    : 'Seu acesso a este curso terminou. Renove para continuar estudando — seu progresso está guardado.';
}

/** Código de erro da API, para o frontend distinguir os dois casos. */
export function accessDeniedCode(result: CourseAccessResult): 'NOT_ENROLLED' | 'ACCESS_EXPIRED' {
  return result.reason === 'not_enrolled' ? 'NOT_ENROLLED' : 'ACCESS_EXPIRED';
}
