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
  description?: string;
  isMandatory: boolean;
  order: number;
  status?: LessonStatus;
  /** Aula liberada como preview livre pra visitantes não matriculados. */
  isPreview?: boolean;
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
  category:
    | 'duvida_aula'
    | 'acesso'
    | 'certificado'
    | 'tutor'
    | 'biblioteca'
    | 'outro';
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
  module:
    | 'tutor'
    | 'recovery_plan'
    | 'evasion'
    | 'recommendations'
    | 'support'
    | 'summaries';
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
  status:
    | 'pending_payment'
    | 'confirmed'
    | 'scheduled'
    | 'done'
    | 'cancelled'
    | 'rescheduled';
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
