// Tipos do módulo de importação WordPress/LearnDash/WooCommerce.
// Estruturas normalizadas — desacoplam origem (WP/LD/WC/CSV) das entidades internas.

export type ImportSource = 'wordpress' | 'learndash' | 'woocommerce' | 'csv';
export type ImportEntityType =
  | 'student'
  | 'course'
  | 'module'
  | 'lesson'
  | 'topic'
  | 'quiz'
  | 'question'
  | 'group'
  | 'product'
  | 'order'
  | 'enrollment'
  | 'progress';

export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'canceled'
  | 'rolled_back';

export type ConflictStrategy =
  | 'ignore'
  | 'update'
  | 'merge'
  | 'create_duplicate' // só onde fizer sentido (raro)
  | 'error';

/**
 * Estratégia para resolver "este registro pertence a qual aluno interno?".
 * - email_first (default): tenta external_id, senão email — funciona pra multi-source
 * - external_id_first: tenta external_id da fonte, senão email
 * - email_only: ignora external_id, só email (consolida usuários de várias fontes)
 * - external_id_only: ignora email, só external_id (mantém fontes separadas)
 */
export type UserMatchStrategy =
  | 'email_first'
  | 'external_id_first'
  | 'email_only'
  | 'external_id_only';

/**
 * O que fazer quando importa entidade-filha (matrícula, pedido, progresso) e o
 * usuário-pai não existe no sistema.
 * - skip (default): ignora a row, registra erro suave
 * - create_stub: cria um user mínimo com o email/external_id que veio
 * - error: interrompe e marca como erro
 */
export type UnmatchedUserPolicy = 'skip' | 'create_stub' | 'error';

export type EnrollmentStartRule =
  | 'paid_date'
  | 'completed_date'
  | 'order_date'
  | 'imported'
  | 'now';

export type EnrollmentExpirationRule =
  | 'start_plus_duration'
  | 'order_plus_duration'
  | 'paid_plus_duration'
  | 'completed_plus_duration'
  | 'explicit'
  | 'lifetime'
  | 'course_fixed_end';

// ---------- Entidades normalizadas ----------

export interface NormalizedStudent {
  externalUserId?: string | null;
  wpUserId?: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  document?: string; // CPF/RG
  status?: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo';
  metadata?: Record<string, unknown>;
}

export interface NormalizedCourse {
  externalCourseId?: string | null;
  learndashCourseId?: string | null;
  slug?: string;
  title: string;
  description?: string;
  status?: 'publish' | 'draft' | 'private';
  // Acesso (aditivo — campos novos opcionais no Course)
  accessDurationDays?: number | null; // null = vitalício
  accessExpiresAt?: string | null; // data fixa ISO
  totalHours?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedModule {
  externalModuleId?: string | null;
  learndashSectionId?: string | null;
  courseExternalId?: string | null;
  courseLearndashId?: string | null;
  title: string;
  description?: string;
  order: number;
  status?: 'publish' | 'draft' | 'private';
  metadata?: Record<string, unknown>;
}

export interface NormalizedLesson {
  externalLessonId?: string | null;
  learndashLessonId?: string | null;
  courseExternalId?: string | null;
  moduleExternalId?: string | null;
  title: string;
  description?: string; // sanitizado
  videoUrl?: string;
  durationMinutes?: number;
  order: number;
  isMandatory?: boolean;
  releaseType?: 'open' | 'drip' | 'scheduled';
  dripDays?: number;
  status?: 'publish' | 'draft' | 'private';
  metadata?: Record<string, unknown>;
}

export interface NormalizedProduct {
  externalProductId?: string | null;
  wcProductId?: string | null;
  sku?: string;
  name: string;
  description?: string;
  type?: 'simple' | 'variable' | 'subscription';
  regularPriceCents: number;
  salePriceCents?: number | null;
  currency: string;
  status?: 'publish' | 'draft' | 'private';
  // Vínculo com curso (preencher 1 desses)
  linkedCourseExternalId?: string | null;
  linkedLearndashCourseId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NormalizedOrder {
  externalOrderId?: string | null;
  wcOrderId?: string | null;
  customerExternalId?: string | null;
  customerEmail?: string | null;
  orderNumber?: string;
  status:
    | 'pending'
    | 'processing'
    | 'on-hold'
    | 'completed'
    | 'cancelled'
    | 'refunded'
    | 'failed';
  orderDate: string; // ISO
  paidDate?: string | null;
  completedDate?: string | null;
  totalCents: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
  productIds?: string[]; // wcProductIds ou externalProductIds
  productSkus?: string[];
  billing?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface NormalizedEnrollment {
  externalEnrollmentId?: string | null;
  userExternalId?: string | null;
  userEmail?: string | null;
  userDocument?: string | null; // CPF/RG vindo no CSV/API
  userWpId?: string | null; // wp_user_id se vier separado
  courseExternalId?: string | null;
  learndashCourseId?: string | null;
  orderExternalId?: string | null;
  productExternalId?: string | null;
  status: 'active' | 'pending' | 'expired' | 'cancelled' | 'completed';
  enrollmentStartDate?: string | null;
  enrollmentExpirationDate?: string | null;
  accessDurationDays?: number | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NormalizedProgress {
  userExternalId?: string | null;
  userEmail?: string | null;
  courseExternalId?: string | null;
  lessonExternalId?: string | null;
  topicExternalId?: string | null;
  completedAt?: string | null;
  progressPercentage?: number;
  status?: 'started' | 'in_progress' | 'completed';
  lastAccessAt?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------- ImportJob (snapshot persistido) ----------

export interface ImportFieldMapping {
  source: string; // chave no payload externo
  target: string; // chave na entidade normalizada
  required?: boolean;
  defaultValue?: unknown;
  // Cadeia de transformações aplicadas em ordem
  transforms?: string[]; // ex: ['trim', 'lowercase']
  conditions?: Array<{ when: 'empty' | 'eq' | 'matches'; value?: unknown }>;
}

export interface ImportEntityConfig {
  entity: ImportEntityType;
  enabled: boolean;
  mappings: ImportFieldMapping[];
  conflictStrategy: ConflictStrategy;
  // Para cada entidade, como resolver match com registro existente:
  matchKeys: string[]; // ex: ['email', 'externalUserId']
}

/**
 * Chaves disponíveis para identificar um aluno na importação.
 * O array é ordenado: tenta a primeira; se falhar, tenta a próxima.
 */
export type UserMatchKey = 'email' | 'document' | 'external_id' | 'wp_user_id';

export interface ImportEnrollmentConfig {
  startRule: EnrollmentStartRule;
  expirationRule: EnrollmentExpirationRule;
  defaultAccessDurationDays?: number; // fallback quando course não define
  // Mapeia status WC → status interno de enrollment
  wcStatusMap: Record<string, NormalizedEnrollment['status']>;
  // Ordem de chaves para resolver o aluno-pai em entidades filhas.
  // Default ['email', 'external_id'] — consolida usuários cross-source.
  userMatchKeys?: UserMatchKey[];
  // Estratégia legada (mantida para compat). Quando matchKeys está presente, é ignorada.
  userMatchStrategy?: UserMatchStrategy;
  // O que fazer quando o aluno-pai não é encontrado.
  // Default 'skip'.
  unmatchedUserPolicy?: UnmatchedUserPolicy;
  // Estratégia de conflito global (sobrescreve a do ImportEntityConfig se setada)
  conflictStrategy?: ConflictStrategy;
  /**
   * Quando true, rows com erros de validacao (ex: email vazio, status invalido)
   * ainda sao processados pelos adapters. Stats marca como
   * 'imported_with_warnings'. Util pra importar dados legados imperfeitos
   * sem perder registros.
   *
   * Default false (strict): rows invalidos sao pulados.
   */
  skipValidationErrors?: boolean;
}

export interface ImportApiConfig {
  source: 'wordpress' | 'learndash' | 'woocommerce';
  baseUrl: string;
  authType: 'basic' | 'bearer' | 'wc_keys' | 'application_password';
  username?: string;
  password?: string; // ou app password
  bearerToken?: string;
  wcConsumerKey?: string;
  wcConsumerSecret?: string;
  endpointPrefix?: string;
  timeoutMs?: number;
  perPage?: number;
  maxRetries?: number;
  rateLimitMs?: number;
  environment?: 'production' | 'staging' | 'other';
}

export interface ImportCsvConfig {
  // Mapeia entityType → fileId armazenado em data/imports-uploads/
  files: Partial<Record<ImportEntityType, string>>;
  separator?: ',' | ';';
  encoding?: 'utf-8' | 'utf-8-bom';
}

export interface ImportJob {
  id: string;
  source: ImportSource;
  mode: 'api' | 'csv';
  api?: ImportApiConfig;
  csv?: ImportCsvConfig;
  entities: ImportEntityConfig[];
  enrollment: ImportEnrollmentConfig;
  status: ImportJobStatus;
  dryRun: boolean;
  // Estatísticas acumuladas
  stats: {
    totalRead: number;
    valid: number;
    invalid: number;
    created: number;
    updated: number;
    ignored: number;
    errors: number;
    durationMs: number;
  };
  // Por entidade — última entidade processada e contagem
  perEntity: Partial<Record<ImportEntityType, {
    read: number;
    valid: number;
    invalid: number;
    created: number;
    updated: number;
    ignored: number;
    errors: number;
  }>>;
  // Lista de internalIds criados — pra rollback
  createdRefs: Array<{ entity: ImportEntityType; internalId: string; externalId?: string }>;
  // Erros (cap 1000)
  errorsLog: Array<{
    entity: ImportEntityType;
    rowIndex: number;
    message: string;
    field?: string;
    rawRow?: Record<string, unknown>;
  }>;
  startedBy: string; // email do admin
  startedById: string;
  startedAt: string;
  finishedAt?: string;
  presetId?: string | null;
  // Mensagens informativas (não erro)
  notes: Array<{ ts: string; level: 'info' | 'warn' | 'error'; message: string }>;
}

// ---------- Cross-reference (mapeia external → interno) ----------

export interface ExternalReference {
  id: string;
  sourceType: ImportSource;
  externalEntityType: ImportEntityType;
  externalId: string;
  internalEntityType: ImportEntityType;
  internalId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  jobId: string; // qual import criou
}

// ---------- Mapping Preset ----------

export interface MappingPreset {
  id: string;
  name: string;
  description?: string;
  source: ImportSource;
  entities: ImportEntityConfig[];
  enrollment?: ImportEnrollmentConfig;
  isBuiltIn: boolean; // presets default não podem ser excluídos
  createdAt: string;
  updatedAt: string;
}
