// Calcula start_date e expiration_date de uma matrícula seguindo regras configuráveis.

import type {
  EnrollmentStartRule,
  EnrollmentExpirationRule,
  NormalizedOrder,
  NormalizedEnrollment,
  NormalizedCourse,
} from '../types';

export interface EnrollmentRulesContext {
  startRule: EnrollmentStartRule;
  expirationRule: EnrollmentExpirationRule;
  defaultAccessDurationDays?: number;
  /** Curso vinculado (já normalizado). Usado para fallback de duração / data fixa. */
  course?: NormalizedCourse;
  /** Pedido relacionado (se for o caso). */
  order?: NormalizedOrder;
  /** Matrícula entrante (CSV/API) com possíveis datas explícitas. */
  enrollment: NormalizedEnrollment;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function resolveStartDate(ctx: EnrollmentRulesContext): string {
  const { startRule, order, enrollment } = ctx;
  switch (startRule) {
    case 'paid_date':
      return order?.paidDate ?? order?.completedDate ?? order?.orderDate ?? new Date().toISOString();
    case 'completed_date':
      return order?.completedDate ?? order?.paidDate ?? order?.orderDate ?? new Date().toISOString();
    case 'order_date':
      return order?.orderDate ?? new Date().toISOString();
    case 'imported':
      return enrollment.enrollmentStartDate ?? new Date().toISOString();
    case 'now':
    default:
      return new Date().toISOString();
  }
}

export function resolveExpirationDate(
  ctx: EnrollmentRulesContext,
  startDate: string,
): string | null {
  const { expirationRule, course, order, enrollment, defaultAccessDurationDays } = ctx;

  // Duração efetiva: explicit > course > default
  const duration =
    enrollment.accessDurationDays ??
    course?.accessDurationDays ??
    defaultAccessDurationDays ??
    null;

  switch (expirationRule) {
    case 'lifetime':
      return null;
    case 'course_fixed_end':
      return course?.accessExpiresAt ?? null;
    case 'explicit':
      return enrollment.enrollmentExpirationDate ?? null;
    case 'start_plus_duration':
      return duration !== null && duration !== undefined
        ? addDays(startDate, duration)
        : null;
    case 'order_plus_duration':
      return duration !== null && duration !== undefined && order?.orderDate
        ? addDays(order.orderDate, duration)
        : null;
    case 'paid_plus_duration':
      return duration !== null && duration !== undefined && (order?.paidDate ?? order?.completedDate)
        ? addDays(order.paidDate ?? order.completedDate!, duration)
        : null;
    case 'completed_plus_duration':
      return duration !== null && duration !== undefined && order?.completedDate
        ? addDays(order.completedDate, duration)
        : null;
    default:
      return null;
  }
}

export function resolveEnrollmentDates(ctx: EnrollmentRulesContext): {
  startDate: string;
  expirationDate: string | null;
} {
  const startDate = resolveStartDate(ctx);
  const expirationDate = resolveExpirationDate(ctx, startDate);
  return { startDate, expirationDate };
}
