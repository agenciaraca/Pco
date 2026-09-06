// AVA PCO — Tipos centrais

export type ID = string;

export type Role = 'student' | 'admin' | 'superadmin';

export interface User {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  createdAt: string;
}

export interface Student extends User {
  role: 'student';
  enrolledCourseIds: ID[];
  lastAccessAt?: string;
  weeklyGoalMinutes: number;
  totalStudyMinutes: number;
  riskScore?: number; // 0-100
}

export type LessonStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'pending_assessment';

export interface Lesson {
  id: ID;
  moduleId: ID;
  courseId: ID;
  title: string;
  durationMinutes: number;
  videoUrl?: string;
  /** Texto curto/resumo (até 4000 chars). Aparece no listing e no topo da aula. */
  description?: string;
  /**
   * Conteúdo HTML completo da aula (texto, imagens, links, áudio embeds, PDFs).
   * Renderizado no corpo da página LMSLesson. Limite alto (até 200k chars).
   * Sanitizado no front antes de injetar.
   */
  content?: string;
  isMandatory: boolean;
  order: number;
  status?: LessonStatus;
  /** Aula liberada como preview livre pra visitantes não matriculados. */
  isPreview?: boolean;
  /**
   * Transcrições por idioma (ISO 639-1). Admin habilita idioma a idioma;
   * aluno escolhe qual ver entre os configurados.
   */
  transcripts?: {
    pt?: string;
    es?: string;
    en?: string;
  };
}

export interface Assessment {
  id: ID;
  moduleId: ID;
  courseId: ID;
  title: string;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes?: number;
  status?: 'pending' | 'passed' | 'failed' | 'available';
}

export interface Module {
  id: ID;
  courseId: ID;
  title: string;
  description?: string;
  order: number;
  releaseAt?: string;
  /**
   * Drip relativo: módulo libera N dias após a matrícula do aluno
   * no curso (se enrolledAt + N dias > now → locked).
   */
  releaseAfterEnrollmentDays?: number | null;
  /** Drip: true se releaseAt está no futuro. */
  locked?: boolean;
  /** ISO 8601 — quando o módulo será liberado (apenas se locked). */
  lockedUntil?: string;
  lessons: Lesson[];
  assessment?: Assessment;
  status?: LessonStatus;
}

export interface Course {
  id: ID;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  coverColor: string;
  modules: Module[];
  totalHours: number;
  certificateAvailable: boolean;
  tags?: string[];
  /** IDs de cursos que devem ser concluídos antes deste. */
  prerequisiteCourseIds?: ID[];
  /** Bullet points de "O que você vai aprender" (CoursePreview). */
  learningOutcomes?: string[];
  /** Instrutor/professor responsável pelo curso. */
  instructorName?: string;
  instructorBio?: string;
  instructorPhotoUrl?: string;
  /** Co-instrutores / equipe pedagógica adicional. */
  collaborators?: Array<{
    name: string;
    role?: string;
    bio?: string;
    photoUrl?: string;
  }>;
  /** Changelog visível pra aluno: novidades por versão. */
  changelog?: Array<{
    version: string;
    date: string;
    notes: string;
  }>;
  /**
   * Curso publicado (true) ou rascunho/despublicado (false).
   * Default em runtime: true (cursos antigos sem o campo são considerados publicados).
   */
  active?: boolean;
  /**
   * URL da imagem de capa do curso (featured image). Quando presente,
   * sobrepõe o coverColor (gradient) na renderização. URL relativa
   * (`/uploads/...`) ou absoluta.
   */
  coverImageUrl?: string;
  /** Customização opcional do certificado de conclusão. */
  certificateTemplate?: {
    title?: string;
    preamble?: string;
    bodyText?: string;
    accentColor?: string;
    ribbonColor?: string;
    orgName?: string;
    signatureName?: string;
    signatureRole?: string;
    logoUrl?: string;
  };

  /**
   * Meses de acesso que a matrícula concede. 0/null/ausente = vitalício.
   * Ver `server/access/course-access.ts`.
   */
  accessMonths?: number | null;
  // ---- Campos da página pública de vendas (/formacao/:slug, SSR) ----
  // Editáveis em /admin/cursos/:id → aba "Página pública". Alimentam também o
  // JSON-LD: `tldr` vira a meta description, `faqs` vira o bloco FAQPage.
  /**
   * Curso aparece no site público? Separado de `active`, que governa o acesso
   * do aluno no LMS. Ausente = visível. Ver `isPubliclyListed()` no servidor.
   */
  publicListed?: boolean;
  /** Selo curto no topo da página, ex.: "Curso principal". */
  badge?: string;
  /** Frase de efeito abaixo do título. */
  tagline?: string;
  /** Resumo answer-first — o primeiro texto que IA e busca leem. */
  tldr?: string;
  /** Nível exibido, ex.: "Formação profissional". */
  level?: string;
  /** Idioma do conteúdo (BCP-47). Default de exibição: pt-BR. */
  language?: string;
  /** Duração de acesso em meses (mínima e máxima). */
  monthsMin?: number;
  monthsMax?: number;
  /** "Para quem é" — bullets da página pública. */
  forWhom?: string[];
  /** Perguntas frequentes — vira FAQPage no JSON-LD. */
  faqs?: Array<{ q: string; a: string }>;
  /** Ementa resumida por módulo. */
  curriculum?: Array<{ n?: string; title: string; desc?: string }>;
  /** Cartões de destaque logo abaixo do topo; `note` é a letra miúda. */
  highlights?: Array<{ title: string; note?: string }>;
  /** Seções longas de venda; `cta` fecha a seção com o par de botões. */
  sections?: Array<{ title: string; subtitle?: string; paras: string[]; cta?: boolean }>;
  /** A jornada em etapas, na ordem em que o aluno a vive. */
  jornada?: Array<{ title: string; subtitle?: string; text: string }>;
  /** Regulamento da promoção, em letra miúda. Texto jurídico: entra verbatim. */
  promoNote?: string;
}

export interface Certificate {
  id: ID;
  courseId: ID;
  studentId: ID;
  issuedAt?: string;
  validationCode: string;
  qrCodeMockUrl: string;
  status: 'in_progress' | 'available' | 'issued';
  progress: number; // 0-100
}

export interface NewsArticle {
  id: ID;
  title: string;
  excerpt: string;
  body?: string;
  category: string;
  tags: string[];
  coverColor: string;
  authorName: string;
  publishedAt: string;
  featured?: boolean;
  relatedCourseIds?: ID[];
}

export interface PodcastEpisode {
  id: ID;
  title: string;
  description: string;
  durationMinutes: number;
  publishedAt: string;
  coverColor: string;
  audioUrl?: string;
  /**
   * Transcrição do episódio. Ausente = não transcrito.
   *
   * Conteúdo só-áudio sem alternativa textual não tem via de acesso para quem é
   * surdo — nem para quem está onde não pode ouvir. `description` é o resumo do
   * card e não substitui.
   */
  transcript?: string;
  relatedCourseIds?: ID[];
  relatedModuleIds?: ID[];
  listened?: boolean;
  favorite?: boolean;
  tags?: string[];
}

export interface LibraryItem {
  id: ID;
  title: string;
  author: string;
  type: 'pdf' | 'apostila' | 'leitura' | 'artigo';
  mandatory: boolean;
  fileMockUrl: string;
  relatedCourseIds?: ID[];
  relatedModuleIds?: ID[];
  theme?: string;
  tags?: string[];
}

export interface SupportTicket {
  id: ID;
  studentId: ID;
  subject: string;
  category: 'duvida_aula' | 'acesso' | 'certificado' | 'tutor' | 'biblioteca' | 'outro';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  message: string;
}

export interface RetentionRisk {
  studentId: ID;
  studentName: string;
  score: number; // 0-100
  level: 'baixo' | 'medio' | 'alto' | 'critico';
  reasons: string[];
  lastAccessAt: string;
  expectedProgress: number;
  realProgress: number;
  blockedModuleId?: ID;
  pendingAssessments: number;
  tutorUsage: number;
  podConsumption: number;
  libraryInteractions: number;
  recommendedAction: string;
}

export interface RecoveryPlan {
  id: ID;
  studentId: ID;
  createdAt: string;
  diagnosis: string;
  tone: 'acolhedor' | 'direto' | 'motivacional';
  channel: 'email' | 'whatsapp' | 'in_app';
  intensity: 'leve' | 'media' | 'intensa';
  goal: string;
  message: string;
  recommendedLessonId?: ID;
  recommendedPodcastId?: ID;
  recommendedMaterialId?: ID;
  suggestedTutorPrompt?: string;
  weeklyGoalMinutes: number;
  status: 'draft' | 'sent' | 'in_followup' | 'completed';
}

export type AiProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'cohere'
  | 'deepseek'
  | 'xai'
  | 'perplexity'
  | 'azure_openai'
  | 'bedrock'
  | 'openrouter'
  | 'custom';

export interface AiConfiguration {
  id: ID;
  module: 'tutor' | 'recovery_plan' | 'evasion' | 'recommendations' | 'support' | 'summaries';
  provider: AiProvider;
  model: string;
  apiKeyMasked: string;
  temperature: number;
  maxTokens: number;
  perStudentLimit: number;
  perDayLimit: number;
  perMonthLimit: number;
  monthlyCostCap: number;
  systemMessage: string;
  allowedScopes: string[];
  blockedTopics: string[];
  fallbackResponse: string;
  active: boolean;
}

export interface AiUsageLog {
  id: ID;
  configurationId: ID;
  studentId?: ID;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
  occurredAt: string;
  successful: boolean;
}

export interface Professional {
  id: ID;
  name: string;
  avatarColor: string;
  bio: string;
  specialties: string[];
  serviceIds: ID[];
  hourlyRate: number;
  email: string;
}

export interface SessionService {
  id: ID;
  name: string;
  type: 'analise' | 'supervisao' | 'orientacao';
  description: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  paymentBeforeConfirmation: boolean;
}

export interface SessionBooking {
  id: ID;
  studentId: ID;
  professionalId: ID;
  serviceId: ID;
  scheduledAt: string;
  status: 'pending_payment' | 'confirmed' | 'scheduled' | 'done' | 'cancelled' | 'rescheduled';
  meetingLink?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
}

export interface SeoMetric {
  date: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgSessionMinutes: number;
}

export interface KeywordMetric {
  keyword: string;
  position: number;
  searchVolume: number;
  trend: 'up' | 'down' | 'flat';
  ctr: number;
}
