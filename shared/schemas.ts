import { z } from 'zod';

// Reutilizáveis
export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().date());

// Auth / User
export const roleSchema = z.enum(['student', 'admin', 'superadmin']);

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha precisa ter ao menos 8 caracteres'),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

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

// Profile
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(80, 'Nome muito longo'),
  email: z.string().email('E-mail inválido'),
  weeklyGoalMinutes: z
    .number({ message: 'Meta semanal precisa ser um número' })
    .int()
    .min(15, 'Meta mínima de 15 min')
    .max(2400, 'Meta máxima de 40h'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

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

// Filters
export const studentsFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['todos', 'ativo', 'em_risco', 'bloqueado', 'inativo']).optional(),
  courseId: z.string().optional(),
  sortBy: z.enum(['name', 'risk', 'lastAccess']).optional(),
});
export type StudentsFilter = z.infer<typeof studentsFilterSchema>;
