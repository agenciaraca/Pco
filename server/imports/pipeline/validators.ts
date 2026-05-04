// Validações por entidade — retornam lista de erros amigáveis.

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

export interface ValidationError {
  field?: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function isFiniteInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

export function validateStudent(s: NormalizedStudent): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!s.email || !EMAIL_RE.test(s.email)) {
    errs.push({ field: 'email', message: 'E-mail inválido ou ausente.' });
  }
  if (s.status && !['ativo', 'em_risco', 'bloqueado', 'inativo'].includes(s.status)) {
    errs.push({ field: 'status', message: `Status desconhecido: ${s.status}` });
  }
  return errs;
}

export function validateCourse(c: NormalizedCourse): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!c.title || c.title.trim().length < 2) {
    errs.push({ field: 'title', message: 'Título obrigatório.' });
  }
  if (
    c.accessDurationDays !== undefined &&
    c.accessDurationDays !== null &&
    (!isFiniteInt(c.accessDurationDays) || c.accessDurationDays < 0)
  ) {
    errs.push({
      field: 'accessDurationDays',
      message: 'Duração precisa ser inteiro >= 0 (null = vitalício).',
    });
  }
  return errs;
}

export function validateModule(m: NormalizedModule): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!m.title || m.title.trim().length < 2) {
    errs.push({ field: 'title', message: 'Título obrigatório.' });
  }
  if (!isFiniteInt(m.order) || m.order < 0) {
    errs.push({ field: 'order', message: 'Ordem precisa ser inteiro >= 0.' });
  }
  if (!m.courseExternalId && !m.courseLearndashId) {
    errs.push({
      message: 'Vínculo com curso ausente (course_external_id ou course_learndash_id).',
    });
  }
  return errs;
}

export function validateLesson(l: NormalizedLesson): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!l.title || l.title.trim().length < 2) {
    errs.push({ field: 'title', message: 'Título obrigatório.' });
  }
  if (!isFiniteInt(l.order) || l.order < 0) {
    errs.push({ field: 'order', message: 'Ordem precisa ser inteiro >= 0.' });
  }
  return errs;
}

export function validateProduct(p: NormalizedProduct): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!p.name || p.name.trim().length < 2) {
    errs.push({ field: 'name', message: 'Nome obrigatório.' });
  }
  if (!isFiniteInt(p.regularPriceCents) || p.regularPriceCents < 0) {
    errs.push({
      field: 'regularPriceCents',
      message: 'Preço inválido (em centavos, inteiro >= 0).',
    });
  }
  if (!p.currency || p.currency.length !== 3) {
    errs.push({ field: 'currency', message: 'Moeda inválida (ISO 3 letras).' });
  }
  return errs;
}

export function validateOrder(o: NormalizedOrder): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!o.customerEmail || !EMAIL_RE.test(o.customerEmail)) {
    errs.push({ field: 'customerEmail', message: 'E-mail do cliente inválido.' });
  }
  if (!o.orderDate || !ISO_DATE_RE.test(o.orderDate)) {
    errs.push({ field: 'orderDate', message: 'Data do pedido inválida.' });
  }
  if (
    !o.status ||
    ![
      'pending',
      'processing',
      'on-hold',
      'completed',
      'cancelled',
      'refunded',
      'failed',
    ].includes(o.status)
  ) {
    errs.push({ field: 'status', message: `Status WC inválido: ${o.status}` });
  }
  if (!isFiniteInt(o.totalCents) || o.totalCents < 0) {
    errs.push({ field: 'totalCents', message: 'Total inválido (em centavos, inteiro >= 0).' });
  }
  return errs;
}

export function validateEnrollment(e: NormalizedEnrollment): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!e.userEmail && !e.userExternalId) {
    errs.push({
      message: 'É necessário userEmail ou userExternalId para identificar o aluno.',
    });
  }
  if (!e.courseExternalId && !e.learndashCourseId) {
    errs.push({
      message: 'Vínculo com curso ausente (courseExternalId ou learndashCourseId).',
    });
  }
  if (
    !e.status ||
    !['active', 'pending', 'expired', 'cancelled', 'completed'].includes(e.status)
  ) {
    errs.push({ field: 'status', message: `Status inválido: ${e.status}` });
  }
  return errs;
}

export function validateProgress(p: NormalizedProgress): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!p.userEmail && !p.userExternalId) {
    errs.push({ message: 'userEmail ou userExternalId obrigatório.' });
  }
  return errs;
}
