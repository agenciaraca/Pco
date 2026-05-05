// Adapters — bridge entre entidades normalizadas e os repositórios oficiais do AVA.
// Centraliza decisões de "criar vs atualizar" e leva em conta external_references.

import * as usersStore from '../auth/users-store';
import * as studentsRepo from '../repositories/students';
import * as productsRepo from '../payments/products-repo';
import * as ordersRepo from '../payments/orders-repo';
import * as refsStore from './refs-store';
import * as jobs from './job-store';
import { resolveEnrollmentDates } from './pipeline/enrollment-engine';
import type {
  NormalizedStudent,
  NormalizedCourse,
  NormalizedProduct,
  NormalizedOrder,
  NormalizedEnrollment,
  ImportEntityConfig,
  ConflictStrategy,
  ImportSource,
  ImportEnrollmentConfig,
} from './types';

interface AdapterContext {
  jobId: string;
  source: ImportSource;
  enrollmentRules?: ImportEnrollmentConfig;
}

interface UpsertResult {
  outcome: 'created' | 'updated' | 'ignored' | 'error';
  internalId?: string;
  message?: string;
}

/**
 * Resolve userId interno seguindo a lista ordenada userMatchKeys.
 * Suporta: 'email' | 'document' | 'external_id' | 'wp_user_id'.
 * Tenta uma chave por vez; primeira a achar vence.
 *
 * Mantém compat com userMatchStrategy legado quando matchKeys não está setado.
 *
 * Retorna { userId } se achou; { error } caso contrário.
 * Com policy=create_stub e email presente, cria user mínimo.
 */
async function resolveUserOrPolicy(
  args: {
    externalId?: string | null;
    email?: string | null;
    document?: string | null;
    wpUserId?: string | null;
    name?: string | null;
  },
  ctx: AdapterContext,
): Promise<{ userId?: string; error?: string }> {
  const cfg = ctx.enrollmentRules;
  const policy = cfg?.unmatchedUserPolicy ?? 'skip';
  const { externalId, email, document, wpUserId, name } = args;

  // Determina ordem de tentativa
  let keys: import('./types').UserMatchKey[];
  if (cfg?.userMatchKeys && cfg.userMatchKeys.length > 0) {
    keys = cfg.userMatchKeys;
  } else {
    // Compat: traduz strategy legado para keys
    const s = cfg?.userMatchStrategy ?? 'email_first';
    if (s === 'email_first') keys = ['email', 'external_id'];
    else if (s === 'external_id_first') keys = ['external_id', 'email'];
    else if (s === 'email_only') keys = ['email'];
    else keys = ['external_id'];
  }

  const tryByKey = async (key: import('./types').UserMatchKey): Promise<string | null> => {
    if (key === 'email') {
      if (!email) return null;
      const u = await usersStore.findUserByEmail(email);
      return u?.id ?? null;
    }
    if (key === 'document') {
      if (!document) return null;
      const u = await usersStore.findUserByDocument(document);
      return u?.id ?? null;
    }
    if (key === 'external_id') {
      if (!externalId) return null;
      const ref = await refsStore.find(ctx.source, 'student', externalId);
      return ref?.internalId ?? null;
    }
    if (key === 'wp_user_id') {
      if (!wpUserId) return null;
      // wp_user_id é guardado em refs como external_id quando vindo do WP
      const ref = await refsStore.find(ctx.source, 'student', wpUserId);
      return ref?.internalId ?? null;
    }
    return null;
  };

  let userId: string | null = null;
  for (const k of keys) {
    userId = await tryByKey(k);
    if (userId) break;
  }
  if (userId) return { userId };

  if (policy === 'error') {
    return {
      error: `Aluno não encontrado (email=${email ?? '—'}, externalId=${externalId ?? '—'}).`,
    };
  }
  if (policy === 'skip') {
    return {
      error: `[skip] aluno não encontrado: ${email ?? externalId ?? '—'}`,
    };
  }
  // create_stub
  if (!email) {
    return {
      error: 'Não foi possível criar stub — sem email para o novo usuário.',
    };
  }
  try {
    const passwordTmp = `pco-stub-${Date.now().toString(36)}`;
    const created = await usersStore.createUser({
      email,
      name: name || email,
      role: 'student',
      password: passwordTmp,
      active: true,
    });
    if (externalId) {
      await refsStore.upsert({
        sourceType: ctx.source,
        externalEntityType: 'student',
        externalId,
        internalEntityType: 'student',
        internalId: created.id,
        jobId: ctx.jobId,
      });
    }
    await jobs.appendCreatedRef(ctx.jobId, {
      entity: 'student',
      internalId: created.id,
      externalId: externalId ?? email,
    });
    return { userId: created.id };
  } catch (err) {
    return {
      error: `Falha ao criar stub: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------- Student ----------

/**
 * Upsert student. Prioriza external_user_id no refs-store; senão por email.
 * Retorna internalId = users-store SystemUser.id.
 */
export async function upsertStudent(
  norm: NormalizedStudent,
  cfg: ImportEntityConfig,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  if (!norm.email) {
    return { outcome: 'error', message: 'E-mail ausente.' };
  }

  // 1) Tenta encontrar por external_user_id
  let existingUserId: string | null = null;
  if (norm.externalUserId) {
    const ref = await refsStore.find(ctx.source, 'student', norm.externalUserId);
    if (ref) existingUserId = ref.internalId;
  }
  // 2) Senão por email
  if (!existingUserId) {
    const u = await usersStore.findUserByEmail(norm.email);
    if (u) existingUserId = u.id;
  }

  if (existingUserId) {
    if (cfg.conflictStrategy === 'ignore')
      return { outcome: 'ignored', internalId: existingUserId };
    if (cfg.conflictStrategy === 'error')
      return {
        outcome: 'error',
        message: `Aluno já existe (${norm.email}). Estratégia=error.`,
      };
    // update / merge
    const patch: Parameters<typeof usersStore.updateUser>[1] = {};
    if (norm.displayName) patch.name = norm.displayName;
    else if (norm.firstName)
      patch.name = `${norm.firstName}${norm.lastName ? ' ' + norm.lastName : ''}`;
    await usersStore.updateUser(existingUserId, patch);

    if (norm.externalUserId) {
      await refsStore.upsert({
        sourceType: ctx.source,
        externalEntityType: 'student',
        externalId: norm.externalUserId,
        internalEntityType: 'student',
        internalId: existingUserId,
        jobId: ctx.jobId,
      });
    }
    return { outcome: 'updated', internalId: existingUserId };
  }

  // Criar novo
  if (cfg.conflictStrategy === 'error') {
    // não há conflito — segue criando
  }
  const passwordTmp = `pco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const created = await usersStore.createUser({
      email: norm.email,
      name:
        norm.displayName ||
        `${norm.firstName ?? ''}${norm.lastName ? ' ' + norm.lastName : ''}`.trim() ||
        norm.email,
      role: 'student',
      password: passwordTmp,
      active: true,
    });
    if (norm.externalUserId) {
      await refsStore.upsert({
        sourceType: ctx.source,
        externalEntityType: 'student',
        externalId: norm.externalUserId,
        internalEntityType: 'student',
        internalId: created.id,
        jobId: ctx.jobId,
      });
    }
    await jobs.appendCreatedRef(ctx.jobId, {
      entity: 'student',
      internalId: created.id,
      externalId: norm.externalUserId ?? norm.wpUserId ?? norm.email,
    });
    return { outcome: 'created', internalId: created.id };
  } catch (err) {
    return {
      outcome: 'error',
      message: err instanceof Error ? err.message : 'Falha ao criar aluno.',
    };
  }
}

// ---------- Product ----------

export async function upsertProduct(
  norm: NormalizedProduct,
  cfg: ImportEntityConfig,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  // Tenta encontrar via external_product_id (refs-store) ou já-existente por refId+kind
  let existingId: string | null = null;
  if (norm.externalProductId) {
    const ref = await refsStore.find(ctx.source, 'product', norm.externalProductId);
    if (ref) existingId = ref.internalId;
  }

  // Se vem com linkedCourseExternalId, podemos vincular o curso
  let linkedCourseInternalId: string | null = null;
  if (norm.linkedCourseExternalId) {
    const courseRef = await refsStore.find(ctx.source, 'course', norm.linkedCourseExternalId);
    if (courseRef) linkedCourseInternalId = courseRef.internalId;
  }

  if (existingId) {
    if (cfg.conflictStrategy === 'ignore')
      return { outcome: 'ignored', internalId: existingId };
    await productsRepo.updateProduct(existingId, {
      name: norm.name,
      priceCents: norm.regularPriceCents,
      currency: norm.currency,
      description: norm.description,
      active: norm.status === 'publish',
      ...(linkedCourseInternalId ? { refId: linkedCourseInternalId } : {}),
    });
    return { outcome: 'updated', internalId: existingId };
  }

  const created = await productsRepo.createProduct({
    kind: 'course',
    refId: linkedCourseInternalId,
    name: norm.name,
    description: norm.description,
    priceCents: norm.regularPriceCents,
    currency: norm.currency,
    active: norm.status === 'publish',
    metadata: {
      sku: norm.sku,
      wcProductId: norm.wcProductId,
      externalProductId: norm.externalProductId,
    },
  });
  if (norm.externalProductId) {
    await refsStore.upsert({
      sourceType: ctx.source,
      externalEntityType: 'product',
      externalId: norm.externalProductId,
      internalEntityType: 'product',
      internalId: created.id,
      jobId: ctx.jobId,
    });
  }
  await jobs.appendCreatedRef(ctx.jobId, {
    entity: 'product',
    internalId: created.id,
    externalId: norm.externalProductId ?? norm.wcProductId ?? undefined,
  });
  return { outcome: 'created', internalId: created.id };
}

// ---------- Course (registro leve) ----------
//
// O AVA tem courses gerenciados via courseRepo.modify (estrutura aninhada com modules/lessons).
// Para evitar refator destrutivo, registramos apenas a referência externa apontando
// para um courseId inferido via slug ou title. Atualização real do conteúdo do curso fica
// como "adapter shallow" — somente upsert do registro de referência por ora.

export async function registerCourseRef(
  norm: NormalizedCourse,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  // Busca curso existente por slug/learndashId/external no refs
  const externalKey =
    norm.externalCourseId ?? norm.learndashCourseId ?? norm.slug ?? norm.title;
  if (!externalKey) {
    return { outcome: 'error', message: 'Curso sem identificador (slug/id/title).' };
  }
  // Não há criação de course nesse sprint — apenas registramos em refs
  await refsStore.upsert({
    sourceType: ctx.source,
    externalEntityType: 'course',
    externalId: externalKey,
    internalEntityType: 'course',
    // Internal id = mesmo external por enquanto (admin pode mapear depois)
    internalId: externalKey,
    jobId: ctx.jobId,
    metadata: {
      title: norm.title,
      slug: norm.slug,
      learndashCourseId: norm.learndashCourseId,
      accessDurationDays: norm.accessDurationDays ?? null,
      accessExpiresAt: norm.accessExpiresAt ?? null,
    },
  });
  return { outcome: 'updated', internalId: externalKey };
}

// ---------- Order ----------

export async function upsertOrder(
  norm: NormalizedOrder,
  cfg: ImportEntityConfig,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  const externalKey = norm.externalOrderId ?? norm.wcOrderId;
  if (!externalKey) {
    return { outcome: 'error', message: 'Order sem identificador externo.' };
  }
  // Verifica se já existe via refs
  const ref = await refsStore.find(ctx.source, 'order', externalKey);
  if (ref) {
    if (cfg.conflictStrategy === 'ignore')
      return { outcome: 'ignored', internalId: ref.internalId };
    // Atualiza status apenas
    await ordersRepo.updateStatus(
      ref.internalId,
      mapWcStatus(norm.status),
      `Import: status WC ${norm.status}`,
    );
    return { outcome: 'updated', internalId: ref.internalId };
  }

  // Cria order interna mínima — sem gateway (registro histórico). Para isso usamos
  // ordersRepo.createOrder que exige um gatewayId; criamos um stub ou pulamos quando
  // não há gateway configurado. Aqui registramos apenas no refs como bridge.
  // Decisão: NÃO criar OrderDto interno (a tabela é exclusiva do checkout AVA).
  // Em vez disso, registramos o pedido externo apenas em refs com metadata cheia.
  await refsStore.upsert({
    sourceType: ctx.source,
    externalEntityType: 'order',
    externalId: externalKey,
    internalEntityType: 'order',
    internalId: externalKey, // alias
    jobId: ctx.jobId,
    metadata: {
      customerEmail: norm.customerEmail,
      status: norm.status,
      orderDate: norm.orderDate,
      paidDate: norm.paidDate,
      completedDate: norm.completedDate,
      totalCents: norm.totalCents,
      currency: norm.currency,
      productIds: norm.productIds,
      productSkus: norm.productSkus,
    },
  });
  return { outcome: 'created', internalId: externalKey };
}

function mapWcStatus(s: NormalizedOrder['status']): 'paid' | 'pending' | 'canceled' | 'failed' | 'refunded' {
  switch (s) {
    case 'completed':
      return 'paid';
    case 'processing':
    case 'pending':
    case 'on-hold':
      return 'pending';
    case 'cancelled':
      return 'canceled';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

// ---------- Enrollment ----------
//
// Resolve aluno (por external_user_id ou email) e curso (por external/learndash) e:
// - calcula start/expiration via enrollment-engine
// - se status interno = 'active', enrolls em studentsRepo.enrollInCourse(userId, courseId)

export async function applyEnrollment(
  norm: NormalizedEnrollment,
  cfg: ImportEntityConfig,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  // Resolve aluno usando estratégia configurada (email_first | external_id_first | only)
  // + policy para usuário não-encontrado (skip | create_stub | error).
  const resolved = await resolveUserOrPolicy(
    {
      externalId: norm.userExternalId,
      email: norm.userEmail,
      document: norm.userDocument,
      wpUserId: norm.userWpId,
      name: norm.userEmail,
    },
    ctx,
  );
  if (!resolved.userId) {
    const policy = ctx.enrollmentRules?.unmatchedUserPolicy ?? 'skip';
    return {
      outcome: policy === 'skip' ? 'ignored' : 'error',
      message: resolved.error,
    };
  }
  const userId = resolved.userId;

  // Resolve curso (apenas refId externo — aliasing simplifica)
  const courseExternal = norm.courseExternalId ?? norm.learndashCourseId;
  if (!courseExternal) {
    return { outcome: 'error', message: 'Curso não identificado.' };
  }
  const courseRef = await refsStore.find(ctx.source, 'course', courseExternal);
  const internalCourseId = courseRef?.internalId ?? courseExternal;

  // Calcula datas
  const courseDuration = (courseRef?.metadata?.accessDurationDays ?? null) as
    | number
    | null;
  const ccfg = ctx.enrollmentRules ?? {
    startRule: 'paid_date',
    expirationRule: 'start_plus_duration',
    wcStatusMap: {},
  };
  const dates = resolveEnrollmentDates({
    startRule: ccfg.startRule,
    expirationRule: ccfg.expirationRule,
    defaultAccessDurationDays: ccfg.defaultAccessDurationDays,
    course: { title: '', accessDurationDays: courseDuration },
    enrollment: norm,
  });

  // Verifica se já existe matrícula
  const existing = await refsStore.find(
    ctx.source,
    'enrollment',
    `${userId}:${internalCourseId}`,
  );
  if (existing) {
    if (cfg.conflictStrategy === 'ignore')
      return { outcome: 'ignored', internalId: existing.internalId };
  }

  if (norm.status === 'active') {
    await studentsRepo.enrollInCourse(userId, internalCourseId);
  }

  await refsStore.upsert({
    sourceType: ctx.source,
    externalEntityType: 'enrollment',
    externalId: `${userId}:${internalCourseId}`,
    internalEntityType: 'enrollment',
    internalId: `${userId}:${internalCourseId}`,
    jobId: ctx.jobId,
    metadata: {
      status: norm.status,
      startDate: dates.startDate,
      expirationDate: dates.expirationDate,
      orderExternalId: norm.orderExternalId,
      productExternalId: norm.productExternalId,
    },
  });

  if (!existing) {
    await jobs.appendCreatedRef(ctx.jobId, {
      entity: 'enrollment',
      internalId: `${userId}:${internalCourseId}`,
      externalId: norm.externalEnrollmentId ?? `${norm.userEmail}->${courseExternal}`,
    });
    return { outcome: 'created', internalId: `${userId}:${internalCourseId}` };
  }
  return { outcome: 'updated', internalId: existing.internalId };
}

// ---------- Status helpers (re-exportados para conveniência) ----------

export { mapWcStatus };
