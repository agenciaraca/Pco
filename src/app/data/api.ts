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
  totpEnabled?: boolean;
}

export interface LoginResponseDto {
  user?: AuthUserDto;
  token?: string;
  totpRequired?: boolean;
  ticket?: string;
}

export async function login(email: string, password: string): Promise<LoginResponseDto> {
  return http.post<LoginResponseDto>('/auth/login', { email, password });
}

export async function loginVerifyTotp(
  ticket: string,
  code: string,
): Promise<{ user: AuthUserDto; token: string }> {
  return http.post<{ user: AuthUserDto; token: string }>('/auth/login/totp', {
    ticket,
    code,
  });
}

export interface TotpSetupResponse {
  secret: string;
  uri: string;
}

export async function totpSetup(): Promise<TotpSetupResponse> {
  return http.post<TotpSetupResponse>('/auth/me/totp/setup', {});
}

export async function totpEnable(code: string): Promise<{ enabled: true; backupCodes: string[] }> {
  return http.post<{ enabled: true; backupCodes: string[] }>('/auth/me/totp/enable', { code });
}

export async function totpDisable(code: string): Promise<{ enabled: false }> {
  return http.post<{ enabled: false }>('/auth/me/totp/disable', { code });
}

export async function totpRegenBackupCodes(code: string): Promise<{ backupCodes: string[] }> {
  return http.post<{ backupCodes: string[] }>('/auth/me/totp/backup-codes/regenerate', { code });
}

export async function fetchCurrentStudent(): Promise<Student> {
  return http.get<Student>('/auth/me');
}

export async function logoutAllDevices(): Promise<{ ok: true; tokenVersion: number }> {
  return http.post<{ ok: true; tokenVersion: number }>('/auth/logout-all-devices', {});
}

// ---------- Impersonation ----------
export interface ImpersonationStartResult {
  ok: true;
  token: string;
  actor: { id: string; email: string; role: 'student' | 'admin' | 'superadmin' };
  target: {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'admin' | 'superadmin';
  };
  expiresInSeconds: number;
}

export async function startImpersonation(targetUserId: string): Promise<ImpersonationStartResult> {
  return http.post<ImpersonationStartResult>(
    `/admin/impersonate/${encodeURIComponent(targetUserId)}`,
    {},
  );
}

export async function exitImpersonation(): Promise<{ ok: true; token: string }> {
  return http.post<{ ok: true; token: string }>('/admin/impersonate/exit', {});
}

export interface ImpersonationStatus {
  impersonating: boolean;
  actor?: { id: string; email: string; role: 'student' | 'admin' | 'superadmin' };
  target?: { id: string; email: string; role: 'student' | 'admin' | 'superadmin' };
}

export async function getImpersonationStatus(): Promise<ImpersonationStatus> {
  return http.get<ImpersonationStatus>('/me/impersonation');
}

export interface UpdateProfileBody {
  name?: string;
  avatarUrl?: string | null;
}
export interface MyProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'superadmin';
  avatarUrl?: string | null;
  active: boolean;
}
export async function updateMyProfile(body: UpdateProfileBody): Promise<MyProfile> {
  return http.put<MyProfile>('/auth/me', body);
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return http.post<{ ok: true }>('/auth/me/password', { currentPassword, newPassword });
}

export async function setMyWeeklyGoal(
  weeklyGoalMinutes: number,
): Promise<{ ok: true; weeklyGoalMinutes: number }> {
  return http.put('/me/weekly-goal', { weeklyGoalMinutes });
}

export interface StudyHeatmapDto {
  days: { date: string; count: number }[];
  summary: {
    totalLessons: number;
    activeDays: number;
    lastYearLessons: number;
    max: number;
  };
}

export async function fetchMyStudyHeatmap(): Promise<StudyHeatmapDto> {
  return http.get<StudyHeatmapDto>('/me/study-heatmap');
}

export interface CoursePrereqCheckDto {
  ok: boolean;
  missing: string[];
  status: { courseId: string; completed: boolean; title: string | null; slug: string | null }[];
  required: string[];
}

export async function fetchCoursePrereqCheck(courseId: string): Promise<CoursePrereqCheckDto> {
  return http.get(`/me/courses/${encodeURIComponent(courseId)}/prereq`);
}

export interface LessonPreviewDto {
  lesson: {
    id: string;
    title: string;
    videoUrl: string | null;
    description: string;
    durationMinutes: number;
  };
  module: { id: string; title: string };
  course: {
    id: string;
    title: string;
    slug: string;
    shortTitle: string;
    coverColor: string;
  };
}

export async function fetchLessonPreview(lessonId: string): Promise<LessonPreviewDto> {
  return http.get(`/lessons/${encodeURIComponent(lessonId)}/preview`);
}

// ---------- Uploads ----------

export interface UploadResultDto {
  url: string;
  filename: string;
  size: number;
  mime: string;
}

export async function uploadFile(file: File): Promise<UploadResultDto> {
  // http.post espera JSON — fazemos fetch direto pra multipart
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as UploadResultDto;
}

export interface ForgotPasswordResponse {
  ok: true;
  devToken?: string;
  expiresIn?: number;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return http.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: true; email: string }> {
  return http.post<{ ok: true; email: string }>('/auth/reset-password', {
    token,
    password,
  });
}

// ---------- Progress ----------

export interface MyProgressDto {
  completedLessonIds: string[];
  byCourse: Record<string, { lessonsCompleted: number; lastAt: string | null }>;
  streakDays: number;
  lastCompletedAt: string | null;
  /** Meta semanal de minutos definida pelo aluno. Default: 180 (3h). */
  weeklyGoalMinutes?: number;
  /** Minutos estudados desde a segunda-feira UTC desta semana. */
  weekMinutes?: number;
  /** ISO timestamp da segunda-feira 00:00 UTC desta semana. */
  weekStartIso?: string;
}

export async function fetchMyProgress(): Promise<MyProgressDto> {
  return http.get<MyProgressDto>('/me/progress');
}

export interface NewAchievementDto {
  badgeId: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
}

export async function markLessonCompleted(
  lessonId: string,
  courseId: string,
  moduleId: string,
): Promise<{
  lessonId: string;
  completedAt: string;
  newAchievements?: NewAchievementDto[];
}> {
  return http.post(`/lessons/${encodeURIComponent(lessonId)}/complete`, {
    courseId,
    moduleId,
  });
}

export async function unmarkLessonCompleted(lessonId: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/lessons/${encodeURIComponent(lessonId)}/complete`);
}

// ---------- Admin user timeline ----------

export interface TimelineEventDto {
  type: 'progress' | 'cert' | 'ticket' | 'tutor' | 'login';
  ts: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}

export async function fetchUserTimeline(id: string): Promise<TimelineEventDto[]> {
  return http.get<TimelineEventDto[]>(`/admin/users/${encodeURIComponent(id)}/timeline`);
}

// ---------- Admin support ----------

export async function fetchAllSupportTickets(): Promise<SupportTicket[]> {
  return http.get<SupportTicket[]>('/admin/support/tickets');
}

export async function updateSupportTicketStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved',
): Promise<SupportTicket> {
  return http.put<SupportTicket>(`/admin/support/tickets/${encodeURIComponent(id)}/status`, {
    status,
  });
}

export async function respondSupportTicket(id: string, message: string): Promise<{ ok: true }> {
  return http.post<{ ok: true }>(`/admin/support/tickets/${encodeURIComponent(id)}/respond`, {
    message,
  });
}

// ---------- Podcast engagement ----------

export interface PodcastEngagementDto {
  userId: string;
  episodeId: string;
  listened: boolean;
  favorite: boolean;
  updatedAt: string;
}

export async function fetchMyPodcastEngagement(): Promise<PodcastEngagementDto[]> {
  return http.get<PodcastEngagementDto[]>('/me/podcast-engagement');
}

export async function setPodcastEngagement(
  episodeId: string,
  patch: { listened?: boolean; favorite?: boolean },
): Promise<PodcastEngagementDto> {
  return http.put<PodcastEngagementDto>(
    `/podcasts/${encodeURIComponent(episodeId)}/engagement`,
    patch,
  );
}

// ---------- Version ----------

export interface VersionDto {
  version: string;
  startedAt: string;
  env: string;
}

export async function fetchVersion(): Promise<VersionDto> {
  return http.get<VersionDto>('/version');
}

// ---------- LGPD export ----------

export async function exportMyData(): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch('/api/me/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `ava-pco-export-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Lesson notes ----------

export interface LessonNoteDto {
  userId: string;
  lessonId: string;
  content: string;
  updatedAt: string;
}

export async function fetchLessonNote(lessonId: string): Promise<LessonNoteDto | null> {
  return http.get<LessonNoteDto | null>(`/lessons/${encodeURIComponent(lessonId)}/note`);
}

export async function saveLessonNote(lessonId: string, content: string): Promise<LessonNoteDto> {
  return http.put<LessonNoteDto>(`/lessons/${encodeURIComponent(lessonId)}/note`, { content });
}

// ---------- Lesson transcripts ----------

export interface LessonTranscriptDto {
  lessonId: string;
  availableLocales: string[];
  locale: string;
  text: string;
}

export async function fetchLessonTranscript(
  lessonId: string,
  lang?: string,
): Promise<LessonTranscriptDto> {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  return http.get<LessonTranscriptDto>(`/lessons/${encodeURIComponent(lessonId)}/transcript${qs}`);
}

export interface TranscriptCoverageDto {
  courses: Array<{
    courseId: string;
    title: string;
    shortTitle: string;
    totalLessons: number;
    withAnyTranscript: number;
    perLang: { pt: number; es: number; en: number };
    coveragePct: number;
  }>;
  totals: {
    totalLessons: number;
    withAnyTranscript: number;
    perLang: { pt: number; es: number; en: number };
    coveragePct: number;
  };
}

export async function fetchTranscriptCoverage(): Promise<TranscriptCoverageDto> {
  return http.get<TranscriptCoverageDto>('/admin/transcripts/coverage');
}

export interface TranscriptBulkInput {
  items: Array<{ lessonId: string; lang: string; text: string }>;
}

export interface TranscriptBulkResult {
  total: number;
  ok: number;
  failed: number;
  results: Array<{ lessonId: string; lang: string; ok: boolean; error?: string }>;
}

export async function bulkUpdateTranscripts(
  input: TranscriptBulkInput,
): Promise<TranscriptBulkResult> {
  return http.post<TranscriptBulkResult>('/admin/transcripts/bulk', input);
}

export interface TranslateWithAiInput {
  lessonId: string;
  fromLang: 'pt' | 'es' | 'en';
  toLang: 'pt' | 'es' | 'en';
}

export interface TranslateWithAiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  provider: string;
  model: string;
}

export async function translateTranscriptWithAi(
  input: TranslateWithAiInput,
): Promise<TranslateWithAiResult> {
  return http.post<TranslateWithAiResult>('/admin/transcripts/translate-with-ai', input);
}

export interface GenerateFromVideoInput {
  lessonId: string;
  lang: 'pt' | 'es' | 'en';
}

export interface GenerateFromVideoResult {
  text: string;
  durationSeconds: number | null;
  language: string;
  sizeMB: number;
  costUsd: number;
}

export async function generateTranscriptFromVideo(
  input: GenerateFromVideoInput,
): Promise<GenerateFromVideoResult> {
  return http.post<GenerateFromVideoResult>('/admin/transcripts/generate-from-video', input);
}

export interface BulkTranslateInput {
  courseId: string;
  fromLang: 'pt' | 'es' | 'en';
  toLang: 'pt' | 'es' | 'en';
}

export interface BulkTranslateResult {
  total: number;
  translated: number;
  skipped: number;
  failed: number;
  totalCostUsd: number;
  results: Array<{
    lessonId: string;
    title: string;
    ok: boolean;
    skipped?: 'no_source' | 'already_has_target';
    error?: string;
  }>;
}

export async function bulkTranslateCourse(input: BulkTranslateInput): Promise<BulkTranslateResult> {
  return http.post<BulkTranslateResult>('/admin/transcripts/bulk-translate', input);
}

// ---------- Tutor usage ----------

export interface TutorUsageDto {
  configured: boolean;
  used: number;
  limit: number;
  remaining: number;
  windowDays: number;
  provider?: string;
  model?: string;
}

export async function fetchTutorUsage(): Promise<TutorUsageDto> {
  return http.get<TutorUsageDto>('/me/tutor/usage');
}

// ---------- Tutor history ----------

export interface TutorTurnDto {
  id: string;
  userId: string;
  prompt: string;
  response: string;
  provider: string | null;
  model: string | null;
  ts: string;
}

export async function fetchTutorHistory(limit = 50): Promise<TutorTurnDto[]> {
  return http.get<TutorTurnDto[]>(`/tutor/history?limit=${limit}`);
}

export async function clearTutorHistory(): Promise<{ ok: true; removed: number }> {
  return http.delete<{ ok: true; removed: number }>('/tutor/history');
}

// ---------- App settings ----------

export interface AppSettingsDto {
  siteName: string;
  contactEmail: string;
  timezone: string;
  cookiePolicyText: string;
  termsUrl: string;
  privacyUrl: string;
  helpEmail: string;
  whatsappNumber: string;
  updatedAt: string;
}

export async function fetchSettings(): Promise<AppSettingsDto> {
  return http.get<AppSettingsDto>('/settings');
}

export async function updateSettings(patch: Partial<AppSettingsDto>): Promise<AppSettingsDto> {
  return http.put<AppSettingsDto>('/admin/settings', patch);
}

// ---------- Tags de marketing (Google, Meta, verificação de propriedade) ----------

export interface MarketingTagsDto {
  gtmId: string;
  ga4Id: string;
  metaPixelId: string;
  googleSiteVerification: string;
  facebookDomainVerification: string;
  /** Volta sempre vazio: credencial não faz o caminho de volta para a tela. */
  metaCapiToken: string;
  /** Se já existe um token guardado — para a tela dizer isso sem mostrá-lo. */
  temCapiToken?: boolean;
  enviarConversaoServidor: boolean;
  exigirConsentimento: boolean;
  ativo: boolean;
  updatedAt: string;
}

export async function fetchMarketingTags(): Promise<MarketingTagsDto> {
  return http.get<MarketingTagsDto>('/admin/marketing-tags');
}

export async function updateMarketingTags(
  patch: Partial<MarketingTagsDto>,
): Promise<MarketingTagsDto> {
  return http.put<MarketingTagsDto>('/admin/marketing-tags', patch);
}

// ---------- Login customization ----------

export interface LoginConfigDto {
  tag: string;
  title: string;
  subtitle: string;
  fromColor: string;
  viaColor: string;
  toColor: string;
  position: 'left' | 'right';
  theme: 'light' | 'dark';
  logoUrl: string | null;
  updatedAt: string;
}

export async function fetchLoginConfig(): Promise<LoginConfigDto> {
  return http.get<LoginConfigDto>('/login-config');
}

export async function updateLoginConfig(patch: Partial<LoginConfigDto>): Promise<LoginConfigDto> {
  return http.put<LoginConfigDto>('/admin/login-config', patch);
}

export async function resetLoginConfig(): Promise<LoginConfigDto> {
  return http.post<LoginConfigDto>('/admin/login-config/reset', {});
}

// ---------- Backups ----------

export interface BackupDto {
  name: string;
  sizeBytes: number;
  mtime: string;
}

export async function fetchBackups(): Promise<BackupDto[]> {
  return http.get<BackupDto[]>('/admin/backups');
}

export async function runBackupNow(): Promise<BackupDto & { ok: true }> {
  return http.post<BackupDto & { ok: true }>('/admin/backups/run', {});
}

export async function deleteBackup(name: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/backups/${encodeURIComponent(name)}`);
}

export async function downloadBackup(name: string): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch(`/api/admin/backups/${encodeURIComponent(name)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Admin search ----------

export interface SearchHitDto {
  type:
    | 'course'
    | 'module'
    | 'lesson'
    | 'library'
    | 'news'
    | 'podcast'
    | 'user'
    | 'order'
    | 'product';
  id: string;
  title: string;
  snippet: string;
  link: string;
}

export async function adminSearch(q: string): Promise<SearchHitDto[]> {
  if (q.trim().length < 2) return [];
  return http.get<SearchHitDto[]>(`/admin/search?q=${encodeURIComponent(q)}`);
}

export interface StudentSearchHitDto {
  type: 'course' | 'lesson' | 'library' | 'news' | 'podcast';
  id: string;
  title: string;
  snippet: string;
  link: string;
}

export async function studentSearch(q: string): Promise<StudentSearchHitDto[]> {
  if (q.trim().length < 2) return [];
  return http.get<StudentSearchHitDto[]>(`/search?q=${encodeURIComponent(q)}`);
}

// ---------- Payment gateways (admin) ----------

export type PaymentProviderId =
  /** Lançamento manual do admin: registro de venda feita fora do sistema. */
  | 'manual'
  /** Histórico da loja WooCommerce, importado em 1/set/2026. */
  | 'legado-wp'
  | 'mock'
  | 'stripe'
  | 'asaas'
  | 'pagarme'
  | 'paypal'
  | 'mercadopago'
  /** Sandra — a cobrança nasce no gateway da própria escola. */
  | 'sandra';

export interface PaymentProviderInfoDto {
  id: PaymentProviderId;
  label: string;
  implemented: boolean;
}

export interface PaymentGatewayDto {
  id: string;
  provider: PaymentProviderId;
  displayName: string;
  mode: 'test' | 'live';
  active: boolean;
  publicKey?: string | null;
  options?: Record<string, unknown>;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGatewayInput {
  provider: PaymentProviderId;
  displayName: string;
  mode: 'test' | 'live';
  active?: boolean;
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  publicKey?: string;
}

export interface UpdateGatewayInput {
  displayName?: string;
  mode?: 'test' | 'live';
  active?: boolean;
  apiKey?: string;
  apiSecret?: string | null;
  webhookSecret?: string | null;
  publicKey?: string | null;
}

export async function fetchPaymentProviders(): Promise<PaymentProviderInfoDto[]> {
  return http.get<PaymentProviderInfoDto[]>('/admin/payments/providers');
}

export async function fetchPaymentGateways(): Promise<PaymentGatewayDto[]> {
  return http.get<PaymentGatewayDto[]>('/admin/payments/gateways');
}

export async function createPaymentGateway(input: CreateGatewayInput): Promise<PaymentGatewayDto> {
  return http.post<PaymentGatewayDto>('/admin/payments/gateways', input);
}

export async function updatePaymentGateway(
  id: string,
  patch: UpdateGatewayInput,
): Promise<PaymentGatewayDto> {
  return http.put<PaymentGatewayDto>(`/admin/payments/gateways/${encodeURIComponent(id)}`, patch);
}

export async function deletePaymentGateway(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/payments/gateways/${encodeURIComponent(id)}`);
}

// Products
export type ProductKind = 'course' | 'session_pack' | 'tutor_pack' | 'bundle';

export interface ProductDto {
  id: string;
  kind: ProductKind;
  refId: string | null;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchProducts(): Promise<ProductDto[]> {
  return http.get<ProductDto[]>('/products');
}

export async function fetchAdminProducts(): Promise<ProductDto[]> {
  return http.get<ProductDto[]>('/admin/products');
}

export interface CreateProductInput {
  kind: ProductKind;
  refId?: string | null;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  return http.post<ProductDto>('/admin/products', input);
}

export async function updateProduct(
  id: string,
  patch: Partial<CreateProductInput>,
): Promise<ProductDto> {
  return http.put<ProductDto>(`/admin/products/${encodeURIComponent(id)}`, patch);
}

export async function deleteProduct(id: string, confirmName: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/products/${encodeURIComponent(id)}`, {
    headers: { 'X-Confirm-Name': confirmName },
  });
}

// Orders
export type OrderStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded';

/** De onde veio a venda. Todo campo é opcional, e ausente é ausente — não é "direto". */
export interface AtribuicaoDto {
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
}

export interface OrderDto {
  id: string;
  userId: string;
  userEmail: string;
  /** Nome de quem comprou, da conta. `null` quando não há conta com esse e-mail. */
  userName?: string | null;
  attribution?: AtribuicaoDto | null;
  productId: string;
  productSnapshot: {
    name: string;
    priceCents: number;
    currency: string;
    kind: ProductKind;
    refId: string | null;
  };
  gatewayId: string;
  gatewayProvider: PaymentProviderId;
  externalId: string | null;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  events: Array<{ ts: string; status: OrderStatus; note?: string }>;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}

export interface AdminOrderInput {
  userEmail: string;
  productId?: string;
  productName?: string;
  refId?: string | null;
  amountCents: number;
  currency?: string;
  status?: OrderStatus;
  attribution?: AtribuicaoDto | null;
  nota?: string;
}

export async function createOrder(input: AdminOrderInput): Promise<OrderDto> {
  return http.post<OrderDto>('/admin/orders', input);
}

export async function updateOrder(
  id: string,
  input: Partial<AdminOrderInput> & { paidAt?: string | null },
): Promise<OrderDto> {
  return http.put<OrderDto>(`/admin/orders/${encodeURIComponent(id)}`, input);
}

export async function deleteOrder(id: string): Promise<{ ok: boolean; apagado: OrderDto }> {
  return http.delete<{ ok: boolean; apagado: OrderDto }>(`/admin/orders/${encodeURIComponent(id)}`);
}

export async function fetchMyOrders(): Promise<OrderDto[]> {
  return http.get<OrderDto[]>('/me/orders');
}

export async function fetchAllOrders(): Promise<OrderDto[]> {
  return http.get<OrderDto[]>('/admin/orders');
}

/**
 * Dados de quem compra, além do produto.
 *
 * Enquanto esta rota mandava só o id do produto, o gateway recebia apenas o
 * e-mail do aluno: o Pagar.me derivava o nome de `email.split('@')[0]` e, sem
 * CPF, recusava a cobrança inteira. O checkout público sempre mandou isto.
 */
export interface CheckoutComprador {
  name?: string;
  document?: string;
  whatsapp?: string;
}

export async function startCheckout(
  productId: string,
  gatewayId?: string,
  couponCode?: string,
  comprador?: CheckoutComprador,
): Promise<OrderDto> {
  return http.post<OrderDto>('/payments/checkout', {
    productId,
    gatewayId,
    couponCode,
    ...comprador,
  });
}

// ---------- Coupons ----------

export type CouponDiscountDto =
  | { kind: 'percent'; value: number }
  | { kind: 'amount'; value: number };

export interface CouponDto {
  id: string;
  code: string;
  description?: string;
  discount: CouponDiscountDto;
  appliesToProductIds: string[];
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponInputDto {
  code: string;
  description?: string;
  discount: CouponDiscountDto;
  appliesToProductIds?: string[];
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export interface CouponCheckResultDto {
  ok: true;
  discountCents: number;
  finalAmountCents: number;
  coupon: { code: string; description?: string; discount: CouponDiscountDto };
}

export async function fetchCoupons(): Promise<CouponDto[]> {
  return http.get<CouponDto[]>('/admin/coupons');
}

export async function createCoupon(input: CouponInputDto): Promise<CouponDto> {
  return http.post<CouponDto>('/admin/coupons', input);
}

export async function updateCoupon(id: string, input: Partial<CouponInputDto>): Promise<CouponDto> {
  return http.put<CouponDto>(`/admin/coupons/${encodeURIComponent(id)}`, input);
}

export async function deleteCoupon(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/admin/coupons/${encodeURIComponent(id)}`);
}

export async function checkCoupon(code: string, productId: string): Promise<CouponCheckResultDto> {
  const qs = new URLSearchParams({ code, productId }).toString();
  return http.get<CouponCheckResultDto>(`/coupons/check?${qs}`);
}

export interface BulkCouponInputDto {
  count: number;
  prefix?: string;
  sequential?: boolean;
  randomLength?: number;
  description?: string;
  discount: CouponDiscountDto;
  appliesToProductIds?: string[];
  maxUsesPerCoupon?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

export async function createCouponsBulk(input: BulkCouponInputDto): Promise<{
  createdCount: number;
  skippedCount: number;
  created: CouponDto[];
  skipped: string[];
}> {
  return http.post('/admin/coupons/bulk', input);
}

export async function downloadCouponsCsv(): Promise<void> {
  return downloadCsv(
    '/admin/coupons/export',
    `cupons-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

// ---------- Moderation: comments + reviews ----------

export interface AdminCommentDto {
  id: string;
  lessonId: string;
  courseId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'superadmin';
  body: string;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReviewDto {
  id: string;
  courseId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCommentsFilter {
  search?: string;
  courseId?: string;
  authorId?: string;
  hidden?: 'true' | 'false' | 'all';
}

export async function fetchAdminComments(
  filter: ListCommentsFilter = {},
): Promise<AdminCommentDto[]> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set('search', filter.search);
  if (filter.courseId) qs.set('courseId', filter.courseId);
  if (filter.authorId) qs.set('authorId', filter.authorId);
  if (filter.hidden) qs.set('hidden', filter.hidden);
  const path = `/admin/comments${qs.size > 0 ? `?${qs.toString()}` : ''}`;
  return http.get<AdminCommentDto[]>(path);
}

export async function bulkCommentAction(
  ids: string[],
  action: 'hide' | 'show' | 'delete',
): Promise<{ updated: number; removed: number }> {
  return http.post('/admin/comments/bulk', { ids, action });
}

export interface ListReviewsFilter {
  search?: string;
  courseId?: string;
  minRating?: number;
  maxRating?: number;
}

export async function fetchAdminReviews(filter: ListReviewsFilter = {}): Promise<AdminReviewDto[]> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set('search', filter.search);
  if (filter.courseId) qs.set('courseId', filter.courseId);
  if (filter.minRating !== undefined) qs.set('minRating', String(filter.minRating));
  if (filter.maxRating !== undefined) qs.set('maxRating', String(filter.maxRating));
  const path = `/admin/reviews${qs.size > 0 ? `?${qs.toString()}` : ''}`;
  return http.get<AdminReviewDto[]>(path);
}

export async function deleteAdminReview(courseId: string, reviewId: string): Promise<void> {
  await http.delete<{ ok: true }>(
    `/admin/courses/${encodeURIComponent(courseId)}/reviews/${encodeURIComponent(reviewId)}`,
  );
}

// ---------- Sales analytics ----------

export interface SalesSummaryDto {
  range: { from: string; to: string; days: number };
  series: Array<{ date: string; revenueCents: number; orders: number }>;
  totals: {
    revenueCents: number;
    refundedCents: number;
    paidOrders: number;
    pendingOrders: number;
    canceledOrders: number;
    refundedOrders: number;
    failedOrders: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    revenueCents: number;
    orders: number;
  }>;
  statusDistribution: Record<OrderStatus, number>;
  comparison: {
    previousRange: { from: string; to: string };
    revenuePctChange: number | null;
    ordersPctChange: number | null;
  };
}

export async function fetchSalesSummary(days = 30): Promise<SalesSummaryDto> {
  return http.get<SalesSummaryDto>(`/admin/sales/summary?days=${days}`);
}

// ---------- Admin daily digest ----------

export interface DigestConfigDto {
  enabled: boolean;
  hourUtc: number;
  recipientRoles: Array<'admin' | 'superadmin'>;
}

export interface DigestPreviewDto {
  subject: string;
  html: string;
  data: {
    windowFrom: string;
    windowTo: string;
    newOrders: number;
    paidOrders: number;
    revenueCents: number;
    refundedOrders: number;
    newUsers: number;
    certificatesIssued: number;
    topProducts: Array<{ name: string; revenueCents: number; count: number }>;
  };
}

export interface DigestRunResultDto {
  recipientCount: number;
  sent: number;
  errors: number;
  data: DigestPreviewDto['data'];
}

export async function fetchDigestConfig(): Promise<DigestConfigDto> {
  return http.get<DigestConfigDto>('/admin/digest/config');
}

export async function updateDigestConfig(
  patch: Partial<DigestConfigDto>,
): Promise<DigestConfigDto> {
  return http.put<DigestConfigDto>('/admin/digest/config', patch);
}

export async function previewDigest(): Promise<DigestPreviewDto> {
  return http.get<DigestPreviewDto>('/admin/digest/preview');
}

export async function runDigestNow(dryRun = false): Promise<DigestRunResultDto> {
  return http.post<DigestRunResultDto>('/admin/digest/run-now', { dryRun });
}

// ---------- Admin: e-mail semanal de progresso do aluno ----------

export interface StudentProgressEmailConfigDto {
  enabled: boolean;
  /** 0 = domingo ... 6 = sábado (UTC) */
  dayOfWeekUtc: number;
  hourUtc: number;
}

export interface StudentProgressEmailStatusDto {
  lastRunAt: string | null;
  lastResult: { sent: number; skipped: number } | null;
}

export async function fetchStudentProgressEmailConfig(): Promise<StudentProgressEmailConfigDto> {
  return http.get<StudentProgressEmailConfigDto>('/admin/email/student-progress');
}

export async function updateStudentProgressEmailConfig(
  patch: Partial<StudentProgressEmailConfigDto>,
): Promise<StudentProgressEmailConfigDto> {
  return http.put<StudentProgressEmailConfigDto>('/admin/email/student-progress', patch);
}

export async function fetchStudentProgressEmailStatus(): Promise<StudentProgressEmailStatusDto> {
  return http.get<StudentProgressEmailStatusDto>('/admin/email/student-progress/status');
}

// ---------- Leaderboard ----------

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  lessonsCompleted: number;
  activeDays: number;
  achievements: number;
  score: number;
}

export interface LeaderboardResultDto {
  range: { from: string; to: string; days: number };
  total: number;
  entries: LeaderboardEntryDto[];
}

export interface MyRankDto {
  rank: number;
  total: number;
  entry?: LeaderboardEntryDto;
}

export async function fetchLeaderboard(days = 30, limit = 20): Promise<LeaderboardResultDto> {
  return http.get<LeaderboardResultDto>(`/admin/leaderboard?days=${days}&limit=${limit}`);
}

export async function fetchMyRank(days = 30): Promise<MyRankDto> {
  return http.get<MyRankDto>(`/me/leaderboard?days=${days}`);
}

export interface PublicLeaderboardEntryDto {
  rank: number;
  userId: string;
  displayName: string;
  lessonsCompleted: number;
  activeDays: number;
  achievements: number;
  score: number;
}

export interface PublicLeaderboardDto {
  range: { from: string; to: string; days: number };
  total: number;
  entries: PublicLeaderboardEntryDto[];
}

export async function fetchPublicLeaderboard(days = 30, limit = 5): Promise<PublicLeaderboardDto> {
  return http.get<PublicLeaderboardDto>(`/leaderboard/top?days=${days}&limit=${limit}`);
}

// ---------- Bulk import users ----------

export interface ImportUserRowDto {
  email: string;
  name?: string;
  courseIds?: string[];
}

export interface ImportUsersResultDto {
  total: number;
  created: number;
  enrolled: number;
  skipped: number;
  errors: Array<{ row: number; email?: string; message: string }>;
}

export async function importUsers(
  rows: ImportUserRowDto[],
  sendWelcomeEmail = false,
): Promise<ImportUsersResultDto> {
  return http.post<ImportUsersResultDto>('/admin/users/import', {
    rows,
    sendWelcomeEmail,
  });
}

// ---------- Wishlist ----------

export interface WishlistEntryDto {
  userId: string;
  courseId: string;
  addedAt: string;
}

export interface CourseWishCountDto {
  courseId: string;
  count: number;
  addedLastWeek: number;
}

export async function fetchMyWishlist(): Promise<WishlistEntryDto[]> {
  return http.get<WishlistEntryDto[]>('/me/wishlist');
}

export async function addToWishlist(courseId: string): Promise<WishlistEntryDto> {
  return http.post<WishlistEntryDto>(`/me/wishlist/${encodeURIComponent(courseId)}`, {});
}

export async function removeFromWishlist(courseId: string): Promise<void> {
  await http.delete<{ ok: true }>(`/me/wishlist/${encodeURIComponent(courseId)}`);
}

export async function fetchWishlistAggregate(): Promise<CourseWishCountDto[]> {
  return http.get<CourseWishCountDto[]>('/admin/wishlist/aggregate');
}

export async function downloadWishlistCsv(): Promise<void> {
  return downloadCsv(
    '/admin/wishlist/export.csv',
    `wishlist-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export interface StorageStatsDto {
  dataDir: string;
  totalBytes: number;
  totalMB: number;
  jsonFilesCount: number;
  backupFoldersCount: number;
  uploadFilesCount: number;
}

export async function fetchStorageStats(): Promise<StorageStatsDto> {
  return http.get<StorageStatsDto>('/admin/storage/stats');
}

export async function cancelMyOrder(id: string): Promise<OrderDto> {
  return http.post<OrderDto>(`/me/orders/${encodeURIComponent(id)}/cancel`, {});
}

export async function adminUpdateOrderStatus(
  id: string,
  status: 'canceled' | 'refunded' | 'failed',
  note?: string,
): Promise<OrderDto> {
  return http.put<OrderDto>(`/admin/orders/${encodeURIComponent(id)}/status`, { status, note });
}

export interface RefundResultDto {
  ok: true;
  partial: boolean;
  refundedCents: number;
  externalRefundId?: string;
  order: OrderDto;
}

export async function adminRefundOrder(
  id: string,
  options: { amountCents?: number; reason?: string } = {},
): Promise<RefundResultDto> {
  return http.post<RefundResultDto>(`/admin/orders/${encodeURIComponent(id)}/refund`, options);
}

// ---------- Imports (admin) ----------

export type ImportEntityTypeDto =
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

export interface ImportFieldDef {
  name: string;
  label: string;
  required: boolean;
  example?: string;
  description?: string;
}

export interface ImportTemplateDto {
  entity: ImportEntityTypeDto;
  filename: string;
  fields: ImportFieldDef[];
}

export type ImportJobStatusDto =
  | 'pending'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'canceled'
  | 'rolled_back';

export interface ImportJobDto {
  id: string;
  source: 'wordpress' | 'learndash' | 'woocommerce' | 'csv';
  mode: 'api' | 'csv';
  status: ImportJobStatusDto;
  dryRun: boolean;
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
  perEntity: Record<string, unknown>;
  startedBy: string;
  startedAt: string;
  finishedAt?: string;
  errorsLog: Array<{
    entity: string;
    rowIndex: number;
    message: string;
    field?: string;
  }>;
  notes: Array<{ ts: string; level: string; message: string }>;
  createdRefs: Array<{
    entity: string;
    internalId: string;
    externalId?: string;
  }>;
}

export async function fetchImportTemplates(): Promise<ImportTemplateDto[]> {
  return http.get<ImportTemplateDto[]>('/admin/imports/templates');
}

export async function downloadImportTemplate(entity: ImportEntityTypeDto): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch(`/api/admin/imports/templates/${encodeURIComponent(entity)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers.get('content-disposition') ?? '';
  const m = cd.match(/filename="([^"]+)"/);
  a.download = m?.[1] ?? `${entity}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportJobsFilterDto {
  status?: string;
  source?: string;
  mode?: string;
  dryRun?: boolean;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  limit?: number;
}

export async function fetchImportJobs(filter: ImportJobsFilterDto = {}): Promise<ImportJobDto[]> {
  const qs = new URLSearchParams();
  if (filter.status) qs.set('status', filter.status);
  if (filter.source) qs.set('source', filter.source);
  if (filter.mode) qs.set('mode', filter.mode);
  if (filter.dryRun !== undefined) qs.set('dryRun', String(filter.dryRun));
  if (filter.dateFrom) qs.set('dateFrom', filter.dateFrom);
  if (filter.dateTo) qs.set('dateTo', filter.dateTo);
  if (filter.q) qs.set('q', filter.q);
  if (filter.limit) qs.set('limit', String(filter.limit));
  const path = `/admin/imports/jobs${qs.toString() ? `?${qs.toString()}` : ''}`;
  return http.get<ImportJobDto[]>(path);
}

export async function fetchImportJob(id: string): Promise<ImportJobDto> {
  return http.get<ImportJobDto>(`/admin/imports/jobs/${encodeURIComponent(id)}`);
}

export async function downloadImportJob(id: string, format: 'csv' | 'json'): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch(
    `/api/admin/imports/jobs/${encodeURIComponent(id)}/export?format=${format}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-${id}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface RollbackPreviewDto {
  refs: Array<{
    id: string;
    sourceType: string;
    externalEntityType: string;
    externalId: string;
    internalEntityType: string;
    internalId: string;
    jobId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  productsToDeactivate: ImportJobDto['createdRefs'];
  studentsCreated: ImportJobDto['createdRefs'];
  enrollmentsCreated: ImportJobDto['createdRefs'];
}

export async function previewImportRollback(id: string): Promise<RollbackPreviewDto> {
  return http.get<RollbackPreviewDto>(
    `/admin/imports/jobs/${encodeURIComponent(id)}/rollback/preview`,
  );
}

export interface RollbackResultDto {
  jobId: string;
  refsRemoved: number;
  productsDeactivated: number;
  notes: string[];
}

export async function rollbackImportJob(id: string): Promise<RollbackResultDto> {
  return http.post<RollbackResultDto>(`/admin/imports/jobs/${encodeURIComponent(id)}/rollback`, {});
}

export async function cancelImportJob(id: string): Promise<{ ok: true; jobId: string }> {
  return http.post<{ ok: true; jobId: string }>(
    `/admin/imports/jobs/${encodeURIComponent(id)}/cancel`,
    {},
  );
}

/**
 * Faz upload multipart de CSVs por entidade.
 * Cada chave em `files` deve ser um File com cabeçalhos canônicos (vide template).
 */

export type EnrollmentStartRuleDto =
  | 'paid_date'
  | 'completed_date'
  | 'order_date'
  | 'imported'
  | 'now';
export type EnrollmentExpirationRuleDto =
  | 'start_plus_duration'
  | 'order_plus_duration'
  | 'paid_plus_duration'
  | 'completed_plus_duration'
  | 'explicit'
  | 'lifetime'
  | 'course_fixed_end';

export interface RunRealOptions {
  startRule?: EnrollmentStartRuleDto;
  expirationRule?: EnrollmentExpirationRuleDto;
  defaultAccessDurationDays?: number;
}

export async function startCsvRunReal(
  files: Partial<Record<ImportEntityTypeDto, File>>,
  options: RunRealOptions = {},
): Promise<{ jobId: string; totalRows: number }> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const form = new FormData();
  for (const [entity, file] of Object.entries(files)) {
    if (file instanceof File) form.set(`file_${entity}`, file);
  }
  if (options.startRule) form.set('enrollment_start_rule', options.startRule);
  if (options.expirationRule) form.set('enrollment_expiration_rule', options.expirationRule);
  if (options.defaultAccessDurationDays !== undefined)
    form.set('default_access_duration_days', String(options.defaultAccessDurationDays));
  const res = await fetch('/api/admin/imports/run/csv', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { jobId: string; totalRows: number };
}

// ---------- Connections (REST WP/LD/WC) ----------

export interface ImportConnectionDto {
  id: string;
  name: string;
  kind: 'wp_ld_wc';
  siteUrl: string;
  wpUsername?: string;
  hasWpAppPassword: boolean;
  hasWcConsumerKey: boolean;
  hasWcConsumerSecret: boolean;
  defaultUserMatchKeys?: UserMatchKeyDto[];
  defaultConflictStrategy?: ConflictStrategyDto;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
}

export interface ImportConnectionInputDto {
  name: string;
  siteUrl: string;
  wpUsername?: string;
  wpAppPassword?: string;
  wcConsumerKey?: string;
  wcConsumerSecret?: string;
  defaultUserMatchKeys?: UserMatchKeyDto[];
  defaultConflictStrategy?: ConflictStrategyDto;
}

export async function fetchImportConnections(): Promise<ImportConnectionDto[]> {
  return http.get<ImportConnectionDto[]>('/admin/imports/connections');
}

export async function createImportConnection(
  input: ImportConnectionInputDto,
): Promise<ImportConnectionDto> {
  return http.post<ImportConnectionDto>('/admin/imports/connections', input);
}

export async function updateImportConnection(
  id: string,
  input: Partial<ImportConnectionInputDto>,
): Promise<ImportConnectionDto> {
  return http.put<ImportConnectionDto>(
    `/admin/imports/connections/${encodeURIComponent(id)}`,
    input,
  );
}

export async function deleteImportConnection(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/admin/imports/connections/${encodeURIComponent(id)}`);
}

export interface ConnectionTestResult {
  wp: { ok: boolean; message: string };
  ld: { ok: boolean; message: string };
  wc: { ok: boolean; skipped?: boolean; message: string };
  overall: 'ok' | 'error';
}

export async function testImportConnection(id: string): Promise<ConnectionTestResult> {
  return http.post<ConnectionTestResult>(
    `/admin/imports/connections/${encodeURIComponent(id)}/test`,
    {},
  );
}

export interface ConnectionDiagnoseResult {
  rootOk: boolean;
  rootStatus: number;
  rootMessage: string;
  meOk: boolean;
  meStatus: number;
  meRoles: string[];
  meUser: string | null;
  usersListOk: boolean;
  usersListStatus: number;
  usersListMessage: string;
  usersFirstEmail: string | null;
}

export async function diagnoseImportConnection(id: string): Promise<ConnectionDiagnoseResult> {
  return http.post<ConnectionDiagnoseResult>(
    `/admin/imports/connections/${encodeURIComponent(id)}/diagnose`,
    {},
  );
}

export interface ConnectionDiagnoseLdResult {
  rootNamespacesIncludesLdlms: boolean;
  rootNamespaces: string[];
  endpoints: Array<{ path: string; ok: boolean; status: number; detail: string }>;
  discoveredSlugs: {
    courses: string;
    lessons: string;
    topics: string;
    quizzes: string;
    questions: string;
    groups: string;
    courseUsers: string;
    courseSteps: string;
    coursePrerequisites: string;
    userCourseProgress: string;
  };
  customSlugs: Array<{ entity: string; default: string; actual: string }>;
  rawRoutesPreview: string[];
  hint: string;
}

export async function diagnoseImportConnectionLd(id: string): Promise<ConnectionDiagnoseLdResult> {
  return http.post<ConnectionDiagnoseLdResult>(
    `/admin/imports/connections/${encodeURIComponent(id)}/diagnose-ld`,
    {},
  );
}

export type UserMatchKeyDto = 'email' | 'document' | 'external_id' | 'wp_user_id';
export type ConflictStrategyDto = 'ignore' | 'update' | 'merge' | 'create_duplicate' | 'error';

export interface RunApiInputDto {
  connectionId: string;
  entities: ImportEntityTypeDto[];
  dryRun?: boolean;
  enrollment?: {
    startRule?: EnrollmentStartRuleDto;
    expirationRule?: EnrollmentExpirationRuleDto;
    defaultAccessDurationDays?: number;
    userMatchKeys?: UserMatchKeyDto[];
    userMatchStrategy?: 'email_first' | 'external_id_first' | 'email_only' | 'external_id_only';
    unmatchedUserPolicy?: 'skip' | 'create_stub' | 'error';
    conflictStrategy?: ConflictStrategyDto;
    /** Importa rows com erros de validacao mesmo assim (logs como warning). */
    skipValidationErrors?: boolean;
  };
}

export async function startApiRun(
  input: RunApiInputDto,
): Promise<{ jobId: string; dryRun: boolean; entities: string[] }> {
  return http.post<{ jobId: string; dryRun: boolean; entities: string[] }>(
    '/admin/imports/run/api',
    input,
  );
}

// ---------- Schedules ----------

export type ScheduleFrequencyDto = 'daily' | 'weekly';
export type WeekdayDto = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ImportScheduleDto {
  id: string;
  name: string;
  connectionId: string;
  enabled: boolean;
  frequency: ScheduleFrequencyDto;
  hourUtc: number;
  minute: number;
  weekday?: WeekdayDto;
  entities: ImportEntityTypeDto[];
  dryRun: boolean;
  enrollment?: {
    startRule?: EnrollmentStartRuleDto;
    expirationRule?: EnrollmentExpirationRuleDto;
    defaultAccessDurationDays?: number;
    userMatchKeys?: UserMatchKeyDto[];
    conflictStrategy?: ConflictStrategyDto;
    unmatchedUserPolicy?: 'skip' | 'create_stub' | 'error';
  };
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastJobId?: string;
  nextRunAt?: string;
}

export interface ImportScheduleInputDto {
  name: string;
  connectionId: string;
  enabled?: boolean;
  frequency: ScheduleFrequencyDto;
  hourUtc: number;
  minute: number;
  weekday?: WeekdayDto;
  entities: ImportEntityTypeDto[];
  dryRun?: boolean;
  enrollment?: ImportScheduleDto['enrollment'];
}

export async function fetchImportSchedules(): Promise<ImportScheduleDto[]> {
  return http.get<ImportScheduleDto[]>('/admin/imports/schedules');
}

export async function createImportSchedule(
  input: ImportScheduleInputDto,
): Promise<ImportScheduleDto> {
  return http.post<ImportScheduleDto>('/admin/imports/schedules', input);
}

export async function updateImportSchedule(
  id: string,
  input: Partial<ImportScheduleInputDto>,
): Promise<ImportScheduleDto> {
  return http.put<ImportScheduleDto>(`/admin/imports/schedules/${encodeURIComponent(id)}`, input);
}

export async function deleteImportSchedule(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/admin/imports/schedules/${encodeURIComponent(id)}`);
}

export async function runImportScheduleNow(
  id: string,
): Promise<{ jobId: string; dryRun: boolean; entities: string[] }> {
  return http.post<{ jobId: string; dryRun: boolean; entities: string[] }>(
    `/admin/imports/schedules/${encodeURIComponent(id)}/run-now`,
    {},
  );
}

export interface CsvPreviewDto {
  entity: ImportEntityTypeDto;
  headers: string[];
  totalRows: number;
  sampleRows: Array<Record<string, string>>;
  targetFields: ImportFieldDef[];
  suggestedMapping: Array<{ source: string; target: string | null }>;
}

export async function previewCsv(entity: ImportEntityTypeDto, file: File): Promise<CsvPreviewDto> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const form = new FormData();
  form.set(`file_${entity}`, file);
  const res = await fetch('/api/admin/imports/preview/csv', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as CsvPreviewDto;
}

export async function startCsvDryRun(
  files: Partial<Record<ImportEntityTypeDto, File>>,
): Promise<{ jobId: string; totalRows: number }> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const form = new FormData();
  for (const [entity, file] of Object.entries(files)) {
    if (file instanceof File) form.set(`file_${entity}`, file);
  }
  const res = await fetch('/api/admin/imports/dry-run/csv', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { jobId: string; totalRows: number };
}

// ---------- Admin stats ----------

export interface CompletionsStatsDto {
  days: number;
  total: number;
  series: Array<{ day: string; count: number }>;
}

export async function fetchCompletionsStats(days = 7): Promise<CompletionsStatsDto> {
  return http.get<CompletionsStatsDto>(`/admin/stats/completions?days=${days}`);
}

export interface TutorUsageStatsDto {
  days: number;
  totalTurns: number;
  uniqueUsers: number;
  byDay: Array<{ day: string; count: number }>;
  topUsers: Array<{ userId: string; count: number; email: string | null; name: string | null }>;
}

export async function fetchTutorUsageStats(days = 30): Promise<TutorUsageStatsDto> {
  return http.get<TutorUsageStatsDto>(`/admin/stats/tutor-usage?days=${days}`);
}

export interface ErrorsStatsDto {
  days: number;
  total: number;
  totalClient: number;
  totalServer: number;
  series: Array<{ day: string; client: number; server: number; total: number }>;
}

export async function fetchErrorsStats(days = 7): Promise<ErrorsStatsDto> {
  return http.get<ErrorsStatsDto>(`/admin/stats/errors?days=${days}`);
}

export interface AuditStatsDto {
  days: number;
  total: number;
  series: Array<{ day: string; ok: number; error: number; total: number }>;
}

export async function fetchAuditStats(days = 7): Promise<AuditStatsDto> {
  return http.get<AuditStatsDto>(`/admin/stats/audit?days=${days}`);
}

// ---------- Health (admin) ----------

export interface HealthStatsDto {
  ok: true;
  ts: number;
  uptimeSec: number;
  startedAt: string;
  nodeVersion: string;
  pid: number;
  memMB: number;
  dataSizeMB: number;
  errors24h: number;
  db: 'connected' | 'fallback';
  lastBackupAt: string | null;
  backupsCount: number;
}

export async function fetchHealth(): Promise<HealthStatsDto> {
  return http.get<HealthStatsDto>('/health/full');
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
  audience: 'all' | 'students' | 'admins' | 'user' | 'users';
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  category?: NotificationDto['category'];
  link?: string;
}

export interface BroadcastEntryDto {
  title: string;
  body: string;
  category: NotificationDto['category'];
  authorEmail: string | null;
  firstAt: string;
  recipientsCount: number;
  readCount: number;
}

export async function fetchSentBroadcasts(limit = 50): Promise<BroadcastEntryDto[]> {
  return http.get<BroadcastEntryDto[]>(`/admin/notifications/sent?limit=${limit}`);
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

export async function downloadAuditLogCsv(filter: AuditFilter = {}): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const qs = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`/api/admin/audit-log.csv${suffix}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `audit-log-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
  return http.get<PodcastEpisode>(`/podcasts/${encodeURIComponent(id)}`).catch(() => null);
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

export async function fetchAllCertificates(): Promise<Certificate[]> {
  return http.get<Certificate[]>('/admin/certificates');
}

export interface ValidationStatDto {
  code: string;
  count: number;
  firstAt: string;
  lastAt: string;
}

export async function fetchCertValidations(): Promise<ValidationStatDto[]> {
  return http.get<ValidationStatDto[]>('/admin/certificates/validations');
}

export async function validateCertificate(code: string): Promise<{
  valid: boolean;
  certificate?: Certificate;
  courseTitle?: string | null;
  courseHours?: number | null;
  studentName?: string | null;
}> {
  try {
    return await http.get(`/certificates/validate/${encodeURIComponent(code)}`);
  } catch {
    return { valid: false };
  }
}

export async function issueCertificate(studentId: string, courseId: string): Promise<Certificate> {
  return http.post<Certificate>('/admin/certificates', { studentId, courseId });
}

export async function revokeCertificate(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/certificates/${encodeURIComponent(id)}`);
}

// ---------- Retention ----------

export interface RetentionRecomputeSummary {
  ok: true;
  total: number;
  byLevel: { baixo: number; medio: number; alto: number; critico: number };
  updated: number;
  durationMs: number;
}

export async function recomputeRetentionRisks(): Promise<RetentionRecomputeSummary> {
  return http.post<RetentionRecomputeSummary>('/admin/retention/recompute', {});
}

export async function fetchRetentionRisks(level?: string): Promise<RetentionRisk[]> {
  return http.get<RetentionRisk[]>('/retention/risks', {
    query: { level },
  });
}

// ---------- Sessions ----------

export async function fetchProfessionals(): Promise<ProfessionalRow[]> {
  return http.get<ProfessionalRow[]>('/sessions/professionals');
}

export async function fetchSessionServices(): Promise<SessionService[]> {
  return http.get<SessionService[]>('/sessions/services');
}

/**
 * Profissional como a tela do aluno o recebe.
 *
 * Sem `email` e sem `hourlyRate`: `/sessions/professionals` é rota aberta, e
 * dado de contato de gente real não fica servido para a internet inteira. Quem
 * gerencia usa `fetchAdminProfessionals`, que devolve tudo.
 */
export interface ProfessionalRow extends Omit<Professional, 'email' | 'hourlyRate'> {
  level: string;
  active: boolean;
  available: boolean;
  credentials: string;
  /** Preço da sessão em centavos, derivado da faixa de titulação. */
  priceCents: number;
  /** Sem faixa ativa correspondente: `priceCents` é 0 por falta, não de graça. */
  precoIndefinido: boolean;
}

/** O mesmo profissional com os campos que só a gestão vê. */
export interface AdminProfessionalRow extends ProfessionalRow {
  email: string;
  hourlyRate: number;
}

export async function fetchAdminProfessionals(): Promise<AdminProfessionalRow[]> {
  return http.get<AdminProfessionalRow[]>('/admin/sessions/professionals');
}

export interface PriceTier {
  id: string;
  label: string;
  description: string;
  priceCents: number;
  active: boolean;
  order: number;
}

/** Reexporta o tipo do serviço para quem consome só a camada de dados. */
export type SessionServiceDto = SessionService;

export async function fetchPriceTiers(): Promise<PriceTier[]> {
  return http.get<PriceTier[]>('/sessions/price-tiers');
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'scheduled' | 'done' | 'cancelled';

export interface SessionBooking {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  scheduledFor: string;
  durationMinutes: number;
  priceCents: number;
  tierId: string;
  status: BookingStatus;
  meetingLink: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string;
  orderId: string | null;
}

export interface CreateBookingInput {
  serviceId: string;
  professionalId: string;
  /** ISO-8601. */
  scheduledFor: string;
  notes?: string;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ aviso: string; agendamento: SessionBooking }> {
  return http.post('/sessions/bookings', input);
}

export async function fetchMyBookings(): Promise<SessionBooking[]> {
  return http.get<SessionBooking[]>('/sessions/bookings');
}

/** Remarca. Só a data muda — trocar de profissional é agendar outra coisa. */
export async function rescheduleBooking(
  id: string,
  scheduledFor: string,
): Promise<SessionBooking> {
  return http.post<SessionBooking>(
    `/sessions/bookings/${encodeURIComponent(id)}/reschedule`,
    { scheduledFor },
  );
}

export async function cancelBooking(id: string, reason = ''): Promise<SessionBooking> {
  return http.post<SessionBooking>(`/sessions/bookings/${encodeURIComponent(id)}/cancel`, {
    reason,
  });
}

/**
 * Abre o pagamento da sessão. Devolve o pedido com `checkoutUrl` do gateway —
 * o preço vem do agendamento, não de uma linha de produto.
 */
export async function checkoutBooking(id: string): Promise<{
  id: string;
  status: string;
  amountCents: number;
  checkoutUrl?: string | null;
  qrCode?: string | null;
}> {
  return http.post(`/sessions/bookings/${encodeURIComponent(id)}/checkout`, {});
}

export async function fetchAllBookings(): Promise<SessionBooking[]> {
  return http.get<SessionBooking[]>('/admin/sessions/bookings');
}

export async function updateBooking(
  id: string,
  patch: { status?: BookingStatus; meetingLink?: string; notes?: string },
): Promise<SessionBooking> {
  return http.put<SessionBooking>(`/admin/sessions/bookings/${encodeURIComponent(id)}`, patch);
}

export async function seedSessionServices(): Promise<{ criados: number }> {
  return http.post('/admin/sessions/services/seed', {});
}

export interface StatusMetricas {
  fonte: 'demo' | 'google-analytics' | 'search-console';
  conectado: boolean;
  observacao: string;
}

/** De onde vêm os números da tela de métricas. Ver server/repositories/metrics.ts. */
export async function fetchMetricsStatus(): Promise<StatusMetricas> {
  return http.get<StatusMetricas>('/metrics/seo/status');
}

export async function fetchSessionPolicy(): Promise<{ aviso: string; baseLegal: string }> {
  return http.get('/sessions/policy');
}

export async function createSessionService(
  input: Partial<SessionService>,
): Promise<SessionService> {
  return http.post<SessionService>('/admin/sessions/services', input);
}

export async function updateSessionService(
  id: string,
  patch: Partial<SessionService>,
): Promise<SessionService> {
  return http.put<SessionService>(`/admin/sessions/services/${encodeURIComponent(id)}`, patch);
}

export async function deleteSessionService(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/sessions/services/${encodeURIComponent(id)}`);
}

export async function createProfessional(
  input: Partial<ProfessionalRow>,
): Promise<ProfessionalRow> {
  return http.post<ProfessionalRow>('/admin/sessions/professionals', input);
}

export async function updateProfessional(
  id: string,
  patch: Partial<ProfessionalRow>,
): Promise<ProfessionalRow> {
  return http.put<ProfessionalRow>(
    `/admin/sessions/professionals/${encodeURIComponent(id)}`,
    patch,
  );
}

export async function deleteProfessional(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/sessions/professionals/${encodeURIComponent(id)}`);
}

export async function upsertPriceTier(id: string, patch: Partial<PriceTier>): Promise<PriceTier> {
  return http.put<PriceTier>(`/admin/sessions/price-tiers/${encodeURIComponent(id)}`, patch);
}

export async function seedPriceTiers(): Promise<{ criadas: number }> {
  return http.post('/admin/sessions/price-tiers/seed', {});
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

/**
 * O relatório de tráfego medido pelo próprio servidor. Substitui os blocos que
 * até 27/ago/2026 eram constantes escritas à mão dentro da tela.
 */
export interface RelatorioTrafego {
  range: string;
  de: string;
  ate: string;
  medindoDesde: string | null;
  diasComDados: number;
  resumo: {
    visitors: number;
    pageviews: number;
    bounceRate: number | null;
    avgSessionMinutes: number | null;
    lcpP75Ms: number | null;
    lcpAmostras: number;
    deltaVisitors: number | null;
    deltaPageviews: number | null;
  };
  serie: SeoMetric[];
  topPages: Array<{
    path: string;
    views: number;
    avgSeconds: number | null;
    bounceRate: number | null;
  }>;
  sources: Array<{ name: string; sessions: number; pct: number }>;
  devices: Array<{ name: string; sessions: number; pct: number }>;
  notFound: Array<{ path: string; hits: number }>;
  tecnico: Array<{
    label: string;
    value: string;
    status: 'ok' | 'warn' | 'desconhecido';
    fonte: string;
  }>;
  status: {
    fonte: string;
    conectado: boolean;
    medindoDesde: string | null;
    semFonte: Array<{ o_que: string; depende_de: string }>;
    observacao: string;
  };
}

export async function fetchTrafego(range = '30d'): Promise<RelatorioTrafego> {
  return http.get<RelatorioTrafego>('/admin/analytics/trafego', { query: { range } });
}

/** Percentual com a base que o gerou — número solto engana. */
export interface Medida {
  pct: number | null;
  base: number;
}

export interface RelatorioRetencao {
  geradoEm: string;
  base: { alunos: number; matriculas: number; cursos: number };
  kpis: {
    ativosRecentes: Medida;
    conclusaoGeral: Medida;
    horasAssistidas: { horas: number; alunos: number };
    impactoReengajamento: Medida;
  };
  cursos: Array<{
    id: string;
    nome: string;
    matriculados: number;
    conclusao: Medida;
    emRisco: Medida;
    progressoMedio: number | null;
  }>;
  coorte: Array<{
    semana: number;
    porCurso: Record<string, number | null>;
    basePorCurso: Record<string, number>;
  }>;
  reengajamento: Array<{ semana: string; enviados: number; retomados: number }>;
  naoMedido: Array<{ o_que: string; depende_de: string }>;
}

export async function fetchRetencao(): Promise<RelatorioRetencao> {
  return http.get<RelatorioRetencao>('/admin/analytics/retencao');
}

/**
 * Agenda de um profissional num dia. Antes a tela listava oito horários fixos
 * sob o título "Horários disponíveis" sem consultar nada.
 */
export interface AgendaDoDia {
  data: string;
  professionalId: string;
  durationMinutes: number;
  slots: Array<{ hora: string; disponivel: boolean; motivo?: 'ocupado' | 'passado' }>;
  observacao: string;
}

/** O que está conectado ao AVA — apurado, não escrito à mão na tela. */
export interface Integracao {
  id: string;
  nome: string;
  categoria: string;
  estado: 'conectado' | 'disponivel' | 'inexistente';
  detalhe: string;
  ondeConfigurar?: string;
}

/**
 * O corpo de uma aula. Rota separada e autenticada desde 27/ago/2026: o
 * catálogo é público e devolvia `lesson.content` junto, então o material pago
 * saía num `curl` sem token. Ver `server/access/conteudo-aula.ts`.
 */
export interface ConteudoDaAula {
  lessonId: string;
  courseId: string;
  content: string | null;
  /**
   * O vídeo vem por aqui desde 2/set/2026, e não mais pelo catálogo.
   *
   * Enquanto vinha de lá, o player era montado com a mesma URL que um visitante
   * anônimo também recebia: o curso interno tocava inteiro para quem não estava
   * matriculado.
   */
  videoUrl: string | null;
}

export async function fetchConteudoDaAula(
  courseId: string,
  lessonId: string,
): Promise<ConteudoDaAula> {
  return http.get<ConteudoDaAula>(
    `/me/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/content`,
  );
}

export async function fetchIntegracoes(): Promise<Integracao[]> {
  return http.get<Integracao[]>('/admin/integracoes');
}

export async function fetchAgendaDoDia(
  professionalId: string,
  data: string,
): Promise<AgendaDoDia> {
  return http.get<AgendaDoDia>(
    `/sessions/professionals/${encodeURIComponent(professionalId)}/horarios`,
    { query: { data } },
  );
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

export async function createAiConfiguration(input: {
  module: string;
  provider: string;
  model: string;
  apiKey?: string;
  active?: boolean;
  systemMessage?: string;
  temperature?: number;
}): Promise<AiConfigPublic> {
  return http.post<AiConfigPublic>('/admin/ai/configurations', input);
}

export async function deleteAiConfiguration(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/ai/configurations/${encodeURIComponent(id)}`);
}

export async function fetchAiConfiguration(
  id: string,
): Promise<
  AiConfigPublic & {
    usage: {
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      total: number;
      successCount: number;
      successRate: number;
    };
  }
> {
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

export async function createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
  return http.post<SupportTicket>('/support/tickets', input);
}

// ---------- Admin students ----------

export type { StudentsFilter };

export async function fetchAdminStudents(filters: StudentsFilter = {}): Promise<AdminStudentRow[]> {
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
  coverImageUrl?: string;
  title?: string;
  slug?: string;
  shortTitle?: string;
  description?: string;
  totalHours?: number;
  certificateAvailable?: boolean;
  coverColor?: string;
  active?: boolean;
  tags?: string[];
  prerequisiteCourseIds?: string[];
  learningOutcomes?: string[];
  instructorName?: string;
  instructorBio?: string;
  instructorPhotoUrl?: string;
  collaborators?: Array<{
    name: string;
    role?: string;
    bio?: string;
    photoUrl?: string;
  }>;
  changelog?: Array<{
    version: string;
    date: string;
    notes: string;
  }>;
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
  // Campos da página pública (/formacao/:slug) — editados na aba "Página pública"
  badge?: string;
  tagline?: string;
  tldr?: string;
  level?: string;
  language?: string;
  monthsMin?: number;
  monthsMax?: number;
  forWhom?: string[];
  faqs?: Array<{ q: string; a: string }>;
  curriculum?: Array<{ n?: string; title: string; desc?: string }>;
  /**
   * Os blocos de argumento de venda do protótipo aprovado. Existiam no schema e
   * na página desde 31/ago, mas só entravam por script — faltava o campo aqui e
   * a tela lá, então o dono não tinha onde escrevê-los.
   */
  highlights?: Array<{ title: string; note?: string }>;
  sections?: Array<{ title: string; subtitle?: string; paras: string[]; cta?: boolean }>;
  jornada?: Array<{ title: string; subtitle?: string; text: string }>;
  promoNote?: string;
}

export async function updateCourse(id: string, patch: UpdateCoursePatch): Promise<Course> {
  return http.put<Course>(`/admin/courses/${encodeURIComponent(id)}`, patch);
}

export interface ImpactoAcesso {
  meses: number | null;
  total: number;
  expirados: number;
  vencendo: number;
  ativos: number;
  comPrazoProprio: number;
  exemplos: Array<{ nome: string; email: string; desde: string; ate: string | null }>;
}

/** Dá prazo comum a quem a política deixaria vencido. Ver `darCarencia`. */
export async function darCarenciaNoCurso(
  courseId: string,
  meses: number,
  ate: string,
): Promise<{ ok: true; afetados: number; ate: string }> {
  return http.post(`/admin/courses/${encodeURIComponent(courseId)}/carencia`, { meses, ate });
}

/** Simula um prazo de acesso sem salvá-lo. Ver `server/access/impacto.ts`. */
export async function simularPrazoDoCurso(
  courseId: string,
  meses: number | null,
): Promise<ImpactoAcesso> {
  const q = meses === null ? '' : `?meses=${encodeURIComponent(String(meses))}`;
  return http.get<ImpactoAcesso>(
    `/admin/courses/${encodeURIComponent(courseId)}/impacto-acesso${q}`,
  );
}

export interface CreateCourseInput {
  title: string;
  slug: string;
  shortTitle: string;
  description?: string;
  totalHours?: number;
  certificateAvailable?: boolean;
  coverColor?: string;
  active?: boolean;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  return http.post<Course>('/admin/courses', input);
}

// ---------- Messaging configs (SMS / WhatsApp) ----------

export type MessagingProviderId = 'mock' | 'twilio' | 'whatsapp-meta';

export interface MessagingConfigView {
  id: string;
  provider: MessagingProviderId;
  enabled: boolean;
  fromNumber: string;
  whatsappPhoneNumberId?: string;
  hasApiKey: boolean;
  hasAccountSid: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingConfigInput {
  provider: MessagingProviderId;
  enabled?: boolean;
  fromNumber: string;
  apiKey?: string;
  accountSid?: string;
  whatsappPhoneNumberId?: string;
}

export async function fetchMessagingConfigs(): Promise<MessagingConfigView[]> {
  return http.get<MessagingConfigView[]>('/admin/messaging-configs');
}

export async function createMessagingConfig(
  input: MessagingConfigInput,
): Promise<MessagingConfigView> {
  return http.post<MessagingConfigView>('/admin/messaging-configs', input);
}

export async function updateMessagingConfig(
  id: string,
  patch: Partial<MessagingConfigInput>,
): Promise<MessagingConfigView> {
  return http.put<MessagingConfigView>(`/admin/messaging-configs/${encodeURIComponent(id)}`, patch);
}

export async function deleteMessagingConfig(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/messaging-configs/${encodeURIComponent(id)}`);
}

export async function pingMessagingConfig(id: string): Promise<{ ok: boolean; message: string }> {
  return http.post<{ ok: boolean; message: string }>(
    `/admin/messaging-configs/${encodeURIComponent(id)}/ping`,
    {},
  );
}

export async function testSendMessage(
  id: string,
  payload: { to: string; body?: string; whatsappTemplate?: string },
): Promise<{ ok: boolean; error?: { code: string; message: string } }> {
  return http.post<{ ok: boolean; error?: { code: string; message: string } }>(
    `/admin/messaging-configs/${encodeURIComponent(id)}/test-send`,
    payload,
  );
}

export interface AdminStudentStats {
  studentId: string;
  tutor: { questionCount: number; lastAt: string | null };
  podcast: { plays: number; favorites: number };
  library: { downloads: number | null; favorites: number | null };
}

export async function fetchAdminStudentStats(id: string): Promise<AdminStudentStats> {
  return http.get<AdminStudentStats>(`/admin/students/${encodeURIComponent(id)}/stats`);
}

/** Prazo de acesso de um aluno, curso por curso. */
export interface CourseAccessRow {
  courseId: string;
  courseTitle: string;
  enrolledAt: string | null;
  accessMonths: number | null;
  /**
   * `suspended` e `canceled` vêm da situação da matrícula, não do prazo, e
   * ganham precedência sobre ele — ver `server/access/course-access.ts`.
   *
   * Até 2/set/2026 esta linha só sabia de data, e matrícula suspensa chegava
   * como `active`: a tela do admin dizia "No prazo" para quem o portão barrava.
   */
  state: 'lifetime' | 'active' | 'expiring' | 'expired' | 'suspended' | 'canceled';
  expiresAt: string | null;
  daysLeft: number | null;
  canStudy: boolean;
}

export async function fetchStudentCourseAccess(id: string): Promise<CourseAccessRow[]> {
  const r = await http.get<{ courses: CourseAccessRow[] }>(
    `/admin/students/${encodeURIComponent(id)}/course-access`,
  );
  return r.courses;
}

/** Extensão de acesso: some meses, crave uma data, ou isente do prazo. */
export type ExtendAccessGrant = { months: number } | { until: string } | { lifetime: true };

export async function extendStudentCourseAccess(
  studentId: string,
  courseId: string,
  grant: ExtendAccessGrant,
): Promise<{ ok: true; courseId: string; expiresAt: string | null }> {
  return http.post(
    `/admin/students/${encodeURIComponent(studentId)}/courses/${encodeURIComponent(courseId)}/extend`,
    grant,
  );
}

/** Convite de primeiro acesso — panorama de quem recebe e quem não recebe. */
export interface CotaEmail {
  provider: string;
  restantes: number | null;
  aviso: string | null;
}

export interface ConviteSegmentos {
  total: number;
  elegiveis: number;
  cota?: CotaEmail | null;
  porMotivo: Record<string, number>;
  rotulos: Record<string, string>;
  amostra: Array<{
    id: string;
    nome: string;
    email: string;
    matriculas: number;
    papelOrigem: string | null;
  }>;
}

export async function fetchConviteSegmentos(): Promise<ConviteSegmentos> {
  return http.get<ConviteSegmentos>('/admin/convites/segmentos');
}

export interface ConviteExcluido {
  id: string;
  nome: string;
  email: string;
  motivo: string;
  matriculas: number;
  papelOrigem: string | null;
}

export async function fetchConviteExcluidos(motivo?: string): Promise<{
  total: number;
  mostrando: number;
  lista: ConviteExcluido[];
}> {
  const q = motivo ? `?motivo=${encodeURIComponent(motivo)}` : '';
  return http.get(`/admin/convites/excluidos${q}`);
}

export async function enviarConvites(input: {
  limite?: number;
  diasValidade?: number;
  simular?: boolean;
}): Promise<{
  enviados: number;
  restantes: number;
  simulado?: boolean;
  falhas?: Array<{ email: string; erro: string }>;
  destinatarios?: Array<{ nome: string; email: string }>;
}> {
  return http.post('/admin/convites/enviar', input);
}

/** O aluno consultando o próprio prazo — alimenta o aviso de vencimento. */
export async function fetchMyCourseAccess(): Promise<CourseAccessRow[]> {
  const r = await http.get<{ courses: CourseAccessRow[] }>('/me/course-access');
  return r.courses;
}

export async function deleteCourse(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/courses/${encodeURIComponent(id)}`);
}

export interface ReorderCourseInput {
  modules: Array<{ id: string; lessonIds: string[] }>;
}

export async function reorderCourse(id: string, payload: ReorderCourseInput): Promise<Course> {
  return http.post<Course>(`/admin/courses/${encodeURIComponent(id)}/reorder`, payload);
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

export async function createModule(courseId: string, input: CreateModulePayload): Promise<Module> {
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

export async function createLesson(moduleId: string, input: CreateLessonPayload): Promise<Lesson> {
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
  return http.post<Assessment>(`/admin/modules/${encodeURIComponent(moduleId)}/assessment`, input);
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
  customRoleSlug?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  totpEnabled?: boolean;
  tokenVersion?: number;
  avatarUrl?: string | null;
  onboardingCompletedAt?: string | null;
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

export async function deleteSystemUser(id: string, confirmEmail: string): Promise<{ ok: true }> {
  return http.delete(`/admin/users/${encodeURIComponent(id)}`, {
    headers: { 'X-Confirm-Name': confirmEmail },
  });
}

// ---------- Recovery plans ----------

export interface RecoveryPlanDto {
  id: string;
  studentId: string;
  studentName: string;
  tone: string;
  channel: string;
  intensity: string;
  goal: string;
  diagnosis: string;
  message: string;
  suggestedTutorPrompt?: string;
  weeklyGoalMinutes: number;
  status: 'draft' | 'sent' | 'in_followup' | 'completed';
  aiProvider?: string;
  aiModel?: string;
  createdAt: string;
  updatedAt: string;
}

export async function generateRecoveryPlan(
  input: RecoveryPlanInput,
): Promise<{ plan: RecoveryPlanDto }> {
  return http.post('/admin/recovery-plan', input);
}

export async function fetchStudentRecoveryPlans(
  studentId: string,
): Promise<{ plans: RecoveryPlanDto[] }> {
  return http.get(`/admin/recovery-plans/${encodeURIComponent(studentId)}`);
}

export async function updateRecoveryPlanStatus(
  id: string,
  status: RecoveryPlanDto['status'],
): Promise<RecoveryPlanDto> {
  return http.put(`/admin/recovery-plans/${encodeURIComponent(id)}/status`, { status });
}

// ---------- Email transacional ----------

/**
 * Os oito provedores de e-mail implementados em
 * `server/notifications/providers/registry.ts`.
 *
 * Este tipo listava cinco. O seletor do admin é populado pelo servidor, que
 * sempre devolveu os oito — então mailgun, brevo e ses apareciam na lista como
 * "mailgun — undefined", porque o rótulo vinha de um `Record` que não os
 * conhecia. Três provedores prontos, com cara de bug.
 */
export type EmailProviderIdDto =
  | 'mock'
  | 'resend'
  | 'sendgrid'
  | 'postmark'
  | 'mailgun'
  | 'brevo'
  | 'ses'
  | 'smtp';

export interface EmailConfigDto {
  id: string;
  provider: EmailProviderIdDto;
  enabled: boolean;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  mailgunDomain?: string;
  mailgunRegion?: 'us' | 'eu';
  sesRegion?: string;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
  hasSesSecret?: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailConfigInputDto {
  provider: EmailProviderIdDto;
  enabled?: boolean;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  /** Mailgun: domínio dedicado de envio (ex.: mg.exemplo.com) e região. */
  mailgunDomain?: string;
  mailgunRegion?: 'us' | 'eu';
  /** SES: `apiKey` é o access key id; estes completam a credencial. */
  sesRegion?: string;
  sesSecretAccessKey?: string;
}

export interface EmailLogDto {
  id: string;
  configId: string;
  provider: EmailProviderIdDto;
  to: string;
  subject: string;
  tag?: string;
  status: 'queued' | 'sent' | 'failed';
  externalId?: string;
  error?: string;
  ts: string;
}

export async function fetchEmailProviders(): Promise<{ providers: EmailProviderIdDto[] }> {
  return http.get('/admin/email/providers');
}

export async function fetchEmailConfigs(): Promise<EmailConfigDto[]> {
  return http.get('/admin/email/configs');
}

export async function createEmailConfig(input: EmailConfigInputDto): Promise<EmailConfigDto> {
  return http.post('/admin/email/configs', input);
}

export async function updateEmailConfig(
  id: string,
  input: Partial<EmailConfigInputDto>,
): Promise<EmailConfigDto> {
  return http.put(`/admin/email/configs/${encodeURIComponent(id)}`, input);
}

export async function deleteEmailConfig(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/admin/email/configs/${encodeURIComponent(id)}`);
}

export async function testEmailConfig(id: string): Promise<{ ok: boolean; message: string }> {
  return http.post(`/admin/email/configs/${encodeURIComponent(id)}/test`, {});
}

export async function sendTestEmail(id: string, to: string): Promise<{ ok: boolean }> {
  return http.post(`/admin/email/configs/${encodeURIComponent(id)}/send-test`, { to });
}

export async function fetchEmailLogs(): Promise<EmailLogDto[]> {
  return http.get('/admin/email/logs');
}

export async function fetchEmailTemplates(): Promise<{ names: string[] }> {
  return http.get('/admin/email/templates');
}

export async function previewEmailTemplate(
  name: string,
): Promise<{ subject: string; html: string; text: string }> {
  return http.get(`/admin/email/templates/${encodeURIComponent(name)}/preview`);
}

// ---------- Webhooks de saída ----------

export type WebhookEventTypeDto =
  | 'order.paid'
  | 'order.canceled'
  | 'order.refunded'
  | 'enrollment.created'
  | 'user.created'
  | 'course.completed'
  | 'lesson.completed';

export type WebhookChannelTypeDto = 'generic' | 'slack' | 'discord';

export interface WebhookEndpointDto {
  id: string;
  name: string;
  url: string;
  events: WebhookEventTypeDto[];
  enabled: boolean;
  channelType?: WebhookChannelTypeDto;
  hasSecret: boolean;
  hasHeaders: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastErrorMessage?: string;
}

export interface WebhookEndpointInputDto {
  name: string;
  url: string;
  events: WebhookEventTypeDto[];
  enabled?: boolean;
  channelType?: WebhookChannelTypeDto;
  secret?: string;
  headers?: Record<string, string>;
}

export interface WebhookDeliveryDto {
  id: string;
  endpointId: string;
  event: WebhookEventTypeDto;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  nextAttemptAt?: string;
  lastResponseStatus?: number;
  lastResponseBody?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export async function fetchWebhookEvents(): Promise<{ events: WebhookEventTypeDto[] }> {
  return http.get('/admin/webhooks/events');
}

export async function fetchWebhookEndpoints(): Promise<WebhookEndpointDto[]> {
  return http.get('/admin/webhooks/endpoints');
}

export async function createWebhookEndpoint(
  input: WebhookEndpointInputDto,
): Promise<WebhookEndpointDto> {
  return http.post('/admin/webhooks/endpoints', input);
}

export async function updateWebhookEndpoint(
  id: string,
  input: Partial<WebhookEndpointInputDto>,
): Promise<WebhookEndpointDto> {
  return http.put(`/admin/webhooks/endpoints/${encodeURIComponent(id)}`, input);
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/admin/webhooks/endpoints/${encodeURIComponent(id)}`);
}

export async function testWebhookEndpoint(
  id: string,
): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  return http.post(`/admin/webhooks/endpoints/${encodeURIComponent(id)}/test`, {});
}

export async function fetchWebhookDeliveries(endpointId?: string): Promise<WebhookDeliveryDto[]> {
  const qs = endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : '';
  return http.get(`/admin/webhooks/deliveries${qs}`);
}

export async function retryWebhookDelivery(id: string): Promise<{ ok: true }> {
  return http.post(`/admin/webhooks/deliveries/${encodeURIComponent(id)}/retry`, {});
}

// ---------- Health check ----------

export type HealthStatusDto = 'ok' | 'warn' | 'error' | 'na';

export interface HealthCheckItemDto {
  id: string;
  label: string;
  status: HealthStatusDto;
  message: string;
  metric?: string | number;
}

export interface HealthSnapshotDto {
  generatedAt: string;
  overall: HealthStatusDto;
  checks: HealthCheckItemDto[];
}

export async function fetchHealthSnapshot(): Promise<HealthSnapshotDto> {
  return http.get('/admin/saude');
}

// ---------- Reengajamento automático ----------

export interface ReengagementConfigDto {
  enabled: boolean;
  inactivityDays: number;
  cooldownDays: number;
  onlyEnrolled: boolean;
  subject: string;
  bodyHtml: string;
  updatedAt: string;
}

export interface ReengagementSentDto {
  userId: string;
  email: string;
  ts: string;
}

export interface ReengagementRunResult {
  dryRun: boolean;
  scanned: number;
  inactive: number;
  sent: number;
  skipped: number;
  errors: number;
  details?: string[];
}

export async function fetchReengagementConfig(): Promise<ReengagementConfigDto> {
  return http.get('/admin/reengagement/config');
}

export async function updateReengagementConfig(
  patch: Partial<ReengagementConfigDto>,
): Promise<ReengagementConfigDto> {
  return http.put('/admin/reengagement/config', patch);
}

export async function fetchReengagementSent(): Promise<ReengagementSentDto[]> {
  return http.get('/admin/reengagement/sent');
}

export async function runReengagement(dryRun: boolean): Promise<ReengagementRunResult> {
  return http.post(`/admin/reengagement/run?dryRun=${dryRun ? 'true' : 'false'}`, {});
}

// ---------- Bulk actions em users ----------

export type BulkUserAction =
  | 'activate'
  | 'deactivate'
  | 'delete'
  | 'unenroll'
  | 'sendEmail'
  | 'forceLogout';

export interface BulkUserInput {
  ids: string[];
  action: BulkUserAction;
  courseId?: string;
  subject?: string;
  html?: string;
  text?: string;
}

export interface BulkUserResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

export async function bulkUserAction(input: BulkUserInput): Promise<BulkUserResult> {
  return http.post('/admin/users/bulk', input);
}

// ---------- Email broadcasts ----------

export type BroadcastAudienceDto =
  | 'all'
  | 'students_active'
  | 'students_inactive'
  | 'admins'
  | 'enrolled_in_course'
  | 'no_enrollment';

export interface BroadcastDto {
  id: string;
  subject: string;
  audience: BroadcastAudienceDto;
  courseId?: string;
  inactivityDays?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  sent: number;
  failed: number;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface BroadcastInputDto {
  subject: string;
  html: string;
  text?: string;
  audience: BroadcastAudienceDto;
  courseId?: string;
  inactivityDays?: number;
}

export interface BroadcastPreviewDto {
  count: number;
  sample: Array<{ id: string; email: string; name?: string }>;
}

export async function fetchBroadcasts(): Promise<BroadcastDto[]> {
  return http.get('/admin/email/broadcasts');
}

export async function previewBroadcast(input: {
  audience: BroadcastAudienceDto;
  courseId?: string;
  inactivityDays?: number;
}): Promise<BroadcastPreviewDto> {
  return http.post('/admin/email/broadcasts/preview', input);
}

export async function startBroadcast(input: BroadcastInputDto): Promise<BroadcastDto> {
  return http.post('/admin/email/broadcasts', input);
}

// ---------- Sessions inspector ----------

export interface SessionInspectDto {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'superadmin';
  active: boolean;
  lastLoginAt: string | null;
  tokenVersion: number;
  totpEnabled: boolean;
  hasLikelyActiveSession: boolean;
}

export async function fetchSessions(): Promise<SessionInspectDto[]> {
  return http.get('/admin/sessions');
}

export async function forceLogout(userId: string): Promise<{ ok: true; tokenVersion: number }> {
  return http.post(`/admin/users/${encodeURIComponent(userId)}/force-logout`, {});
}

// ---------- API tokens ----------

export type ApiTokenScopeDto =
  | 'stats:read'
  | 'students:read'
  | 'orders:read'
  | 'courses:read'
  | 'all:read';

export interface ApiTokenDto {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiTokenScopeDto[];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  active: boolean;
}

export interface CreateApiTokenInput {
  name: string;
  scopes: ApiTokenScopeDto[];
  expiresAt?: string;
}

export interface CreateApiTokenResult {
  token: ApiTokenDto;
  secret: string;
}

export async function fetchApiTokens(): Promise<{
  tokens: ApiTokenDto[];
  scopes: ApiTokenScopeDto[];
}> {
  return http.get('/admin/api-tokens');
}

export async function createApiToken(input: CreateApiTokenInput): Promise<CreateApiTokenResult> {
  return http.post('/admin/api-tokens', input);
}

export async function revokeApiToken(id: string): Promise<{ ok: true }> {
  return http.post(`/admin/api-tokens/${encodeURIComponent(id)}/revoke`, {});
}

export async function deleteApiToken(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/api-tokens/${encodeURIComponent(id)}`);
}

// ---------- Question bank ----------

export type QuestionTypeDto = 'multiple_choice' | 'true_false' | 'open_ended';

export interface QuestionOptionDto {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuestionDto {
  id: string;
  courseId: string;
  moduleId?: string;
  type: QuestionTypeDto;
  prompt: string;
  options: QuestionOptionDto[];
  expectedAnswer?: string;
  explanation?: string;
  tags: string[];
  difficulty: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCourseQuestions(
  courseId: string,
): Promise<{ questions: QuestionDto[] }> {
  return http.get(`/admin/courses/${encodeURIComponent(courseId)}/questions`);
}

export interface CreateQuestionInput {
  moduleId?: string;
  type: QuestionTypeDto;
  prompt: string;
  options: { text: string; correct: boolean }[];
  expectedAnswer?: string;
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  active?: boolean;
}

export async function createQuestion(
  courseId: string,
  input: CreateQuestionInput,
): Promise<QuestionDto> {
  return http.post(`/admin/courses/${encodeURIComponent(courseId)}/questions`, input);
}

export async function updateQuestion(
  id: string,
  patch: Partial<CreateQuestionInput> & { moduleId?: string | null },
): Promise<QuestionDto> {
  return http.put(`/admin/questions/${encodeURIComponent(id)}`, patch);
}

export async function deleteQuestion(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/questions/${encodeURIComponent(id)}`);
}

export interface GenerateQuestionsInput {
  count?: number;
  moduleId?: string;
}

export interface GenerateQuestionsResult {
  generated: number;
  provider: string;
  model: string;
  questions: QuestionDto[];
}

export async function generateQuestions(
  courseId: string,
  input: GenerateQuestionsInput,
): Promise<GenerateQuestionsResult> {
  return http.post(`/admin/courses/${encodeURIComponent(courseId)}/questions/generate`, input);
}

export interface QuizQuestionPublicDto {
  id: string;
  type: QuestionTypeDto;
  prompt: string;
  tags: string[];
  difficulty: number;
  options: { id: string; text: string }[];
}

export async function fetchQuiz(
  courseId: string,
  options: { moduleId?: string; max?: number } = {},
): Promise<{
  questions: QuizQuestionPublicDto[];
  /** Nota de corte cadastrada na avaliação do módulo (padrão 70). */
  passingScore?: number;
  moduleId?: string | null;
  assessmentTitle?: string | null;
}> {
  const qs = new URLSearchParams();
  if (options.moduleId) qs.set('moduleId', options.moduleId);
  // Sem `max`, o servidor usa o `questionCount` da avaliação do módulo.
  if (options.max) qs.set('max', String(options.max));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return http.get(`/me/quiz/${encodeURIComponent(courseId)}/start${suffix}`);
}

export interface QuizGradeResultDto {
  /** Número de acertos entre as questões que entraram na nota. */
  score: number;
  /** Quantas questões entraram na nota (exclui as pendentes de correção). */
  total: number;
  pct: number;
  /** Questões que ficaram aguardando correção e saíram do denominador. */
  pendentes?: number;
  /** Quem decide aprovação é o servidor, com a nota de corte cadastrada. */
  passingScore?: number;
  passed?: boolean;
  results: Array<{
    questionId: string;
    type?: string;
    /** `null` = aguardando correção; não conta como erro. */
    correct: boolean | null;
    correctOptionIds: string[];
    explanation: string | null;
    aiScore?: number | null;
    aiFeedback?: string | null;
    pendenteDeCorrecao?: boolean;
  }>;
}

export interface QuizAnswerInput {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export async function submitQuiz(
  courseId: string,
  answers: QuizAnswerInput[],
  moduleId?: string,
): Promise<QuizGradeResultDto> {
  // `moduleId` viaja para que o servidor aplique a nota de corte DAQUELA
  // avaliação, e não um 70 fixo.
  return http.post(`/me/quiz/${encodeURIComponent(courseId)}/grade`, {
    answers,
    ...(moduleId ? { moduleId } : {}),
  });
}

// ---------- System user detail ----------

export async function fetchSystemUser(id: string): Promise<SystemUser> {
  return http.get<SystemUser>(`/admin/users/${encodeURIComponent(id)}`);
}

// ---------- Webhook presets ----------

export interface WebhookPresetDto {
  id: string;
  name: string;
  description: string;
  icon?: string;
  urlPlaceholder: string;
  channelType: 'generic' | 'slack' | 'discord';
  headers?: Record<string, string>;
  suggestedEvents: string[];
  docsUrl?: string;
  notes?: string;
}

export async function fetchWebhookPresets(): Promise<{
  presets: WebhookPresetDto[];
}> {
  return http.get('/admin/webhooks/presets');
}

// ---------- Email template overrides ----------

export interface EmailTemplateOverrideDto {
  name: string;
  subject?: string;
  greeting?: string;
  footerNote?: string;
  brandColor?: string;
  logoUrl?: string;
  orgName?: string;
}

export async function fetchTemplateOverrides(): Promise<{
  overrides: EmailTemplateOverrideDto[];
}> {
  return http.get('/admin/email/template-overrides');
}

export async function saveTemplateOverride(
  name: string,
  patch: Omit<EmailTemplateOverrideDto, 'name'>,
): Promise<EmailTemplateOverrideDto> {
  return http.put(`/admin/email/template-overrides/${encodeURIComponent(name)}`, patch);
}

export async function deleteTemplateOverride(name: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/email/template-overrides/${encodeURIComponent(name)}`);
}

export async function previewTemplateLive(
  name: string,
  override: Omit<EmailTemplateOverrideDto, 'name'>,
): Promise<{ subject: string; html: string; text: string }> {
  return http.post(`/admin/email/templates/${encodeURIComponent(name)}/preview`, override);
}

// ---------- Weekly report config ----------

export interface WeeklyReportConfigDto {
  enabled: boolean;
  dayOfWeekUtc: number;
  hourUtc: number;
  recipientRoles: ('admin' | 'superadmin')[];
}

export async function fetchWeeklyReportConfig(): Promise<WeeklyReportConfigDto> {
  return http.get('/admin/email/weekly-report');
}

export async function saveWeeklyReportConfig(
  patch: Partial<WeeklyReportConfigDto>,
): Promise<WeeklyReportConfigDto> {
  return http.put('/admin/email/weekly-report', patch);
}

export interface WeeklyReportPreviewDto {
  data: {
    windowFrom: string;
    windowTo: string;
    revenue: { currentCents: number; deltaPct: number };
    newStudents: { current: number; deltaPct: number };
    certificatesIssued: number;
    reviews: { new: number; averageRating: number };
    support: { opened: number; closed: number };
    topProducts: Array<{ name: string; revenueCents: number; count: number }>;
  };
  email: { subject: string; html: string; text: string };
}

export async function fetchWeeklyReportPreview(): Promise<WeeklyReportPreviewDto> {
  return http.post('/admin/email/weekly-report/preview', {});
}

// ---------- Admin KPIs ----------

export interface AdminKpisDto {
  generatedAt: string;
  revenue: {
    currency: string;
    netCents: number;
    grossCents: number;
    refundedCents: number;
    last30DaysCents: number;
    prev30DaysCents: number;
    deltaPct: number;
  };
  students: {
    total: number;
    active: number;
    new30Days: number;
    newPrev30Days: number;
    deltaPct: number;
  };
  completion: {
    certificatesIssued: number;
    issuedLast30Days: number;
  };
  satisfaction: {
    averageRating: number;
    reviewCount: number;
  };
}

export async function fetchAdminKpis(): Promise<AdminKpisDto> {
  return http.get('/admin/kpis');
}

// ---------- Study paths (trilhas) ----------

export interface StudyPathDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverColor: string;
  courseIds: string[];
  active: boolean;
  publicVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchStudyPaths(): Promise<{ paths: StudyPathDto[] }> {
  return http.get('/admin/study-paths');
}

export async function fetchPublicStudyPaths(): Promise<{ paths: StudyPathDto[] }> {
  return http.get('/study-paths');
}

export interface CreateStudyPathInput {
  slug: string;
  title: string;
  description?: string;
  coverColor?: string;
  courseIds?: string[];
  active?: boolean;
  publicVisible?: boolean;
}

export async function createStudyPath(input: CreateStudyPathInput): Promise<StudyPathDto> {
  return http.post('/admin/study-paths', input);
}

export async function updateStudyPath(
  id: string,
  patch: Partial<CreateStudyPathInput>,
): Promise<StudyPathDto> {
  return http.put(`/admin/study-paths/${encodeURIComponent(id)}`, patch);
}

export async function deleteStudyPath(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/study-paths/${encodeURIComponent(id)}`);
}

export interface StudyPathProgressDto {
  pathId: string;
  totalCourses: number;
  completedCourses: number;
  nextCourseId: string | null;
  done: boolean;
  status: { courseId: string; completed: boolean }[];
}

export async function fetchStudyPathProgress(id: string): Promise<StudyPathProgressDto> {
  return http.get(`/me/study-paths/${encodeURIComponent(id)}/progress`);
}

// ---------- Roles & Permissions ----------

export interface RoleDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  /** Tier de auth herdado (student/admin/superadmin). */
  tier: 'student' | 'admin' | 'superadmin';
  system: boolean;
  createdAt: string;
  updatedAt: string;
  /** Quantos usuários do sistema têm esse slug como role. */
  userCount?: number;
}

export async function fetchRoles(): Promise<{ roles: RoleDto[] }> {
  return http.get('/admin/roles');
}

export interface PermissionMetaDto {
  label: string;
  group: string;
  description?: string;
}

export async function fetchPermissionsCatalog(): Promise<{
  system: string[];
  custom: string[];
  meta: Record<string, PermissionMetaDto>;
  groups: string[];
}> {
  return http.get('/admin/permissions');
}

export interface CreateRoleInput {
  slug: string;
  name: string;
  description?: string;
  permissions?: string[];
  tier?: 'student' | 'admin' | 'superadmin';
}

export async function createRole(input: CreateRoleInput): Promise<RoleDto> {
  return http.post('/admin/roles', input);
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  tier?: 'student' | 'admin' | 'superadmin';
}

export async function updateRole(id: string, patch: UpdateRoleInput): Promise<RoleDto> {
  return http.put(`/admin/roles/${encodeURIComponent(id)}`, patch);
}

export async function deleteRole(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/roles/${encodeURIComponent(id)}`);
}

// ---------- Activity feed ----------

export type ActivityKindDto =
  | 'audit'
  | 'email_sent'
  | 'email_failed'
  | 'webhook_success'
  | 'webhook_failed'
  | 'reengagement'
  | 'order_paid'
  | 'order_refunded'
  | 'order_canceled';

export interface ActivityItemDto {
  id: string;
  ts: string;
  kind: ActivityKindDto;
  label: string;
  detail?: string;
  actor?: string;
  target?: string;
  link?: string;
}

// ---------- CSV exports ----------

async function downloadCsv(path: string, filename: string): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadUsersCsv(): Promise<void> {
  return downloadCsv(
    '/admin/users/export.csv',
    `users-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export async function downloadOrdersCsv(): Promise<void> {
  return downloadCsv(
    '/admin/orders/export.csv',
    `orders-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export async function duplicateCourse(id: string): Promise<{ id: string; title: string }> {
  return http.post(`/admin/courses/${encodeURIComponent(id)}/duplicate`, {});
}

export async function downloadCoursesCsv(): Promise<void> {
  return downloadCsv(
    '/admin/courses/export.csv',
    `courses-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

// ---------- Settings backup / restore ----------

export interface SettingsBackupDto {
  version: 1;
  createdAt: string;
  files: Array<{
    file: string;
    exists: boolean;
    data: unknown;
  }>;
}

export interface RestoreResultDto {
  restored: string[];
  skipped: Array<{ file: string; reason: string }>;
  dryRun: boolean;
}

export async function downloadSettingsBackup(): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch('/api/admin/settings/backup', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ava-pco-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function restoreSettings(
  payload: SettingsBackupDto,
  dryRun = false,
): Promise<RestoreResultDto> {
  return http.post('/admin/settings/restore', { ...payload, dryRun });
}

// ---------- Admin notes ----------

export interface AdminNoteDto {
  id: string;
  studentId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAdminNotes(studentId: string): Promise<AdminNoteDto[]> {
  return http.get(`/admin/students/${encodeURIComponent(studentId)}/notes`);
}

export async function createAdminNote(
  studentId: string,
  body: string,
  pinned = false,
): Promise<AdminNoteDto> {
  return http.post(`/admin/students/${encodeURIComponent(studentId)}/notes`, {
    body,
    pinned,
  });
}

export async function updateAdminNote(
  studentId: string,
  noteId: string,
  patch: { body?: string; pinned?: boolean },
): Promise<AdminNoteDto> {
  return http.put(
    `/admin/students/${encodeURIComponent(studentId)}/notes/${encodeURIComponent(noteId)}`,
    patch,
  );
}

export async function deleteAdminNote(studentId: string, noteId: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(
    `/admin/students/${encodeURIComponent(studentId)}/notes/${encodeURIComponent(noteId)}`,
  );
}

// ---------- Course reviews ----------

export interface CourseRatingSummaryDto {
  courseId: string;
  count: number;
  avg: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface CourseReviewDto {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface MyCourseReviewDto {
  id: string;
  courseId: string;
  rating: number;
  comment?: string;
  updatedAt: string;
}

export async function fetchCourseRating(courseId: string): Promise<CourseRatingSummaryDto> {
  return http.get(`/courses/${encodeURIComponent(courseId)}/rating`);
}

export async function fetchCourseReviews(courseId: string): Promise<CourseReviewDto[]> {
  return http.get(`/courses/${encodeURIComponent(courseId)}/reviews`);
}

export async function fetchMyCourseReview(courseId: string): Promise<MyCourseReviewDto | null> {
  return http.get(`/me/courses/${encodeURIComponent(courseId)}/review`);
}

export async function upsertMyCourseReview(
  courseId: string,
  rating: number,
  comment?: string,
): Promise<MyCourseReviewDto> {
  return http.put(`/me/courses/${encodeURIComponent(courseId)}/review`, {
    rating,
    comment,
  });
}

// ---------- Notification preferences ----------

export interface NotificationPrefsDto {
  userId: string;
  receiveBroadcasts: boolean;
  receiveReengagement: boolean;
  snoozedUntil: string | null;
  updatedAt: string;
}

export async function fetchMyNotificationPrefs(): Promise<NotificationPrefsDto> {
  return http.get('/me/notification-prefs');
}

export async function updateMyNotificationPrefs(
  patch: Partial<
    Pick<NotificationPrefsDto, 'receiveBroadcasts' | 'receiveReengagement' | 'snoozedUntil'>
  >,
): Promise<NotificationPrefsDto> {
  return http.put('/me/notification-prefs', patch);
}

export async function snoozeNotifications(days: number): Promise<NotificationPrefsDto> {
  return http.post('/me/notification-prefs/snooze', { days });
}

export interface LastLessonDto {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  totalSeconds: number;
  lastHeartbeatAt: string;
}

export async function fetchLastLesson(): Promise<LastLessonDto | null> {
  return http.get<LastLessonDto | null>('/me/last-lesson');
}

export interface MyNoteHitDto {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  content: string;
  updatedAt: string;
}

export async function fetchMyNotes(search?: string): Promise<MyNoteHitDto[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return http.get<MyNoteHitDto[]>(`/me/notes${qs}`);
}

// ---------- Snapshots de backup (auto) ----------

export interface BackupSnapshotDto {
  date: string;
  files: Array<{ name: string; size: number }>;
}

export interface BackupDbDumpDto {
  enabled: boolean;
  tablesDumped: number;
  rowsTotal: number;
  bytesTotal: number;
  errors: string[];
  completo: boolean;
}

export interface BackupRunResultDto {
  date: string;
  filesBackedUp: number;
  bytesTotal: number;
  errors: string[];
  /** Ausente = o banco não foi copiado nesta snapshot. */
  db?: BackupDbDumpDto;
}

export interface BackupStatusDto {
  enabled: boolean;
  lastRunAt: string | null;
  lastResult: BackupRunResultDto | null;
  keepDays: number;
  /**
   * `null` = não há banco (modo JSON, e os arquivos já são a base inteira).
   * `true` = as tabelas entraram na última snapshot.
   * `false` = **há banco e ele não está na snapshot** — o estado que pode
   * custar a base inteira, e que nenhuma tela sabia dizer até 3/set/2026.
   */
  bancoCoberto: boolean | null;
  tabelasEsperadas: number;
  /** `null` = ainda não rodou. Não medido não é o mesmo que ruim. */
  saudavel: boolean | null;
}

export async function fetchBackupSnapshots(): Promise<BackupSnapshotDto[]> {
  return http.get<BackupSnapshotDto[]>('/admin/backups/snapshots');
}

export async function fetchBackupStatus(): Promise<BackupStatusDto> {
  return http.get<BackupStatusDto>('/admin/backups/status');
}

export async function runBackupSnapshotNow(): Promise<BackupRunResultDto> {
  return http.post<BackupRunResultDto>('/admin/backups/run-now', {});
}

// ---------- Admin alerts ----------

export interface AdminAlertItemDto {
  id: string;
  label: string;
  status: HealthStatusDto;
  message: string;
  metric?: string | number;
}

export interface AdminAlertsDto {
  generatedAt: string;
  overall: HealthStatusDto;
  total: number;
  warn: number;
  error: number;
  items: AdminAlertItemDto[];
}

export async function fetchAdminAlerts(): Promise<AdminAlertsDto> {
  return http.get<AdminAlertsDto>('/admin/alerts');
}

// ---------- Course students ----------

export interface CourseStudentDto {
  studentId: string;
  name: string;
  email: string;
  /**
   * Status global da ficha do aluno. **Não diz nada sobre este curso** — era
   * ele que a tela mostrava, e por isso todo mundo aparecia como ativo.
   */
  status: 'ativo' | 'em_risco' | 'bloqueado' | string;
  /** Situação da matrícula NESTE curso. */
  situacao: 'ativa' | 'suspensa' | 'cancelada';
  acesso: {
    estado: 'active' | 'expiring' | 'expired' | 'lifetime';
    expiraEm: string | null;
    diasRestantes: number | null;
  };
  /** Pode estudar agora: situação ativa **e** prazo em dia. */
  ativoNoCurso: boolean;
  lessonsCompleted: number;
  totalLessons: number;
  progressPct: number;
  /** `aulas` = contado das aulas concluídas aqui; `importado` = veio do portal. */
  origemDoProgresso: 'aulas' | 'importado';
  lastCompletedAt: string | null;
  lastAccessAt: string | null;
  riskScore: number;
}

export interface CourseStudentsDto {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  accessMonths: number | null;
  enrolledCount: number;
  ativosCount: number;
  vencidosCount: number;
  foraDeSituacaoCount: number;
  students: CourseStudentDto[];
}

export async function fetchCourseStudents(courseId: string): Promise<CourseStudentsDto> {
  return http.get<CourseStudentsDto>(`/admin/courses/${encodeURIComponent(courseId)}/students`);
}

export interface BulkEnrollResultDto {
  enrolled: number;
  alreadyEnrolled: number;
  errors: Array<{ studentId: string; message: string }>;
  ineligible?: Array<{ studentId: string; missing: string[] }>;
  forced?: boolean;
}

export async function bulkEnrollInCourse(
  courseId: string,
  studentIds: string[],
  force = false,
): Promise<BulkEnrollResultDto> {
  return http.post<BulkEnrollResultDto>(
    `/admin/courses/${encodeURIComponent(courseId)}/enroll-bulk${force ? '?force=true' : ''}`,
    { studentIds },
  );
}

export interface BulkIssueCertsResultDto {
  courseTitle: string;
  enrolled: number;
  issued: number;
  alreadyIssued: number;
  notCompleted: number;
}

export async function bulkIssueCertsForCourse(courseId: string): Promise<BulkIssueCertsResultDto> {
  return http.post<BulkIssueCertsResultDto>(
    `/admin/courses/${encodeURIComponent(courseId)}/issue-certs-bulk`,
    {},
  );
}

// ---------- LGPD: account deletion ----------

export type DeletionStatusDto = 'pending' | 'approved' | 'rejected' | 'completed';

export interface DeletionRequestDto {
  id: string;
  userId: string;
  userEmail: string;
  reason?: string;
  status: DeletionStatusDto;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export async function fetchMyDeletionRequest(): Promise<DeletionRequestDto | null> {
  return http.get<DeletionRequestDto | null>('/me/account/deletion');
}

export async function requestAccountDeletion(reason?: string): Promise<DeletionRequestDto> {
  return http.post<DeletionRequestDto>('/me/account/deletion', { reason });
}

export async function cancelDeletionRequest(id: string): Promise<void> {
  await http.delete<{ ok: true }>(`/me/account/deletion/${encodeURIComponent(id)}`);
}

export async function downloadMyDataExport(): Promise<void> {
  const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
  const token = session?.token;
  const res = await fetch('/api/me/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meus-dados-ava-pco-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAdminDeletionRequests(): Promise<DeletionRequestDto[]> {
  return http.get<DeletionRequestDto[]>('/admin/deletion-requests');
}

export async function adminUpdateDeletionRequest(
  id: string,
  status: 'approved' | 'rejected' | 'completed',
  note?: string,
): Promise<DeletionRequestDto> {
  return http.put<DeletionRequestDto>(`/admin/deletion-requests/${encodeURIComponent(id)}`, {
    status,
    note,
  });
}

// ---------- Admin: courses summary ----------

export interface CourseSummaryDto {
  courseId: string;
  enrolledCount: number;
  completedCount: number;
  avgProgressPct: number;
}

export async function fetchAdminCoursesSummary(): Promise<CourseSummaryDto[]> {
  return http.get<CourseSummaryDto[]>('/admin/courses-summary');
}

export async function downloadStudentsCsv(
  filters: {
    search?: string;
    status?: string;
    courseId?: string;
    sortBy?: string;
  } = {},
): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) qs.set(k, String(v));
  }
  const path = `/admin/students/export.csv${qs.size > 0 ? `?${qs.toString()}` : ''}`;
  return downloadCsv(path, `alunos-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ---------- Alerts center ----------

export interface AlertsCenterDto {
  generatedAt: string;
  health: { issues: AdminAlertItemDto[]; overall: HealthStatusDto };
  lgpdDeletionRequests: {
    count: number;
    items: Array<{ id: string; userEmail: string; requestedAt: string }>;
  };
  supportTicketsOpen: {
    count: number;
    items: Array<{
      id: string;
      subject: string;
      studentId: string;
      createdAt: string;
    }>;
  };
  moderatedComments: {
    count: number;
    recent: Array<{ id: string; authorName: string; createdAt: string }>;
  };
  failedImportJobs: {
    count: number;
    items: Array<{
      id: string;
      source: string;
      mode: string;
      startedAt: string;
    }>;
  };
  failedWebhookDeliveries: {
    count: number;
    items: Array<{
      id: string;
      event: string;
      attempts: number;
      createdAt: string;
    }>;
  };
}

export async function fetchAlertsCenter(): Promise<AlertsCenterDto> {
  return http.get<AlertsCenterDto>('/admin/alerts/center');
}

export interface AdminTutorTurnDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  prompt: string;
  response: string;
  provider: string | null;
  model: string | null;
  ts: string;
}

export async function fetchAdminTutorHistory(
  opts: {
    search?: string;
    userId?: string;
    limit?: number;
  } = {},
): Promise<AdminTutorTurnDto[]> {
  const qs = new URLSearchParams();
  if (opts.search) qs.set('search', opts.search);
  if (opts.userId) qs.set('userId', opts.userId);
  if (opts.limit) qs.set('limit', String(opts.limit));
  const path = `/admin/tutor/history${qs.size > 0 ? `?${qs.toString()}` : ''}`;
  return http.get<AdminTutorTurnDto[]>(path);
}

export interface AchievementsStatsDto {
  totalAwarded: number;
  uniqueRecipients: number;
  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    awarded: number;
  }>;
  topUsers: Array<{
    userId: string;
    count: number;
    name: string;
    email: string;
  }>;
}

export async function fetchAchievementsStats(): Promise<AchievementsStatsDto> {
  return http.get<AchievementsStatsDto>('/admin/achievements/stats');
}

export interface AdminAboutDto {
  version: string;
  commit: string | null;
  buildDate: string | null;
  env: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryMB: number;
  pid: number;
  hostname: string | null;
  dataDirOverride: boolean;
}

export async function fetchAdminAbout(): Promise<AdminAboutDto> {
  return http.get<AdminAboutDto>('/admin/about');
}

export async function downloadLeaderboardCsv(days = 30, limit = 100): Promise<void> {
  return downloadCsv(
    `/admin/leaderboard/export.csv?days=${days}&limit=${limit}`,
    `leaderboard-${days}d-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

// ---------- Achievements ----------

export type BadgeIdDto =
  | 'first_lesson'
  | 'first_course'
  | 'streak_7'
  | 'streak_30'
  | 'three_courses'
  | 'tutor_helper';

export interface BadgeDefDto {
  id: BadgeIdDto;
  name: string;
  description: string;
  icon: string;
}

export interface AwardedBadgeDto {
  id: string;
  userId: string;
  badgeId: BadgeIdDto;
  awardedAt: string;
}

export interface AchievementsResponseDto {
  catalog: Record<BadgeIdDto, BadgeDefDto>;
  awarded: AwardedBadgeDto[];
}

export async function fetchMyAchievements(): Promise<AchievementsResponseDto> {
  return http.get('/me/achievements');
}

export async function refreshMyAchievements(): Promise<{
  granted: AwardedBadgeDto[];
}> {
  return http.post('/me/achievements/refresh', {});
}

export async function fetchStudentAchievements(
  studentId: string,
): Promise<AchievementsResponseDto> {
  return http.get(`/admin/students/${encodeURIComponent(studentId)}/achievements`);
}

// ---------- Setup checklist ----------

export interface SetupItemDto {
  id: string;
  label: string;
  ok: boolean;
  message: string;
  link: string;
}

export interface SetupStatusDto {
  total: number;
  ok: number;
  progressPct: number;
  items: SetupItemDto[];
}

export async function fetchSetupStatus(): Promise<SetupStatusDto> {
  return http.get('/admin/setup/status');
}

// ---------- Onboarding wizard ----------

export interface OnboardingStatusDto {
  needsOnboarding: boolean;
  completedAt: string | null;
  role: string;
  customRoleSlug: string | null;
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusDto> {
  return http.get('/admin/onboarding/status');
}

export async function completeOnboarding(): Promise<{ ok: boolean; completedAt: string }> {
  return http.post('/admin/onboarding/complete', {});
}

// ---------- Saved searches ----------

export type SavedSearchScopeDto =
  | 'students'
  | 'orders'
  | 'imports'
  | 'activity'
  | 'rate-limits'
  | 'logs'
  | 'broadcasts';

export interface SavedSearchDto {
  id: string;
  ownerId: string;
  ownerEmail: string;
  scope: SavedSearchScopeDto;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSavedSearches(scope?: SavedSearchScopeDto): Promise<SavedSearchDto[]> {
  const qs = scope ? `?scope=${scope}` : '';
  return http.get(`/admin/saved-searches${qs}`);
}

export async function createSavedSearch(input: {
  scope: SavedSearchScopeDto;
  name: string;
  filters: Record<string, unknown>;
}): Promise<SavedSearchDto> {
  return http.post('/admin/saved-searches', input);
}

export async function updateSavedSearch(
  id: string,
  patch: { name?: string; filters?: Record<string, unknown> },
): Promise<SavedSearchDto> {
  return http.put(`/admin/saved-searches/${encodeURIComponent(id)}`, patch);
}

export async function deleteSavedSearch(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/saved-searches/${encodeURIComponent(id)}`);
}

// ---------- Live sessions ----------

export type LiveSessionStatusDto = 'scheduled' | 'live' | 'ended' | 'canceled';

export interface LiveSessionDto {
  id: string;
  title: string;
  description?: string;
  courseId?: string | null;
  hostName?: string;
  joinUrl: string;
  startAt: string;
  durationMinutes: number;
  status: LiveSessionStatusDto;
  statusComputed: LiveSessionStatusDto;
  audience: 'all' | 'enrolled';
  embedType?: 'link' | 'zoom_embed';
  zoomMeetingNumber?: string;
  zoomPassword?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveSessionInputDto {
  title: string;
  description?: string;
  courseId?: string | null;
  hostName?: string;
  joinUrl: string;
  startAt: string;
  durationMinutes: number;
  audience: 'all' | 'enrolled';
  embedType?: 'link' | 'zoom_embed';
  zoomMeetingNumber?: string;
  zoomPassword?: string;
}

export async function fetchMyLiveSessions(): Promise<LiveSessionDto[]> {
  return http.get('/me/live-sessions');
}

export async function fetchAdminLiveSessions(): Promise<LiveSessionDto[]> {
  return http.get('/admin/live-sessions');
}

export async function createLiveSession(input: LiveSessionInputDto): Promise<LiveSessionDto> {
  return http.post('/admin/live-sessions', input);
}

export async function updateLiveSession(
  id: string,
  patch: Partial<LiveSessionInputDto> & { status?: LiveSessionStatusDto },
): Promise<LiveSessionDto> {
  return http.put(`/admin/live-sessions/${encodeURIComponent(id)}`, patch);
}

export async function deleteLiveSession(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/live-sessions/${encodeURIComponent(id)}`);
}

export interface ZoomConfigDto {
  configured: boolean;
  sdkKey?: string;
  enabled?: boolean;
  hasSecret?: boolean;
}

export async function fetchZoomConfig(): Promise<ZoomConfigDto> {
  return http.get('/admin/zoom/config');
}

export async function saveZoomConfig(input: {
  sdkKey: string;
  sdkSecret: string;
}): Promise<{ sdkKey: string; enabled: boolean; hasSecret: boolean }> {
  return http.put('/admin/zoom/config', input);
}

export async function fetchZoomSignature(
  meetingNumber: string,
): Promise<{ signature: string; sdkKey: string }> {
  return http.post('/zoom/signature', { meetingNumber });
}

// ---------- Transcription ----------

export interface TranscriptionSegmentDto {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface SessionTranscriptDto {
  id: string;
  sessionId: string;
  segments: TranscriptionSegmentDto[];
  fullText: string;
  language: string;
  durationSeconds: number;
  provider: string;
  model: string;
  aiSummary?: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
}

export async function fetchSessionTranscript(sessionId: string): Promise<SessionTranscriptDto> {
  return http.get(`/session/${encodeURIComponent(sessionId)}/transcript`);
}

export async function startTranscription(
  sessionId: string,
  audioUrl: string,
): Promise<{ transcript: SessionTranscriptDto; message: string }> {
  return http.post(`/admin/transcription/transcribe/${encodeURIComponent(sessionId)}`, {
    audioUrl,
  });
}

// ---------- Mentoring ----------

export interface MentoringConfigDto {
  id: string;
  courseId: string;
  instructorName: string;
  bookingUrl: string;
  provider: 'calendly' | 'calcom' | 'other';
  description?: string;
  durationMinutes?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMyMentoring(
  courseId: string,
): Promise<{ configs: MentoringConfigDto[] }> {
  return http.get(`/me/mentoring/${encodeURIComponent(courseId)}`);
}

export async function fetchAdminMentoring(): Promise<{ configs: MentoringConfigDto[] }> {
  return http.get('/admin/mentoring');
}

export async function createMentoring(input: {
  courseId: string;
  instructorName: string;
  bookingUrl: string;
  description?: string;
  durationMinutes?: number;
}): Promise<MentoringConfigDto> {
  return http.post('/admin/mentoring', input);
}

export async function updateMentoring(
  id: string,
  patch: Partial<{
    instructorName: string;
    bookingUrl: string;
    description: string;
    durationMinutes: number;
    active: boolean;
  }>,
): Promise<MentoringConfigDto> {
  return http.put(`/admin/mentoring/${encodeURIComponent(id)}`, patch);
}

export async function deleteMentoring(id: string): Promise<{ ok: true }> {
  return http.delete(`/admin/mentoring/${encodeURIComponent(id)}`);
}

// ---------- Lesson discussions ----------

export interface LessonCommentDto {
  id: string;
  lessonId: string;
  courseId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'superadmin';
  body: string;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchLessonComments(lessonId: string): Promise<LessonCommentDto[]> {
  return http.get(`/lessons/${encodeURIComponent(lessonId)}/comments`);
}

export async function createLessonComment(input: {
  lessonId: string;
  courseId: string;
  body: string;
  parentId?: string;
}): Promise<LessonCommentDto> {
  return http.post(`/lessons/${encodeURIComponent(input.lessonId)}/comments`, {
    body: input.body,
    courseId: input.courseId,
    parentId: input.parentId,
  });
}

export async function updateLessonComment(
  lessonId: string,
  commentId: string,
  patch: { body?: string; pinned?: boolean; hidden?: boolean },
): Promise<LessonCommentDto> {
  return http.put(
    `/lessons/${encodeURIComponent(lessonId)}/comments/${encodeURIComponent(commentId)}`,
    patch,
  );
}

export async function deleteLessonComment(
  lessonId: string,
  commentId: string,
): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(
    `/lessons/${encodeURIComponent(lessonId)}/comments/${encodeURIComponent(commentId)}`,
  );
}

// ---------- Jobs / cron viewer ----------

export interface JobStatusDto {
  name: string;
  enabled: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  totalTicks: number;
  // webhooks
  running?: boolean;
  lastRunProcessed?: number;
  pending?: number;
  totalDeliveries?: number;
  // reengagement
  lastRunResult?: {
    scanned: number;
    inactive: number;
    sent: number;
    skipped: number;
    errors: number;
  } | null;
  recentEmails24h?: number;
}

export async function fetchJobs(): Promise<{ jobs: JobStatusDto[] }> {
  return http.get('/admin/jobs');
}

export async function runJob(name: string, dryRun = false): Promise<unknown> {
  return http.post(`/admin/jobs/${encodeURIComponent(name)}/run?dryRun=${dryRun}`, {});
}

// ---------- Rate-limit telemetry ----------

export interface RateLimitSummaryDto {
  totalHits: number;
  blockedCount: number;
  windowMs: number;
  topIps: Array<{ ip: string; count: number; blocked: number }>;
  topPaths: Array<{ path: string; count: number; blocked: number }>;
  recentBlocks: Array<{ ts: number; ip: string; path: string; method: string }>;
}

export async function fetchRateLimitSummary(windowMs?: number): Promise<RateLimitSummaryDto> {
  const qs = windowMs ? `?windowMs=${windowMs}` : '';
  return http.get(`/admin/rate-limits${qs}`);
}

// ---------- System logs ----------

export type LogLevelDto = 'log' | 'warn' | 'error' | 'info' | 'debug';

export interface LogLineDto {
  ts: string;
  level: LogLevelDto;
  message: string;
}

export interface LogsResponseDto {
  total: number;
  lines: LogLineDto[];
}

// ---------- Lesson watch-time ----------

export async function postWatchHeartbeat(
  lessonId: string,
  courseId: string,
  deltaSeconds: number,
  lessonDurationSeconds?: number,
): Promise<{ totalSeconds: number; lessonId: string }> {
  return http.post(`/me/lessons/${encodeURIComponent(lessonId)}/watch`, {
    courseId,
    deltaSeconds,
    lessonDurationSeconds,
  });
}

export interface WatchEntryDto {
  totalSeconds: number;
  lessonId?: string;
}

export async function fetchMyWatch(lessonId: string): Promise<WatchEntryDto> {
  return http.get(`/me/lessons/${encodeURIComponent(lessonId)}/watch`);
}

export interface LessonWatchStatsDto {
  lessonId: string;
  uniqueViewers: number;
  totalSeconds: number;
  avgSecondsPerViewer: number;
}

export async function fetchLessonWatchStats(lessonId: string): Promise<LessonWatchStatsDto> {
  return http.get(`/admin/lessons/${encodeURIComponent(lessonId)}/watch-stats`);
}

export interface CourseWatchStatsDto {
  courseId: string;
  totalSeconds: number;
  uniqueLearners: number;
  byLesson: Array<{ lessonId: string; totalSeconds: number; viewers: number }>;
}

export async function fetchCourseWatchStats(courseId: string): Promise<CourseWatchStatsDto> {
  return http.get(`/admin/courses/${encodeURIComponent(courseId)}/watch-stats`);
}

export interface CourseAnalyticsDto {
  course: {
    id: string;
    title: string;
    totalLessons: number;
    totalModules: number;
  };
  enrollment: {
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    avgCompletionPct: number;
  };
  watchTime: CourseWatchStatsDto;
  rating: {
    courseId: string;
    count: number;
    avg: number;
    distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
}

export async function fetchCourseAnalytics(courseId: string): Promise<CourseAnalyticsDto> {
  return http.get(`/admin/courses/${encodeURIComponent(courseId)}/analytics`);
}

export interface StudentAnalyticsDto {
  student: {
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: string;
    lastAccessAt: string | null;
  };
  enrollment: {
    total: number;
    totalLessonsCompleted: number;
    courses: Array<{
      courseId: string;
      title: string;
      totalLessons: number;
      completedLessons: number;
      completionPct: number;
    }>;
  };
  watchTime: {
    totalSeconds: number;
    lessonsTouched: number;
  };
  engagement: {
    streak: { current: number; longest: number; lastActiveDay: string | null };
    reviewsWritten: number;
    achievementsEarned: number;
    achievementIds: string[];
  };
}

export async function fetchStudentAnalytics(studentId: string): Promise<StudentAnalyticsDto> {
  return http.get(`/admin/students/${encodeURIComponent(studentId)}/analytics`);
}

// ---------- Streak ----------

export interface StreakDto {
  current: number;
  longest: number;
  lastActiveDay: string | null;
}

export async function fetchMyStreak(): Promise<StreakDto> {
  return http.get('/me/streak');
}

export async function fetchLogs(
  query: {
    level?: LogLevelDto;
    q?: string;
    limit?: number;
  } = {},
): Promise<LogsResponseDto> {
  const qs = new URLSearchParams();
  if (query.level) qs.set('level', query.level);
  if (query.q) qs.set('q', query.q);
  if (query.limit) qs.set('limit', String(query.limit));
  const path = `/admin/logs${qs.toString() ? `?${qs.toString()}` : ''}`;
  return http.get(path);
}

export async function fetchActivityFeed(
  filter: {
    kinds?: ActivityKindDto[];
    since?: string;
    until?: string;
    q?: string;
    limit?: number;
  } = {},
): Promise<ActivityItemDto[]> {
  const qs = new URLSearchParams();
  if (filter.kinds && filter.kinds.length > 0) qs.set('kinds', filter.kinds.join(','));
  if (filter.since) qs.set('since', filter.since);
  if (filter.until) qs.set('until', filter.until);
  if (filter.q) qs.set('q', filter.q);
  if (filter.limit) qs.set('limit', String(filter.limit));
  const path = `/admin/activity${qs.toString() ? `?${qs.toString()}` : ''}`;
  return http.get(path);
}
