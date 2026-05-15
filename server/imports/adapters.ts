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
  NormalizedProgress,
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
    const patch: Parameters<typeof usersStore.updateUser>[1] = {};
    const newName =
      norm.displayName ||
      (norm.firstName
        ? `${norm.firstName}${norm.lastName ? ' ' + norm.lastName : ''}`
        : '');
    if (newName) {
      if (cfg.conflictStrategy === 'merge') {
        // Merge: só preenche se atual estiver vazio
        const current = await usersStore.findUserById(existingUserId);
        if (!current?.name || current.name === current.email) {
          patch.name = newName;
        }
      } else {
        // update: sobrescreve
        patch.name = newName;
      }
    }
    if (Object.keys(patch).length > 0) {
      await usersStore.updateUser(existingUserId, patch);
    }

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
    if (cfg.conflictStrategy === 'error')
      return {
        outcome: 'error',
        message: `Produto já existe (${norm.externalProductId}). Estratégia=error.`,
      };
    if (cfg.conflictStrategy === 'merge') {
      // Merge: só sobrescreve campos atualmente vazios
      const current = await productsRepo.findById(existingId);
      const patch: Parameters<typeof productsRepo.updateProduct>[1] = {};
      if (!current?.name && norm.name) patch.name = norm.name;
      if ((current?.priceCents ?? 0) === 0 && norm.regularPriceCents > 0)
        patch.priceCents = norm.regularPriceCents;
      if (!current?.currency && norm.currency) patch.currency = norm.currency;
      if (!current?.description && norm.description)
        patch.description = norm.description;
      if (linkedCourseInternalId && !current?.refId)
        patch.refId = linkedCourseInternalId;
      if (Object.keys(patch).length > 0) {
        await productsRepo.updateProduct(existingId, patch);
      }
    } else {
      // update: sobrescreve tudo
      await productsRepo.updateProduct(existingId, {
        name: norm.name,
        priceCents: norm.regularPriceCents,
        currency: norm.currency,
        description: norm.description,
        active: norm.status === 'publish',
        ...(linkedCourseInternalId ? { refId: linkedCourseInternalId } : {}),
      });
    }
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
    if (cfg.conflictStrategy === 'error')
      return {
        outcome: 'error',
        message: `Pedido já existe (${externalKey}). Estratégia=error.`,
      };
    // Para merge ou update, atualiza status; merge preserva metadata existente
    if (cfg.conflictStrategy !== 'merge') {
      await ordersRepo.updateStatus(
        ref.internalId,
        mapWcStatus(norm.status),
        `Import: status WC ${norm.status}`,
      );
    }
    // Merge metadata
    const mergedMeta =
      cfg.conflictStrategy === 'merge'
        ? mergeOrderMeta(ref.metadata as Record<string, unknown>, norm)
        : buildOrderMeta(norm);
    await refsStore.upsert({
      sourceType: ctx.source,
      externalEntityType: 'order',
      externalId: externalKey,
      internalEntityType: 'order',
      internalId: ref.internalId,
      jobId: ctx.jobId,
      metadata: mergedMeta,
    });
    return { outcome: 'updated', internalId: ref.internalId };
  }

  await refsStore.upsert({
    sourceType: ctx.source,
    externalEntityType: 'order',
    externalId: externalKey,
    internalEntityType: 'order',
    internalId: externalKey,
    jobId: ctx.jobId,
    metadata: buildOrderMeta(norm),
  });
  return { outcome: 'created', internalId: externalKey };
}

function buildOrderMeta(norm: NormalizedOrder): Record<string, unknown> {
  return {
    customerEmail: norm.customerEmail,
    status: norm.status,
    orderDate: norm.orderDate,
    paidDate: norm.paidDate,
    completedDate: norm.completedDate,
    totalCents: norm.totalCents,
    currency: norm.currency,
    productIds: norm.productIds,
    productSkus: norm.productSkus,
  };
}

function mergeOrderMeta(
  current: Record<string, unknown> | undefined,
  norm: NormalizedOrder,
): Record<string, unknown> {
  const cur = current ?? {};
  const fresh = buildOrderMeta(norm);
  const out: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(fresh)) {
    const existing = out[k];
    const isEmpty =
      existing === undefined ||
      existing === null ||
      existing === '' ||
      (Array.isArray(existing) && existing.length === 0);
    if (isEmpty && v !== undefined && v !== null) out[k] = v;
  }
  return out;
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
    if (cfg.conflictStrategy === 'error')
      return {
        outcome: 'error',
        message: `Matrícula já existe para ${userId}:${internalCourseId}.`,
      };
  }

  if (norm.status === 'active') {
    await studentsRepo.enrollInCourse(userId, internalCourseId);
  }

  // Para merge, mantém startDate mais antiga e expirationDate mais recente
  const meta = (existing?.metadata ?? {}) as Record<string, unknown>;
  const finalStart =
    cfg.conflictStrategy === 'merge' && typeof meta.startDate === 'string'
      ? earliestDate(meta.startDate, dates.startDate)
      : dates.startDate;
  const finalExpiration =
    cfg.conflictStrategy === 'merge' && typeof meta.expirationDate === 'string'
      ? latestDate(meta.expirationDate as string | null, dates.expirationDate)
      : dates.expirationDate;

  await refsStore.upsert({
    sourceType: ctx.source,
    externalEntityType: 'enrollment',
    externalId: `${userId}:${internalCourseId}`,
    internalEntityType: 'enrollment',
    internalId: `${userId}:${internalCourseId}`,
    jobId: ctx.jobId,
    metadata: {
      status: norm.status,
      startDate: finalStart,
      expirationDate: finalExpiration,
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

// ---------- Progress ----------
//
// Atualiza student.progressByCourse[courseId] = percent. Resolve aluno por
// userMatchKeys (default email + external_id). Linha de progress por step
// individual (post_id) é ignorada — só interessa o agregado por curso.

export async function applyProgress(
  norm: NormalizedProgress,
  ctx: AdapterContext,
): Promise<UpsertResult> {
  // Linhas de step individual têm topicExternalId/lessonExternalId mas o
  // percentual está só no payload de curso. Ignora silenciosamente.
  if (norm.progressPercentage === undefined || norm.progressPercentage === null) {
    if (norm.lessonExternalId || norm.topicExternalId) {
      return { outcome: 'ignored', message: 'step-level progress sem percentual agregado' };
    }
  }

  const resolved = await resolveUserOrPolicy(
    {
      externalId: norm.userExternalId,
      email: norm.userEmail,
      name: norm.userEmail,
    },
    ctx,
  );
  if (!resolved.userId) {
    return { outcome: 'error', message: resolved.error };
  }
  const userId = resolved.userId;

  const courseExternal = norm.courseExternalId;
  if (!courseExternal) {
    return { outcome: 'error', message: 'progress sem courseExternalId' };
  }
  const courseRef = await refsStore.find(ctx.source, 'course', courseExternal);
  const internalCourseId = courseRef?.internalId ?? courseExternal;

  const pct = norm.progressPercentage ?? 0;
  await studentsRepo.setCourseProgress(userId, internalCourseId, pct);

  return { outcome: 'updated', internalId: `${userId}:${internalCourseId}:progress` };
}

// ---------- Status helpers (re-exportados para conveniência) ----------

export { mapWcStatus };

function earliestDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function latestDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

// Exposto para testes — não usar em código de produção
export const __test_internals__ = {
  earliestDate,
  latestDate,
  mergeOrderMeta,
  buildOrderMeta,
};
