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

/**
 * Situacao da matricula, separada do prazo de acesso.
 *
 * `ativa`     — o normal.
 * `suspensa`  — pagamento pendurado (boleto em atraso, pedido em espera). O
 *               acesso para, a matricula e o progresso ficam. Volta sozinha
 *               quando o pedido e quitado.
 * `cancelada` — estorno ou desistencia. A compra foi desfeita; o registro
 *               permanece porque o historico do aluno vale mais que a linha
 *               limpa.
 */
export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'ativa',
  'suspensa',
  'cancelada',
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
  'question_generation',
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
    /**
     * Credencial e segurança da conta. Até 19/ago/2026 isso vivia só em
     * `data/users.json`, separado da pessoa — quem entrava por um caminho que
     * escrevia apenas no banco aparecia no admin com matrícula e não conseguia
     * fazer login. Estas colunas existem para acabar com as duas fontes.
     *
     * `password_hash` é nulo enquanto a conta não tiver senha definida: é o
     * caso de quem veio da importação e precisa passar pelo "esqueci minha
     * senha" para entrar a primeira vez.
     */
    passwordHash: text('password_hash'),
    tokenVersion: integer('token_version').notNull().default(0),
    active: boolean('active').notNull().default(true),
    customRoleSlug: text('custom_role_slug'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    document: text('document'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    totpSecretEncrypted: text('totp_secret_encrypted'),
    /** Hashes sha256 dos códigos de backup do 2FA — nunca os códigos em claro. */
    totpBackupCodes: jsonb('totp_backup_codes').$type<string[]>(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

// ---------- Tokens de redefinição de senha ----------

/**
 * Vive no banco porque o convite inicial de 1.600 alunos não pode depender de o
 * processo não reiniciar: até 19/ago/2026 estes tokens moravam num Map em
 * memória, e qualquer deploy invalidava todos os links já enviados — o aluno
 * clicava e via "token inválido", sem ninguém entender por quê.
 *
 * `used_at` marca consumo em vez de apagar a linha: um link reutilizado precisa
 * ser distinguível de um link que nunca existiu quando alguém for investigar.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('password_reset_tokens_user_idx').on(t.userId),
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
  /**
   * Papel que a pessoa tinha no WordPress de origem: `aluno`, `desistente`,
   * `inadimplente`, `reembolsado`, `inativo`, `customer`…
   *
   * A migração jogou todo mundo em `status='ativo'` e perdeu essa distinção —
   * que é justamente a que decide quem deve ser convidado para o ambiente novo e
   * quem não deve. Fica em coluna própria em vez de virar `status` para não
   * mudar, de repente, o comportamento de telas e contagens que já existem: aqui
   * é registro do que a origem dizia, não julgamento sobre o acesso de hoje.
   */
  sourceRole: text('source_role'),
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
  // Campos ricos do curso que não têm coluna própria: tags, learningOutcomes,
  // instrutor, capa, certificateTemplate, colaboradores, changelog e os campos
  // da página pública (badge, tagline, tldr, forWhom, faqs, curriculum, ...).
  // Antes desta coluna eles existiam só no JsonStore: com DATABASE_URL setado o
  // repositório os descartava em silêncio no update e nunca os devolvia na
  // leitura, então em produção a edição do admin não persistia e a página
  // pública saía sem as seções ricas. Mesmo padrão de JSONB polimórfico já
  // usado em library/news/podcasts.
  meta: jsonb('meta').$type<Record<string, unknown>>(),
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
    /**
     * Drip relativo: o modulo so abre N dias APOS a matricula daquele aluno.
     *
     * Existia em `createModuleSchema`, no editor do admin, no tipo do produto e
     * no motor de liberacao (`repositories/drip.ts`) — e **nao tinha coluna**
     * ate 3/set/2026. O caminho JSON gravava; o caminho de banco, que e
     * producao, descartava no insert, descartava no update e nao devolvia na
     * leitura. O admin marcava "liberar 30 dias apos a matricula", o formulario
     * confirmava com 200, e o modulo ficava disponivel na hora, para todos.
     *
     * Quarto caso do mesmo padrao (`content`, `isPreview`, `transcripts` foram
     * os tres anteriores) e o primeiro que falha **abrindo** conteudo em vez de
     * fechando. `test/schema-cabe-no-banco.test.ts` existe para nao haver
     * quinto.
     */
    releaseAfterEnrollmentDays: integer('release_after_enrollment_days'),
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
    /**
     * Conteúdo HTML completo da aula.
     *
     * Faltava esta coluna, e a falta tinha consequência visível: a importação
     * capturou o conteúdo inteiro de 522 aulas, mas só a `description` — cortada
     * em 500 caracteres — tinha onde pousar. Produção lê do Postgres, então o
     * aluno lia meia frase enquanto o texto completo dormia num arquivo no
     * servidor. `LMSLesson` já sabe renderizar isto; era só o banco que não
     * sabia guardar.
     */
    content: text('content'),
    isMandatory: boolean('is_mandatory').notNull().default(true),
    /**
     * Aula liberada como teaser: qualquer visitante vê o vídeo sem matrícula.
     *
     * A coluna faltava, e a falta era silenciosa nos dois sentidos. O editor do
     * admin sempre teve a caixa "aula de demonstração", e o caminho de banco
     * descartava o campo ao gravar; a leitura devolvia sempre `undefined`.
     * Resultado em produção: marcar a caixa não fazia nada, `/lessons/:id/preview`
     * respondia 403 para toda aula, e o selo "tem aula grátis" do catálogo nunca
     * aparecia. Quem administra não tinha como perceber — o formulário salvava
     * sem erro.
     */
    isPreview: boolean('is_preview').notNull().default(false),
    /**
     * Transcrição por idioma (`{ pt, es, en }`), do mesmo jeito que o editor
     * do admin já pedia.
     *
     * Faltava a coluna, com a mesma consequência silenciosa do `is_preview`:
     * o painel de transcrição do editor — três idiomas, com botão de copiar de
     * um para outro — salvava sem erro e o texto se perdia no caminho do banco.
     * As duas rotas que a servem (`/lessons/:id/transcript` e o download)
     * respondiam `NO_TRANSCRIPT` para toda aula, porque em produção nenhuma
     * aula jamais teve transcrição gravada.
     */
    transcripts: jsonb('transcripts').$type<Record<string, string | undefined>>(),
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
    /**
     * Fim do acesso desta matrícula. NULL = vitalício (ou prazo ainda não
     * aplicado). Gravado na matrícula, não derivado na leitura, para que mudar
     * `accessMonths` do curso não encurte o acesso de quem já comprou — e para
     * que estender por compra seja um UPDATE nesta linha.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /**
     * Situacao da matricula — ver `enrollmentStatusEnum`. Nao confundir com
     * `expiresAt`: prazo vencido e uma coisa, pagamento desfeito e outra.
     */
    status: enrollmentStatusEnum('status').notNull().default('ativa'),
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
  tags: jsonb('tags')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  coverColor: text('cover_color').notNull(),
  authorName: text('author_name').notNull(),
  publishedAt: text('published_at').notNull(),
  featured: boolean('featured').notNull().default(false),
  relatedCourseIds: jsonb('related_course_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
});

export const podcasts = pgTable('podcasts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  publishedAt: text('published_at').notNull(),
  coverColor: text('cover_color').notNull(),
  audioUrl: text('audio_url'),
  /**
   * Transcrição do episódio, em texto puro. `null` = não transcrito.
   *
   * Conteúdo só-áudio sem alternativa textual não tem via de acesso nenhuma
   * para quem é surdo. `description` não serve: é o resumo do card, limitado a
   * 2000 caracteres pelo schema — um episódio de 40 min não cabe ali.
   */
  transcript: text('transcript'),
  tags: jsonb('tags')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  relatedCourseIds: jsonb('related_course_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  relatedModuleIds: jsonb('related_module_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
});

export const libraryItems = pgTable('library_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  type: text('type').notNull(), // 'pdf' | 'apostila' | 'leitura' | 'artigo'
  mandatory: boolean('mandatory').notNull().default(false),
  fileMockUrl: text('file_url').notNull(),
  tags: jsonb('tags')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  relatedCourseIds: jsonb('related_course_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  relatedModuleIds: jsonb('related_module_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
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
  reasons: jsonb('reasons')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
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
  specialties: jsonb('specialties')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  serviceIds: jsonb('service_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /**
   * Faixa de titulação. É ela que define o preço da sessão — não o serviço:
   * a mesma análise custa diferente conforme quem atende. Ver
   * `sessionPriceTiers`.
   */
  level: text('level').notNull().default('escola'),
  /** Fora do ar sem apagar: profissional que saiu não some do histórico. */
  active: boolean('active').notNull().default(true),
  /**
   * Aceitando agendamento agora. Separado de `active` porque agenda cheia é
   * estado do dia, não desligamento — e o aluno agenda com quem estiver
   * disponível no momento.
   */
  available: boolean('available').notNull().default(true),
  /** Titulação por extenso, para exibir ao aluno. */
  credentials: text('credentials').notNull().default(''),
});

/**
 * Preço da sessão por faixa de titulação.
 *
 * Tabela própria, e não uma coluna em `session_services`, porque o preço varia
 * com quem atende e não com o que é atendido: análise com profissional da
 * escola e análise com doutor são a mesma sessão a preços diferentes. Três
 * linhas que o admin edita num lugar só.
 */
export const sessionPriceTiers = pgTable('session_price_tiers', {
  /** Igual ao `professionals.level`. */
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull().default(0),
  active: boolean('active').notNull().default(true),
  order: integer('order').notNull().default(0),
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

/**
 * Agendamento de sessão.
 *
 * Guarda **cópia** do nome do serviço, do nome de quem atende e do preço no
 * instante do agendamento. Não é desnormalização por descuido: o admin edita
 * faixas de preço e serviços a qualquer momento, e o que foi combinado com o
 * aluno não pode mudar de valor depois. O `id` continua apontando para a
 * origem, para quem quiser navegar.
 */
export const sessionBookings = pgTable('session_bookings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  /** Cópia: o aluno pode trocar de e-mail sem reescrever o histórico. */
  userEmail: text('user_email').notNull().default(''),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull().default(''),
  professionalId: text('professional_id').notNull(),
  professionalName: text('professional_name').notNull().default(''),
  /** Início da sessão, ISO-8601 com fuso. */
  scheduledFor: text('scheduled_for').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(50),
  /** Preço travado no ato, em centavos. Ver o comentário da tabela. */
  priceCents: integer('price_cents').notNull().default(0),
  /** Faixa de titulação que produziu o preço. */
  tierId: text('tier_id').notNull().default(''),
  /** pending_payment | confirmed | scheduled | done | cancelled */
  status: text('status').notNull().default('pending_payment'),
  meetingLink: text('meeting_link').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  cancelledAt: text('cancelled_at'),
  cancelReason: text('cancel_reason').notNull().default(''),
  /**
   * Pedido que paga esta sessão, quando o serviço exige pagamento antes.
   * Guardado aqui para que o aluno possa retomar um pagamento pendente sem
   * gerar pedido novo a cada visita à tela.
   */
  orderId: text('order_id'),
});

/**
 * Pedido de compra.
 *
 * Viveu só em `data/payment-orders.json` até 26/ago/2026 — registro de dinheiro
 * fora do banco, sem backup transacional e sem consulta. A migração segue o
 * molde de `repositories/courses.ts`: lê do banco primeiro, cai no JSON quando
 * a tabela está vazia, e o caminho JSON não é apagado.
 *
 * `productSnapshot` e `events` são jsonb porque são exatamente isso — uma cópia
 * congelada e um log cronológico. Normalizá-los daria três tabelas para
 * responder à mesma pergunta.
 */
/**
 * Produtos à venda — o que define o PREÇO de um curso.
 *
 * Vieram para o banco em 31/ago/2026, pelo mesmo motivo dos pedidos: preço é
 * registro de dinheiro. Enquanto viveu só em `data/payment-products.json`,
 * ficou fora do backup transacional e sujeito a sumir junto com o arquivo — e a
 * partir de 31/ago é ele que decide quanto o aluno paga.
 */
export const paymentProducts = pgTable('payment_products', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  /** courseId quando kind=course; serviceId quando kind=session_pack. */
  refId: text('ref_id'),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('BRL'),
  active: boolean('active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const paymentOrders = pgTable('payment_orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull().default(''),
  productId: text('product_id').notNull(),
  productSnapshot: jsonb('product_snapshot')
    .$type<{
      name: string;
      priceCents: number;
      currency: string;
      kind: string;
      refId: string | null;
    }>()
    .notNull(),
  gatewayId: text('gateway_id').notNull(),
  gatewayProvider: text('gateway_provider').notNull(),
  /** ID do pagamento no gateway. */
  externalId: text('external_id'),
  /**
   * ID do **parcelamento** no gateway, quando a cobrança é um carnê.
   *
   * Cada parcela é uma cobrança com id próprio, e o pedido guarda o da
   * primeira. Sem este campo, o aviso de vencimento da parcela 3 não encontra
   * pedido nenhum e é ignorado — quem para de pagar no meio do carnê continua
   * estudando, e o AVA não fica sabendo. O Asaas devolve `installment` na
   * criação e o repete em todas as parcelas.
   */
  gatewayInstallmentId: text('gateway_installment_id'),
  status: text('status').notNull().default('pending'),
  /**
   * De onde veio a pessoa que comprou: origem, meio, campanha.
   *
   * Guardado no pedido, não no aluno, porque a pergunta que interessa é "que
   * campanha converteu esta venda" — e a mesma pessoa pode chegar por um
   * anúncio hoje e por busca orgânica no ano que vem. Preso ao aluno, o
   * segundo dado apagaria o primeiro.
   *
   * Nasceu do histórico: o WooCommerce guardava isso em
   * `_wc_order_attribution_*` e o AVA não guardava nada. Ver
   * `server/marketing/atribuicao.ts`.
   */
  attribution: jsonb('attribution').$type<{
    tipoOrigem?: string;
    origem?: string;
    meio?: string;
    campanha?: string;
    conteudo?: string;
    termo?: string;
    idCampanha?: string;
    referrer?: string;
    dispositivo?: string;
    entrada?: string;
    gclid?: string;
    fbclid?: string;
  }>(),
  /**
   * Pix, boleto ou cartão — o que a pessoa escolheu na nossa página.
   *
   * Nulo nos pedidos anteriores a 5/set/2026, quando o método não era um dado
   * nosso: cada gateway decidia sozinho, e o Asaas cobrava pix por padrão sem
   * ninguém ter escolhido. Nulo aqui quer dizer "não se sabe", que é diferente
   * de "cartão".
   *
   * É por ele que a busca por pedido pendente equivalente se orienta, e não
   * mais pelo gateway: com roteamento e fallback, o gateway do pedido pode
   * mudar entre a criação e a cobrança — o método, não.
   */
  metodo: text('metodo'),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: text('currency').notNull().default('BRL'),
  events: jsonb('events')
    .$type<Array<{ ts: string; status: string; note?: string }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  checkoutUrl: text('checkout_url'),
  qrCode: text('qr_code'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  paidAt: text('paid_at'),
});

/**
 * Cupom de desconto.
 *
 * `code` é único e vive em maiúsculas — quem digita não deve ser punido pelo
 * caps lock. O desconto vai em jsonb porque é uma união (`percent` ou
 * `amount`), e achatá-la em duas colunas nuláveis deixaria representável o
 * estado sem sentido de ter as duas ou nenhuma.
 */
export const paymentCoupons = pgTable('payment_coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  discount: jsonb('discount').$type<{ kind: string; value: number }>().notNull(),
  appliesToProductIds: jsonb('applies_to_product_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** null = ilimitado. */
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: text('valid_from'),
  validUntil: text('valid_until'),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** Banco de questões. `options` em jsonb: a alternativa só existe dentro da questão. */
export const questionBank = pgTable('question_bank', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  moduleId: text('module_id'),
  type: text('type').notNull(),
  prompt: text('prompt').notNull(),
  options: jsonb('options')
    .$type<Array<{ id: string; text: string; correct: boolean }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  expectedAnswer: text('expected_answer'),
  explanation: text('explanation'),
  tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  difficulty: integer('difficulty').notNull().default(3),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
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
  allowedScopes: jsonb('allowed_scopes')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  blockedTopics: jsonb('blocked_topics')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
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

// ---------- Analytics próprio (medição de tráfego) ----------

/**
 * Um dia de medição de tráfego. Só contadores: nenhuma coluna aqui identifica
 * pessoa — sem IP, sem cookie, sem user-agent, sem id de sessão. A chave é a
 * data, e a escrita é upsert (`onConflictDoUpdate`), porque o dia corrente é
 * reescrito a cada descarga do coletor.
 */
export const analyticsDaily = pgTable('analytics_daily', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  pageviews: integer('pageviews').notNull().default(0),
  sessions: integer('sessions').notNull().default(0),
  bounces: integer('bounces').notNull().default(0),
  totalSessionSeconds: integer('total_session_seconds').notNull().default(0),
  byPath: jsonb('by_path')
    .$type<Record<string, { views: number; entries: number; bounces: number; totalSeconds: number }>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  bySource: jsonb('by_source')
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  byDevice: jsonb('by_device')
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  lcpBuckets: jsonb('lcp_buckets').$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  lcpCount: integer('lcp_count').notNull().default(0),
  notFound: jsonb('not_found')
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: text('updated_at').notNull(),
});
