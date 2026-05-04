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

export async function totpEnable(
  code: string,
): Promise<{ enabled: true; backupCodes: string[] }> {
  return http.post<{ enabled: true; backupCodes: string[] }>(
    '/auth/me/totp/enable',
    { code },
  );
}

export async function totpDisable(code: string): Promise<{ enabled: false }> {
  return http.post<{ enabled: false }>('/auth/me/totp/disable', { code });
}

export async function totpRegenBackupCodes(
  code: string,
): Promise<{ backupCodes: string[] }> {
  return http.post<{ backupCodes: string[] }>(
    '/auth/me/totp/backup-codes/regenerate',
    { code },
  );
}

export async function fetchCurrentStudent(): Promise<Student> {
  return http.get<Student>('/auth/me');
}

export async function logoutAllDevices(): Promise<{ ok: true; tokenVersion: number }> {
  return http.post<{ ok: true; tokenVersion: number }>('/auth/logout-all-devices', {});
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

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return http.post<{ ok: true }>('/auth/me/password', { currentPassword, newPassword });
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

export async function resetPassword(token: string, password: string): Promise<{ ok: true; email: string }> {
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
}

export async function fetchMyProgress(): Promise<MyProgressDto> {
  return http.get<MyProgressDto>('/me/progress');
}

export async function markLessonCompleted(
  lessonId: string,
  courseId: string,
  moduleId: string,
): Promise<{ lessonId: string; completedAt: string }> {
  return http.post<{ lessonId: string; completedAt: string }>(
    `/lessons/${encodeURIComponent(lessonId)}/complete`,
    { courseId, moduleId },
  );
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
  return http.put<SupportTicket>(
    `/admin/support/tickets/${encodeURIComponent(id)}/status`,
    { status },
  );
}

export async function respondSupportTicket(id: string, message: string): Promise<{ ok: true }> {
  return http.post<{ ok: true }>(
    `/admin/support/tickets/${encodeURIComponent(id)}/respond`,
    { message },
  );
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

// ---------- LGPD export + delete ----------

export async function requestAccountDeletion(): Promise<{ ok: true }> {
  return http.post<{ ok: true }>('/me/request-deletion', {});
}

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

export async function updateLoginConfig(
  patch: Partial<LoginConfigDto>,
): Promise<LoginConfigDto> {
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
  | 'mock'
  | 'stripe'
  | 'asaas'
  | 'pagarme'
  | 'paypal'
  | 'mercadopago';

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

export async function createPaymentGateway(
  input: CreateGatewayInput,
): Promise<PaymentGatewayDto> {
  return http.post<PaymentGatewayDto>('/admin/payments/gateways', input);
}

export async function updatePaymentGateway(
  id: string,
  patch: UpdateGatewayInput,
): Promise<PaymentGatewayDto> {
  return http.put<PaymentGatewayDto>(
    `/admin/payments/gateways/${encodeURIComponent(id)}`,
    patch,
  );
}

export async function deletePaymentGateway(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(
    `/admin/payments/gateways/${encodeURIComponent(id)}`,
  );
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

export async function deleteProduct(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/products/${encodeURIComponent(id)}`);
}

// Orders
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded';

export interface OrderDto {
  id: string;
  userId: string;
  userEmail: string;
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

export async function fetchMyOrders(): Promise<OrderDto[]> {
  return http.get<OrderDto[]>('/me/orders');
}

export async function fetchAllOrders(): Promise<OrderDto[]> {
  return http.get<OrderDto[]>('/admin/orders');
}

export async function startCheckout(productId: string, gatewayId?: string): Promise<OrderDto> {
  return http.post<OrderDto>('/payments/checkout', { productId, gatewayId });
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
  const res = await fetch(
    `/api/admin/imports/templates/${encodeURIComponent(entity)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
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

export async function fetchImportJobs(
  filter: ImportJobsFilterDto = {},
): Promise<ImportJobDto[]> {
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

export async function downloadImportJob(
  id: string,
  format: 'csv' | 'json',
): Promise<void> {
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
  return http.post<RollbackResultDto>(
    `/admin/imports/jobs/${encodeURIComponent(id)}/rollback`,
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
  if (options.expirationRule)
    form.set('enrollment_expiration_rule', options.expirationRule);
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
  await http.delete<{ ok: true }>(
    `/admin/imports/connections/${encodeURIComponent(id)}`,
  );
}

export interface ConnectionTestResult {
  wp: { ok: boolean; message: string };
  wc: { ok: boolean; message: string };
  overall: 'ok' | 'error';
}

export async function testImportConnection(id: string): Promise<ConnectionTestResult> {
  return http.post<ConnectionTestResult>(
    `/admin/imports/connections/${encodeURIComponent(id)}/test`,
    {},
  );
}

export interface RunApiInputDto {
  connectionId: string;
  entities: ImportEntityTypeDto[];
  dryRun?: boolean;
  enrollment?: {
    startRule?: EnrollmentStartRuleDto;
    expirationRule?: EnrollmentExpirationRuleDto;
    defaultAccessDurationDays?: number;
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

export async function validateCertificate(
  code: string,
): Promise<{ valid: boolean; certificate?: Certificate }> {
  try {
    return await http.get<{ valid: boolean; certificate?: Certificate }>(
      `/certificates/validate/${encodeURIComponent(code)}`,
    );
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
  tags?: string[];
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

// ---------- Email transacional ----------

export type EmailProviderIdDto = 'mock' | 'resend' | 'sendgrid' | 'postmark' | 'smtp';

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
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
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

export async function testEmailConfig(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  return http.post(`/admin/email/configs/${encodeURIComponent(id)}/test`, {});
}

export async function sendTestEmail(
  id: string,
  to: string,
): Promise<{ ok: boolean }> {
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

export interface WebhookEndpointDto {
  id: string;
  name: string;
  url: string;
  events: WebhookEventTypeDto[];
  enabled: boolean;
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

export async function fetchWebhookDeliveries(
  endpointId?: string,
): Promise<WebhookDeliveryDto[]> {
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

export async function createApiToken(
  input: CreateApiTokenInput,
): Promise<CreateApiTokenResult> {
  return http.post('/admin/api-tokens', input);
}

export async function revokeApiToken(id: string): Promise<{ ok: true }> {
  return http.post(`/admin/api-tokens/${encodeURIComponent(id)}/revoke`, {});
}

export async function deleteApiToken(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/admin/api-tokens/${encodeURIComponent(id)}`);
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

export async function deleteAdminNote(
  studentId: string,
  noteId: string,
): Promise<{ ok: true }> {
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

export async function fetchMyCourseReview(
  courseId: string,
): Promise<MyCourseReviewDto | null> {
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
  updatedAt: string;
}

export async function fetchMyNotificationPrefs(): Promise<NotificationPrefsDto> {
  return http.get('/me/notification-prefs');
}

export async function updateMyNotificationPrefs(
  patch: Partial<Pick<NotificationPrefsDto, 'receiveBroadcasts' | 'receiveReengagement'>>,
): Promise<NotificationPrefsDto> {
  return http.put('/me/notification-prefs', patch);
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

export async function fetchActivityFeed(filter: {
  kinds?: ActivityKindDto[];
  since?: string;
  until?: string;
  q?: string;
  limit?: number;
} = {}): Promise<ActivityItemDto[]> {
  const qs = new URLSearchParams();
  if (filter.kinds && filter.kinds.length > 0) qs.set('kinds', filter.kinds.join(','));
  if (filter.since) qs.set('since', filter.since);
  if (filter.until) qs.set('until', filter.until);
  if (filter.q) qs.set('q', filter.q);
  if (filter.limit) qs.set('limit', String(filter.limit));
  const path = `/admin/activity${qs.toString() ? `?${qs.toString()}` : ''}`;
  return http.get(path);
}
