// Schema Drizzle do AVA PCO. Single source of truth do DB.
// Convenções:
//  - Datas em timestamptz com default now()
//  - PKs em texto (slug-like ou nanoid) para legibilidade
//  - Soft delete não é usado: marcações como `archived_at` quando precisar
//  - JSONB para campos polimórficos (allowedScopes, blockedTopics, etc.)

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------- Enums ----------

export const roleEnum = pgEnum('role', ['student', 'admin', 'superadmin']);

export const studentStatusEnum = pgEnum('student_status', [
  'ativo',
  'em_risco',
  'bloqueado',
  'inativo',
]);

export const lessonStatusEnum = pgEnum('lesson_status', [
  'locked',
  'available',
  'in_progress',
  'completed',
  'pending_assessment',
]);

export const supportCategoryEnum = pgEnum('support_category', [
  'duvida_aula',
  'acesso',
  'certificado',
  'tutor',
  'biblioteca',
  'outro',
]);

export const supportStatusEnum = pgEnum('support_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);

export const aiModuleEnum = pgEnum('ai_module', [
  'tutor',
  'recovery_plan',
  'evasion',
  'recommendations',
  'support',
  'summaries',
  'grading',
]);

export const aiProviderEnum = pgEnum('ai_provider', [
  'anthropic',
  'openai',
  'google',
  'mistral',
  'deepseek',
  'groq',
]);

// ---------- Users ----------

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: roleEnum('role').notNull().default('student'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

// ---------- Students ----------

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weeklyGoalMinutes: integer('weekly_goal_minutes').notNull().default(180),
  totalStudyMinutes: integer('total_study_minutes').notNull().default(0),
  riskScore: integer('risk_score').notNull().default(0),
  status: studentStatusEnum('status').notNull().default('ativo'),
  lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- Courses ----------

export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  shortTitle: text('short_title').notNull(),
  description: text('description').notNull(),
  coverColor: text('cover_color').notNull(),
  totalHours: integer('total_hours').notNull().default(0),
  certificateAvailable: boolean('certificate_available').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const modules = pgTable(
  'modules',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    order: integer('order').notNull(),
    releaseAt: timestamp('release_at', { withTimezone: true }),
  },
  (t) => ({
    courseIdx: index('modules_course_idx').on(t.courseId),
  }),
);

export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    moduleId: text('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    videoUrl: text('video_url'),
    description: text('description'),
    isMandatory: boolean('is_mandatory').notNull().default(true),
    order: integer('order').notNull(),
  },
  (t) => ({
    moduleIdx: index('lessons_module_idx').on(t.moduleId),
  }),
);

export const assessments = pgTable('assessments', {
  id: text('id').primaryKey(),
  moduleId: text('module_id')
    .notNull()
    .references(() => modules.id, { onDelete: 'cascade' }),
  courseId: text('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  questionCount: integer('question_count').notNull().default(10),
  passingScore: integer('passing_score').notNull().default(70),
  timeLimitMinutes: integer('time_limit_minutes'),
});

// ---------- Enrollments ----------

export const enrollments = pgTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    progress: integer('progress').notNull().default(0),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('enrollments_student_course_idx').on(t.studentId, t.courseId),
  }),
);

// ---------- News / Podcasts / Library / Certificates ----------

export const newsArticles = pgTable('news_articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  body: text('body'),
  category: text('category').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  coverColor: text('cover_color').notNull(),
  authorName: text('author_name').notNull(),
  publishedAt: text('published_at').notNull(),
  featured: boolean('featured').notNull().default(false),
  relatedCourseIds: jsonb('related_course_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
});

export const podcasts = pgTable('podcasts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  publishedAt: text('published_at').notNull(),
  coverColor: text('cover_color').notNull(),
  audioUrl: text('audio_url'),
  relatedCourseIds: jsonb('related_course_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  relatedModuleIds: jsonb('related_module_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
});

export const libraryItems = pgTable('library_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  type: text('type').notNull(), // 'pdf' | 'apostila' | 'leitura' | 'artigo'
  mandatory: boolean('mandatory').notNull().default(false),
  fileMockUrl: text('file_url').notNull(),
  relatedCourseIds: jsonb('related_course_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  relatedModuleIds: jsonb('related_module_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  theme: text('theme'),
});

export const certificates = pgTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    validationCode: text('validation_code').notNull().unique(),
    qrCodeMockUrl: text('qr_code_url').notNull().default('#'),
    status: text('status').notNull().default('in_progress'), // in_progress | available | issued
    progress: integer('progress').notNull().default(0),
  },
  (t) => ({
    studentIdx: index('certificates_student_idx').on(t.studentId),
  }),
);

// ---------- Support ----------

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    category: supportCategoryEnum('category').notNull(),
    status: supportStatusEnum('status').notNull().default('open'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('support_tickets_student_idx').on(t.studentId),
    statusIdx: index('support_tickets_status_idx').on(t.status),
  }),
);

// ---------- Retention risks ----------

export const retentionRisks = pgTable('retention_risks', {
  studentId: text('student_id')
    .primaryKey()
    .references(() => students.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().default(0),
  level: text('level').notNull(), // baixo|medio|alto|critico
  reasons: jsonb('reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  expectedProgress: integer('expected_progress').notNull().default(0),
  realProgress: integer('real_progress').notNull().default(0),
  pendingAssessments: integer('pending_assessments').notNull().default(0),
  tutorUsage: integer('tutor_usage').notNull().default(0),
  podConsumption: integer('pod_consumption').notNull().default(0),
  libraryInteractions: integer('library_interactions').notNull().default(0),
  recommendedAction: text('recommended_action').notNull().default(''),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------- Sessions / Professionals ----------

export const professionals = pgTable('professionals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull(),
  bio: text('bio').notNull(),
  email: text('email').notNull(),
  hourlyRate: integer('hourly_rate').notNull().default(0),
  specialties: jsonb('specialties').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  serviceIds: jsonb('service_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
});

export const sessionServices = pgTable('session_services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // analise|supervisao|orientacao
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(50),
  price: integer('price').notNull().default(0),
  active: boolean('active').notNull().default(true),
  paymentBeforeConfirmation: boolean('payment_before_confirmation').notNull().default(true),
});

// ---------- AI Configurations ----------

export const aiConfigurations = pgTable('ai_configurations', {
  id: text('id').primaryKey(),
  module: aiModuleEnum('module').notNull(),
  provider: aiProviderEnum('provider').notNull(),
  model: text('model').notNull(),

  // Chave criptografada (AES-GCM). Formato: base64(iv).base64(ciphertext).base64(tag)
  // Nunca volta ao cliente — apenas o servidor descriptografa para chamar provider.
  apiKeyEncrypted: text('api_key_encrypted').notNull().default(''),

  temperature: doublePrecision('temperature').notNull().default(0.3),
  maxTokens: integer('max_tokens').notNull().default(1200),
  perStudentLimit: integer('per_student_limit').notNull().default(50),
  perDayLimit: integer('per_day_limit').notNull().default(5000),
  perMonthLimit: integer('per_month_limit').notNull().default(120000),
  monthlyCostCap: doublePrecision('monthly_cost_cap').notNull().default(800),
  systemMessage: text('system_message').notNull().default(''),
  allowedScopes: jsonb('allowed_scopes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  blockedTopics: jsonb('blocked_topics').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  fallbackResponse: text('fallback_response').notNull().default(''),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: text('id').primaryKey(),
    configId: text('config_id')
      .notNull()
      .references(() => aiConfigurations.id, { onDelete: 'cascade' }),
    studentId: text('student_id'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    successful: boolean('successful').notNull().default(true),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    configIdx: index('ai_usage_logs_config_idx').on(t.configId),
    studentIdx: index('ai_usage_logs_student_idx').on(t.studentId),
    timeIdx: index('ai_usage_logs_time_idx').on(t.occurredAt),
  }),
);
