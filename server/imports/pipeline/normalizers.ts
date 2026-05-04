// Converte rows CSV (depois de mapping) em entidades normalizadas tipadas.
// Aplica transforms sensatos por campo quando o mapping default não cobre.

import type {
  NormalizedStudent,
  NormalizedCourse,
  NormalizedModule,
  NormalizedLesson,
  NormalizedProduct,
  NormalizedOrder,
  NormalizedEnrollment,
  NormalizedProgress,
} from '../types';
import { applyTransforms } from './transforms';

function s(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === '' ? undefined : t;
}
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function int(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined ? Math.trunc(n) : undefined;
}
function bool(v: unknown): boolean | undefined {
  return applyTransforms(v, ['parse_boolean']) as boolean;
}
function date(v: unknown): string | undefined {
  return (applyTransforms(v, ['parse_date']) as string | null) ?? undefined;
}
function money(v: unknown): number {
  return (applyTransforms(v, ['parse_money']) as number) ?? 0;
}

export function normalizeStudent(row: Record<string, unknown>): NormalizedStudent {
  return {
    externalUserId: s(row.external_user_id) ?? null,
    wpUserId: s(row.wp_user_id) ?? null,
    email: (s(row.user_email) ?? '').toLowerCase(),
    firstName: s(row.first_name),
    lastName: s(row.last_name),
    displayName: s(row.display_name) ?? s(row.user_login),
    phone: applyTransforms(s(row.phone), ['normalize_phone']) as string | undefined,
    document: applyTransforms(s(row.document), ['normalize_document']) as
      | string
      | undefined,
    status: (s(row.status) ?? 'ativo') as NormalizedStudent['status'],
  };
}

export function normalizeCourse(row: Record<string, unknown>): NormalizedCourse {
  return {
    externalCourseId: s(row.external_course_id) ?? null,
    learndashCourseId: s(row.learndash_course_id) ?? null,
    slug: s(row.course_slug),
    title: s(row.course_title) ?? '',
    description: applyTransforms(s(row.course_description), ['sanitize_html']) as
      | string
      | undefined,
    status: (s(row.course_status) ?? 'publish') as NormalizedCourse['status'],
    accessDurationDays:
      int(row.course_access_expires_after_days) ?? int(row.course_duration_days) ?? null,
  };
}

export function normalizeModule(row: Record<string, unknown>): NormalizedModule {
  return {
    externalModuleId: s(row.external_module_id) ?? null,
    learndashSectionId: s(row.learndash_section_id) ?? null,
    courseExternalId: s(row.course_external_id) ?? null,
    courseLearndashId: s(row.course_learndash_id) ?? null,
    title: s(row.module_title) ?? '',
    description: s(row.description),
    order: int(row.module_order) ?? 0,
    status: (s(row.status) ?? 'publish') as NormalizedModule['status'],
  };
}

export function normalizeLesson(row: Record<string, unknown>): NormalizedLesson {
  return {
    externalLessonId: s(row.external_lesson_id) ?? null,
    learndashLessonId: s(row.learndash_lesson_id) ?? null,
    courseExternalId: s(row.course_external_id) ?? null,
    moduleExternalId: s(row.module_external_id) ?? null,
    title: s(row.lesson_title) ?? '',
    description: applyTransforms(s(row.lesson_content), ['sanitize_html']) as
      | string
      | undefined,
    videoUrl: applyTransforms(s(row.lesson_video_url), ['extract_video_url']) as
      | string
      | undefined,
    durationMinutes: int(row.lesson_duration_minutes),
    order: int(row.lesson_order) ?? 0,
    isMandatory: bool(row.is_mandatory) ?? true,
    releaseType: (s(row.release_type) ?? 'open') as NormalizedLesson['releaseType'],
    dripDays: int(row.drip_days),
    status: (s(row.status) ?? 'publish') as NormalizedLesson['status'],
  };
}

export function normalizeProduct(row: Record<string, unknown>): NormalizedProduct {
  return {
    externalProductId: s(row.external_product_id) ?? null,
    wcProductId: s(row.wc_product_id) ?? null,
    sku: s(row.sku),
    name: s(row.product_name) ?? '',
    type: (s(row.product_type) ?? 'simple') as NormalizedProduct['type'],
    regularPriceCents: money(row.regular_price),
    salePriceCents: row.sale_price ? money(row.sale_price) : null,
    currency: (s(row.currency) ?? 'BRL').toUpperCase(),
    status: (s(row.status) ?? 'publish') as NormalizedProduct['status'],
    linkedCourseExternalId: s(row.linked_course_external_id) ?? null,
    linkedLearndashCourseId: s(row.linked_learndash_course_id) ?? null,
  };
}

export function normalizeOrder(row: Record<string, unknown>): NormalizedOrder {
  const productIds = applyTransforms(s(row.product_ids), ['split_pipe']) as string[];
  const productSkus = applyTransforms(s(row.product_skus), ['split_pipe']) as string[];
  return {
    externalOrderId: s(row.external_order_id) ?? null,
    wcOrderId: s(row.wc_order_id) ?? null,
    customerExternalId: s(row.customer_external_id) ?? null,
    customerEmail: (s(row.customer_email) ?? '').toLowerCase() || null,
    orderNumber: s(row.order_number),
    status: (s(row.order_status) ?? 'pending') as NormalizedOrder['status'],
    orderDate: date(row.order_date) ?? new Date().toISOString(),
    paidDate: date(row.paid_date),
    completedDate: date(row.completed_date),
    totalCents: money(row.total),
    currency: (s(row.currency) ?? 'BRL').toUpperCase(),
    paymentMethod: s(row.payment_method),
    transactionId: s(row.transaction_id),
    productIds: productIds.length > 0 ? productIds : undefined,
    productSkus: productSkus.length > 0 ? productSkus : undefined,
    billing: {
      firstName: s(row.billing_first_name),
      lastName: s(row.billing_last_name),
      email: s(row.billing_email)?.toLowerCase(),
      phone: applyTransforms(s(row.billing_phone), ['normalize_phone']) as
        | string
        | undefined,
    },
  };
}

export function normalizeEnrollment(row: Record<string, unknown>): NormalizedEnrollment {
  return {
    externalEnrollmentId: s(row.external_enrollment_id) ?? null,
    userExternalId: s(row.user_external_id) ?? null,
    userEmail: (s(row.user_email) ?? '').toLowerCase() || null,
    courseExternalId: s(row.course_external_id) ?? null,
    learndashCourseId: s(row.learndash_course_id) ?? null,
    orderExternalId: s(row.order_external_id) ?? s(row.wc_order_id) ?? null,
    productExternalId: s(row.product_external_id) ?? s(row.wc_product_id) ?? null,
    status: (s(row.enrollment_status) ?? 'active') as NormalizedEnrollment['status'],
    enrollmentStartDate: date(row.enrollment_start_date),
    enrollmentExpirationDate: date(row.enrollment_expiration_date),
    accessDurationDays: int(row.access_duration_days),
    completedAt: date(row.completed_at),
  };
}

export function normalizeProgress(row: Record<string, unknown>): NormalizedProgress {
  return {
    userExternalId: s(row.user_external_id) ?? null,
    userEmail: (s(row.user_email) ?? '').toLowerCase() || null,
    courseExternalId: s(row.course_external_id) ?? null,
    lessonExternalId: s(row.lesson_external_id) ?? null,
    topicExternalId: s(row.topic_external_id) ?? null,
    completedAt: date(row.completed_at),
    progressPercentage: int(row.progress_percentage),
    status: (s(row.status) ?? 'in_progress') as NormalizedProgress['status'],
    lastAccessAt: date(row.last_access_at),
  };
}
