import { z } from 'zod';

// Reutilizáveis
export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().date());

// Auth / User
export const roleSchema = z.enum(['student', 'admin', 'superadmin']);

// E-mail leniente: aceita qualquer string contendo @ e ponto no domínio.
// Funciona com TLDs como .local, .test, .internal etc.
const emailLike = z
  .string()
  .min(3, 'E-mail muito curto')
  .max(160, 'E-mail muito longo')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido');

export const loginSchema = z.object({
  email: emailLike,
  password: z.string().min(1, 'Senha obrigatória').max(200, 'Senha muito longa'),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailLike,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z
    .string()
    .min(8, 'Senha precisa ter ao menos 8 caracteres')
    .max(128, 'Senha muito longa'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Profile (self-service)
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(120, 'Nome muito longo').optional(),
  avatarUrl: z
    .string()
    .max(500, 'URL muito longa')
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const selfChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória').max(128),
  newPassword: z
    .string()
    .min(8, 'Nova senha precisa ter ao menos 8 caracteres')
    .max(128, 'Senha muito longa'),
});
export type SelfChangePasswordInput = z.infer<typeof selfChangePasswordSchema>;

// Notifications
export const notificationCategoryEnum = z.enum([
  'info',
  'success',
  'warning',
  'danger',
  'announcement',
]);

export const notificationAudienceEnum = z.enum(['all', 'students', 'admins', 'user', 'users']);

export const broadcastNotificationSchema = z
  .object({
    audience: notificationAudienceEnum,
    userId: z.string().min(1).optional(),
    userIds: z.array(z.string().min(1)).max(500).optional(),
    title: z.string().min(2, 'Título muito curto').max(120, 'Título muito longo'),
    body: z.string().min(2, 'Corpo muito curto').max(2000, 'Corpo muito longo'),
    category: notificationCategoryEnum.optional(),
    link: z.string().max(500).optional(),
  })
  .refine((v) => v.audience !== 'user' || (v.userId && v.userId.length > 0), {
    message: 'userId é obrigatório quando audience = user',
    path: ['userId'],
  })
  .refine((v) => v.audience !== 'users' || (v.userIds && v.userIds.length > 0), {
    message: 'userIds é obrigatório quando audience = users',
    path: ['userIds'],
  });
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;

// Support
export const supportCategorySchema = z.enum([
  'duvida_aula',
  'acesso',
  'certificado',
  'tutor',
  'biblioteca',
  'outro',
]);

export const createSupportTicketSchema = z.object({
  subject: z
    .string()
    .min(4, 'Assunto muito curto')
    .max(120, 'Assunto muito longo'),
  category: supportCategorySchema,
  message: z
    .string()
    .min(10, 'Descreva com mais detalhes (mínimo 10 caracteres)')
    .max(2000, 'Mensagem muito longa'),
});
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

// Recovery plan
export const recoveryPlanSchema = z.object({
  studentId: idSchema,
  tone: z.enum(['acolhedor', 'direto', 'motivacional']),
  channel: z.enum(['email', 'whatsapp', 'in_app']),
  intensity: z.enum(['leve', 'media', 'intensa']),
  goal: z.string().min(1).max(200),
  includeTutor: z.boolean(),
  includePod: z.boolean(),
  includeLibrary: z.boolean(),
});
export type RecoveryPlanInput = z.infer<typeof recoveryPlanSchema>;

// Payment gateways
export const paymentProviderEnum = z.enum([
  'mock',
  'stripe',
  'asaas',
  'pagarme',
  'paypal',
  'mercadopago',
]);
export const paymentModeEnum = z.enum(['test', 'live']);

export const createPaymentGatewaySchema = z.object({
  provider: paymentProviderEnum,
  displayName: z.string().min(2).max(120),
  mode: paymentModeEnum,
  active: z.boolean().optional(),
  apiKey: z.string().min(1, 'API key obrigatória').max(2000),
  apiSecret: z.string().max(2000).optional(),
  webhookSecret: z.string().max(2000).optional(),
  publicKey: z.string().max(2000).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePaymentGatewayInput = z.infer<typeof createPaymentGatewaySchema>;

export const updatePaymentGatewaySchema = z.object({
  displayName: z.string().min(2).max(120).optional(),
  mode: paymentModeEnum.optional(),
  active: z.boolean().optional(),
  apiKey: z.string().max(2000).optional(),
  apiSecret: z.string().max(2000).nullable().optional(),
  webhookSecret: z.string().max(2000).nullable().optional(),
  publicKey: z.string().max(2000).nullable().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePaymentGatewayInput = z.infer<typeof updatePaymentGatewaySchema>;

// Products
export const productKindEnum = z.enum(['course', 'session_pack', 'tutor_pack', 'bundle']);

export const createProductSchema = z.object({
  kind: productKindEnum,
  refId: z.string().nullable().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0).max(10_000_00 /* R$ 10.000 */),
  currency: z.string().length(3).default('BRL'),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Checkout
export const checkoutSchema = z.object({
  productId: z.string().min(1),
  gatewayId: z.string().min(1).optional(), // se omitido, usa o ativo
  couponCode: z.string().max(40).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Cupons
export const couponDiscountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('percent'), value: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal('amount'), value: z.number().int().min(1).max(10_000_00) }),
]);

export const createCouponSchema = z.object({
  code: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
  discount: couponDiscountSchema,
  appliesToProductIds: z.array(z.string().min(1)).max(100).optional(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = createCouponSchema.partial().omit({ code: true });
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

// Generic API envelope
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

// AI providers
export const providerIdSchema = z.enum([
  'anthropic',
  'openai',
  'google',
  'mistral',
  'deepseek',
  'groq',
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const aiModuleSchema = z.enum([
  'tutor',
  'recovery_plan',
  'evasion',
  'recommendations',
  'support',
  'summaries',
]);
export type AiModule = z.infer<typeof aiModuleSchema>;

export const updateAiConfigSchema = z.object({
  provider: providerIdSchema.optional(),
  model: z.string().min(1).max(80).optional(),
  apiKey: z.string().min(0).max(500).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32000).optional(),
  perStudentLimit: z.number().int().min(0).max(100000).optional(),
  perDayLimit: z.number().int().min(0).max(10000000).optional(),
  perMonthLimit: z.number().int().min(0).max(100000000).optional(),
  monthlyCostCap: z.number().min(0).max(1000000).optional(),
  systemMessage: z.string().max(8000).optional(),
  allowedScopes: z.array(z.string().max(80)).max(50).optional(),
  blockedTopics: z.array(z.string().max(80)).max(50).optional(),
  fallbackResponse: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});
export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;

export const tutorAskSchema = z.object({
  message: z.string().min(1, 'Mensagem obrigatória').max(2000, 'Mensagem muito longa'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});
export type TutorAskInput = z.infer<typeof tutorAskSchema>;

// ---- Course writes ----

export const updateCourseSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug aceita apenas letras minúsculas, números e hífens')
    .optional(),
  shortTitle: z.string().min(1).max(60).optional(),
  description: z.string().max(2000).optional(),
  totalHours: z.number().int().min(0).max(10000).optional(),
  certificateAvailable: z.boolean().optional(),
  coverColor: z.string().max(120).optional(),
  active: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  /**
   * IDs de cursos que o aluno deve completar antes de poder se matricular
   * neste. Vazio ou undefined = sem pré-requisitos.
   */
  prerequisiteCourseIds: z.array(z.string().min(1).max(40)).max(10).optional(),
  /**
   * Bullet points de "O que você vai aprender" — exibido na página
   * pública do curso como incentivo de matrícula.
   */
  learningOutcomes: z.array(z.string().min(2).max(200)).max(20).optional(),
  /** Nome público do(a) instrutor(a)/professor(a). */
  instructorName: z.string().max(120).optional().or(z.literal('')),
  /** Bio curta do instrutor. */
  instructorBio: z.string().max(2000).optional().or(z.literal('')),
  /** URL pública de uma foto do instrutor. */
  instructorPhotoUrl: z.string().url().max(500).optional().or(z.literal('')),
  /**
   * Co-instrutores / equipe pedagógica adicional (até 10).
   * O instrutor principal continua em instructorName/Bio/Photo.
   */
  collaborators: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        role: z.string().max(120).optional(),
        bio: z.string().max(1000).optional(),
        photoUrl: z.string().url().max(500).optional().or(z.literal('')),
      }),
    )
    .max(10)
    .optional(),
  /**
   * Customização do certificado de conclusão. Cada campo é opcional —
   * vazios caem nos defaults globais.
   */
  certificateTemplate: z
    .object({
      title: z.string().max(120).optional(),
      preamble: z.string().max(200).optional(),
      bodyText: z.string().max(500).optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)')
        .optional(),
      ribbonColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)')
        .optional(),
      orgName: z.string().max(120).optional(),
      signatureName: z.string().max(120).optional(),
      signatureRole: z.string().max(120).optional(),
      logoUrl: z.string().url().max(500).optional().or(z.literal('')),
    })
    .partial()
    .optional(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

// ---- News writes ----

export const createNewsSchema = z.object({
  title: z.string().min(4, 'Título muito curto').max(200),
  excerpt: z.string().min(10, 'Resumo muito curto').max(600),
  body: z.string().max(20000).optional(),
  category: z.string().min(1).max(60),
  tags: z.array(z.string().max(40)).max(20).default([]),
  coverColor: z.string().max(120).default('from-pco-blue to-pco-cyan'),
  authorName: z.string().min(2).max(80).default('Equipe PCO'),
  publishedAt: z.string().min(8).max(20),
  featured: z.boolean().default(false),
  relatedCourseIds: z.array(z.string().max(40)).max(50).default([]),
});
export type CreateNewsInput = z.infer<typeof createNewsSchema>;

export const updateNewsSchema = createNewsSchema.partial();
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;

// ---- Library writes ----

export const libraryTypeSchema = z.enum(['pdf', 'apostila', 'leitura', 'artigo']);

export const createLibrarySchema = z.object({
  title: z.string().min(2).max(200),
  author: z.string().min(2).max(120),
  type: libraryTypeSchema,
  mandatory: z.boolean().default(false),
  fileMockUrl: z.string().min(1).max(500).default('#'),
  relatedCourseIds: z.array(z.string().max(40)).max(50).default([]),
  relatedModuleIds: z.array(z.string().max(40)).max(100).default([]),
  theme: z.string().max(80).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});
export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;

export const updateLibrarySchema = createLibrarySchema.partial();
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;

// ---- Podcast writes ----

export const createPodcastSchema = z.object({
  title: z.string().min(2, 'Título muito curto').max(200),
  description: z.string().min(10, 'Descrição muito curta').max(2000),
  durationMinutes: z.number().int().min(1).max(600).default(30),
  publishedAt: z.string().min(8).max(20),
  coverColor: z.string().max(120).default('from-pco-blue to-pco-cyan'),
  audioUrl: z
    .string()
    .url('URL inválida')
    .or(z.literal(''))
    .optional(),
  relatedCourseIds: z.array(z.string().max(40)).max(50).default([]),
  relatedModuleIds: z.array(z.string().max(40)).max(100).default([]),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});
export type CreatePodcastInput = z.infer<typeof createPodcastSchema>;

export const updatePodcastSchema = createPodcastSchema.partial();
export type UpdatePodcastInput = z.infer<typeof updatePodcastSchema>;

// ---- Module writes ----

export const createModuleSchema = z.object({
  title: z.string().min(2, 'Título muito curto').max(160),
  description: z.string().max(2000).optional(),
  order: z.number().int().min(1).max(500),
  // datetime-local input emite ''; tratamos como "sem release programado".
  // Caso preenchido, exige formato ISO ou datetime-local (>= 10 chars: YYYY-MM-DD).
  releaseAt: z
    .string()
    .min(10)
    .max(35)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /**
   * Drip relativo: módulo só fica acessível N dias após a matrícula do
   * aluno no curso. Se ambos releaseAt e releaseAfterEnrollmentDays são
   * passados, o aluno só vê quando AMBOS forem satisfeitos (lock mais
   * tardio vence). 1-365 dias.
   */
  releaseAfterEnrollmentDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .nullable(),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema.partial();
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

// ---- Lesson writes ----

export const createLessonSchema = z.object({
  title: z.string().min(2, 'Título muito curto').max(200),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  videoUrl: z.string().url('URL inválida').or(z.literal('')).optional(),
  description: z.string().max(4000).optional(),
  isMandatory: z.boolean().default(true),
  order: z.number().int().min(1).max(500),
  /**
   * Se true, esta aula é exibida como preview livre para visitantes não
   * matriculados. Útil como teaser de marketing.
   */
  isPreview: z.boolean().default(false).optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = createLessonSchema.partial();
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// ---- Student writes ----

export const studentStatusEnum = z.enum(['ativo', 'em_risco', 'bloqueado', 'inativo']);

export const createStudentSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(120),
  email: z.string().email('E-mail inválido'),
  weeklyGoalMinutes: z.number().int().min(15).max(2400).default(180),
  status: studentStatusEnum.default('ativo'),
  enrolledCourseIds: z.array(z.string().max(40)).max(50).default([]),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  weeklyGoalMinutes: z.number().int().min(15).max(2400).optional(),
  status: studentStatusEnum.optional(),
  enrolledCourseIds: z.array(z.string().max(40)).max(50).optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ---- Assessment writes ----

export const createAssessmentSchema = z.object({
  title: z.string().min(2, 'Título muito curto').max(200),
  questionCount: z.number().int().min(1).max(200).default(10),
  passingScore: z.number().int().min(0).max(100).default(70),
  timeLimitMinutes: z.number().int().min(1).max(600).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = createAssessmentSchema.partial();
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

// ---- System Users (login + RBAC) ----

export const createSystemUserSchema = z.object({
  email: z.string().email('E-mail inválido').max(160),
  name: z.string().min(2, 'Nome muito curto').max(120),
  role: roleSchema,
  /**
   * Slug de role customizada (opcional). Hoje é metadado/documentação.
   * Quando RBAC dinâmico for ativado, vira a fonte da verdade pra autorização.
   */
  customRoleSlug: z.string().min(1).max(40).nullable().optional(),
  password: z
    .string()
    .min(8, 'Senha precisa ter ao menos 8 caracteres')
    .max(128, 'Senha muito longa'),
  active: z.boolean().default(true),
});
export type CreateSystemUserInput = z.infer<typeof createSystemUserSchema>;

export const updateSystemUserSchema = z.object({
  email: z.string().email().max(160).optional(),
  name: z.string().min(2).max(120).optional(),
  role: roleSchema.optional(),
  customRoleSlug: z.string().min(1).max(40).nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateSystemUserInput = z.infer<typeof updateSystemUserSchema>;

export const changePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Senha precisa ter ao menos 8 caracteres')
    .max(128, 'Senha muito longa'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Filters
export const studentsFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['todos', 'ativo', 'em_risco', 'bloqueado', 'inativo']).optional(),
  courseId: z.string().optional(),
  sortBy: z.enum(['name', 'risk', 'lastAccess']).optional(),
});
export type StudentsFilter = z.infer<typeof studentsFilterSchema>;
