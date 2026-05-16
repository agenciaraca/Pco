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
  // WP REST retorna title/excerpt/content como { rendered: '...' }
  if (typeof v === 'object' && v !== null) {
    const r = (v as { rendered?: unknown }).rendered;
    if (typeof r === 'string') {
      const t = r.trim();
      return t === '' ? undefined : t;
    }
    return undefined;
  }
  const t = String(v).trim();
  return t === '' ? undefined : t;
}

/** Tenta multiplos aliases de keys ate achar um valor preenchido. */
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Mapeia status de WP/LD/WC pra status interno do AVA (PT). */
function mapStudentStatus(raw: string | undefined): NormalizedStudent['status'] {
  if (!raw) return 'ativo';
  const lc = raw.toLowerCase();
  if (['active', 'ativo', 'enabled', 'true', '1'].includes(lc)) return 'ativo';
  if (['inactive', 'inativo', 'disabled', 'false', '0'].includes(lc)) return 'inativo';
  if (['blocked', 'bloqueado', 'banned'].includes(lc)) return 'bloqueado';
  if (['at_risk', 'em_risco', 'risk'].includes(lc)) return 'em_risco';
  // Fallback: trata desconhecido como ativo (evita 1771 invalidos por status)
  return 'ativo';
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
  if (v === null || v === undefined || v === '') return undefined;
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
    externalUserId: s(pick(row, ['external_user_id', 'wp_user_id', 'id'])) ?? null,
    wpUserId: s(pick(row, ['wp_user_id', 'id'])) ?? null,
    // WP REST: 'email' (context=edit). CSV legacy: 'user_email'
    email: (s(pick(row, ['user_email', 'email'])) ?? '').toLowerCase(),
    firstName: s(pick(row, ['first_name', 'firstName'])),
    lastName: s(pick(row, ['last_name', 'lastName'])),
    displayName: s(
      pick(row, ['display_name', 'name', 'displayName', 'user_login', 'username']),
    ),
    phone: applyTransforms(s(pick(row, ['phone', 'telefone'])), ['normalize_phone']) as
      | string
      | undefined,
    document: applyTransforms(s(pick(row, ['document', 'cpf', 'documento'])), [
      'normalize_document',
    ]) as string | undefined,
    status: mapStudentStatus(s(pick(row, ['status', 'wp_status']))),
  };
}

export function normalizeCourse(row: Record<string, unknown>): NormalizedCourse {
  return {
    externalCourseId: s(pick(row, ['external_course_id', 'learndash_course_id', 'id'])) ?? null,
    learndashCourseId: s(pick(row, ['learndash_course_id', 'id'])) ?? null,
    slug: s(pick(row, ['course_slug', 'slug'])),
    title: s(pick(row, ['course_title', 'title', 'name'])) ?? '',
    description: applyTransforms(
      s(pick(row, ['course_description', 'description', 'content_html', 'content', 'excerpt'])),
      ['sanitize_html'],
    ) as string | undefined,
    status: (s(pick(row, ['course_status', 'wp_status', 'status'])) ?? 'publish') as
      NormalizedCourse['status'],
    accessDurationDays:
      int(pick(row, ['course_access_expires_after_days', 'course_duration_days', 'access_duration_days'])) ??
      null,
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
    externalLessonId: s(pick(row, ['external_lesson_id', 'learndash_lesson_id', 'id'])) ?? null,
    learndashLessonId: s(pick(row, ['learndash_lesson_id', 'id'])) ?? null,
    courseExternalId: s(pick(row, ['course_external_id', 'course'])) ?? null,
    moduleExternalId: s(pick(row, ['module_external_id', 'parent', 'section'])) ?? null,
    title: s(pick(row, ['lesson_title', 'title', 'name'])) ?? '',
    description: applyTransforms(
      s(pick(row, ['lesson_content', 'content_html', 'content', 'description', 'excerpt'])),
      ['sanitize_html'],
    ) as string | undefined,
    videoUrl: applyTransforms(s(pick(row, ['lesson_video_url', 'video_url'])), [
      'extract_video_url',
    ]) as string | undefined,
    durationMinutes: int(pick(row, ['lesson_duration_minutes', 'duration_minutes'])),
    order: int(pick(row, ['lesson_order', 'order', 'menu_order'])) ?? 0,
    isMandatory: bool(pick(row, ['is_mandatory', 'mandatory'])) ?? true,
    releaseType: (s(pick(row, ['release_type', 'release'])) ?? 'open') as
      NormalizedLesson['releaseType'],
    dripDays: int(pick(row, ['drip_days', 'visible_after_days'])),
    status: (s(pick(row, ['status', 'wp_status'])) ?? 'publish') as NormalizedLesson['status'],
  };
}

export function normalizeProduct(row: Record<string, unknown>): NormalizedProduct {
  return {
    externalProductId: s(pick(row, ['external_product_id', 'wc_product_id', 'id'])) ?? null,
    wcProductId: s(pick(row, ['wc_product_id', 'id'])) ?? null,
    sku: s(pick(row, ['sku'])),
    name: s(pick(row, ['product_name', 'name', 'title'])) ?? '',
    type: (s(pick(row, ['product_type', 'type'])) ?? 'simple') as NormalizedProduct['type'],
    regularPriceCents: money(pick(row, ['regular_price', 'price'])),
    salePriceCents: pick(row, ['sale_price']) ? money(pick(row, ['sale_price'])) : null,
    currency: (s(pick(row, ['currency'])) ?? 'BRL').toUpperCase(),
    status: (s(pick(row, ['status', 'wp_status'])) ?? 'publish') as NormalizedProduct['status'],
    linkedCourseExternalId:
      s(pick(row, ['linked_course_external_id', 'related_course_id'])) ?? null,
    linkedLearndashCourseId:
      s(pick(row, ['linked_learndash_course_id', 'learndash_course_id'])) ?? null,
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
    userDocument: s(row.user_document) ?? s(row.user_cpf) ?? s(row.cpf) ?? null,
    userWpId: s(row.wp_user_id) ?? null,
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
  // lastAccessAt: connectors podem expor explícito ('last_access_at') OU
  // só ter started_at/completed_at. Usamos o max disponível como proxy
  // — sem esse fallback, alunos importados ficam todos com "último acesso
  // = hoje" porque students.ts:enrollInCourse seta lastAccessAt: new Date()
  // quando recebe `undefined`.
  const explicit = date(row.last_access_at);
  const completed = date(row.completed_at);
  const started = date(row.started_at);
  const lastAccessAt =
    [explicit, completed, started].filter((v): v is string => !!v).sort().pop() ??
    null;
  return {
    userExternalId: s(row.user_external_id) ?? null,
    userEmail: (s(row.user_email) ?? '').toLowerCase() || null,
    courseExternalId: s(row.course_external_id) ?? null,
    lessonExternalId: s(row.lesson_external_id) ?? null,
    topicExternalId: s(row.topic_external_id) ?? null,
    completedAt: date(row.completed_at),
    progressPercentage: int(row.progress_percentage),
    status: (s(row.status) ?? 'in_progress') as NormalizedProgress['status'],
    lastAccessAt,
  };
}
