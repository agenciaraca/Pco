// Camada de API — chama o backend Hono em /api via fetch.
// Os tipos voltam dos schemas/Zod compartilhados em shared/.

import { http } from './client';
import type {
  Course,
  Module,
  Lesson,
  Assessment,
  Student,
  NewsArticle,
  PodcastEpisode,
  LibraryItem,
  Certificate,
  RetentionRisk,
  Professional,
  SessionService,
  SeoMetric,
  KeywordMetric,
  SupportTicket,
} from '../types/schema';
import type {
  CreateSupportTicketInput,
  RecoveryPlanInput,
  StudentsFilter,
} from '../../../shared/schemas';
import type { AdminStudentRow } from './seed';

// ---------- Auth ----------

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'superadmin';
}

export async function login(email: string, password: string) {
  return http.post<{ user: AuthUserDto; token: string }>('/auth/login', {
    email,
    password,
  });
}

export async function fetchCurrentStudent(): Promise<Student> {
  return http.get<Student>('/auth/me');
}

export async function logoutAllDevices(): Promise<{ ok: true; tokenVersion: number }> {
  return http.post<{ ok: true; tokenVersion: number }>('/auth/logout-all-devices', {});
}

export interface ForgotPasswordResponse {
  ok: true;
  devToken?: string;
  expiresIn?: number;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return http.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true; email: string }> {
  return http.post<{ ok: true; email: string }>('/auth/reset-password', {
    token,
    password,
  });
}

// ---------- Notifications ----------

export interface NotificationDto {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'info' | 'success' | 'warning' | 'danger' | 'announcement';
  link?: string;
  createdAt: string;
  readAt: string | null;
  authorEmail?: string | null;
}

export async function fetchNotifications(): Promise<NotificationDto[]> {
  return http.get<NotificationDto[]>('/notifications');
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  return http.get<{ count: number }>('/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<{ ok: true }> {
  return http.post<{ ok: true }>(`/notifications/${encodeURIComponent(id)}/read`, {});
}

export async function markAllNotificationsRead(): Promise<{ ok: true; updated: number }> {
  return http.post<{ ok: true; updated: number }>('/notifications/mark-all-read', {});
}

export interface BroadcastNotificationInput {
  audience: 'all' | 'students' | 'admins' | 'user';
  userId?: string;
  title: string;
  body: string;
  category?: NotificationDto['category'];
  link?: string;
}

export async function broadcastNotification(
  input: BroadcastNotificationInput,
): Promise<{ ok: true; sent: number }> {
  return http.post<{ ok: true; sent: number }>('/admin/notifications/broadcast', input);
}

// ---------- Audit log ----------

export interface AuditEntryDto {
  id: string;
  ts: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  meta?: Record<string, unknown>;
  status: 'ok' | 'error';
}

export interface AuditFilter {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  since?: string;
  until?: string;
  limit?: number;
}

// ---------- Error log ----------

export interface ErrorEntryDto {
  id: string;
  ts: string;
  message: string;
  stack: string | null;
  method: string;
  path: string;
  status: number;
  actorId: string | null;
  actorEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}

export async function fetchErrorLog(limit = 200): Promise<ErrorEntryDto[]> {
  return http.get<ErrorEntryDto[]>(`/admin/errors?limit=${limit}`);
}

// ---------- Audit log ----------

export async function fetchAuditLog(filter: AuditFilter = {}): Promise<AuditEntryDto[]> {
  const qs = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return http.get<AuditEntryDto[]>(`/admin/audit-log${suffix}`);
}

// ---------- Courses ----------

export async function fetchCourses(): Promise<Course[]> {
  return http.get<Course[]>('/courses');
}

export async function fetchCourse(id: string): Promise<Course | null> {
  return http.get<Course>(`/courses/${encodeURIComponent(id)}`).catch(() => null);
}

// ---------- News ----------

export async function fetchNews(): Promise<NewsArticle[]> {
  return http.get<NewsArticle[]>('/news');
}

// ---------- Podcasts ----------

export async function fetchPodcasts(): Promise<PodcastEpisode[]> {
  return http.get<PodcastEpisode[]>('/podcasts');
}

export async function fetchPodcastEpisode(id: string): Promise<PodcastEpisode | null> {
  return http
    .get<PodcastEpisode>(`/podcasts/${encodeURIComponent(id)}`)
    .catch(() => null);
}

// ---------- Library ----------

export async function fetchLibrary(filters?: {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}): Promise<LibraryItem[]> {
  return http.get<LibraryItem[]>('/library', {
    query: {
      type: filters?.type,
      courseId: filters?.courseId,
      mandatoryOnly: filters?.mandatoryOnly,
    },
  });
}

// ---------- Certificates ----------

export async function fetchCertificates(): Promise<Certificate[]> {
  return http.get<Certificate[]>('/certificates');
}

// ---------- Retention ----------

export async function fetchRetentionRisks(level?: string): Promise<RetentionRisk[]> {
  return http.get<RetentionRisk[]>('/retention/risks', {
    query: { level },
  });
}

// ---------- Sessions ----------

export async function fetchProfessionals(): Promise<Professional[]> {
  return http.get<Professional[]>('/sessions/professionals');
}

export async function fetchSessionServices(): Promise<SessionService[]> {
  return http.get<SessionService[]>('/sessions/services');
}

// ---------- SEO / Metrics ----------

export async function fetchSeoTimeseries(range = '30d'): Promise<SeoMetric[]> {
  return http.get<SeoMetric[]>('/metrics/seo/timeseries', {
    query: { range },
  });
}

export async function fetchKeywords(): Promise<KeywordMetric[]> {
  return http.get<KeywordMetric[]>('/metrics/seo/keywords');
}

// ---------- AI ----------

export interface AiProviderInfo {
  id: 'anthropic' | 'openai' | 'google' | 'mistral' | 'deepseek' | 'groq';
  name: string;
  homepageUrl: string;
  consoleUrl: string;
  apiKeyDocsUrl: string;
  defaultModel: string;
  models: Array<{
    id: string;
    label: string;
    contextWindow: number;
    inputCostPerMTok?: number;
    outputCostPerMTok?: number;
    recommendedFor?: string;
  }>;
}

export async function fetchAiProviders(): Promise<AiProviderInfo[]> {
  return http.get<AiProviderInfo[]>('/ai/providers');
}

export interface AiConfigPublic {
  id: string;
  module: 'tutor' | 'recovery_plan' | 'evasion' | 'recommendations' | 'support' | 'summaries';
  provider: AiProviderInfo['id'];
  model: string;
  apiKeyMasked: string;
  apiKeyConfigured: boolean;
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
  updatedAt: string;
}

export async function fetchAiConfigurations(): Promise<AiConfigPublic[]> {
  return http.get<AiConfigPublic[]>('/admin/ai/configurations');
}

export async function fetchAiConfiguration(
  id: string,
): Promise<AiConfigPublic & { usage: { inputTokens: number; outputTokens: number; costUsd: number; total: number; successCount: number; successRate: number } }> {
  return http.get(`/admin/ai/configurations/${encodeURIComponent(id)}`);
}

export async function updateAiConfiguration(
  id: string,
  patch: Partial<{
    provider: AiProviderInfo['id'];
    model: string;
    apiKey: string | null;
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
  }>,
): Promise<AiConfigPublic> {
  return http.put(`/admin/ai/configurations/${encodeURIComponent(id)}`, patch);
}

export async function testAiConnection(
  provider: AiProviderInfo['id'],
  apiKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return http.post('/admin/ai/test', { provider, apiKey });
}

export interface TutorReply {
  message: string;
  provider: AiProviderInfo['id'] | null;
  model: string | null;
  usage: { inputTokens: number; outputTokens: number; costUsd: number } | null;
}

export async function askTutor(
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<TutorReply> {
  return http.post<TutorReply>('/ai/tutor', { message, history });
}

// ---------- Support ----------

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  return http.get<SupportTicket[]>('/support/tickets');
}

export async function createSupportTicket(
  input: CreateSupportTicketInput,
): Promise<SupportTicket> {
  return http.post<SupportTicket>('/support/tickets', input);
}

// ---------- Admin students ----------

export type { StudentsFilter };

export async function fetchAdminStudents(
  filters: StudentsFilter = {},
): Promise<AdminStudentRow[]> {
  return http.get<AdminStudentRow[]>('/admin/students', {
    query: {
      search: filters.search,
      status: filters.status,
      courseId: filters.courseId,
      sortBy: filters.sortBy,
    },
  });
}

export async function fetchAdminStudent(id: string): Promise<AdminStudentRow | null> {
  return http.get<AdminStudentRow>(`/admin/students/${encodeURIComponent(id)}`).catch(() => null);
}

// ---------- Admin: Course writes ----------

export interface UpdateCoursePatch {
  title?: string;
  slug?: string;
  shortTitle?: string;
  description?: string;
  totalHours?: number;
  certificateAvailable?: boolean;
  coverColor?: string;
  active?: boolean;
}

export async function updateCourse(id: string, patch: UpdateCoursePatch): Promise<Course> {
  return http.put<Course>(`/admin/courses/${encodeURIComponent(id)}`, patch);
}

// ---------- Admin: News writes ----------

export interface CreateNewsPayload {
  title: string;
  excerpt: string;
  body?: string;
  category: string;
  tags?: string[];
  coverColor?: string;
  authorName?: string;
  publishedAt: string;
  featured?: boolean;
  relatedCourseIds?: string[];
}

export async function createNews(input: CreateNewsPayload): Promise<NewsArticle> {
  return http.post<NewsArticle>('/admin/news', input);
}

export async function updateNews(
  id: string,
  patch: Partial<CreateNewsPayload>,
): Promise<NewsArticle> {
  return http.put<NewsArticle>(`/admin/news/${encodeURIComponent(id)}`, patch);
}

export async function deleteNews(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/news/${encodeURIComponent(id)}`);
}

// ---------- Admin: Library writes ----------

export interface CreateLibraryPayload {
  title: string;
  author: string;
  type: 'pdf' | 'apostila' | 'leitura' | 'artigo';
  mandatory?: boolean;
  fileMockUrl?: string;
  relatedCourseIds?: string[];
  relatedModuleIds?: string[];
  theme?: string;
}

export async function createLibrary(input: CreateLibraryPayload): Promise<LibraryItem> {
  return http.post<LibraryItem>('/admin/library', input);
}

export async function updateLibrary(
  id: string,
  patch: Partial<CreateLibraryPayload>,
): Promise<LibraryItem> {
  return http.put<LibraryItem>(`/admin/library/${encodeURIComponent(id)}`, patch);
}

export async function deleteLibrary(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/library/${encodeURIComponent(id)}`);
}

// ---------- Admin: Podcasts writes ----------

export interface CreatePodcastPayload {
  title: string;
  description: string;
  durationMinutes?: number;
  publishedAt: string;
  coverColor?: string;
  audioUrl?: string;
  relatedCourseIds?: string[];
  relatedModuleIds?: string[];
}

export async function createPodcast(input: CreatePodcastPayload): Promise<PodcastEpisode> {
  return http.post<PodcastEpisode>('/admin/podcasts', input);
}

export async function updatePodcast(
  id: string,
  patch: Partial<CreatePodcastPayload>,
): Promise<PodcastEpisode> {
  return http.put<PodcastEpisode>(`/admin/podcasts/${encodeURIComponent(id)}`, patch);
}

export async function deletePodcast(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/podcasts/${encodeURIComponent(id)}`);
}

// ---------- Admin: Modules ----------

export interface CreateModulePayload {
  title: string;
  description?: string;
  order: number;
  releaseAt?: string;
}

export async function createModule(
  courseId: string,
  input: CreateModulePayload,
): Promise<Module> {
  return http.post<Module>(`/admin/courses/${encodeURIComponent(courseId)}/modules`, input);
}

export async function updateModule(
  id: string,
  patch: Partial<CreateModulePayload>,
): Promise<Module> {
  return http.put<Module>(`/admin/modules/${encodeURIComponent(id)}`, patch);
}

export async function deleteModule(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/modules/${encodeURIComponent(id)}`);
}

// ---------- Admin: Lessons ----------

export interface CreateLessonPayload {
  title: string;
  durationMinutes?: number;
  videoUrl?: string;
  description?: string;
  isMandatory?: boolean;
  order: number;
}

export async function createLesson(
  moduleId: string,
  input: CreateLessonPayload,
): Promise<Lesson> {
  return http.post<Lesson>(`/admin/modules/${encodeURIComponent(moduleId)}/lessons`, input);
}

export async function updateLesson(
  id: string,
  patch: Partial<CreateLessonPayload>,
): Promise<Lesson> {
  return http.put<Lesson>(`/admin/lessons/${encodeURIComponent(id)}`, patch);
}

export async function deleteLesson(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/lessons/${encodeURIComponent(id)}`);
}

// ---------- Admin: Student writes ----------

export interface CreateStudentPayload {
  name: string;
  email: string;
  weeklyGoalMinutes?: number;
  status?: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo';
  enrolledCourseIds?: string[];
}

export async function createAdminStudent(input: CreateStudentPayload): Promise<AdminStudentRow> {
  return http.post<AdminStudentRow>('/admin/students', input);
}

export async function updateAdminStudent(
  id: string,
  patch: Partial<CreateStudentPayload>,
): Promise<AdminStudentRow> {
  return http.put<AdminStudentRow>(`/admin/students/${encodeURIComponent(id)}`, patch);
}

export async function blockStudent(id: string): Promise<AdminStudentRow> {
  return http.post<AdminStudentRow>(`/admin/students/${encodeURIComponent(id)}/block`);
}

export async function unblockStudent(id: string): Promise<AdminStudentRow> {
  return http.post<AdminStudentRow>(`/admin/students/${encodeURIComponent(id)}/unblock`);
}

export async function deleteAdminStudent(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/students/${encodeURIComponent(id)}`);
}

// ---------- Admin: Assessments ----------

export interface AssessmentPayload {
  title: string;
  questionCount?: number;
  passingScore?: number;
  timeLimitMinutes?: number;
}

export async function upsertAssessment(
  moduleId: string,
  input: AssessmentPayload,
): Promise<Assessment> {
  return http.post<Assessment>(
    `/admin/modules/${encodeURIComponent(moduleId)}/assessment`,
    input,
  );
}

export async function updateAssessment(
  id: string,
  patch: Partial<AssessmentPayload>,
): Promise<Assessment> {
  return http.put<Assessment>(`/admin/assessments/${encodeURIComponent(id)}`, patch);
}

export async function deleteAssessment(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/assessments/${encodeURIComponent(id)}`);
}

// ---------- Admin: System Users (RBAC + login) ----------

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'superadmin';
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CreateSystemUserPayload {
  email: string;
  name: string;
  role: SystemUser['role'];
  password: string;
  active?: boolean;
}

export async function fetchSystemUsers(): Promise<SystemUser[]> {
  return http.get<SystemUser[]>('/admin/users');
}

export async function createSystemUser(input: CreateSystemUserPayload): Promise<SystemUser> {
  return http.post<SystemUser>('/admin/users', input);
}

export async function updateSystemUser(
  id: string,
  patch: { email?: string; name?: string; role?: SystemUser['role']; active?: boolean },
): Promise<SystemUser> {
  return http.put<SystemUser>(`/admin/users/${encodeURIComponent(id)}`, patch);
}

export async function changeSystemUserPassword(
  id: string,
  password: string,
): Promise<{ ok: true }> {
  return http.put<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}/password`, { password });
}

export async function deleteSystemUser(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/users/${encodeURIComponent(id)}`);
}

// ---------- Recovery plans ----------

export async function generateRecoveryPlan(input: RecoveryPlanInput): Promise<{
  message: string;
  plan: Record<string, unknown>;
}> {
  return http.post('/admin/recovery-plan', input);
}
