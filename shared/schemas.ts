import { z } from 'zod';
import { metodoPagamentoSchema } from './metodos-pagamento';

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
  avatarUrl: z.string().max(500, 'URL muito longa').nullable().optional(),
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
  subject: z.string().min(4, 'Assunto muito curto').max(120, 'Assunto muito longo'),
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
  /** Sandra — emite a cobrança no gateway da própria escola. */
  'sandra',
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
/**
 * Checkout de dentro do app (aluno logado).
 *
 * Nasceu com três campos, e por isso mandava ao gateway **só o e-mail**: o
 * Pagar.me recebia `name` derivado de `email.split('@')[0]` e nenhum documento,
 * e recusava a cobrança. O checkout público, logo abaixo, sempre pediu nome,
 * CPF e telefone — duas rotas de compra com contratos diferentes, e só uma
 * funcionava.
 *
 * Os campos são opcionais **aqui** de propósito: quem exige documento é o
 * provider (a Sandra sempre exigiu, o Pagar.me passou a exigir com boleto), e
 * marcá-los obrigatórios no schema quebraria as chamadas que já existem.
 */
export const checkoutSchema = z.object({
  productId: z.string().min(1),
  /**
   * Pix, boleto ou cartão. **Opcional**, e o motivo importa: o checkout antigo
   * não mandava método nenhum e cada gateway decidia sozinho. Ausente, tudo
   * segue como era; presente, ele decide qual gateway cobra — ver
   * `server/payments/roteamento.ts`.
   */
  metodo: metodoPagamentoSchema.optional(),
  gatewayId: z.string().min(1).optional(), // se omitido, usa o roteamento
  couponCode: z.string().max(40).optional(),
  /** Nome de quem compra. Sem ele o gateway inventa um a partir do e-mail. */
  name: z.string().min(2).max(120).optional(),
  /** CPF/CNPJ. Obrigatório para boleto; validado por `shared/documento.ts`. */
  document: z.string().max(20).optional().or(z.literal('')),
  whatsapp: z.string().max(30).optional().or(z.literal('')),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Checkout PÚBLICO (visitante não logado). Provisiona a conta pelo e-mail e
 * cria o pedido no gateway. Usado pelo site público de vendas.
 */
export const publicCheckoutSchema = z
  .object({
    /** Compra de um curso só. Continua valendo — o site usava só isto. */
    courseSlug: z.string().min(1).max(120).optional(),
    /**
     * Carrinho: vários cursos num pedido só.
     *
     * O modelo de pedido tem UM produto (`productId` é coluna, não tabela de
     * itens). Em vez de mexer na tabela do dinheiro, o servidor materializa um
     * produto `kind: 'bundle'` inativo com os `courseIds` do carrinho — e
     * `grantAccessForOrder` já matricula em todos os cursos de um pacote. É
     * caminho existente e testado, não invenção nova.
     */
    courseSlugs: z.array(z.string().min(1).max(120)).min(1).max(20).optional(),
    name: z.string().min(2).max(120),
    email: z.string().email().max(160),
    /** CPF/CNPJ (opcional; alguns gateways exigem). */
    document: z.string().max(20).optional().or(z.literal('')),
    whatsapp: z.string().max(30).optional().or(z.literal('')),
    gatewayId: z.string().min(1).optional(),
    /** Pix, boleto ou cartão. Ver a nota em `checkoutSchema`. */
    metodo: metodoPagamentoSchema.optional(),
    couponCode: z.string().max(40).optional(),
    /**
     * De onde a pessoa veio, capturado pelo navegador na primeira visita.
     *
     * Chega do cliente e por isso **não decide nada** — não muda preço, não
     * libera acesso, não escolhe gateway. Serve para responder "que campanha
     * converteu", e é gravado como veio, limitado em tamanho. O servidor não
     * confia nele para mais que isso.
     */
    origem: z
      .object({
        utm_source: z.string().max(300).optional(),
        utm_medium: z.string().max(300).optional(),
        utm_campaign: z.string().max(300).optional(),
        utm_content: z.string().max(300).optional(),
        utm_term: z.string().max(300).optional(),
        utm_id: z.string().max(300).optional(),
        gclid: z.string().max(300).optional(),
        fbclid: z.string().max(300).optional(),
        referrer: z.string().max(300).optional(),
      })
      .optional(),
    /** Consentimento LGPD obrigatório. */
    consent: z.literal(true),
  })
  .refine((d) => Boolean(d.courseSlug) || (d.courseSlugs?.length ?? 0) > 0, {
    message: 'Informe courseSlug ou courseSlugs.',
    path: ['courseSlug'],
  });
export type PublicCheckoutInput = z.infer<typeof publicCheckoutSchema>;

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

/**
 * Os módulos de IA configuráveis. **Esta lista tem de casar com o `aiModuleEnum`
 * de `server/db/schema.ts`** — e não casava.
 *
 * Até 3/set/2026 o banco declarava oito e este schema seis: `grading` e
 * `question_generation` existiam como coluna e como tipo interno, mas não no
 * schema que valida a escrita de configuração nem na tela `/admin/ias`. Não
 * havia caminho para ligar a correção por IA — e, como `gradeOpenEndedWithAi`
 * devolvia `null`, **toda resposta dissertativa era marcada errada**, valia 0 e
 * ainda somava 100 ao denominador do quiz. Um aluno que acertasse tudo podia
 * ler "0% — quase lá, refaça pra fixar".
 */
export const aiModuleSchema = z.enum([
  'tutor',
  'recovery_plan',
  'evasion',
  'recommendations',
  'support',
  'summaries',
  'grading',
  'question_generation',
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

/**
 * Corpo do estorno pelo admin.
 *
 * Era a **única mutação financeira da casa sem validação Zod**: `amountCents` e
 * `reason` iam do JSON do cliente direto para o provider, sem teto e sem tipo.
 * Um valor maior que o pedido, ou negativo, ou uma string, chegavam ao gateway.
 */
export const refundOrderSchema = z.object({
  /** Ausente = estorno total. Presente = parcial, e nunca maior que o pedido. */
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export const createCourseSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug aceita apenas letras minúsculas, números e hífens'),
  shortTitle: z.string().min(1).max(60),
  description: z.string().max(2000).optional(),
  totalHours: z.number().int().min(0).max(10000).default(0),
  certificateAvailable: z.boolean().default(true),
  coverColor: z.string().max(120).optional(),
  active: z.boolean().default(true),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

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
  /** URL absoluta ou relativa (/uploads/...) da imagem de capa. Vazia = remove. */
  coverImageUrl: z.string().max(500).optional().or(z.literal('')),
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
   * Changelog visível ao aluno: histórico de atualizações do curso.
   * Cada entry tem versão (livre), data, descrição. Visível em
   * "Novidades neste curso" no LMSCourse.
   */
  changelog: z
    .array(
      z.object({
        version: z.string().min(1).max(40),
        date: z.string().min(8).max(35),
        notes: z.string().min(1).max(2000),
      }),
    )
    .max(50)
    .optional(),
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
  /**
   * Por quantos meses a matrícula dá acesso ao curso. Ex.: 6 na Hipnoterapia,
   * 16 na Psicanálise Clínica. Expirado, o aluno para de estudar até comprar
   * extensão — o progresso e o histórico continuam guardados.
   *
   * `0`, `null` ou ausente = acesso vitalício. Nenhum curso passa a expirar só
   * porque o campo existe: é preciso declarar o prazo.
   *
   * O prazo vale para matrículas NOVAS. Quem já está matriculado tem a data de
   * fim gravada na própria matrícula, então mudar a política aqui não encurta
   * nem estende o acesso de quem já comprou.
   */
  accessMonths: z.number().int().min(0).max(600).nullable().optional(),
  // ---- Campos da PÁGINA PÚBLICA de vendas (site público SSR) ----
  /**
   * Curso aparece no site público (catálogo, página de venda, sitemap)?
   *
   * Separado de `active`, que governa o acesso do ALUNO no LMS. Antes as duas
   * coisas eram a mesma flag, então tirar um curso da vitrine cortava o acesso
   * de quem já estava matriculado — o que travava, por exemplo, despublicar o
   * treinamento interno de equipe sem derrubar as 19 matrículas dele.
   *
   * Ausente = `true`: curso que nunca tocou nesse campo continua visível, como
   * sempre esteve. Só `false` explícito esconde.
   */
  publicListed: z.boolean().optional(),
  /** Selo curto no hero, ex.: "Curso principal", "Complementar". */
  badge: z.string().max(40).optional().or(z.literal('')),
  /** Frase de efeito abaixo do título na página pública. */
  tagline: z.string().max(200).optional().or(z.literal('')),
  /** Resumo answer-first (TL;DR) — alimenta GEO/IA e a meta description. */
  tldr: z.string().max(600).optional().or(z.literal('')),
  /** Nível exibido, ex.: "Formação profissional". */
  level: z.string().max(60).optional().or(z.literal('')),
  /** Idioma do conteúdo (BCP-47), default pt-BR. */
  language: z.string().max(12).optional().or(z.literal('')),
  /** Duração mínima/máxima de acesso, em meses (exibido na página). */
  monthsMin: z.number().int().min(0).max(120).optional(),
  monthsMax: z.number().int().min(0).max(120).optional(),
  /** "Para quem é" — bullets exibidos na página pública. */
  forWhom: z.array(z.string().min(2).max(200)).max(20).optional(),
  /** FAQ da página pública (alimenta FAQPage JSON-LD). */
  faqs: z
    .array(z.object({ q: z.string().min(2).max(300), a: z.string().min(2).max(2000) }))
    .max(30)
    .optional(),
  /** Ementa resumida por módulo (número, título, descrição). */
  curriculum: z
    .array(
      z.object({
        n: z.string().max(6).optional(),
        title: z.string().min(1).max(200),
        desc: z.string().max(500).optional(),
      }),
    )
    .max(60)
    .optional(),
  /**
   * ---- Blocos longos da página de venda (changelog de design, item 8) ----
   *
   * Vieram do protótipo aprovado (`docs/design/pages/Curso.dc.html`), onde a
   * página do curso deixou de ser ementa + preço e passou a ter argumento de
   * venda. São opcionais: curso que não preencher continua com a página curta,
   * sem buraco na tela — cada bloco só aparece se tiver conteúdo.
   */
  /** Três cartões de destaque, cada um com a nota de asterisco embaixo. */
  highlights: z
    .array(
      z.object({
        title: z.string().min(2).max(300),
        note: z.string().max(600).optional(),
      }),
    )
    .max(10)
    .optional(),
  /** Seções longas de venda: título, subtítulo, parágrafos e par de CTAs. */
  sections: z
    .array(
      z.object({
        title: z.string().min(2).max(300),
        subtitle: z.string().max(300).optional(),
        paras: z.array(z.string().min(1).max(4000)).max(20),
        /** Fecha a seção com "QUERO ME MATRICULAR" + WhatsApp. */
        cta: z.boolean().optional(),
      }),
    )
    .max(20)
    .optional(),
  /** A jornada em etapas (título, subtítulo, texto). */
  jornada: z
    .array(
      z.object({
        title: z.string().min(2).max(200),
        subtitle: z.string().max(200).optional(),
        text: z.string().max(2000),
      }),
    )
    .max(10)
    .optional(),
  /**
   * Regulamento da promoção, em letra miúda, antes do aviso de formação livre.
   * Texto jurídico: entra verbatim, nunca reescrito.
   */
  promoNote: z.string().max(4000).optional().or(z.literal('')),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

/**
 * Reordenação em massa de módulos e aulas de um curso.
 * Lista de módulos na nova ordem; cada um traz as lessonIds na nova ordem.
 * Permite mover aulas entre módulos (lessonId pode estar em qualquer módulo).
 */
export const reorderCourseSchema = z.object({
  modules: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        lessonIds: z.array(z.string().min(1).max(120)).max(500),
      }),
    )
    .min(1)
    .max(200),
});
export type ReorderCourseInput = z.infer<typeof reorderCourseSchema>;

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
  audioUrl: z.string().url('URL inválida').or(z.literal('')).optional(),
  /*
    Transcrição. O teto é generoso de propósito: uma hora de fala dá algo em
    torno de 60 mil caracteres, e cortar no meio produziria transcrição
    truncada — que é pior do que nenhuma, porque parece completa.
  */
  transcript: z.string().max(200_000).optional(),
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
  releaseAfterEnrollmentDays: z.number().int().min(1).max(365).optional().nullable(),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema.partial();
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

// ---- Lesson writes ----

/**
 * Idiomas suportados pra transcrição de video-aulas.
 * Português é o nativo; espanhol e inglês adicionais.
 * Extensível adicionando novos códigos ISO 639-1 aqui.
 */
export const SUPPORTED_TRANSCRIPT_LOCALES = ['pt', 'es', 'en'] as const;
export type TranscriptLocale = (typeof SUPPORTED_TRANSCRIPT_LOCALES)[number];

export const TRANSCRIPT_LOCALE_LABELS: Record<TranscriptLocale, string> = {
  pt: 'Português',
  es: 'Español',
  en: 'English',
};

export const createLessonSchema = z.object({
  title: z.string().min(2, 'Título muito curto').max(200),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  videoUrl: z.string().url('URL inválida').or(z.literal('')).optional(),
  description: z.string().max(4000).optional(),
  /** Conteúdo HTML completo da aula (rich text, áudios embed, materiais). */
  content: z.string().max(200_000).optional(),
  isMandatory: z.boolean().default(true),
  order: z.number().int().min(1).max(500),
  /**
   * Se true, esta aula é exibida como preview livre para visitantes não
   * matriculados. Útil como teaser de marketing.
   */
  isPreview: z.boolean().default(false).optional(),
  /**
   * Transcrições da video-aula por idioma (ISO 639-1). Admin habilita
   * idioma a idioma; aluno escolhe qual ver entre os configurados.
   * Idiomas com string vazia são tratados como não-configurados.
   * Limite por idioma: 100k chars (~50 páginas).
   */
  transcripts: z
    .object({
      pt: z.string().max(100_000).optional(),
      es: z.string().max(100_000).optional(),
      en: z.string().max(100_000).optional(),
    })
    .partial()
    .optional(),
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

/**
 * Extensão de acesso a um curso. Exatamente uma das três formas:
 * `months` soma ao prazo, `until` crava a data, `lifetime` isenta do prazo.
 */
export const extendCourseAccessSchema = z
  .object({
    months: z.number().int().min(1).max(600).optional(),
    until: z.string().datetime({ offset: true }).optional(),
    lifetime: z.literal(true).optional(),
  })
  .refine(
    (v) =>
      [v.months !== undefined, v.until !== undefined, v.lifetime === true].filter(Boolean)
        .length === 1,
    { message: 'Informe exatamente um: months, until ou lifetime.' },
  );
export type ExtendCourseAccessInput = z.infer<typeof extendCourseAccessSchema>;

/**
 * Disparo de convites de primeiro acesso. `simular` devolve a lista sem enviar
 * nada — é o que a tela usa para mostrar quem receberia antes de o admin
 * confirmar.
 */
export const enviarConvitesSchema = z.object({
  /** Quantos por chamada. Baixo de propósito: a tela repete e mostra progresso. */
  limite: z.number().int().min(1).max(100).default(25),
  diasValidade: z.number().int().min(1).max(90).default(7),
  simular: z.boolean().default(false),
  /** Restringe a pessoas específicas; ausente = todos os elegíveis. */
  somenteIds: z.array(z.string().min(1)).max(500).optional(),
});
export type EnviarConvitesInput = z.infer<typeof enviarConvitesSchema>;

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

// ---------- Sessões: análise, supervisão e orientação ----------
//
// Serviços OPCIONAIS, contratados à parte. Torná-los obrigatórios seria venda
// casada — vedada pelo art. 39, I, do CDC. Ver `server/sessions/regra-opcional.ts`.

export const sessionServiceTypeSchema = z.enum(['analise', 'supervisao', 'orientacao']);

export const createSessionServiceSchema = z.object({
  name: z.string().min(3, 'Nome muito curto').max(120),
  type: sessionServiceTypeSchema,
  description: z.string().max(600).default(''),
  durationMinutes: z.number().int().min(10).max(240).default(50),
  price: z.number().int().min(0).max(1_000_000).default(0),
  active: z.boolean().default(true),
  paymentBeforeConfirmation: z.boolean().default(true),
});
export const updateSessionServiceSchema = createSessionServiceSchema.partial();
export type CreateSessionServiceInput = z.infer<typeof createSessionServiceSchema>;

export const createProfessionalSchema = z.object({
  name: z.string().min(3, 'Nome muito curto').max(120),
  email: z.string().email('E-mail inválido'),
  bio: z.string().max(1200).default(''),
  credentials: z.string().max(300).default(''),
  // A titulação define o preço da sessão — ver `session_price_tiers`.
  level: z.string().min(1).max(40).default('escola'),
  avatarColor: z.string().max(120).default('from-pco-blue to-pco-cyan'),
  hourlyRate: z.number().int().min(0).max(1_000_000).default(0),
  specialties: z.array(z.string().max(60)).max(20).default([]),
  serviceIds: z.array(z.string().max(80)).max(20).default([]),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});
export const updateProfessionalSchema = createProfessionalSchema.partial();
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;

export const upsertPriceTierSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(2).max(80),
  description: z.string().max(300).default(''),
  priceCents: z.number().int().min(0).max(10_000_000),
  active: z.boolean().default(true),
  order: z.number().int().min(0).max(99).default(0),
});
export type UpsertPriceTierInput = z.infer<typeof upsertPriceTierSchema>;

// Agendamento de sessão. Continua valendo o de sempre: serviço opcional,
// contratado à parte, nunca requisito de curso.

export const bookingStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'scheduled',
  'done',
  'cancelled',
]);

export const createBookingSchema = z.object({
  serviceId: z.string().min(1).max(80),
  professionalId: z.string().min(1).max(80),
  /** Início da sessão, ISO-8601. Validado como data real, não como string. */
  scheduledFor: z
    .string()
    .min(10)
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data/hora inválida'),
  notes: z.string().max(600).default(''),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Remarcação: só a data muda. Trocar de profissional é agendar outra coisa. */
export const rescheduleBookingSchema = z.object({
  scheduledFor: z
    .string()
    .min(10)
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data/hora inválida'),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(400).default(''),
});

/** O que o admin pode mexer depois: status, link da reunião e observações. */
export const updateBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  meetingLink: z.string().max(500).optional(),
  notes: z.string().max(600).optional(),
});
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

// ---------- Analytics próprio ----------

/**
 * O sinal que o navegador manda a cada página aberta.
 *
 * `sessionId` é gerado no `sessionStorage` da aba e nunca é persistido pelo
 * servidor — serve só para o processo saber que duas páginas são a mesma
 * visita. Não há campo para IP, e não deve haver: o dia em que este schema
 * aceitar identificador de pessoa, a medição deixa de dispensar consentimento.
 */
export const analyticsHitSchema = z.object({
  sessionId: z.string().min(8).max(64),
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).default(''),
  utmMedium: z.string().max(80).default(''),
  /** A rota caiu no 404 do SPA. */
  notFound: z.boolean().default(false),
  /** Largest Contentful Paint em ms, medido pelo navegador. Só na 1ª página. */
  lcpMs: z.number().int().min(0).max(120_000).optional(),
  /**
   * Sinal só de desempenho: registra o LCP e **não** conta página vista.
   *
   * Existe porque o LCP só é conhecido um tempo depois do carregamento, e
   * esperar por ele para contar a visita perdia justamente quem sai rápido —
   * ou seja, as rejeições. Contar a página na hora e o desempenho depois é o
   * que mantém a taxa de rejeição honesta.
   */
  apenasVitals: z.boolean().default(false),
});
export type AnalyticsHitInput = z.infer<typeof analyticsHitSchema>;

// ---------- Tags de marketing (Google, Meta, verificação de propriedade) ----------

/**
 * Só IDENTIFICADOR entra — nunca script.
 *
 * O campo "cole aqui o código do Google" seria um buraco de XSS com aparência de
 * recurso: admin comprometido passaria a executar JavaScript arbitrário em toda
 * página, para todo visitante. Aqui cada campo aceita o formato do provedor e
 * mais nada; quem monta o trecho é o servidor.
 *
 * String vazia é o jeito de LIMPAR um campo — daí o `.or(z.literal(''))` em vez
 * de `.optional()`.
 */
const idOuVazio = (regex: RegExp, exemplo: string) =>
  z
    .string()
    .trim()
    .regex(regex, `formato inválido — esperado algo como ${exemplo}`)
    .or(z.literal(''));

export const marketingTagsSchema = z.object({
  gtmId: idOuVazio(/^GTM-[A-Z0-9]{4,12}$/, 'GTM-ABC1234'),
  ga4Id: idOuVazio(/^G-[A-Z0-9]{6,14}$/, 'G-ABCDE12345'),
  metaPixelId: idOuVazio(/^[0-9]{8,24}$/, '1234567890123456'),
  googleSiteVerification: idOuVazio(/^[A-Za-z0-9_-]{20,120}$/, 'o conteúdo da meta tag'),
  facebookDomainVerification: idOuVazio(/^[A-Za-z0-9]{16,80}$/, 'o conteúdo da meta tag'),
  /**
   * Token da API de Conversões do Meta. Diferente dos outros campos, é
   * credencial — vem em texto livre porque o formato é do Meta, e é cifrado
   * antes de tocar o disco.
   */
  metaCapiToken: z.string().max(600).or(z.literal('')),
  enviarConversaoServidor: z.boolean(),
  exigirConsentimento: z.boolean(),
  ativo: z.boolean(),
});
export type MarketingTagsInput = z.infer<typeof marketingTagsSchema>;

export const updateMarketingTagsSchema = marketingTagsSchema.partial();

// ---------- Pedidos: CRUD do admin ----------

/**
 * O que o admin pode escrever num pedido.
 *
 * De fora ficam os campos que o gateway escreve (`externalId`, `checkoutUrl`,
 * `qrCode`): deixar o admin digitá-los criaria pedido apontando para cobrança
 * que não existe. Editar é para corrigir o que veio torto do histórico ou
 * registrar o que aconteceu fora do sistema — não para forjar cobrança.
 */
export const orderStatusSchema = z.enum([
  'pending',
  'processing',
  'paid',
  'failed',
  'canceled',
  'refunded',
]);

export const atribuicaoSchema = z.object({
  tipoOrigem: z.string().max(300).optional(),
  origem: z.string().max(300).optional(),
  meio: z.string().max(300).optional(),
  campanha: z.string().max(300).optional(),
  conteudo: z.string().max(300).optional(),
  termo: z.string().max(300).optional(),
  idCampanha: z.string().max(300).optional(),
  referrer: z.string().max(300).optional(),
  dispositivo: z.string().max(300).optional(),
  entrada: z.string().max(300).optional(),
  gclid: z.string().max(300).optional(),
  fbclid: z.string().max(300).optional(),
});

export const adminCreateOrderSchema = z.object({
  userEmail: z.string().email().max(160),
  /** Produto do catálogo. Sem ele, `productName` e `amountCents` descrevem a venda. */
  productId: z.string().max(120).optional(),
  productName: z.string().min(2).max(200).optional(),
  /** Curso a que este pedido se refere, quando houver. */
  refId: z.string().max(120).optional().nullable(),
  amountCents: z.number().int().min(0).max(100_000_00),
  currency: z.string().length(3).default('BRL'),
  status: orderStatusSchema.default('pending'),
  attribution: atribuicaoSchema.optional().nullable(),
  nota: z.string().max(400).optional(),
});
export type AdminCreateOrderInput = z.infer<typeof adminCreateOrderSchema>;

export const adminUpdateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  amountCents: z.number().int().min(0).max(100_000_00).optional(),
  currency: z.string().length(3).optional(),
  userEmail: z.string().email().max(160).optional(),
  productName: z.string().min(2).max(200).optional(),
  refId: z.string().max(120).optional().nullable(),
  attribution: atribuicaoSchema.optional().nullable(),
  paidAt: z.string().max(40).optional().nullable(),
  nota: z.string().max(400).optional(),
});
export type AdminUpdateOrderInput = z.infer<typeof adminUpdateOrderSchema>;
