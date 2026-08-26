import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { readFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { currentStudent } from '../src/app/data/seed';

// Lê version do package.json no boot (sem reads em runtime)
const AVA_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pathResolve(process.cwd(), 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
})();
const AVA_STARTED_AT = new Date().toISOString();
import * as usersStore from './auth/users-store';
import * as oauthGoogle from './auth/oauth-google';
import * as oauthMicrosoft from './auth/oauth-microsoft';
import * as samlAuth from './auth/saml';
import crypto from 'node:crypto';
import { signToken, verifyToken } from './auth/jwt';
import {
  generateSecret,
  generateBackupCodes,
  hashBackupCode,
  buildOtpauthUri,
  verifyTotp,
} from './auth/totp';
import { encryptApiKey, decryptApiKey } from './db/encryption';
import { attachUser, requireAuth } from './auth/middleware';
import { canImpersonate, startImpersonation, exitImpersonation } from './auth/impersonation';
import { blockDuringImpersonation } from './auth/block-during-impersonation';
import { createResetToken, consumeResetToken } from './auth/password-reset';
import { auditMiddleware } from './audit/middleware';
import { listAudit, auditByDay, recordAudit } from './audit/log';
import { recordError, listErrors, recordClientError, errorsByDay } from './errors/store';
import { saveUpload, UploadError } from './uploads/store';
import { gatherHealth } from './monitoring/health';
import { search as adminSearch } from './search/admin-search';
import { studentSearch } from './search/student-search';
import {
  createSupportTicketSchema,
  recoveryPlanSchema,
  studentsFilterSchema,
  loginSchema,
  updateAiConfigSchema,
  tutorAskSchema,
  createCourseSchema,
  updateCourseSchema,
  reorderCourseSchema,
  createNewsSchema,
  updateNewsSchema,
  createLibrarySchema,
  updateLibrarySchema,
  createPodcastSchema,
  updatePodcastSchema,
  createModuleSchema,
  updateModuleSchema,
  createLessonSchema,
  updateLessonSchema,
  createStudentSchema,
  updateStudentSchema,
  extendCourseAccessSchema,
  enviarConvitesSchema,
  studentStatusEnum,
  createAssessmentSchema,
  updateAssessmentSchema,
  createSystemUserSchema,
  updateSystemUserSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  broadcastNotificationSchema,
  updateProfileSchema,
  selfChangePasswordSchema,
  createPaymentGatewaySchema,
  updatePaymentGatewaySchema,
  createProductSchema,
  updateProductSchema,
  checkoutSchema,
  publicCheckoutSchema,
  createCouponSchema,
  updateCouponSchema,
  createSessionServiceSchema,
  updateSessionServiceSchema,
  createProfessionalSchema,
  updateProfessionalSchema,
  upsertPriceTierSchema,
  createBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  updateBookingSchema,
} from '../shared/schemas';
import { rateLimit } from './rate-limit';
import * as rateLimitTelemetry from './rate-limit';
import { jsonError, validate } from './http';
import { getProvider, listProviders, calculateCost } from './ai/providers';
import * as aiConfigRepo from './repositories/ai-configs';
import {
  transcribeWithWhisper,
  downloadVideoForTranscription,
  inferFilenameFromUrl,
} from './ai/whisper';
import * as supportRepo from './repositories/support';
import * as coursesRepo from './repositories/courses';
import { isPubliclyListed } from './public/projections';
import {
  segmentar as segmentarConvite,
  ROTULO_MOTIVO as ROTULO_MOTIVO_CONVITE,
} from './convites/elegibilidade';
import { montarListaConvite, registrarConvite } from './convites/repo';
import { consultarCota as consultarCotaEmail } from './notifications/cota';
import { renderPrimeiroAcesso } from './notifications/templates';
import { courseAccessFor, accessDeniedCode, accessDeniedMessage } from './access/guard';
import { accessFor as accessInfoFor } from './access/course-access';
import { simularPrazoDoCurso, darCarencia } from './access/impacto';
import { AVISO_OPCIONAL, BASE_LEGAL } from './sessions/regra-opcional';
import * as newsRepo from './repositories/news';
import * as podcastsRepo from './repositories/podcasts';
import * as libraryRepo from './repositories/library';
import * as certsRepo from './repositories/certificates';
import * as retentionRepo from './repositories/retention';
import * as recoveryPlans from './repositories/recovery-plans';
import * as sessionsRepo from './repositories/sessions';
import * as bookingsRepo from './sessions/bookings-repo';
import * as sessionAvisos from './sessions/avisos';
import * as studentsRepo from './repositories/students';
import * as metricsRepo from './repositories/metrics';
import * as notificationsRepo from './repositories/notifications';
import * as loginConfigRepo from './repositories/login-config';
import * as settingsRepo from './repositories/settings';
import * as tutorHistory from './repositories/tutor-history';
import * as progressRepo from './repositories/progress';
import * as lessonNotesRepo from './repositories/lesson-notes';
import * as podcastEngagementRepo from './repositories/podcast-engagement';
import * as certValidationsRepo from './repositories/cert-validations';
import * as gatewaysRepo from './payments/gateways-repo';
import * as productsRepo from './payments/products-repo';
import * as ordersRepo from './payments/orders-repo';
import * as couponsRepo from './payments/coupons-repo';
import { ALL_PROVIDERS, getPaymentProvider } from './payments/providers/registry';
import * as importJobs from './imports/job-store';
import {
  CSV_TEMPLATES,
  listAllTemplates,
  generateCsvTemplate,
} from './imports/schemas/csv-templates';
import { parseCsvBuffer } from './imports/connectors/csv';
import { runDryRun, runReal } from './imports/service';
import { triggerApiImport } from './imports/runner';
import { exportJobAsCsv, exportJobAsJson, listJobsFiltered } from './imports/reports';
import { rollbackJob, previewRollback } from './imports/rollback';
import * as importConnections from './imports/connections-store';
import * as importSchedules from './imports/schedules-store';
import { pingWp, diagnoseWp } from './imports/connectors/wp';
import { pingWc } from './imports/connectors/wc';
import { pingLd, diagnoseLd } from './imports/connectors/ld';
import { collectFromApi } from './imports/connectors/orchestrator';
import * as emailConfigs from './notifications/config-store';
import * as webhookEndpoints from './webhooks/endpoints-store';
import { buildSnapshot as buildHealthSnapshot } from './health/dashboard';
import * as reengagementCfg from './reengagement/config-store';
import * as apiTokens from './auth/api-tokens';
import * as rolesStore from './auth/roles-store';
import { requireApiToken } from './auth/api-token-middleware';
import * as activityFeed from './activity/feed';
import { buildCsv, csvResponse } from './export/csv';
import * as adminNotes from './admin/notes-store';
import * as discussions from './discussions/store';
import { buildSalesSummary } from './payments/sales-analytics';
import { renderInvoiceHtml } from './payments/invoice';
import { renderCertificateHtml } from './repositories/certificate-render';
import * as backupWorker from './db/backup-worker';
import * as deletionRequests from './auth/deletion-requests-store';
import * as adminDigest from './notifications/admin-digest';
import * as weeklyReport from './notifications/weekly-report';
import * as studentProgressEmail from './notifications/student-progress-email';
import * as welcome from './notifications/welcome';
import * as wishlistStore from './activity/wishlist-store';
import { buildLeaderboard, getUserRank } from './activity/leaderboard';
import * as liveSessions from './live-sessions/store';
import * as zoomConfig from './live-sessions/zoom-config';
import * as mentoringStore from './mentoring/store';
import * as transcriptionConfig from './transcription/config';
import * as transcriptionStore from './transcription/store';
import { getTranscriptionProvider } from './transcription/providers';
import { PSYCHOANALYSIS_VOCABULARY } from './transcription/vocabulary';
import * as savedSearches from './saved-searches/store';
import { readConfirmHeader, confirmMatches } from './http/confirm';
import { buildOpenApiSpec } from './http/openapi';
import * as logBuffer from './monitoring/log-buffer';
import * as watchTimeRepo from './repositories/watch-time';
import * as courseReviews from './reviews/store';
import * as achievementsStore from './achievements/store';
import * as achievementsEngine from './achievements/engine';
import * as settingsBackup from './settings/backup';
import * as reengagementWorker from './reengagement/worker';
import * as expiryWorker from './access/expiry-worker';
import * as lembreteWorker from './sessions/lembrete-worker';
import * as webhookDeliveries from './webhooks/delivery-store';
import * as webhooksDispatcher from './webhooks/dispatcher';
import { ALL_WEBHOOK_EVENTS, type WebhookEventType } from './webhooks/types';
import { WEBHOOK_PRESETS } from './webhooks/presets';
import * as emailLogs from './notifications/log-store';
import * as emailBroadcasts from './notifications/broadcasts';
import * as notificationPrefs from './notifications/prefs-store';
import { sendWithConfig, pingConfig, sendSafe } from './notifications/sender';
import { ALL_EMAIL_PROVIDERS } from './notifications/providers/registry';
import {
  renderPasswordReset,
  renderOrderPaid,
  previewTemplate,
  TEMPLATE_NAMES,
} from './notifications/templates';
import * as templateOverrides from './notifications/template-overrides';
import type { EmailProviderId } from './notifications/types';
import type {
  ImportEntityType,
  ImportSource,
  ImportEnrollmentConfig,
  EnrollmentStartRule,
  EnrollmentExpirationRule,
} from './imports/types';
import { AiError } from './ai/types';
import { hasDb } from './db/client';
import { computeModuleLock, findModuleLockForLesson } from './repositories/drip';
import * as studyPaths from './repositories/study-paths';
import { computePathProgress } from './repositories/study-paths';
import * as questionBank from './repositories/question-bank';
import { checkPrerequisites, computeCompletedCourseIds } from './repositories/prerequisites';

/**
 * Libera acesso do usuário ao produto pago.
 * - course: enroll no curso (adiciona ao enrolledCourseIds do estudante)
 * - session_pack/tutor_pack: registra em metadata para uso futuro (sprint subsequente)
 */
function renderUnsubPage(kind: 'ok' | 'error', title: string, message: string): string {
  const accent = kind === 'ok' ? '#10b981' : '#dc2626';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — AVA PCO</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7f9;color:#1a1a1a}
.box{max-width:520px;margin:80px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center}
h1{margin:0 0 12px;color:${accent}}
p{margin:0 0 16px;color:#555;line-height:1.5}
.brand{font-size:14px;color:#999;margin-top:24px}
a{color:#0070f3;text-decoration:none}
</style>
</head>
<body>
<div class="box">
<h1>${escapeHtmlBasic(title)}</h1>
<p>${escapeHtmlBasic(message)}</p>
<p class="brand">AVA PCO · <a href="https://ava.psicanaliseclinica.online">ava.psicanaliseclinica.online</a></p>
</div>
</body>
</html>`;
}

function escapeHtmlBasic(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m === '"' ? '&quot;' : '&#39;',
  );
}

async function grantAccessForOrder(order: import('./payments/types').Order): Promise<void> {
  if (order.productSnapshot.kind === 'course' && order.productSnapshot.refId) {
    await studentsRepo.enrollInCourse(order.userId, order.productSnapshot.refId);
    return;
  }
  if (order.productSnapshot.kind === 'bundle') {
    const ids = await getBundleCourseIds(order.productId);
    for (const courseId of ids) {
      await studentsRepo.enrollInCourse(order.userId, courseId);
    }
  }
  // Sessão paga: confirma o agendamento que o pedido estava segurando.
  if (order.productSnapshot.kind === 'session_pack' && order.productSnapshot.refId) {
    const booking = await bookingsRepo.findById(order.productSnapshot.refId);
    // Só sai de pending_payment. Sessão já cancelada não ressuscita porque o
    // pagamento entrou depois — isso vira caso de estorno, não de confirmação.
    if (booking && booking.status === 'pending_payment') {
      const confirmada = await bookingsRepo.update(booking.id, { status: 'confirmed' });
      // O aluno acabou de pagar: é o pior momento para ficar sem resposta.
      if (confirmada) await sessionAvisos.avisar('confirmada', confirmada);
    }
    return;
  }
  // Demais kinds: por ora apenas registrado na order (events). Sprint futuro implementa.
}

/**
 * Revoga o acesso liberado pelo grantAccessForOrder. Inverso simétrico.
 */
async function revokeAccessForOrder(order: import('./payments/types').Order): Promise<void> {
  if (order.productSnapshot.kind === 'course' && order.productSnapshot.refId) {
    await studentsRepo.unenrollFromCourse(order.userId, order.productSnapshot.refId);
    return;
  }
  if (order.productSnapshot.kind === 'bundle') {
    const ids = await getBundleCourseIds(order.productId);
    for (const courseId of ids) {
      await studentsRepo.unenrollFromCourse(order.userId, courseId);
    }
  }
  // Estorno de sessão: volta a aguardar pagamento em vez de seguir confirmada.
  // Cancelar de vez é decisão de gente, não consequência automática do estorno.
  if (order.productSnapshot.kind === 'session_pack' && order.productSnapshot.refId) {
    const booking = await bookingsRepo.findById(order.productSnapshot.refId);
    if (booking && booking.status === 'confirmed') {
      await bookingsRepo.update(booking.id, { status: 'pending_payment' });
    }
  }
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;
}

async function getBundleCourseIds(productId: string): Promise<string[]> {
  const p = await productsRepo.findById(productId);
  if (!p || p.kind !== 'bundle') return [];
  const arr = (p.metadata as { courseIds?: unknown } | undefined)?.courseIds;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === 'string');
}

export function buildApp() {
  const app = new Hono().basePath('/api');

  app.use('*', logger());
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        connectSrc: ["'self'", 'https:'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
      },
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
    }),
  );
  app.use(
    '*',
    cors({
      origin: (origin) => {
        const allowed = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
          .split(',')
          .map((s) => s.trim());
        if (!origin) return '*';
        return allowed.includes(origin) ? origin : null;
      },
      credentials: true,
    }),
  );
  app.use('*', rateLimit({ windowMs: 60_000, max: 120 }));
  app.use('*', attachUser);
  app.use('*', auditMiddleware);

  // Version header em toda response
  app.use('*', async (c, next) => {
    await next();
    c.header('X-AVA-Version', AVA_VERSION);
  });

  // ---------- App settings ----------

  // Público — branding/contato visíveis no rodapé etc.
  app.get('/settings', async (c) => c.json(await settingsRepo.getSettings()));

  app.put('/admin/settings', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const allowed = [
      'siteName',
      'contactEmail',
      'timezone',
      'cookiePolicyText',
      'termsUrl',
      'privacyUrl',
      'helpEmail',
      'whatsappNumber',
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    const next = await settingsRepo.updateSettings(patch);
    return c.json(next);
  });

  // ---------- Login customization ----------

  // Público — usado pela tela /login para renderizar branding
  app.get('/login-config', async (c) => c.json(await loginConfigRepo.getConfig()));

  // Admin: atualiza
  app.put('/admin/login-config', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    // Aceita só keys conhecidas
    const allowed = [
      'tag',
      'title',
      'subtitle',
      'fromColor',
      'viaColor',
      'toColor',
      'position',
      'theme',
      'logoUrl',
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    const next = await loginConfigRepo.updateConfig(patch);
    return c.json(next);
  });

  app.post('/admin/login-config/reset', requireAuth('admin', 'superadmin'), async (c) => {
    const next = await loginConfigRepo.resetConfig();
    return c.json(next);
  });

  // /version público — dev/debug
  app.get('/version', (c) =>
    c.json({
      version: AVA_VERSION,
      startedAt: AVA_STARTED_AT,
      env: process.env.NODE_ENV ?? 'development',
    }),
  );

  // /health rápido — sem I/O caro (usado por crons)
  app.get('/health', (c) =>
    c.json({ ok: true, ts: Date.now(), db: hasDb() ? 'connected' : 'fallback' }),
  );

  /** Versão pública — sem auth. Útil pra badges/clients. */
  app.get('/version', async (c) => {
    let version = 'unknown';
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      version = pkg.version ?? 'unknown';
    } catch {
      /* ignore */
    }
    return c.json({
      version,
      name: 'ava-pco',
      commit: process.env.GIT_COMMIT ?? null,
    });
  });

  /**
   * /ready — readiness probe. Verifica se DATA_DIR é gravável.
   * Retorna 503 se algo essencial está quebrado.
   */
  app.get('/ready', async (c) => {
    const checks: Record<string, boolean> = {};
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      const probePath = path.join(dataDir, '.ready-probe');
      await fs.writeFile(probePath, String(Date.now()), 'utf8');
      await fs.readFile(probePath, 'utf8');
      await fs.unlink(probePath).catch(() => undefined);
      checks.dataDirWritable = true;
    } catch {
      checks.dataDirWritable = false;
    }
    checks.processUptimeOk = process.uptime() >= 0;
    const ok = Object.values(checks).every(Boolean);
    if (!ok) {
      return c.json({ ok: false, checks }, 503);
    }
    return c.json({ ok: true, checks, ts: Date.now() });
  });

  // /health/full — coleta uptime, mem, tamanho data/, erros 24h. Auth admin
  app.get('/health/full', requireAuth('admin', 'superadmin'), async (c) => {
    const stats = await gatherHealth(hasDb() ? 'connected' : 'fallback');
    return c.json(stats);
  });

  // ---------- Auth (mock) ----------

  // Limite estrito em /auth/login: 5 tentativas / min por IP
  app.post('/auth/login', rateLimit({ windowMs: 60_000, max: 5 }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return jsonError(c, 400, 'INVALID_INPUT', parsed.error.message);
    const { email, password } = parsed.data;
    const user = await usersStore.verifyPassword(email, password);
    if (!user) return jsonError(c, 401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

    // Se 2FA ativado, retorna challenge — token só após verificar TOTP
    if (user.totpEnabled) {
      const ticket = await signToken(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          tv: user.tokenVersion ?? 0,
          totp: 'pending',
        },
        600,
      );
      return c.json({ totpRequired: true, ticket });
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    });
    return c.json({ user, token });
  });

  // Conclui login após TOTP. Aceita 6-digit ou backup code (formato AAAA-AAAA).
  app.post('/auth/login/totp', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      ticket?: string;
      code?: string;
    };
    if (!body.ticket || !body.code) {
      return jsonError(c, 400, 'INVALID_INPUT', 'Ticket e code são obrigatórios.');
    }
    const claims = await verifyToken(body.ticket).catch(() => null);
    if (!claims || (claims as { totp?: string }).totp !== 'pending') {
      return jsonError(c, 401, 'INVALID_TICKET', 'Ticket inválido ou expirado.');
    }
    const raw = await usersStore.findRawById(claims.sub);
    if (!raw || !raw.totpEnabled || !raw.totpSecretEncrypted) {
      return jsonError(c, 400, 'NO_TOTP', 'Usuário sem 2FA ativo.');
    }

    const code = body.code.trim();
    let valid = false;

    // Tenta TOTP primeiro
    if (/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      const secret = decryptApiKey(raw.totpSecretEncrypted);
      valid = verifyTotp(secret, code);
    } else {
      // Senão tenta backup code
      const hash = hashBackupCode(code);
      valid = await usersStore.consumeBackupCode(raw.id, hash);
    }

    if (!valid) {
      return jsonError(c, 401, 'INVALID_CODE', 'Código 2FA inválido.');
    }

    const user = usersStore.toPublic(raw);
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    });
    return c.json({ user, token });
  });

  // ---------- OAuth Google (env-gated) ----------
  // Inicio: redirect para Google. Salva state em cookie HttpOnly.
  app.get('/auth/oauth/google', async (c) => {
    const cfg = oauthGoogle.googleConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'OAuth Google nao configurado.');
    }
    const state = oauthGoogle.generateState();
    const url = oauthGoogle.buildGoogleAuthUrl({ config: cfg, state });
    // 10 min
    c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    return c.redirect(url, 302);
  });

  // Callback: valida state, exchange code, busca user, cria/atualiza, JWT.
  app.get('/auth/oauth/google/callback', async (c) => {
    const cfg = oauthGoogle.googleConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'OAuth Google nao configurado.');
    }
    const code = c.req.query('code');
    const state = c.req.query('state');
    const err = c.req.query('error');
    if (err) {
      return c.redirect(`/login?error=oauth_${encodeURIComponent(err)}`, 302);
    }
    if (!code || !state) {
      return jsonError(c, 400, 'INVALID_INPUT', 'code e state obrigatorios.');
    }
    const cookies = c.req.header('cookie') ?? '';
    const m = /(?:^|;\s*)oauth_state=([^;]+)/.exec(cookies);
    const expected = m?.[1];
    if (!expected || expected !== state) {
      return jsonError(c, 400, 'STATE_MISMATCH', 'CSRF state invalido.');
    }

    let userInfo;
    try {
      const tk = await oauthGoogle.exchangeCodeForToken(code, cfg);
      if (!tk.access_token) throw new Error('access_token ausente');
      userInfo = await oauthGoogle.fetchGoogleUserInfo(tk.access_token);
    } catch (e) {
      return c.redirect(
        `/login?error=oauth_${encodeURIComponent(e instanceof Error ? e.message.slice(0, 80) : 'unknown')}`,
        302,
      );
    }
    if (!userInfo.email) {
      return c.redirect('/login?error=oauth_no_email', 302);
    }

    // Cria ou recupera local user (role student por default).
    let raw = await usersStore.findUserByEmail(userInfo.email);
    if (!raw) {
      const password = crypto.randomBytes(24).toString('hex');
      const created = await usersStore.createUser({
        email: userInfo.email,
        name: userInfo.name ?? userInfo.email.split('@')[0],
        role: 'student',
        password,
        active: true,
      });
      raw = await usersStore.findUserByEmail(created.email);
    }
    if (!raw || !raw.active) {
      return c.redirect('/login?error=oauth_user_inactive', 302);
    }

    const token = await signToken({
      sub: raw.id,
      email: raw.email,
      role: raw.role,
      tv: raw.tokenVersion ?? 0,
    });
    // Limpa state cookie e devolve token via fragmento (#) — nunca query string,
    // pra nao logar no histórico do servidor de redirect.
    c.header('Set-Cookie', 'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return c.redirect(`/auth/oauth/finish#token=${encodeURIComponent(token)}`, 302);
  });

  // ---------- OAuth Microsoft Entra ID (env-gated) ----------
  app.get('/auth/oauth/microsoft', async (c) => {
    const cfg = oauthMicrosoft.microsoftConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'OAuth Microsoft nao configurado.');
    }
    const state = oauthMicrosoft.generateState();
    const url = oauthMicrosoft.buildMicrosoftAuthUrl({ config: cfg, state });
    c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    return c.redirect(url, 302);
  });

  app.get('/auth/oauth/microsoft/callback', async (c) => {
    const cfg = oauthMicrosoft.microsoftConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'OAuth Microsoft nao configurado.');
    }
    const code = c.req.query('code');
    const state = c.req.query('state');
    const err = c.req.query('error');
    if (err) {
      return c.redirect(`/login?error=oauth_${encodeURIComponent(err)}`, 302);
    }
    if (!code || !state) {
      return jsonError(c, 400, 'INVALID_INPUT', 'code e state obrigatorios.');
    }
    const cookies = c.req.header('cookie') ?? '';
    const m = /(?:^|;\s*)oauth_state=([^;]+)/.exec(cookies);
    if (!m?.[1] || m[1] !== state) {
      return jsonError(c, 400, 'STATE_MISMATCH', 'CSRF state invalido.');
    }

    let userInfo;
    try {
      const tk = await oauthMicrosoft.exchangeCodeForToken(code, cfg);
      if (!tk.access_token) throw new Error('access_token ausente');
      userInfo = await oauthMicrosoft.fetchMicrosoftUserInfo(tk.access_token);
    } catch (e) {
      return c.redirect(
        `/login?error=oauth_${encodeURIComponent(e instanceof Error ? e.message.slice(0, 80) : 'unknown')}`,
        302,
      );
    }
    const email = oauthMicrosoft.extractEmail(userInfo);
    if (!email) {
      return c.redirect('/login?error=oauth_no_email', 302);
    }

    let raw = await usersStore.findUserByEmail(email);
    if (!raw) {
      const password = crypto.randomBytes(24).toString('hex');
      const created = await usersStore.createUser({
        email,
        name: userInfo.displayName ?? email.split('@')[0],
        role: 'student',
        password,
        active: true,
      });
      raw = await usersStore.findUserByEmail(created.email);
    }
    if (!raw || !raw.active) {
      return c.redirect('/login?error=oauth_user_inactive', 302);
    }
    const token = await signToken({
      sub: raw.id,
      email: raw.email,
      role: raw.role,
      tv: raw.tokenVersion ?? 0,
    });
    c.header('Set-Cookie', 'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return c.redirect(`/auth/oauth/finish#token=${encodeURIComponent(token)}`, 302);
  });

  // ---------- SAML SSO (env-gated, com signature validation via xml-crypto) ----------
  app.get('/auth/saml/login', async (c) => {
    const cfg = samlAuth.samlConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'SAML nao configurado.');
    }
    const xml = samlAuth.buildAuthnRequest(cfg);
    const relay = c.req.query('relay') ?? '/dashboard';
    return c.redirect(samlAuth.buildRedirectUrl(cfg, xml, relay), 302);
  });

  app.post('/auth/saml/acs', async (c) => {
    const cfg = samlAuth.samlConfigFromEnv();
    if (!cfg) {
      return jsonError(c, 503, 'NOT_CONFIGURED', 'SAML nao configurado.');
    }
    const body = (await c.req.parseBody().catch(() => ({}))) as Record<
      string,
      string | File | undefined
    >;
    const samlResponse = body['SAMLResponse'];
    if (typeof samlResponse !== 'string') {
      return jsonError(c, 400, 'INVALID_INPUT', 'SAMLResponse ausente.');
    }
    const rs = body['RelayState'];
    const relayState = typeof rs === 'string' ? rs : '/dashboard';

    const sigCheck = samlAuth.verifySamlSignature(samlResponse, cfg.idpCert);
    if (!sigCheck.valid) {
      return c.redirect(
        `/login?error=saml_sig_${encodeURIComponent(sigCheck.reason ?? 'invalid')}`,
        302,
      );
    }

    let assertion;
    try {
      assertion = samlAuth.parseSamlResponse(samlResponse);
    } catch (e) {
      return c.redirect(
        `/login?error=saml_${encodeURIComponent(e instanceof Error ? e.message.slice(0, 80) : 'parse')}`,
        302,
      );
    }
    const conditions = samlAuth.validateConditions(assertion);
    if (!conditions.ok) {
      return c.redirect(
        `/login?error=saml_${encodeURIComponent(conditions.reason ?? 'invalid')}`,
        302,
      );
    }
    if (!assertion.email) {
      return c.redirect('/login?error=saml_no_email', 302);
    }

    let raw = await usersStore.findUserByEmail(assertion.email);
    if (!raw) {
      const password = crypto.randomBytes(24).toString('hex');
      const created = await usersStore.createUser({
        email: assertion.email,
        name:
          assertion.attributes.displayName ??
          assertion.attributes.name ??
          assertion.email.split('@')[0],
        role: 'student',
        password,
        active: true,
      });
      raw = await usersStore.findUserByEmail(created.email);
    }
    if (!raw || !raw.active) {
      return c.redirect('/login?error=saml_user_inactive', 302);
    }
    const token = await signToken({
      sub: raw.id,
      email: raw.email,
      role: raw.role,
      tv: raw.tokenVersion ?? 0,
    });
    return c.redirect(
      `/auth/oauth/finish#token=${encodeURIComponent(token)}&relay=${encodeURIComponent(relayState)}`,
      302,
    );
  });

  // Setup TOTP — gera secret novo e devolve URI otpauth://. Só persiste após /enable.
  app.post('/auth/me/totp/setup', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const raw = await usersStore.findRawById(u.sub);
    if (!raw) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
    if (raw.totpEnabled) {
      return jsonError(c, 409, 'ALREADY_ENABLED', '2FA já está ativo. Desative primeiro.');
    }
    const secret = generateSecret();
    const uri = buildOtpauthUri({
      secret,
      accountName: raw.email,
      issuer: 'AVA PCO',
    });
    await usersStore.setTotpSecret(raw.id, encryptApiKey(secret));
    return c.json({ secret, uri });
  });

  // Enable TOTP — usuário envia primeiro código pra confirmar setup.
  app.post(
    '/auth/me/totp/enable',
    requireAuth(),
    blockDuringImpersonation('user.totp.enable'),
    async (c) => {
      const u = c.get('user')!;
      const body = (await c.req.json().catch(() => ({}))) as { code?: string };
      if (!body.code) return jsonError(c, 400, 'INVALID_INPUT', 'code é obrigatório.');
      const raw = await usersStore.findRawById(u.sub);
      if (!raw || !raw.totpSecretEncrypted) {
        return jsonError(c, 400, 'NO_SETUP', 'Setup não iniciado. Chame /setup antes.');
      }
      const secret = decryptApiKey(raw.totpSecretEncrypted);
      if (!verifyTotp(secret, body.code)) {
        return jsonError(c, 401, 'INVALID_CODE', 'Código inválido.');
      }
      const codes = generateBackupCodes(10);
      const hashes = codes.map(hashBackupCode);
      await usersStore.enableTotp(raw.id, hashes);
      return c.json({ enabled: true, backupCodes: codes });
    },
  );

  // Disable TOTP — exige código atual para evitar lockout indireto.
  app.post(
    '/auth/me/totp/disable',
    requireAuth(),
    blockDuringImpersonation('user.totp.disable'),
    async (c) => {
      const u = c.get('user')!;
      const body = (await c.req.json().catch(() => ({}))) as { code?: string };
      const raw = await usersStore.findRawById(u.sub);
      if (!raw || !raw.totpEnabled || !raw.totpSecretEncrypted) {
        return jsonError(c, 400, 'NOT_ENABLED', '2FA não está ativo.');
      }
      const secret = decryptApiKey(raw.totpSecretEncrypted);
      const code = (body.code ?? '').trim();
      let valid = false;
      if (/^\d{6}$/.test(code)) valid = verifyTotp(secret, code);
      else if (code) valid = await usersStore.consumeBackupCode(raw.id, hashBackupCode(code));
      if (!valid) return jsonError(c, 401, 'INVALID_CODE', 'Código inválido.');
      await usersStore.disableTotp(raw.id);
      return c.json({ enabled: false });
    },
  );

  // Regenera backup codes (revoga todos os antigos).
  app.post('/auth/me/totp/backup-codes/regenerate', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const body = (await c.req.json().catch(() => ({}))) as { code?: string };
    const raw = await usersStore.findRawById(u.sub);
    if (!raw || !raw.totpEnabled || !raw.totpSecretEncrypted) {
      return jsonError(c, 400, 'NOT_ENABLED', '2FA não está ativo.');
    }
    const secret = decryptApiKey(raw.totpSecretEncrypted);
    if (!body.code || !verifyTotp(secret, body.code)) {
      return jsonError(c, 401, 'INVALID_CODE', 'Código TOTP inválido.');
    }
    const codes = generateBackupCodes(10);
    const hashes = codes.map(hashBackupCode);
    await usersStore.regenBackupCodes(raw.id, hashes);
    return c.json({ backupCodes: codes });
  });

  app.get('/auth/me', async (c) => {
    const jwt = c.get('user');
    if (!jwt) {
      // Sem token: comportamento legado retorna currentStudent (compatibilidade dev)
      return c.json(await studentsRepo.getCurrentStudent());
    }
    const u = await usersStore.findUserById(jwt.sub);
    if (!u) return jsonError(c, 401, 'UNAUTHORIZED', 'Usuário não existe mais.');
    if (u.role === 'student') {
      // O perfil é DESTE aluno. Antes de 20/ago/2026 aqui vinha
      // `getCurrentStudent()` — sempre o aluno do seed — com nome e e-mail
      // trocados por cima: todo mundo via as matrículas e o progresso de outra
      // pessoa, e não via os próprios cursos.
      const s = await studentsRepo.getStudentProfile(u.id);
      return c.json({
        ...(s ?? {
          enrolledCourseIds: [],
          weeklyGoalMinutes: 180,
          totalStudyMinutes: 0,
          riskScore: 0,
          createdAt: u.createdAt,
        }),
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl ?? null,
      });
    }
    return c.json(u);
  });

  // ---------- Forgot / Reset password ----------

  // Limite estrito em /auth/forgot-password: 3 tentativas / 5min
  app.post('/auth/forgot-password', rateLimit({ windowMs: 5 * 60_000, max: 3 }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(forgotPasswordSchema, body);
    if (!v.ok) {
      // Mesmo input ruim retorna sucesso vazio (não vaza existência de e-mail)
      return c.json({ ok: true });
    }
    const u = await usersStore.findUserByEmail(v.data.email);
    if (u && u.active) {
      const token = await createResetToken(u.id, u.email);
      if (process.env.NODE_ENV !== 'production') {
        // Nunca em produção: o token dá para trocar a senha de qualquer conta
        // por 30 minutos, e quem lê o log da aplicação passaria a poder fazer
        // isso com as 1.600 contas de uma vez, no dia do convite em massa.
        // eslint-disable-next-line no-console
        console.log(`[forgot-password] reset token para ${u.email}: ${token.token}`);
      }
      const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
      const resetUrl = `${base}/redefinir-senha?token=${encodeURIComponent(token.token)}`;
      const tpl = renderPasswordReset({
        userName: u.name,
        resetUrl,
        expiresInMinutes: 30,
      });
      void sendSafe({
        to: { email: u.email, name: u.name },
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tag: 'password_reset',
      });
      if (process.env.NODE_ENV !== 'production') {
        return c.json({ ok: true, devToken: token.token, expiresIn: 30 * 60 });
      }
    }
    return c.json({ ok: true });
  });

  // Limite estrito em /auth/reset-password: 10 tentativas / min por IP
  app.post('/auth/reset-password', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(resetPasswordSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const tokenEntry = await consumeResetToken(v.data.token);
    if (!tokenEntry) {
      return jsonError(c, 400, 'INVALID_TOKEN', 'Token inválido ou expirado.');
    }
    const ok = await usersStore.changePassword(tokenEntry.userId, v.data.password);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
    return c.json({ ok: true, email: tokenEntry.email });
  });

  // Heatmap de estudo: 365 dias × contagem de aulas concluídas
  app.get('/me/study-heatmap', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const list = await progressRepo.listForUser(u.sub);
    const counts = new Map<string, number>();
    for (const p of list) {
      const day = p.completedAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const days: { date: string; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: counts.get(key) ?? 0 });
    }
    const totalLessons = list.length;
    const activeDays = counts.size;
    const lastYearLessons = days.reduce((s, d) => s + d.count, 0);
    return c.json({
      days,
      summary: {
        totalLessons,
        activeDays,
        lastYearLessons,
        max: Math.max(0, ...Array.from(counts.values())),
      },
    });
  });

  // Self-service: aluno define sua meta semanal de estudo (em minutos)
  app.put('/me/weekly-goal', requireAuth(), async (c) => {
    const u = c.get('user')!;
    if (u.role !== 'student') {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas alunos têm meta semanal.');
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = body.weeklyGoalMinutes;
    const minutes = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 2400) {
      return jsonError(
        c,
        400,
        'INVALID_INPUT',
        'weeklyGoalMinutes deve ser inteiro entre 15 e 2400.',
      );
    }
    const updated = await studentsRepo.updateAdminStudent(u.sub, {
      weeklyGoalMinutes: minutes,
    });
    if (!updated) {
      return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado.');
    }
    await recordAudit(c, {
      action: 'student.weekly_goal.update',
      targetType: 'student',
      targetId: u.sub,
      meta: { weeklyGoalMinutes: minutes },
    });
    return c.json({ ok: true, weeklyGoalMinutes: minutes });
  });

  // Atualiza perfil do user logado (nome, avatar)
  app.put('/auth/me', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateProfileSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    try {
      const updated = await usersStore.updateUser(u.sub, v.data);
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
      return c.json(updated);
    } catch (err) {
      return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
    }
  });

  // Self-service: troca de senha (exige senha atual)
  app.post(
    '/auth/me/password',
    requireAuth(),
    blockDuringImpersonation('user.password.change'),
    async (c) => {
      const u = c.get('user')!;
      const body = await c.req.json().catch(() => ({}));
      const v = validate(selfChangePasswordSchema, body);
      if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
      const result = await usersStore.verifyAndChangePassword(
        u.sub,
        v.data.currentPassword,
        v.data.newPassword,
      );
      if (result === 'wrong-password') {
        return jsonError(c, 400, 'WRONG_PASSWORD', 'Senha atual incorreta.');
      }
      if (result === 'not-found') {
        return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
      }
      return c.json({ ok: true });
    },
  );

  // Revoga todos os tokens do user logado (logout em todos os dispositivos)
  app.post('/auth/logout-all-devices', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const newTv = await usersStore.bumpTokenVersion(u.sub);
    if (newTv === null) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
    return c.json({ ok: true, tokenVersion: newTv });
  });

  // ---------- Uploads ----------

  // Multipart limited a 5MB, mime allowlist (imagens). Requer auth.
  app.post('/uploads', requireAuth(), async (c) => {
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return jsonError(c, 400, 'INVALID_FORM', 'Form-data inválido.');
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return jsonError(c, 400, 'NO_FILE', 'Campo "file" ausente ou inválido.');
    }
    try {
      const result = await saveUpload(file);
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof UploadError) {
        return jsonError(c, err.status, err.code, err.message);
      }
      throw err;
    }
  });

  // ---------- Progresso (usuário logado) ----------

  /**
   * Prazo de acesso do aluno, curso por curso. A interface usa isto para o
   * aviso de "seu acesso termina em N dias" e para a tela de renovação — sem
   * ela, o aluno só descobriria o vencimento ao levar um 403.
   */
  app.get('/me/course-access', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const student = await studentsRepo.findAdminStudent(u.sub);
    if (!student) return c.json({ courses: [] });
    const allCourses = await coursesRepo.listCourses();
    const now = new Date();
    const courses = (student.enrolledCourseIds ?? []).map((courseId) => {
      const course = allCourses.find((co) => co.id === courseId);
      const info = accessInfoFor(
        {
          enrolledAt: student.enrollmentDates?.[courseId] ?? student.createdAt,
          storedExpiresAt: student.accessExpiresByCourse?.[courseId] ?? null,
          accessMonths: (course as unknown as { accessMonths?: number | null } | undefined)
            ?.accessMonths,
        },
        now,
      );
      return {
        courseId,
        courseTitle: course?.title ?? courseId,
        enrolledAt: student.enrollmentDates?.[courseId] ?? null,
        accessMonths:
          (course as unknown as { accessMonths?: number | null } | undefined)?.accessMonths ?? null,
        ...info,
      };
    });
    return c.json({ courses });
  });

  app.get('/me/progress', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const list = await progressRepo.listForUser(u.sub);
    const byCourse = await progressRepo.progressByCourse(u.sub);

    // Streak: dias distintos com pelo menos 1 lesson concluída, contados pra trás a partir de hoje (UTC)
    const distinctDays = new Set(list.map((p) => p.completedAt.slice(0, 10)));
    let streak = 0;
    const day = new Date();
    while (distinctDays.has(day.toISOString().slice(0, 10))) {
      streak += 1;
      day.setUTCDate(day.getUTCDate() - 1);
    }

    // Meta semanal + minutos assistidos esta semana (segunda → domingo).
    // Como WatchTimeEntry agrega totalSeconds cumulativo, aproximamos pela
    // soma das aulas completadas nesta semana × duração. Se não tiver
    // duração, fallback de 15 min por aula concluída.
    const student = await studentsRepo.findAdminStudent(u.sub);
    const weeklyGoalMinutes = student?.weeklyGoalMinutes ?? 180;
    const now = new Date();
    const dow = now.getUTCDay(); // 0 = sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysFromMon);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString();
    const completedThisWeek = list.filter((p) => p.completedAt >= weekStartIso);
    const allCourses = await coursesRepo.listCourses();
    const lessonDurations = new Map<string, number>();
    for (const co of allCourses) {
      for (const m of co.modules ?? []) {
        for (const l of m.lessons ?? []) {
          lessonDurations.set(l.id, l.durationMinutes ?? 15);
        }
      }
    }
    const weekMinutes = completedThisWeek.reduce(
      (s, p) => s + (lessonDurations.get(p.lessonId) ?? 15),
      0,
    );

    return c.json({
      completedLessonIds: list.map((p) => p.lessonId),
      byCourse,
      streakDays: streak,
      lastCompletedAt: list[0]?.completedAt ?? null,
      weeklyGoalMinutes,
      weekMinutes,
      weekStartIso,
    });
  });

  app.post('/lessons/:id/complete', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const courseId = typeof body.courseId === 'string' ? body.courseId : '';
    const moduleId = typeof body.moduleId === 'string' ? body.moduleId : '';
    if (!courseId || !moduleId) {
      return jsonError(c, 400, 'INVALID_INPUT', 'courseId e moduleId são obrigatórios');
    }
    // Prazo de acesso: marcar aula é avançar no curso, então expirado não passa.
    // Admin escapa para poder testar o conteúdo.
    if (u.role === 'student') {
      const acc = await courseAccessFor(u.sub, courseId);
      if (!acc.canStudy) {
        return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
          expiresAt: acc.access?.expiresAt ?? null,
        });
      }
    }
    // Drip: bloqueia se o módulo da aula ainda não foi liberado
    // (considera tanto data absoluta quanto relativa à matrícula).
    const courseForLock = await coursesRepo.findCourse(courseId);
    if (courseForLock) {
      const enrolledAt = await studentsRepo.getEnrollmentDate(u.sub, courseId);
      const found = findModuleLockForLesson(courseForLock, lessonId, Date.now(), { enrolledAt });
      if (found?.lock.locked) {
        return jsonError(
          c,
          423,
          'LOCKED',
          `Aula bloqueada — liberação em ${found.lock.lockedUntil}`,
          { lockedUntil: found.lock.lockedUntil },
        );
      }
    }
    const entry = await progressRepo.markCompleted({
      userId: u.sub,
      lessonId,
      courseId,
      moduleId,
    });

    // Verifica se completou 100% do curso e auto-emite certificado
    try {
      const course = await coursesRepo.findCourse(courseId);
      if (course) {
        const total = course.modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
        const done = await progressRepo.listForUser(u.sub);
        const doneInThisCourse = done.filter((p) => p.courseId === courseId).length;
        if (total > 0 && doneInThisCourse >= total) {
          // Já tem cert emitido?
          const allCerts = await certsRepo.listAllCertificates();
          const existing = allCerts.find(
            (cert) =>
              cert.studentId === u.sub && cert.courseId === courseId && cert.status === 'issued',
          );
          if (!existing) {
            const newCert = await certsRepo.issueCertificate({
              studentId: u.sub,
              courseId,
            });
            await notificationsRepo.createOne({
              userId: u.sub,
              title: `🎓 Certificado emitido — ${course.title}`,
              body: `Parabéns! Você concluiu o curso. Código de validação: ${newCert.validationCode}.`,
              category: 'announcement',
              link: '/certificados',
              authorEmail: 'sistema',
            });
            void webhooksDispatcher.emit('certificate.issued', {
              certificateId: newCert.id,
              studentId: u.sub,
              studentEmail: u.email,
              courseId,
              courseTitle: course.title,
              validationCode: newCert.validationCode,
              issuedAt: newCert.issuedAt,
            });
            void webhooksDispatcher.emit('course.completed', {
              studentId: u.sub,
              studentEmail: u.email,
              courseId,
              courseTitle: course.title,
            });
          }
        }
      }
    } catch (err) {
      console.error('[auto-issue cert] erro ao verificar:', err);
    }

    // Avalia achievements (síncrono — retorna newly-granted ao cliente para UI celebrar)
    let newAchievements: Array<{
      badgeId: string;
      title: string;
      description: string;
      icon: string;
      awardedAt: string;
    }> = [];
    try {
      const r = await achievementsEngine.evaluate(u.sub);
      newAchievements = r.granted.map((g) => {
        const def = achievementsStore.BADGES[g.badgeId];
        return {
          badgeId: g.badgeId,
          title: def?.name ?? g.badgeId,
          description: def?.description ?? '',
          icon: def?.icon ?? '🏆',
          awardedAt: g.awardedAt,
        };
      });
    } catch (err) {
      console.error('[achievements] erro:', err);
    }

    return c.json({ ...entry, newAchievements }, 201);
  });

  // Watch-time heartbeat — cliente envia chunks pequenos (até 60s) durante a reprodução
  app.post(
    '/me/lessons/:id/watch',
    requireAuth(),
    rateLimit({ windowMs: 60_000, max: 240 }),
    async (c) => {
      const u = c.get('user')!;
      const lessonId = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as {
        courseId?: string;
        deltaSeconds?: number;
        lessonDurationSeconds?: number;
      };
      if (!body.courseId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'courseId é obrigatório');
      }
      const delta = Number(body.deltaSeconds ?? 0);
      if (!Number.isFinite(delta) || delta < 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'deltaSeconds inválido');
      }
      const entry = await watchTimeRepo.addChunk({
        userId: u.sub,
        lessonId,
        courseId: body.courseId,
        deltaSeconds: delta,
        lessonDurationSeconds: body.lessonDurationSeconds,
      });
      return c.json({
        totalSeconds: entry.totalSeconds,
        lessonId: entry.lessonId,
      });
    },
  );

  app.get('/me/lessons/:id/watch', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const entry = await watchTimeRepo.getEntry(u.sub, c.req.param('id') as string);
    return c.json(entry ?? { totalSeconds: 0 });
  });

  /** Export markdown de todas anotações do aluno. */
  app.get('/me/notes/export.md', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const notes = await lessonNotesRepo.listForUser(u.sub);
    const courses = await coursesRepo.listCourses();
    const lessonToCourse = new Map<
      string,
      {
        course: { id: string; title: string };
        module: { id: string; title: string };
        lesson: { id: string; title: string };
      }
    >();
    for (const course of courses) {
      for (const m of course.modules) {
        for (const l of m.lessons) {
          lessonToCourse.set(l.id, {
            course: { id: course.id, title: course.title },
            module: { id: m.id, title: m.title },
            lesson: { id: l.id, title: l.title },
          });
        }
      }
    }
    // Agrupa por course → module → lesson
    const grouped = new Map<
      string,
      Map<string, Array<{ lessonTitle: string; content: string; updatedAt: string }>>
    >();
    for (const n of notes) {
      if (!n.content.trim()) continue;
      const meta = lessonToCourse.get(n.lessonId);
      if (!meta) continue;
      const cKey = `${meta.course.id}|${meta.course.title}`;
      const mKey = `${meta.module.id}|${meta.module.title}`;
      let courseMap = grouped.get(cKey);
      if (!courseMap) {
        courseMap = new Map();
        grouped.set(cKey, courseMap);
      }
      let lessonsArr = courseMap.get(mKey);
      if (!lessonsArr) {
        lessonsArr = [];
        courseMap.set(mKey, lessonsArr);
      }
      lessonsArr.push({
        lessonTitle: meta.lesson.title,
        content: n.content,
        updatedAt: n.updatedAt,
      });
    }

    const lines: string[] = [];
    lines.push(`# Minhas anotações — AVA PCO`);
    lines.push(`> Exportado em ${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    for (const [cKey, courseMap] of grouped) {
      const [, courseTitle] = cKey.split('|');
      lines.push(`## ${courseTitle}`);
      lines.push('');
      for (const [mKey, lessonsArr] of courseMap) {
        const [, moduleTitle] = mKey.split('|');
        lines.push(`### ${moduleTitle}`);
        lines.push('');
        for (const note of lessonsArr) {
          lines.push(`#### ${note.lessonTitle}`);
          lines.push(`*Atualizado: ${new Date(note.updatedAt).toLocaleString('pt-BR')}*`);
          lines.push('');
          lines.push(note.content);
          lines.push('');
        }
      }
    }

    const md = lines.join('\n');
    return new Response(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="anotacoes-${new Date().toISOString().slice(0, 10)}.md"`,
      },
    });
  });

  /** Lista todas anotações do aluno com nome de curso/aula resolvidos. */
  app.get('/me/notes', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const search = c.req.query('search')?.toLowerCase().trim();
    const notes = await lessonNotesRepo.listForUser(u.sub);
    const courses = await coursesRepo.listCourses();
    type Hit = {
      lessonId: string;
      lessonTitle: string;
      moduleId: string;
      moduleTitle: string;
      courseId: string;
      courseTitle: string;
      content: string;
      updatedAt: string;
    };
    const hits: Hit[] = [];
    for (const n of notes) {
      if (!n.content.trim()) continue;
      if (search && !n.content.toLowerCase().includes(search)) continue;
      for (const c of courses) {
        const m = c.modules.find((mod) => mod.lessons.some((l) => l.id === n.lessonId));
        if (m) {
          const lesson = m.lessons.find((l) => l.id === n.lessonId)!;
          hits.push({
            lessonId: n.lessonId,
            lessonTitle: lesson.title,
            moduleId: m.id,
            moduleTitle: m.title,
            courseId: c.id,
            courseTitle: c.title,
            content: n.content,
            updatedAt: n.updatedAt,
          });
          break;
        }
      }
    }
    hits.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
    return c.json(hits);
  });

  /** Retorna a última aula visitada pelo aluno (com title/courseTitle). */
  app.get('/me/last-lesson', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const last = await watchTimeRepo.getLastWatchedForUser(u.sub);
    if (!last) return c.json(null);
    const course = await coursesRepo.findCourse(last.courseId);
    if (!course) return c.json(null);
    let lesson: { id: string; title: string } | null = null;
    let moduleInfo: { id: string; title: string } | null = null;
    for (const m of course.modules) {
      const found = m.lessons.find((l) => l.id === last.lessonId);
      if (found) {
        lesson = { id: found.id, title: found.title };
        moduleInfo = { id: m.id, title: m.title };
        break;
      }
    }
    if (!lesson || !moduleInfo) return c.json(null);
    return c.json({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      moduleId: moduleInfo.id,
      moduleTitle: moduleInfo.title,
      courseId: course.id,
      courseTitle: course.title,
      totalSeconds: last.totalSeconds,
      lastHeartbeatAt: last.lastHeartbeatAt,
    });
  });

  app.get('/admin/lessons/:id/watch-stats', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await watchTimeRepo.aggregateLesson(c.req.param('id') as string)),
  );

  app.get('/admin/courses/:id/watch-stats', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await watchTimeRepo.aggregateCourse(c.req.param('id') as string)),
  );

  /**
   * Analytics consolidado por curso: matriculados + completion + watch-time + rating.
   */
  app.get('/admin/courses/:id/analytics', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');

    const allLessons = (course.modules ?? []).flatMap((m) => m.lessons ?? []);
    const totalLessonsInCourse = allLessons.length;

    // Matriculados
    const allStudents = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
    const enrolled = allStudents.filter((s) => (s.enrolledCourseIds ?? []).includes(courseId));

    // Progress: completion por aluno
    const allProgress = await progressRepo.listAll();
    const progressByUser = new Map<string, Set<string>>();
    for (const p of allProgress) {
      if (p.courseId !== courseId) continue;
      const set = progressByUser.get(p.userId) ?? new Set<string>();
      set.add(p.lessonId);
      progressByUser.set(p.userId, set);
    }

    const distribution = { notStarted: 0, inProgress: 0, completed: 0 };
    const completionRates: number[] = [];
    for (const s of enrolled) {
      const done = (progressByUser.get(s.id) ?? new Set()).size;
      const rate = totalLessonsInCourse > 0 ? done / totalLessonsInCourse : 0;
      completionRates.push(rate);
      if (done === 0) distribution.notStarted++;
      else if (rate >= 1) distribution.completed++;
      else distribution.inProgress++;
    }
    const avgCompletion =
      completionRates.length === 0
        ? 0
        : completionRates.reduce((s, r) => s + r, 0) / completionRates.length;

    // Watch time
    const watchAgg = await watchTimeRepo.aggregateCourse(courseId);

    // Reviews
    const ratingSummary = await courseReviews.summary(courseId);

    return c.json({
      course: {
        id: course.id,
        title: course.title,
        totalLessons: totalLessonsInCourse,
        totalModules: (course.modules ?? []).length,
      },
      enrollment: {
        total: enrolled.length,
        ...distribution,
        avgCompletionPct: Math.round(avgCompletion * 100),
      },
      watchTime: watchAgg,
      rating: ratingSummary,
    });
  });

  app.delete('/lessons/:id/complete', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const ok = await progressRepo.unmarkCompleted(u.sub, lessonId);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Não estava marcada como concluída');
    return c.json({ ok: true });
  });

  // ---------- Podcast engagement (usuário logado) ----------

  app.get('/me/podcast-engagement', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const list = await podcastEngagementRepo.listForUser(u.sub);
    return c.json(list);
  });

  app.put('/podcasts/:id/engagement', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const episodeId = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const patch: { listened?: boolean; favorite?: boolean } = {};
    if (typeof body.listened === 'boolean') patch.listened = body.listened;
    if (typeof body.favorite === 'boolean') patch.favorite = body.favorite;
    const entry = await podcastEngagementRepo.upsert(u.sub, episodeId, patch);
    return c.json(entry);
  });

  // ---------- Solicitação de exclusão de conta (LGPD) ----------

  app.post('/me/request-deletion', requireAuth(), async (c) => {
    const u = c.get('user')!;
    try {
      await notificationsRepo.broadcast({
        audience: 'admins',
        title: `Pedido de exclusão de conta: ${u.email}`,
        body: `O usuário ${u.email} (id ${u.sub}) solicitou exclusão de sua conta conforme LGPD Art. 18. Avaliar e remover via /admin/usuarios.`,
        category: 'warning',
        link: '/admin/usuarios',
        authorEmail: 'sistema',
      });
    } catch (err) {
      console.error('[deletion-request notify]', err);
    }
    return c.json({ ok: true });
  });

  // ---------- Export de dados (LGPD) ----------

  /** Status atual da solicitação ativa (se houver). */
  app.get('/me/account/deletion', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const r = await deletionRequests.findActiveForUser(u.sub);
    return c.json(r);
  });

  /** Aluno solicita exclusão. Admin processa manualmente. */
  app.post(
    '/me/account/deletion',
    requireAuth(),
    rateLimit({ windowMs: 60 * 60_000, max: 3 }),
    async (c) => {
      const u = c.get('user')!;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;
      try {
        const r = await deletionRequests.create({
          userId: u.sub,
          userEmail: u.email,
          reason,
        });
        return c.json(r, 201);
      } catch (err) {
        return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : 'Erro');
      }
    },
  );

  /** Aluno cancela própria solicitação pendente. */
  app.delete('/me/account/deletion/:id', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const id = c.req.param('id') as string;
    const ok = await deletionRequests.cancel(id, u.sub);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Solicitação não encontrada ou já resolvida.');
    return c.json({ ok: true });
  });

  /** Admin lista todas. */
  app.get('/admin/deletion-requests', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await deletionRequests.listAll()),
  );

  /** Admin atualiza status (approved/rejected/completed). */
  app.put(
    '/admin/deletion-requests/:id',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('lgpd.deletion.confirm'),
    async (c) => {
      const id = c.req.param('id') as string;
      const u = c.get('user')!;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const status = String(body.status ?? '');
      const note = typeof body.note === 'string' ? body.note : undefined;
      if (!['approved', 'rejected', 'completed'].includes(status)) {
        return jsonError(c, 400, 'INVALID_STATUS', 'status inválido.');
      }
      const r = await deletionRequests.setStatus(
        id,
        status as 'approved' | 'rejected' | 'completed',
        u.email,
        note,
      );
      if (!r) return jsonError(c, 404, 'NOT_FOUND', 'Solicitação não encontrada.');
      return c.json(r);
    },
  );

  app.get('/me/export', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const profile = await usersStore.findUserById(u.sub);
    const progress = await progressRepo.listForUser(u.sub);
    const notes = await lessonNotesRepo.listForUser(u.sub);
    const engagement = await podcastEngagementRepo.listForUser(u.sub);
    const tutor = await tutorHistory.listForUser(u.sub, 1000);
    const allCerts = await certsRepo.listAllCertificates();
    const certs = allCerts.filter((cert) => cert.studentId === u.sub);

    const dump = {
      exportedAt: new Date().toISOString(),
      user: profile,
      progress,
      lessonNotes: notes,
      podcastEngagement: engagement,
      tutorHistory: tutor,
      certificates: certs,
    };

    return new Response(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ava-pco-export-${u.sub}-${Date.now()}.json"`,
      },
    });
  });

  // ---------- Lesson notes (usuário logado) ----------

  app.get('/lessons/:id/note', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const note = await lessonNotesRepo.getNote(u.sub, lessonId);
    return c.json(note);
  });

  app.put('/lessons/:id/note', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content : '';
    if (content.length > 10000) {
      return jsonError(c, 400, 'TOO_LONG', 'Anotação muito longa (máx 10k chars)');
    }
    const entry = await lessonNotesRepo.upsertNote(u.sub, lessonId, content);
    return c.json(entry);
  });

  app.delete('/lessons/:id/note', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const ok = await lessonNotesRepo.deleteNote(u.sub, lessonId);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Sem anotação');
    return c.json({ ok: true });
  });

  // ---------- Tutor usage (usuário logado) ----------

  app.get('/me/tutor/usage', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const config = await aiConfigRepo.getActiveByModule('tutor');
    if (!config) {
      return c.json({
        configured: false,
        used: 0,
        limit: 0,
        remaining: 0,
        windowDays: 30,
      });
    }
    const used = await aiConfigRepo.countUsageInWindow(config.id, u.sub, 30 * 24 * 60 * 60 * 1000);
    return c.json({
      configured: true,
      used,
      limit: config.perStudentLimit,
      remaining: Math.max(0, config.perStudentLimit - used),
      windowDays: 30,
      provider: config.provider,
      model: config.model,
    });
  });

  // ---------- Tutor history (usuário logado) ----------

  app.get('/tutor/history', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const limit = Number(c.req.query('limit') ?? '50');
    const list = await tutorHistory.listForUser(u.sub, Number.isFinite(limit) ? limit : 50);
    return c.json(list);
  });

  app.delete('/tutor/history', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const removed = await tutorHistory.clearForUser(u.sub);
    return c.json({ ok: true, removed });
  });

  // ---------- Notifications (usuário logado) ----------

  app.get('/notifications', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const limit = Number(c.req.query('limit') ?? '100');
    const items = await notificationsRepo.listForUser(u.sub, Number.isFinite(limit) ? limit : 100);
    return c.json(items);
  });

  app.get('/notifications/unread-count', requireAuth(), async (c) => {
    const u = c.get('user')!;
    // Snooze: mascara badge enquanto pausado, sem perder estado real
    const prefs = await notificationPrefs.getPrefs(u.sub);
    if (notificationPrefs.isSnoozeActive(prefs)) {
      return c.json({ count: 0, snoozedUntil: prefs.snoozedUntil });
    }
    const count = await notificationsRepo.unreadCountForUser(u.sub);
    return c.json({ count });
  });

  app.post('/notifications/:id/read', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const id = c.req.param('id') as string;
    const ok = await notificationsRepo.markRead(u.sub, id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Notificação não encontrada.');
    return c.json({ ok: true });
  });

  app.post('/notifications/mark-all-read', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const updated = await notificationsRepo.markAllRead(u.sub);
    return c.json({ ok: true, updated });
  });

  // Histórico de broadcasts (admin)
  app.get('/admin/notifications/sent', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '50');
    const list = await notificationsRepo.listSentBroadcasts(Number.isFinite(limit) ? limit : 50);
    return c.json(list);
  });

  // Broadcast — admin/superadmin
  app.post('/admin/notifications/broadcast', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(broadcastNotificationSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const u = c.get('user')!;
    const sent = await notificationsRepo.broadcast({
      ...v.data,
      authorEmail: u.email,
    });
    return c.json({ ok: true, sent });
  });

  // ---------- Courses ----------

  app.get('/courses', async (c) => c.json(await coursesRepo.listCourses()));
  /**
   * Endpoint público: retorna o conteúdo de uma lesson SE ela estiver marcada
   * como isPreview=true. Caso contrário 403. Usado pra player aberto a
   * visitantes não matriculados (teaser de marketing).
   */
  /**
   * Retorna transcrição da aula no idioma solicitado. Aluno deve estar
   * matriculado no curso (ou aula ser preview livre). Idiomas disponíveis
   * vêm da própria lesson.transcripts (apenas os com conteúdo são habilitados).
   */
  app.get('/lessons/:id/transcript', async (c) => {
    const lessonId = c.req.param('id') as string;
    const lang = (c.req.query('lang') ?? 'pt') as 'pt' | 'es' | 'en';
    const all = await coursesRepo.listCourses();
    let foundLesson: (typeof all)[number]['modules'][number]['lessons'][number] | null = null;
    let parentCourse: (typeof all)[number] | null = null;
    for (const co of all) {
      for (const m of co.modules ?? []) {
        const l = m.lessons.find((x) => x.id === lessonId);
        if (l) {
          foundLesson = l;
          parentCourse = co;
          break;
        }
      }
      if (foundLesson) break;
    }
    if (!foundLesson || !parentCourse) {
      return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada.');
    }
    const isPreview = foundLesson.isPreview === true;
    if (!isPreview) {
      const user = c.get('user');
      if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'Login necessário.');
      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      if (!isAdmin) {
        const acc = await courseAccessFor(user.sub, parentCourse.id);
        if (!acc.canStudy) {
          return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
            expiresAt: acc.access?.expiresAt ?? null,
          });
        }
      }
    }
    const transcripts =
      (foundLesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
    const availableLocales = Object.entries(transcripts)
      .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
      .map(([k]) => k);
    if (availableLocales.length === 0) {
      return c.json({
        lessonId,
        availableLocales: [],
        locale: null,
        text: null,
      });
    }
    const finalLang = availableLocales.includes(lang)
      ? lang
      : availableLocales.includes('pt')
        ? 'pt'
        : availableLocales[0]!;
    return c.json({
      lessonId,
      availableLocales,
      locale: finalLang,
      text: transcripts[finalLang] ?? null,
    });
  });

  /**
   * Export de transcricao da aula como TXT ou MD.
   * Mesma auth do JSON: matriculado / preview / admin.
   * Query param `format=md|txt` (default txt). `lang=pt|es|en`.
   */
  app.get('/lessons/:id/transcript.:format', async (c) => {
    const lessonId = c.req.param('id') as string;
    const format = (c.req.param('format') ?? 'txt').toLowerCase();
    if (format !== 'md' && format !== 'txt') {
      return jsonError(c, 400, 'BAD_FORMAT', 'Formato deve ser md ou txt.');
    }
    const lang = (c.req.query('lang') ?? 'pt') as 'pt' | 'es' | 'en';
    const all = await coursesRepo.listCourses();
    let foundLesson: (typeof all)[number]['modules'][number]['lessons'][number] | null = null;
    let parentCourse: (typeof all)[number] | null = null;
    let parentModule: (typeof all)[number]['modules'][number] | null = null;
    for (const co of all) {
      for (const m of co.modules ?? []) {
        const l = m.lessons.find((x) => x.id === lessonId);
        if (l) {
          foundLesson = l;
          parentCourse = co;
          parentModule = m;
          break;
        }
      }
      if (foundLesson) break;
    }
    if (!foundLesson || !parentCourse) {
      return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada.');
    }
    if (!foundLesson.isPreview) {
      const user = c.get('user');
      if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'Login necessário.');
      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      if (!isAdmin) {
        const acc = await courseAccessFor(user.sub, parentCourse.id);
        if (!acc.canStudy) {
          return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
            expiresAt: acc.access?.expiresAt ?? null,
          });
        }
      }
    }
    const transcripts =
      (foundLesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
    const availableLocales = Object.entries(transcripts)
      .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
      .map(([k]) => k);
    if (availableLocales.length === 0) {
      return jsonError(c, 404, 'NO_TRANSCRIPT', 'Esta aula não tem transcrição disponível.');
    }
    const finalLang = availableLocales.includes(lang)
      ? lang
      : availableLocales.includes('pt')
        ? 'pt'
        : availableLocales[0]!;
    const text = transcripts[finalLang] ?? '';
    const safeFileSlug = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 60);
    const baseSlug = safeFileSlug(foundLesson.title || 'aula');
    const filename = `${baseSlug}-${finalLang}.${format}`;
    let body: string;
    let contentType: string;
    if (format === 'md') {
      const courseTitle = parentCourse.title || 'Curso';
      const moduleTitle = parentModule?.title || '';
      body = `# ${foundLesson.title}\n\n_${courseTitle}${
        moduleTitle ? ` · ${moduleTitle}` : ''
      } · idioma: ${finalLang}_\n\n---\n\n${text}\n`;
      contentType = 'text/markdown; charset=utf-8';
    } else {
      body = text + '\n';
      contentType = 'text/plain; charset=utf-8';
    }
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });

  app.get('/lessons/:id/preview', async (c) => {
    const lessonId = c.req.param('id') as string;
    const all = await coursesRepo.listCourses();
    let foundLesson: (typeof all)[number]['modules'][number]['lessons'][number] | null = null;
    let parentCourse: (typeof all)[number] | null = null;
    let parentModule: (typeof all)[number]['modules'][number] | null = null;
    for (const co of all) {
      for (const m of co.modules ?? []) {
        const l = m.lessons.find((x) => x.id === lessonId);
        if (l) {
          foundLesson = l;
          parentCourse = co;
          parentModule = m;
          break;
        }
      }
      if (foundLesson) break;
    }
    if (!foundLesson || !parentCourse || !parentModule) {
      return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada.');
    }
    if (!foundLesson.isPreview) {
      return jsonError(c, 403, 'NOT_PREVIEW', 'Esta aula não está disponível como preview livre.');
    }
    return c.json({
      lesson: {
        id: foundLesson.id,
        title: foundLesson.title,
        videoUrl: foundLesson.videoUrl ?? null,
        description: foundLesson.description ?? '',
        durationMinutes: foundLesson.durationMinutes,
      },
      module: {
        id: parentModule.id,
        title: parentModule.title,
      },
      course: {
        id: parentCourse.id,
        title: parentCourse.title,
        slug: parentCourse.slug,
        shortTitle: parentCourse.shortTitle,
        coverColor: parentCourse.coverColor,
      },
    });
  });

  app.get('/courses/:id', async (c) => {
    const course = await coursesRepo.findCourse(c.req.param('id'));
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    // Drip: usa data de matrícula do aluno logado (se houver) pra
    // computar drip relativo. Visitantes só veem o lock absoluto.
    const me = c.get('user');
    const enrolledAt = me ? await studentsRepo.getEnrollmentDate(me.sub, course.id) : null;
    const ctx = { enrolledAt };
    const enriched = {
      ...course,
      modules: course.modules.map((m) => {
        const lock = computeModuleLock(m, Date.now(), ctx);
        return lock.locked
          ? { ...m, lockedUntil: lock.lockedUntil, locked: true }
          : { ...m, locked: false };
      }),
    };
    return c.json(enriched);
  });

  /**
   * Verifica se o aluno logado completou os pré-requisitos do curso.
   * Retorna { ok, missing, status } pra UI mostrar warning antes de matricular.
   */
  app.get('/me/courses/:id/prereq', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');
    const required = course.prerequisiteCourseIds ?? [];
    if (required.length === 0) {
      return c.json({ ok: true, missing: [], status: [], required: [] });
    }
    const allCourses = await coursesRepo.listCourses();
    const myProgress = await progressRepo.listForUser(u.sub);
    const completedLessonIds = myProgress.map((p) => p.lessonId);
    const completedCourseIds = computeCompletedCourseIds(allCourses, completedLessonIds);
    const result = checkPrerequisites(required, completedCourseIds);
    // Anexa info dos cursos pra UI mostrar título/slug
    const detailById = new Map(allCourses.map((co) => [co.id, co]));
    const status = result.status.map((s) => {
      const co = detailById.get(s.courseId);
      return {
        courseId: s.courseId,
        completed: s.completed,
        title: co?.title ?? null,
        slug: co?.slug ?? null,
      };
    });
    return c.json({
      ok: result.ok,
      missing: result.missing,
      status,
      required,
    });
  });

  // ---------- News ----------

  app.get('/news', async (c) => c.json(await newsRepo.listNews()));

  // ---------- Podcasts ----------

  app.get('/podcasts', async (c) => c.json(await podcastsRepo.listPodcasts()));
  app.get('/podcasts/:id', async (c) => {
    const ep = await podcastsRepo.findPodcast(c.req.param('id'));
    if (!ep) return jsonError(c, 404, 'NOT_FOUND', 'Episódio não encontrado');
    return c.json(ep);
  });

  // ---------- Library ----------

  app.get('/library', async (c) => {
    const { type, courseId, mandatoryOnly } = c.req.query();
    return c.json(
      await libraryRepo.listLibrary({
        type,
        courseId,
        mandatoryOnly: mandatoryOnly === 'true',
      }),
    );
  });

  // ---------- Certificates ----------

  // Certificados de quem está logado. Sem auth aqui, esta rota devolvia os
  // certificados do aluno do seed para qualquer visitante — dado de uma pessoa
  // aparecendo para outra.
  app.get('/certificates', requireAuth(), async (c) => {
    const u = c.get('user')!;
    return c.json(await certsRepo.listCertificatesForStudent(u.sub));
  });

  // Renderiza HTML do certificado para impressão. Aluno dono ou admin.
  app.get('/certificates/:id/render', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const id = c.req.param('id') as string;
    const all = await certsRepo.listAllCertificates();
    const cert = all.find((x) => x.id === id);
    if (!cert) return jsonError(c, 404, 'NOT_FOUND', 'Certificado não encontrado.');

    const isAdmin = u.role === 'admin' || u.role === 'superadmin';
    if (!isAdmin && cert.studentId !== u.sub) {
      return jsonError(c, 403, 'FORBIDDEN', 'Acesso negado.');
    }

    const student = await usersStore.findUserById(cert.studentId);
    const course = await coursesRepo.findCourse(cert.courseId);
    const html = renderCertificateHtml({
      certificate: cert,
      studentName: student?.name ?? 'Aluno',
      courseName: course?.title ?? 'Curso',
      courseHours:
        typeof (course as { totalHours?: number } | null)?.totalHours === 'number'
          ? (course as { totalHours?: number }).totalHours
          : undefined,
      validationBaseUrl: process.env.PUBLIC_ORIGIN,
      template: (course as { certificateTemplate?: unknown } | null)?.certificateTemplate as
        | Parameters<typeof renderCertificateHtml>[0]['template']
        | undefined,
    });
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

  // Admin: lista todos
  app.get('/admin/certificates', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await certsRepo.listAllCertificates()),
  );

  // Validação pública (sem auth) — usada por terceiros que recebem o link
  app.get('/certificates/validate/:code', async (c) => {
    const code = c.req.param('code') as string;
    const cert = await certsRepo.findByValidationCode(code);
    if (!cert) return c.json({ valid: false }, 404);
    // Rastreia validação (não bloqueia resposta se falhar)
    void certValidationsRepo.recordValidation(code);

    // Enriquece com nomes humanos (sem dados sensíveis)
    const course = await coursesRepo.findCourse(cert.courseId);
    const student = await usersStore.findUserById(cert.studentId);
    return c.json({
      valid: true,
      certificate: cert,
      courseTitle: course?.title ?? null,
      courseHours: course?.totalHours ?? null,
      studentName: student?.name ?? null,
    });
  });

  // Stats de validação (admin)
  app.get('/admin/certificates/validations', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await certValidationsRepo.listAll()),
  );

  // Admin: emite certificado manualmente
  app.post('/admin/certificates', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const courseId = typeof body.courseId === 'string' ? body.courseId : '';
    if (!studentId || !courseId) {
      return jsonError(c, 400, 'INVALID_INPUT', 'studentId e courseId são obrigatórios.');
    }
    const cert = await certsRepo.issueCertificate({ studentId, courseId });
    void webhooksDispatcher.emit('certificate.issued', {
      certificateId: cert.id,
      studentId,
      courseId,
      validationCode: cert.validationCode,
      issuedAt: cert.issuedAt,
      manual: true,
    });
    return c.json(cert, 201);
  });

  // Admin: revoga
  app.delete('/admin/certificates/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await certsRepo.deleteCertificate(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Certificado não encontrado.');
    return c.json({ ok: true });
  });

  // ---------- Retention ----------

  app.get('/retention/risks', async (c) =>
    c.json(await retentionRepo.listRetentionRisks(c.req.query('level'))),
  );

  /**
   * Recalcula o risco de evasão de todos os alunos a partir dos dados atuais
   * (último acesso, progresso por curso, datas de matrícula). Atualiza
   * admin-students.riskScore + status e substitui retention-risks por um
   * snapshot novo.
   */
  app.post(
    '/admin/retention/recompute',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const { recomputeAllRisks } = await import('./services/retention-calculator');
      // carga horária real por curso (default 30h se desconhecido)
      const courses = await coursesRepo.listCourses();
      const hoursById = new Map(courses.map((co) => [co.id, co.totalHours ?? 30]));
      const summary = await recomputeAllRisks({
        courseHours: (id) => hoursById.get(id) ?? 30,
      });
      return c.json({ ok: true, ...summary });
    },
  );

  // ---------- Sessions / Professionals ----------

  /**
   * Projeção pública de um profissional.
   *
   * `email` e `hourlyRate` ficam de fora porque estas rotas não pedem token:
   * qualquer um na internet lê. Enquanto havia só dado de semente ninguém se
   * importava, mas o próximo passo do projeto é cadastrar profissionais de
   * verdade — e aí seriam e-mails reais servidos abertos, prontos para
   * raspagem. O admin continua vendo tudo em `/admin/sessions/professionals`.
   */
  function profissionalPublico(p: sessionsRepo.ProfessionalRow) {
    const { email: _email, hourlyRate: _hourlyRate, ...publico } = p;
    return publico;
  }

  app.get('/sessions/services', async (c) => c.json(await sessionsRepo.listSessionServices()));
  app.get('/sessions/professionals', async (c) =>
    c.json((await sessionsRepo.listProfessionals()).map(profissionalPublico)),
  );
  app.get('/sessions/price-tiers', async (c) => c.json(await sessionsRepo.listPriceTiers()));

  /**
   * Quem pode atender agora. O aluno agenda com o profissional disponível no
   * momento — não escolhe uma pessoa e fica esperando ela abrir agenda.
   */
  app.get('/sessions/available', async (c) => {
    const serviceId = c.req.query('serviceId') || undefined;
    return c.json({
      aviso: AVISO_OPCIONAL,
      profissionais: (await sessionsRepo.listAvailableProfessionals(serviceId)).map(
        profissionalPublico,
      ),
    });
  });

  /**
   * A regra em forma de dado, para que a tela não a reescreva por conta.
   * Análise e supervisão são opcionais por exigência legal: condicioná-las à
   * venda do curso é venda casada (CDC, art. 39, I).
   */
  app.get('/sessions/policy', async (c) =>
    c.json({ aviso: AVISO_OPCIONAL, baseLegal: BASE_LEGAL }),
  );

  // ---- Agendamento (aluno) ----

  /**
   * Agenda uma sessão de verdade.
   *
   * Até 25/ago/2026 a tela do aluno tinha um botão "Confirmar agendamento" que
   * só avançava um passo local: nada era gravado, e mesmo assim a tela
   * prometia que o link da reunião chegaria por e-mail. Esta rota existe para
   * que a promessa passe a ser verdade.
   *
   * O que é recusado, e por quê:
   *
   * - profissional inativo, indisponível, ou que não atende aquele serviço —
   *   a lista pública já filtra, mas quem chama a API direto não passa;
   * - profissional sem faixa de preço válida — cobrar R$ 0,00 por engano é
   *   pior do que recusar e avisar;
   * - mesmo profissional, mesmo horário, agendamento ainda de pé.
   */
  app.post('/sessions/bookings', requireAuth(), async (c) => {
    const user = c.get('user')!;
    const v = validate(createBookingSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());

    const servicos = await sessionsRepo.listSessionServices();
    const servico = servicos.find((sv) => sv.id === v.data.serviceId);
    if (!servico || !servico.active) {
      return jsonError(c, 404, 'NOT_FOUND', 'Serviço não encontrado ou fora do ar.');
    }

    const profissionais = await sessionsRepo.listProfessionals();
    const prof = profissionais.find((pr) => pr.id === v.data.professionalId);
    if (!prof) return jsonError(c, 404, 'NOT_FOUND', 'Profissional não encontrado.');
    if (!prof.active || !prof.available) {
      return jsonError(
        c,
        409,
        'INDISPONIVEL',
        'Este profissional não está aceitando agendamentos.',
      );
    }
    if (!prof.serviceIds.includes(servico.id)) {
      return jsonError(c, 409, 'NAO_ATENDE', 'Este profissional não atende este serviço.');
    }
    if (prof.precoIndefinido) {
      return jsonError(
        c,
        409,
        'PRECO_INDEFINIDO',
        'A faixa de preço deste profissional não está configurada. Escolha outro profissional ou fale com a coordenação.',
      );
    }

    const quando = new Date(v.data.scheduledFor);
    if (quando.getTime() <= Date.now()) {
      return jsonError(c, 400, 'VALIDATION', 'A data escolhida já passou.');
    }
    const iso = quando.toISOString();
    // A duração entra na conta: sem ela, 14:00 e 14:10 passariam como horários
    // distintos numa sessão de 50 minutos, e dois alunos marcariam em cima um
    // do outro com a mesma pessoa.
    if (await bookingsRepo.horarioOcupado(prof.id, iso, servico.durationMinutes)) {
      return jsonError(c, 409, 'HORARIO_OCUPADO', 'Este horário conflita com outra sessão.');
    }

    const booking = await bookingsRepo.create({
      userId: user.sub,
      userEmail: user.email,
      serviceId: servico.id,
      serviceName: servico.name,
      professionalId: prof.id,
      professionalName: prof.name,
      scheduledFor: iso,
      durationMinutes: servico.durationMinutes,
      priceCents: prof.priceCents,
      tierId: prof.level,
      // Agendar não é pagar: quando o serviço exige pagamento antes, nasce
      // pendente e o checkout muda o status. Sem isso, nasce agendado e a
      // confirmação é manual.
      status: servico.paymentBeforeConfirmation ? 'pending_payment' : 'scheduled',
      meetingLink: '',
      notes: v.data.notes,
    });

    // Explícito porque o auditMiddleware só cobre /admin/* — e agendar é
    // compromisso de dinheiro feito pelo próprio aluno.
    await recordAudit(c, {
      action: 'session.booking.create',
      targetType: 'session_booking',
      targetId: booking.id,
      meta: {
        serviceId: servico.id,
        professionalId: prof.id,
        priceCents: booking.priceCents,
      },
    });
    await sessionAvisos.avisar('criada', booking);
    return c.json({ aviso: AVISO_OPCIONAL, agendamento: booking }, 201);
  });

  /** As sessões do próprio aluno. Ninguém vê as dos outros por aqui. */
  app.get('/sessions/bookings', requireAuth(), async (c) => {
    const user = c.get('user')!;
    return c.json(await bookingsRepo.listForUser(user.sub));
  });

  /**
   * Remarca. Só a data muda — trocar de profissional é agendar outra coisa, e
   * o preço foi congelado com base em quem atende.
   *
   * Sessão já paga continua paga: remarcar não devolve para pending_payment,
   * senão o aluno pagaria duas vezes pela mesma hora.
   */
  app.post('/sessions/bookings/:id/reschedule', requireAuth(), async (c) => {
    const user = c.get('user')!;
    const v = validate(rescheduleBookingSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());

    const booking = await bookingsRepo.findById(c.req.param('id') as string);
    if (!booking) return jsonError(c, 404, 'NOT_FOUND', 'Agendamento não encontrado.');
    const ehDono = booking.userId === user.sub;
    const ehAdmin = user.role === 'admin' || user.role === 'superadmin';
    if (!ehDono && !ehAdmin) {
      return jsonError(c, 403, 'FORBIDDEN', 'Este agendamento não é seu.');
    }
    if (booking.status === 'cancelled' || booking.status === 'done') {
      return jsonError(c, 409, 'NAO_REMARCAVEL', 'Sessão cancelada ou já realizada não remarca.');
    }

    const quando = new Date(v.data.scheduledFor);
    if (quando.getTime() <= Date.now()) {
      return jsonError(c, 400, 'VALIDATION', 'A data escolhida já passou.');
    }
    const iso = quando.toISOString();
    // ignorarId: ao mover, a sessão não pode conflitar consigo mesma.
    if (
      await bookingsRepo.horarioOcupado(
        booking.professionalId,
        iso,
        booking.durationMinutes,
        booking.id,
      )
    ) {
      return jsonError(c, 409, 'HORARIO_OCUPADO', 'Este horário conflita com outra sessão.');
    }

    const out = await bookingsRepo.update(booking.id, { scheduledFor: iso });
    if (out) await sessionAvisos.avisar('remarcada', out);
    await recordAudit(c, {
      action: 'session.booking.reschedule',
      targetType: 'session_booking',
      targetId: booking.id,
      meta: { de: booking.scheduledFor, para: iso, porDono: ehDono },
    });
    return c.json(out);
  });

  app.post('/sessions/bookings/:id/cancel', requireAuth(), async (c) => {
    const user = c.get('user')!;
    const v = validate(cancelBookingSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());

    const booking = await bookingsRepo.findById(c.req.param('id') as string);
    if (!booking) return jsonError(c, 404, 'NOT_FOUND', 'Agendamento não encontrado.');
    // Dono ou admin. Sem isto, o id de outro aluno cancelaria a sessão dele.
    const ehDono = booking.userId === user.sub;
    const ehAdmin = user.role === 'admin' || user.role === 'superadmin';
    if (!ehDono && !ehAdmin) {
      return jsonError(c, 403, 'FORBIDDEN', 'Este agendamento não é seu.');
    }
    if (booking.status === 'cancelled') return c.json(booking);
    if (booking.status === 'done') {
      return jsonError(c, 409, 'JA_REALIZADA', 'Sessão já realizada não pode ser cancelada.');
    }

    const out = await bookingsRepo.cancel(booking.id, v.data.reason);
    if (out) await sessionAvisos.avisar('cancelada', out);
    await recordAudit(c, {
      action: 'session.booking.cancel',
      targetType: 'session_booking',
      targetId: booking.id,
      meta: { porDono: ehDono },
    });
    return c.json(out);
  });

  /**
   * Paga a sessão.
   *
   * Reusa inteiro o maquinário de checkout dos cursos — mesmos gateways, mesmo
   * provider, mesma tabela de pedidos — com uma diferença que importa: o preço
   * **não** vem de uma linha de produto, vem do agendamento. Sessão não tem
   * preço fixo por serviço; tem preço por titulação de quem atende, congelado
   * no instante em que o aluno agendou. Criar um produto para cada combinação
   * de serviço × faixa seria inventar catálogo para descrever o que o
   * agendamento já sabe.
   *
   * O pedido nasce com `kind: 'session_pack'` e `refId` apontando para o
   * agendamento; quando o gateway confirma, `grantAccessForOrder` acha o
   * agendamento por aí e o move para `confirmed`.
   */
  app.post(
    '/sessions/bookings/:id/checkout',
    requireAuth(),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const u = c.get('user')!;
      const booking = await bookingsRepo.findById(c.req.param('id') as string);
      if (!booking) return jsonError(c, 404, 'NOT_FOUND', 'Agendamento não encontrado.');
      if (booking.userId !== u.sub) {
        return jsonError(c, 403, 'FORBIDDEN', 'Este agendamento não é seu.');
      }
      if (booking.status === 'cancelled') {
        return jsonError(c, 409, 'CANCELADA', 'Esta sessão foi cancelada.');
      }
      if (booking.status !== 'pending_payment') {
        return jsonError(c, 409, 'NADA_A_PAGAR', 'Esta sessão não está aguardando pagamento.');
      }
      if (booking.priceCents <= 0) {
        // O mesmo cuidado da criação: 0 aqui seria cobrar nada por engano.
        return jsonError(c, 409, 'PRECO_INDEFINIDO', 'Sessão sem preço definido.');
      }

      // Pagamento já iniciado e ainda de pé: devolve o mesmo, não cria outro.
      if (booking.orderId) {
        const anterior = await ordersRepo.findById(booking.orderId);
        if (anterior && (anterior.status === 'pending' || anterior.status === 'processing')) {
          return c.json(anterior);
        }
      }

      const gw = (await gatewaysRepo.listActive())[0] ?? null;
      if (!gw) {
        return jsonError(
          c,
          400,
          'NO_ACTIVE_GATEWAY',
          'Nenhum gateway de pagamento ativo configurado.',
        );
      }
      const provider = getPaymentProvider(gw.provider);
      if (!provider) {
        return jsonError(
          c,
          501,
          'PROVIDER_NOT_IMPLEMENTED',
          `Provider ${gw.provider} ainda não tem implementação.`,
        );
      }
      const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
      if (!creds) return jsonError(c, 500, 'INTERNAL', 'Falha ao ler credenciais do gateway.');

      const nome = `${booking.serviceName} com ${booking.professionalName}`;
      const order = await ordersRepo.createOrder({
        userId: u.sub,
        userEmail: u.email,
        // Não existe linha de produto para isto — ver o comentário acima.
        productId: `session:${booking.id}`,
        productSnapshot: {
          name: nome,
          priceCents: booking.priceCents,
          currency: 'BRL',
          kind: 'session_pack',
          refId: booking.id,
        },
        gatewayId: gw.id,
        gatewayProvider: gw.provider,
        amountCents: booking.priceCents,
        currency: 'BRL',
      });
      await bookingsRepo.update(booking.id, { orderId: order.id });

      try {
        const result = await provider.createPayment(gw, creds, {
          amountCents: booking.priceCents,
          currency: 'BRL',
          description: nome,
          customerEmail: u.email,
          metadata: { orderId: order.id, userId: u.sub, bookingId: booking.id },
        });
        const updated = await ordersRepo.attachGatewayResult(order.id, {
          externalId: result.externalId,
          checkoutUrl: result.checkoutUrl,
          qrCode: result.qrCode,
          status: result.status,
        });
        await recordAudit(c, {
          action: 'session.booking.checkout',
          targetType: 'session_booking',
          targetId: booking.id,
          meta: { orderId: order.id, amountCents: booking.priceCents },
        });
        return c.json(updated, 201);
      } catch (err) {
        await ordersRepo.updateStatus(
          order.id,
          'failed',
          err instanceof Error ? err.message : 'Erro do provider',
        );
        return jsonError(
          c,
          502,
          'GATEWAY_FAILED',
          err instanceof Error ? err.message : 'Falha ao criar checkout no gateway.',
        );
      }
    },
  );

  // ---- Admin: gestão de serviços, profissionais e faixas de preço ----

  /** Lista completa, com e-mail — o que a projeção pública omite de propósito. */
  app.get('/admin/sessions/professionals', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await sessionsRepo.listProfessionals()),
  );

  app.get('/admin/sessions/bookings', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await bookingsRepo.listAll()),
  );

  app.put('/admin/sessions/bookings/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const v = validate(updateBookingSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    // O estado ANTES, para avisar só quando algo de fato mudou para o aluno.
    const antes = await bookingsRepo.findById(c.req.param('id') as string);
    const out = await bookingsRepo.update(c.req.param('id') as string, v.data);
    if (!out) return jsonError(c, 404, 'NOT_FOUND', 'Agendamento não encontrado.');

    // É aqui que a promessa da tela vira verdade: "a coordenação confirma e
    // envia o link". Antes, o admin marcava confirmed, colava o link, e nada
    // saía — o aviso dependia de alguém lembrar de escrever à mão.
    if (antes) {
      const virouConfirmada = antes.status !== 'confirmed' && out.status === 'confirmed';
      const ganhouLink = !antes.meetingLink && !!out.meetingLink && out.status === 'confirmed';
      const virouCancelada = antes.status !== 'cancelled' && out.status === 'cancelled';
      if (virouConfirmada || ganhouLink) await sessionAvisos.avisar('confirmada', out);
      else if (virouCancelada) await sessionAvisos.avisar('cancelada', out);
    }
    // Sem recordAudit aqui: auditMiddleware já grava toda mutação em /admin/*.
    return c.json(out);
  });

  app.post('/admin/sessions/services', requireAuth('admin', 'superadmin'), async (c) => {
    const v = validate(createSessionServiceSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    return c.json(await sessionsRepo.createSessionService(v.data), 201);
  });

  app.put('/admin/sessions/services/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const v = validate(updateSessionServiceSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    const r = await sessionsRepo.updateSessionService(c.req.param('id') as string, v.data);
    if (!r) return jsonError(c, 404, 'NOT_FOUND', 'Serviço não encontrado.');
    return c.json(r);
  });

  app.delete('/admin/sessions/services/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await sessionsRepo.deleteSessionService(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Serviço não encontrado.');
    return c.json({ ok: true });
  });

  app.post('/admin/sessions/professionals', requireAuth('admin', 'superadmin'), async (c) => {
    const v = validate(createProfessionalSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    // `level` é string livre no schema porque as faixas são editáveis pelo
    // admin — a lista válida é dado, não tipo. A conferência tem que ser aqui:
    // titulação que não casa com faixa ativa deixava o profissional valendo
    // R$ 0,00 sem ninguém decidir isso.
    if (!(await sessionsRepo.faixaValida(v.data.level))) {
      return jsonError(c, 400, 'FAIXA_INVALIDA', 'Titulação sem faixa de preço ativa.');
    }
    return c.json(await sessionsRepo.createProfessional(v.data), 201);
  });

  app.put('/admin/sessions/professionals/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const v = validate(updateProfessionalSchema, await c.req.json().catch(() => ({})));
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    if (v.data.level !== undefined && !(await sessionsRepo.faixaValida(v.data.level))) {
      return jsonError(c, 400, 'FAIXA_INVALIDA', 'Titulação sem faixa de preço ativa.');
    }
    const r = await sessionsRepo.updateProfessional(c.req.param('id') as string, v.data);
    if (!r) return jsonError(c, 404, 'NOT_FOUND', 'Profissional não encontrado.');
    return c.json(r);
  });

  app.delete('/admin/sessions/professionals/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await sessionsRepo.deleteProfessional(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Profissional não encontrado.');
    return c.json({ ok: true });
  });

  app.put('/admin/sessions/price-tiers/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const v = validate(upsertPriceTierSchema, { ...body, id: c.req.param('id') });
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());
    return c.json(await sessionsRepo.upsertPriceTier(v.data));
  });

  /**
   * Materializa o catálogo de serviços no banco. Idempotente.
   *
   * Enquanto a tabela está vazia, a listagem devolve a semente e as escritas
   * vão para o banco — então editar um serviço da semente responde 404. Esta
   * rota encerra esse descompasso.
   */
  app.post('/admin/sessions/services/seed', requireAuth('admin', 'superadmin'), async (c) =>
    c.json({ criados: await sessionsRepo.seedSessionServices() }),
  );

  /** Cria as três faixas iniciais. Idempotente: não sobrescreve o que existe. */
  app.post('/admin/sessions/price-tiers/seed', requireAuth('admin', 'superadmin'), async (c) =>
    c.json({ criadas: await sessionsRepo.seedPriceTiers() }),
  );

  // ---------- SEO / Metrics ----------

  /**
   * De onde vêm os números da tela de métricas.
   *
   * Existe porque a tela não tinha como saber, e por isso apresentava dado de
   * semente como se fosse medição. Aditivo: as rotas antigas não mudaram de
   * forma.
   */
  app.get('/metrics/seo/status', (c) => c.json(metricsRepo.fonteDasMetricas()));

  app.get('/metrics/seo/timeseries', async (c) =>
    c.json(await metricsRepo.listSeoTimeseries(c.req.query('range'))),
  );
  app.get('/metrics/seo/keywords', async (c) => c.json(await metricsRepo.listKeywords()));

  // ---------- AI: providers catalog ----------

  app.get('/ai/providers', (c) =>
    c.json(
      listProviders().map((p) => ({
        ...p.info,
        // não expõe instância, só metadata
      })),
    ),
  );

  // ---------- AI: configurations (admin) ----------

  app.get('/admin/ai/configurations', async (c) => c.json(await aiConfigRepo.listConfigs()));

  app.post('/admin/ai/configurations', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.module || !body.provider || !body.model) {
      return jsonError(c, 400, 'INVALID_INPUT', 'module, provider e model são obrigatórios');
    }
    const created = await aiConfigRepo.createConfig({
      id: typeof body.id === 'string' ? body.id : undefined,
      module: body.module as 'tutor',
      provider: String(body.provider),
      model: String(body.model),
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
      perStudentLimit: typeof body.perStudentLimit === 'number' ? body.perStudentLimit : undefined,
      perDayLimit: typeof body.perDayLimit === 'number' ? body.perDayLimit : undefined,
      perMonthLimit: typeof body.perMonthLimit === 'number' ? body.perMonthLimit : undefined,
      monthlyCostCap: typeof body.monthlyCostCap === 'number' ? body.monthlyCostCap : undefined,
      systemMessage: typeof body.systemMessage === 'string' ? body.systemMessage : undefined,
      allowedScopes: Array.isArray(body.allowedScopes)
        ? (body.allowedScopes as string[])
        : undefined,
      blockedTopics: Array.isArray(body.blockedTopics)
        ? (body.blockedTopics as string[])
        : undefined,
      fallbackResponse:
        typeof body.fallbackResponse === 'string' ? body.fallbackResponse : undefined,
      active: body.active === true,
    });
    return c.json(aiConfigRepo.toPublic(created), 201);
  });

  app.delete('/admin/ai/configurations/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await aiConfigRepo.deleteConfig(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    return c.json({ ok: true });
  });

  app.get('/admin/ai/configurations/:id', async (c) => {
    const cfg = await aiConfigRepo.getConfig(c.req.param('id'));
    if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    const usage = await aiConfigRepo.aggregateUsage(cfg.id);
    return c.json({ ...aiConfigRepo.toPublic(cfg), usage });
  });

  app.put('/admin/ai/configurations/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateAiConfigSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await aiConfigRepo.updateConfig(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    return c.json(aiConfigRepo.toPublic(updated));
  });

  // Test connection com a chave fornecida (não persiste).
  app.post('/admin/ai/test', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const provider = body?.provider as string;
    const apiKey = body?.apiKey as string;
    if (!provider || !apiKey)
      return jsonError(c, 400, 'INVALID_INPUT', 'provider e apiKey são obrigatórios');
    const p = getProvider(provider as 'anthropic');
    if (!p) return jsonError(c, 400, 'INVALID_PROVIDER', 'Provider desconhecido');
    const result = await p.testKey(apiKey);
    return c.json(result);
  });

  // ---------- AI: Tutor ----------

  app.post('/ai/tutor', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(tutorAskSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());

    const config = await aiConfigRepo.getActiveByModule('tutor');
    if (!config) {
      return c.json({
        message:
          'Tutor Virtual não está configurado. Acesse /admin/ias para selecionar provider, modelo e chave de API.',
        provider: null,
        model: null,
        usage: null,
      });
    }

    // A cota é por aluno, então precisa ser o aluno que está perguntando. Com o
    // id do seed fixo aqui, os 1.601 alunos dividiam uma cota só: bastava um
    // usar o mês inteiro para bloquear todos os outros.
    const quemPergunta = c.get('user');
    const studentId = quemPergunta?.sub ?? currentStudent.id;
    const monthlyUse = await aiConfigRepo.countUsageInWindow(
      config.id,
      studentId,
      30 * 24 * 60 * 60 * 1000,
    );
    if (monthlyUse >= config.perStudentLimit) {
      return jsonError(
        c,
        429,
        'STUDENT_LIMIT',
        `Você atingiu o limite de ${config.perStudentLimit} perguntas neste mês. Pacotes adicionais disponíveis em breve.`,
      );
    }

    const provider = getProvider(config.provider);
    if (!provider) {
      return jsonError(c, 500, 'PROVIDER_MISSING', 'Provider configurado não existe.');
    }

    try {
      const messages = [
        ...(v.data.history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: v.data.message },
      ];

      const result = await provider.chat({
        apiKey: config.apiKey,
        model: config.model,
        messages,
        systemPrompt: config.systemMessage,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      const cost = calculateCost(
        config.provider,
        config.model,
        result.inputTokens,
        result.outputTokens,
      );
      await aiConfigRepo.recordUsage({
        configId: config.id,
        studentId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: cost,
        successful: true,
      });

      // Persiste turno no histórico se o user estiver logado
      const u = c.get('user');
      if (u) {
        await tutorHistory.recordTurn({
          userId: u.sub,
          prompt: v.data.message,
          response: result.text,
          provider: config.provider,
          model: result.model,
        });
      }

      return c.json({
        message: result.text,
        provider: config.provider,
        model: result.model,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: cost,
        },
      });
    } catch (err) {
      await aiConfigRepo.recordUsage({
        configId: config.id,
        studentId,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        successful: false,
      });
      if (err instanceof AiError) {
        if (err.code === 'INVALID_KEY')
          return jsonError(c, 502, 'AI_INVALID_KEY', 'Chave do provider inválida.');
        if (err.code === 'RATE_LIMIT')
          return jsonError(c, 502, 'AI_RATE_LIMIT', 'Provider rejeitou por excesso de uso.');
        if (err.code === 'TIMEOUT') return jsonError(c, 504, 'AI_TIMEOUT', err.message);
      }
      return jsonError(c, 502, 'AI_UPSTREAM', 'Falha ao chamar provider IA.');
    }
  });

  // ---------- Support ----------

  // Ticket é conversa entre uma pessoa e o suporte: sem login não há de quem
  // mostrar. Antes, quem chegasse sem token recebia os tickets do aluno do seed.
  app.get('/support/tickets', requireAuth(), async (c) => {
    const u = c.get('user')!;
    return c.json(await supportRepo.listTicketsForStudent(u.sub));
  });
  app.post('/support/tickets', requireAuth(), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createSupportTicketSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const u = c.get('user')!;
    const id = u.sub;
    const ticket = await supportRepo.createTicket({
      studentId: id,
      subject: v.data.subject,
      category: v.data.category,
      message: v.data.message,
    });

    // Notifica admins/superadmin
    try {
      await notificationsRepo.broadcast({
        audience: 'admins',
        title: `Novo ticket: ${ticket.subject}`,
        body: `Categoria ${ticket.category}. De ${u?.email ?? 'aluno demo'}.`,
        category: 'info',
        link: '/admin/suporte',
        authorEmail: 'sistema',
      });
    } catch (err) {
      console.error('[notify admins on ticket]', err);
    }

    return c.json(ticket, 201);
  });

  // Admin: lista tickets, atualiza status, responde via notif
  app.get('/admin/support/tickets', requireAuth('admin', 'superadmin'), async (c) => {
    const all = await supportRepo.listAllTickets();
    return c.json(all);
  });

  app.put('/admin/support/tickets/:id/status', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const allowed = new Set(['open', 'in_progress', 'resolved']);
    const status = typeof body.status === 'string' ? body.status : '';
    if (!allowed.has(status)) {
      return jsonError(c, 400, 'INVALID_STATUS', 'Status inválido (open/in_progress/resolved)');
    }
    const updated = await supportRepo.updateTicketStatus(
      id,
      status as 'open' | 'in_progress' | 'resolved',
    );
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Ticket não encontrado');
    return c.json(updated);
  });

  app.post('/admin/support/tickets/:id/respond', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 2) return jsonError(c, 400, 'INVALID_INPUT', 'Mensagem requerida');
    const ticket = await supportRepo.findTicket(id);
    if (!ticket) return jsonError(c, 404, 'NOT_FOUND', 'Ticket não encontrado');
    const u = c.get('user')!;
    await notificationsRepo.createOne({
      userId: ticket.studentId,
      title: `Resposta ao ticket: ${ticket.subject}`,
      body: message,
      category: 'success',
      link: '/suporte',
      authorEmail: u.email,
    });
    await supportRepo.updateTicketStatus(id, 'in_progress');
    return c.json({ ok: true });
  });

  // ---------- Timeline do aluno (admin) ----------

  app.get('/admin/users/:id/timeline', requireAuth('admin', 'superadmin'), async (c) => {
    const userId = c.req.param('id') as string;
    const events: Array<{
      type: 'progress' | 'cert' | 'ticket' | 'tutor' | 'login';
      ts: string;
      title: string;
      body: string;
      meta?: Record<string, unknown>;
    }> = [];

    const progress = await progressRepo.listForUser(userId);
    for (const p of progress) {
      events.push({
        type: 'progress',
        ts: p.completedAt,
        title: 'Aula concluída',
        body: `lessonId ${p.lessonId} (curso ${p.courseId})`,
        meta: { lessonId: p.lessonId, courseId: p.courseId },
      });
    }

    const allCerts = await certsRepo.listAllCertificates();
    for (const cert of allCerts.filter((x) => x.studentId === userId)) {
      if (cert.issuedAt) {
        events.push({
          type: 'cert',
          ts: cert.issuedAt,
          title: 'Certificado emitido',
          body: `Curso ${cert.courseId} — código ${cert.validationCode}`,
          meta: { code: cert.validationCode },
        });
      }
    }

    const tickets = await supportRepo.listTicketsForStudent(userId);
    for (const t of tickets) {
      events.push({
        type: 'ticket',
        ts: t.createdAt,
        title: `Ticket aberto: ${t.subject}`,
        body: t.message.slice(0, 200),
        meta: { id: t.id, status: t.status, category: t.category },
      });
    }

    const tutorTurns = await tutorHistory.listForUser(userId, 1000);
    // Conta por dia (não polui timeline com cada pergunta)
    const tutorByDay = new Map<string, number>();
    for (const t of tutorTurns) {
      const day = t.ts.slice(0, 10);
      tutorByDay.set(day, (tutorByDay.get(day) ?? 0) + 1);
    }
    for (const [day, count] of tutorByDay) {
      events.push({
        type: 'tutor',
        ts: `${day}T23:59:59.000Z`,
        title: `Tutor Virtual: ${count} pergunta${count === 1 ? '' : 's'}`,
        body: `Interações com Tutor neste dia.`,
        meta: { count },
      });
    }

    const u = await usersStore.findUserById(userId);
    if (u?.lastLoginAt) {
      events.push({
        type: 'login',
        ts: u.lastLoginAt,
        title: 'Último login',
        body: u.email,
      });
    }

    events.sort((a, b) => (b.ts > a.ts ? 1 : -1));
    return c.json(events.slice(0, 200));
  });

  // ---------- Admin students ----------

  app.get('/admin/students', async (c) => {
    const filtersResult = studentsFilterSchema.safeParse({
      search: c.req.query('search'),
      status: c.req.query('status'),
      courseId: c.req.query('courseId'),
      sortBy: c.req.query('sortBy'),
    });
    const filters = filtersResult.success ? filtersResult.data : {};
    return c.json(await studentsRepo.listAdminStudents(filters));
  });

  /** Export CSV de alunos respeitando os mesmos filtros. */
  app.get('/admin/students/export.csv', requireAuth('admin', 'superadmin'), async (c) => {
    const filtersResult = studentsFilterSchema.safeParse({
      search: c.req.query('search'),
      status: c.req.query('status'),
      courseId: c.req.query('courseId'),
      sortBy: c.req.query('sortBy'),
    });
    const filters = filtersResult.success ? filtersResult.data : {};
    const list = await studentsRepo.listAdminStudents(filters);
    const rows: string[] = [];
    rows.push('id,name,email,status,risk_score,enrolled_courses,last_access_at,created_at');
    for (const s of list) {
      const cells = [
        s.id,
        (s.name ?? '').replace(/[",\n]/g, ' '),
        s.email,
        s.status,
        String(s.riskScore ?? 0),
        String((s.enrolledCourseIds ?? []).length),
        s.lastAccessAt ?? '',
        s.createdAt,
      ];
      rows.push(cells.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
    }
    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="alunos-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });

  app.get('/admin/students/:id', async (c) => {
    const s = await studentsRepo.findAdminStudent(c.req.param('id'));
    if (!s) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(s);
  });

  /**
   * Stats agregadas de uso de recursos por aluno: Tutor IA, Podcast e
   * Biblioteca. Para a aba Recursos do AdminUserDetail. Dados reais
   * baseados nos stores existentes; library ainda sem tracking real.
   */
  app.get('/admin/students/:id/stats', async (c) => {
    const id = c.req.param('id') as string;
    const s = await studentsRepo.findAdminStudent(id);
    if (!s) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');

    const tutor = await import('./repositories/tutor-history');
    const tutorTurns = (await tutor.listAll()).filter((t) => t.userId === id);
    const lastTutorAt =
      tutorTurns.length > 0
        ? tutorTurns.reduce((acc, t) => (t.ts > acc ? t.ts : acc), tutorTurns[0]!.ts)
        : null;

    const pe = await import('./repositories/podcast-engagement');
    const podEngagement = await pe.listForUser(id);
    const podPlays = podEngagement.filter((e) => e.listened).length;
    const podFavorites = podEngagement.filter((e) => e.favorite).length;

    return c.json({
      studentId: id,
      tutor: {
        questionCount: tutorTurns.length,
        lastAt: lastTutorAt,
      },
      podcast: {
        plays: podPlays,
        favorites: podFavorites,
      },
      library: {
        // Library ainda sem tracking de download por usuário; placeholder honesto.
        downloads: null,
        favorites: null,
      },
    });
  });

  // ---------- Recovery plan ----------

  app.post(
    '/admin/recovery-plan',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const v = validate(recoveryPlanSchema, body);
      if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());

      const student = await studentsRepo.findAdminStudent(v.data.studentId);
      const risks = await retentionRepo.listRetentionRisks();
      const risk = risks.find((r) => r.studentId === v.data.studentId);

      const plan = await recoveryPlans.generateWithAi({
        studentId: v.data.studentId,
        studentName: student?.name ?? risk?.studentName ?? 'Aluno',
        riskScore: risk?.score ?? 50,
        riskReasons: risk?.reasons ?? [],
        realProgress: risk?.realProgress ?? 0,
        expectedProgress: risk?.expectedProgress ?? 0,
        tone: v.data.tone,
        channel: v.data.channel,
        intensity: v.data.intensity,
        goal: v.data.goal,
      });

      await recordAudit(c, {
        action: 'recovery_plan.generate',
        targetType: 'recovery_plan',
        targetId: plan.id,
        meta: { studentId: v.data.studentId },
      });

      return c.json({ plan });
    },
  );

  app.get('/admin/recovery-plans/:studentId', requireAuth('admin', 'superadmin'), async (c) => {
    const studentId = c.req.param('studentId') as string;
    const plans = await recoveryPlans.listForStudent(studentId);
    return c.json({ plans });
  });

  app.put('/admin/recovery-plans/:id/status', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = body.status as string;
    if (!['draft', 'sent', 'in_followup', 'completed'].includes(status)) {
      return jsonError(c, 400, 'INVALID_STATUS', 'Status inválido.');
    }
    const plan = await recoveryPlans.findById(id);
    if (!plan) return jsonError(c, 404, 'NOT_FOUND', 'Plano não encontrado.');

    const updated = await recoveryPlans.updateStatus(
      id,
      status as 'draft' | 'sent' | 'in_followup' | 'completed',
    );

    if (status === 'sent' && plan.status !== 'sent') {
      const student = await studentsRepo.findAdminStudent(plan.studentId);

      if (plan.channel === 'in_app' || plan.channel === 'email') {
        void notificationsRepo.createOne({
          userId: plan.studentId,
          title: 'Plano de retomada',
          body: plan.message.slice(0, 300),
          category: 'info',
          link: '/dashboard',
        });
      }

      if (student?.email && (plan.channel === 'email' || plan.channel === 'in_app')) {
        void sendSafe({
          to: { email: student.email, name: student.name },
          subject: 'Plano de retomada — AVA PCO',
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#0097B2;margin:0 0 16px">Plano de Retomada</h2>
              <div style="white-space:pre-line;color:#0f172a;font-size:14px;line-height:1.6">${plan.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              ${
                plan.suggestedTutorPrompt
                  ? `<div style="margin-top:16px;padding:12px;background:#f0f9ff;border-left:3px solid #0097B2;border-radius:4px">
                <strong style="color:#0097B2;font-size:12px">Pergunta sugerida ao Tutor:</strong>
                <p style="margin:4px 0 0;font-size:13px;color:#334155">${plan.suggestedTutorPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              </div>`
                  : ''
              }
              <p style="margin-top:24px;font-size:12px;color:#64748b">Equipe pedagógica — PCO</p>
            </div>`,
          text: plan.message,
          tag: 'recovery-plan',
        });
      }
      await recordAudit(c, {
        action: 'recovery_plan.send',
        targetType: 'recovery_plan',
        targetId: id,
        meta: { studentId: plan.studentId, channel: plan.channel },
      });
    }

    return c.json(updated);
  });

  // ---------- Admin: Course writes ----------

  /** Emite certificados em massa para alunos que concluíram um curso. */
  app.post(
    '/admin/courses/:id/issue-certs-bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const courseId = c.req.param('id') as string;
      const course = await coursesRepo.findCourse(courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');
      const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
      if (totalLessons === 0) {
        return jsonError(c, 400, 'NO_LESSONS', 'Curso sem aulas.');
      }
      const allStudents = await studentsRepo.listAdminStudents({
        limit: 5000,
      } as never);
      const enrolled = allStudents.filter((s) => (s.enrolledCourseIds ?? []).includes(courseId));
      const allProgress = await progressRepo.listAll();
      const progressByUser = new Map<string, number>();
      for (const p of allProgress) {
        if (p.courseId !== courseId) continue;
        progressByUser.set(p.userId, (progressByUser.get(p.userId) ?? 0) + 1);
      }
      const allCerts = await certsRepo.listAllCertificates();
      const issuedSet = new Set(
        allCerts
          .filter((cert) => cert.courseId === courseId && cert.status === 'issued')
          .map((cert) => cert.studentId),
      );
      let issued = 0;
      let alreadyIssued = 0;
      let notCompleted = 0;
      for (const s of enrolled) {
        const done = progressByUser.get(s.id) ?? 0;
        if (done < totalLessons) {
          notCompleted++;
          continue;
        }
        if (issuedSet.has(s.id)) {
          alreadyIssued++;
          continue;
        }
        try {
          const cert = await certsRepo.issueCertificate({ studentId: s.id, courseId });
          issued++;
          void webhooksDispatcher.emit('certificate.issued', {
            certificateId: cert.id,
            studentId: s.id,
            courseId,
            courseTitle: course.title,
            validationCode: cert.validationCode,
            issuedAt: cert.issuedAt,
            bulk: true,
          });
        } catch (err) {
          console.error('[bulk issue cert]', err);
        }
      }
      return c.json({
        courseTitle: course.title,
        enrolled: enrolled.length,
        issued,
        alreadyIssued,
        notCompleted,
      });
    },
  );

  /** Resumo agregado por curso pra tabela admin: enrolledCount + avgPct. */
  app.get('/admin/courses-summary', requireAuth('admin', 'superadmin'), async (c) => {
    const courses = await coursesRepo.listCourses();
    const allStudents = await studentsRepo.listAdminStudents({
      limit: 5000,
    } as never);
    const allProgress = await progressRepo.listAll();
    const out = courses.map((course) => {
      const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);
      const enrolled = allStudents.filter((s) => (s.enrolledCourseIds ?? []).includes(course.id));
      const progressByUser = new Map<string, number>();
      for (const p of allProgress) {
        if (p.courseId !== course.id) continue;
        progressByUser.set(p.userId, (progressByUser.get(p.userId) ?? 0) + 1);
      }
      const rates = enrolled.map((s) => {
        const done = progressByUser.get(s.id) ?? 0;
        return totalLessons > 0 ? done / totalLessons : 0;
      });
      const avgPct =
        rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0;
      const completed = rates.filter((r) => r >= 1).length;
      return {
        courseId: course.id,
        enrolledCount: enrolled.length,
        completedCount: completed,
        avgProgressPct: avgPct,
      };
    });
    return c.json(out);
  });

  /** Bulk enroll de alunos existentes num curso. body: { studentIds: string[] } */
  app.post(
    '/admin/courses/:id/enroll-bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const courseId = c.req.param('id') as string;
      const course = await coursesRepo.findCourse(courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const ids = Array.isArray(body.studentIds)
        ? (body.studentIds as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      if (ids.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'studentIds vazio.');
      }
      if (ids.length > 500) {
        return jsonError(c, 400, 'TOO_MANY', 'Máximo 500 por chamada.');
      }
      const force = c.req.query('force') === 'true' || body.force === true;
      const required = course.prerequisiteCourseIds ?? [];
      const allCourses = required.length > 0 ? await coursesRepo.listCourses() : [];

      let enrolled = 0;
      let already = 0;
      const errors: Array<{ studentId: string; message: string }> = [];
      const ineligible: Array<{ studentId: string; missing: string[] }> = [];

      for (const studentId of ids) {
        try {
          const s = await studentsRepo.findAdminStudent(studentId);
          if (!s) {
            errors.push({ studentId, message: 'aluno não encontrado' });
            continue;
          }
          if ((s.enrolledCourseIds ?? []).includes(courseId)) {
            already++;
            continue;
          }
          // Verifica prereqs (a menos que force=true)
          if (required.length > 0 && !force) {
            const myProgress = await progressRepo.listForUser(studentId);
            const completedLessonIds = myProgress.map((p) => p.lessonId);
            const completedCourseIds = computeCompletedCourseIds(allCourses, completedLessonIds);
            const check = checkPrerequisites(required, completedCourseIds);
            if (!check.ok) {
              ineligible.push({ studentId, missing: check.missing });
              continue;
            }
          }
          await studentsRepo.enrollInCourse(studentId, courseId);
          enrolled++;
          // Notifica o aluno da nova matrícula (best-effort)
          try {
            await notificationsRepo.createOne({
              userId: studentId,
              title: `🎓 Você foi matriculado em ${course.title}`,
              body: `Acesse o curso e comece a estudar.${
                required.length > 0 && force ? ' (Matrícula manual concedida pelo admin.)' : ''
              }`,
              category: 'announcement',
              link: `/curso/${course.id}`,
              authorEmail: 'sistema',
            });
          } catch {
            // ignora — notificação é best-effort
          }
        } catch (err) {
          errors.push({
            studentId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return c.json({
        enrolled,
        alreadyEnrolled: already,
        errors,
        ineligible,
        forced: force,
      });
    },
  );

  /** Lista alunos matriculados num curso com progresso individual. */
  /**
   * Quantas pessoas este prazo tranca, se eu salvar?
   *
   * Declarar meses de acesso não age só daqui para frente: matrícula sem prazo
   * gravado passa a valer `enrolledAt + meses`, e as datas reais começam em
   * 2021. Sem esta conta, salvar o campo é uma ação de efeito silencioso e
   * amplo. Só lê.
   */
  app.get('/admin/courses/:id/impacto-acesso', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

    const bruto = c.req.query('meses');
    const meses = bruto === undefined || bruto === '' ? null : Number(bruto);
    if (meses !== null && (!Number.isFinite(meses) || meses < 0 || meses > 600)) {
      return jsonError(c, 400, 'VALIDATION', 'Meses precisa ser um número entre 0 e 600.');
    }

    return c.json(await simularPrazoDoCurso(courseId, meses));
  });

  /**
   * Dá um prazo comum a quem a política do curso deixaria vencido.
   *
   * O contrapeso da rota acima: se a simulação diz "471 pessoas perdem acesso
   * hoje", esta é a forma de transformar o muro em rampa sem renovar 471 vezes
   * à mão. Escreve `expiresAt` na matrícula, que tem precedência sobre a
   * política do curso — a carência sobrevive a mudanças posteriores.
   */
  app.post('/admin/courses/:id/carencia', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

    const body = (await c.req.json().catch(() => ({}))) as { meses?: number; ate?: string };
    const meses = Number(body.meses);
    if (!Number.isFinite(meses) || meses <= 0 || meses > 600) {
      return jsonError(c, 400, 'VALIDATION', 'Informe a política em meses (1 a 600).');
    }
    const ate = typeof body.ate === 'string' ? body.ate : '';
    const alvo = new Date(ate);
    if (!ate || Number.isNaN(alvo.getTime())) {
      return jsonError(c, 400, 'VALIDATION', 'Informe até quando vale a carência.');
    }
    if (alvo.getTime() <= Date.now()) {
      // Carência para o passado não é carência: seria um jeito silencioso de
      // trancar todo mundo de uma vez, com cara de gentileza.
      return jsonError(c, 400, 'VALIDATION', 'A carência precisa terminar no futuro.');
    }

    const r = await darCarencia(courseId, meses, alvo.toISOString());
    return c.json({ ok: true, ...r, ate: alvo.toISOString() });
  });

  app.get('/admin/courses/:id/students', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

    const allLessons = course.modules.flatMap((m) => m.lessons);
    const totalLessons = allLessons.length;

    const allStudents = await studentsRepo.listAdminStudents({
      limit: 5000,
    } as never);
    const enrolled = allStudents.filter((s) => (s.enrolledCourseIds ?? []).includes(courseId));

    const allProgress = await progressRepo.listAll();
    const progressByUser = new Map<string, { done: number; lastCompletedAt: string | null }>();
    for (const p of allProgress) {
      if (p.courseId !== courseId) continue;
      const cur = progressByUser.get(p.userId) ?? {
        done: 0,
        lastCompletedAt: null as string | null,
      };
      cur.done++;
      if (!cur.lastCompletedAt || (p.completedAt && p.completedAt > cur.lastCompletedAt)) {
        cur.lastCompletedAt = p.completedAt ?? null;
      }
      progressByUser.set(p.userId, cur);
    }

    const result = enrolled.map((s) => {
      const prog = progressByUser.get(s.id) ?? { done: 0, lastCompletedAt: null };
      const pct = totalLessons > 0 ? Math.round((prog.done / totalLessons) * 100) : 0;
      return {
        studentId: s.id,
        name: s.name,
        email: s.email,
        status: s.status,
        lessonsCompleted: prog.done,
        totalLessons,
        progressPct: pct,
        lastCompletedAt: prog.lastCompletedAt,
        lastAccessAt: s.lastAccessAt,
        riskScore: s.riskScore,
      };
    });

    result.sort((a, b) => b.progressPct - a.progressPct);
    return c.json({
      courseId,
      courseTitle: course.title,
      totalLessons,
      enrolledCount: result.length,
      students: result,
    });
  });

  app.post('/admin/courses', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createCourseSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const result = await coursesRepo.createCourse(v.data);
    if ('error' in result) {
      return jsonError(c, 409, 'DUPLICATE_SLUG', 'Já existe um curso com esse slug.');
    }
    return c.json(result, 201);
  });

  app.put('/admin/courses/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateCourseSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateCourse(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(updated);
  });

  app.delete(
    '/admin/courses/:id',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 100 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const result = await coursesRepo.deleteCourse(id);
      if (!result) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
      return c.json({ ok: true });
    },
  );

  /**
   * Reordenação em massa de módulos + aulas de um curso. Aceita também
   * mover aulas entre módulos. Usado pelo drag-and-drop do editor.
   */
  app.post(
    '/admin/courses/:id/reorder',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 60 }),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const v = validate(reorderCourseSchema, body);
      if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
      const courseId = c.req.param('id') as string;
      const updated = await coursesRepo.reorderCourseContent(courseId, v.data.modules);
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
      return c.json(updated);
    },
  );

  /**
   * Emite explicitamente course.published quando admin clica em "publicar"
   * o curso no editor. Hoje a publicacao eh implicita (curso aparece no
   * catalog se nao tem releaseAt no futuro), mas este endpoint permite
   * acionar webhooks manualmente para integradores que precisam saber.
   */
  app.post('/admin/courses/:id/publish', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso nao encontrado');
    void webhooksDispatcher.emit('course.published', {
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      shortTitle: course.shortTitle,
      publishedAt: new Date().toISOString(),
    });
    return c.json({ ok: true, courseId });
  });

  // ---------- Admin: News writes ----------

  app.post('/admin/news', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createNewsSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await newsRepo.createNews(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/news/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateNewsSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await newsRepo.updateNews(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Artigo não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/news/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await newsRepo.deleteNews(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Artigo não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Library writes ----------

  app.post('/admin/library', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createLibrarySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await libraryRepo.createLibrary(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/library/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateLibrarySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await libraryRepo.updateLibrary(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Material não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/library/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await libraryRepo.deleteLibrary(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Material não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Podcasts writes ----------

  app.post('/admin/podcasts', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createPodcastSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await podcastsRepo.createPodcast(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/podcasts/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updatePodcastSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await podcastsRepo.updatePodcast(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Episódio não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/podcasts/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await podcastsRepo.deletePodcast(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Episódio não encontrado');
    return c.json({ ok: true });
  });

  // Admin: Duplicar curso (clone completo com novos IDs)
  app.post(
    '/admin/courses/:id/duplicate',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      try {
        const cloned = await coursesRepo.duplicateCourse(c.req.param('id') as string);
        if (!cloned) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
        return c.json(cloned, 201);
      } catch (err) {
        return jsonError(c, 501, 'NOT_SUPPORTED', err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ---------- Admin: Modules ----------

  app.post('/admin/courses/:courseId/modules', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createModuleSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await coursesRepo.createModule(c.req.param('courseId') as string, v.data);
    if (!created) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(created, 201);
  });

  app.put('/admin/modules/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateModuleSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateModule(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/modules/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await coursesRepo.deleteModule(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Lessons ----------

  app.post('/admin/modules/:moduleId/lessons', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createLessonSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await coursesRepo.createLesson(c.req.param('moduleId') as string, v.data);
    if (!created) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(created, 201);
  });

  app.put('/admin/lessons/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateLessonSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateLesson(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada');
    return c.json(updated);
  });

  app.delete('/admin/lessons/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await coursesRepo.deleteLesson(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada');
    return c.json({ ok: true });
  });

  // ---------- Admin: Student writes ----------

  app.post('/admin/students', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createStudentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await studentsRepo.createAdminStudent(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/students/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateStudentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await studentsRepo.updateAdminStudent(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.post('/admin/students/:id/block', requireAuth('admin', 'superadmin'), async (c) => {
    const updated = await studentsRepo.setStudentStatus(c.req.param('id') as string, 'bloqueado');
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.post('/admin/students/:id/unblock', requireAuth('admin', 'superadmin'), async (c) => {
    const updated = await studentsRepo.setStudentStatus(c.req.param('id') as string, 'ativo');
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.put('/admin/students/:id/status', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = studentStatusEnum.safeParse(body?.status);
    if (!parsed.success)
      return jsonError(c, 400, 'INVALID_INPUT', 'Status inválido', parsed.error.flatten());
    const updated = await studentsRepo.setStudentStatus(c.req.param('id') as string, parsed.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/students/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await studentsRepo.deleteAdminStudent(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Assessments ----------

  app.post('/admin/modules/:moduleId/assessment', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createAssessmentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const result = await coursesRepo.upsertAssessment(c.req.param('moduleId') as string, v.data);
    if (!result) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(result);
  });

  app.put('/admin/assessments/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateAssessmentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateAssessment(c.req.param('id') as string, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Avaliação não encontrada');
    return c.json(updated);
  });

  app.delete('/admin/assessments/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await coursesRepo.deleteAssessment(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Avaliação não encontrada');
    return c.json({ ok: true });
  });

  // ---------- Admin: System Users (login + RBAC) ----------
  // Apenas admin/superadmin. Mudança de role exige superadmin.

  app.get('/admin/users', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json(await usersStore.listUsers());
  });

  app.get('/admin/users/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const u = await usersStore.findUserById(id);
    if (!u) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
    return c.json(u);
  });

  app.post('/admin/users', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const v = validate(createSystemUserSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const acting = c.get('user');
    if (v.data.role === 'superadmin' && acting?.role !== 'superadmin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas superadmin pode criar superadmin.');
    }
    const sendWelcome = body.sendWelcomeEmail === true;
    try {
      const created = await usersStore.createUser(v.data);
      // Notificação de boas-vindas (in-app)
      await notificationsRepo.createOne({
        userId: created.id,
        title: `Bem-vindo(a) ao AVA PCO, ${created.name}!`,
        body: 'Sua conta foi criada. Acesse seu perfil para confirmar dados e, se receber uma senha temporária, troque-a no primeiro acesso.',
        category: 'announcement',
        link: '/perfil',
        authorEmail: acting?.email ?? null,
      });
      // Email de boas-vindas (opcional)
      if (sendWelcome) {
        void welcome
          .sendWelcomeEmail({
            email: created.email,
            name: created.name,
            tempPassword: v.data.password,
          })
          .catch((err) =>
            console.error('[welcome email]', err instanceof Error ? err.message : err),
          );
      }
      return c.json(created, 201);
    } catch (err) {
      return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
    }
  });

  app.put('/admin/users/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateSystemUserSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const acting = c.get('user');
    if (v.data.role && acting?.role !== 'superadmin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas superadmin pode alterar role.');
    }
    // Bloqueia mudanças sensíveis (role/email) durante impersonation
    if (acting?.act) {
      if (v.data.role) {
        return jsonError(
          c,
          403,
          'IMPERSONATION_BLOCKED',
          'Não é possível alterar role enquanto visualiza como outro usuário.',
          { action: 'user.role.change' },
        );
      }
      if (v.data.email) {
        return jsonError(
          c,
          403,
          'IMPERSONATION_BLOCKED',
          'Não é possível alterar e-mail enquanto visualiza como outro usuário.',
          { action: 'user.email.change' },
        );
      }
    }
    try {
      const id = c.req.param('id') as string;
      const updated = await usersStore.updateUser(id, v.data);
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
      return c.json(updated);
    } catch (err) {
      return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
    }
  });

  app.put(
    '/admin/users/:id/password',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('user.password.change'),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const v = validate(changePasswordSchema, body);
      if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
      const id = c.req.param('id') as string;
      const ok = await usersStore.changePassword(id, v.data.password);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
      return c.json({ ok: true });
    },
  );

  /**
   * Inspector de sessões — retorna user list com hint de "está com sessão viva?"
   * Considera "ativo" qualquer user com lastLoginAt nos últimos 30 dias e active=true.
   */
  app.get('/admin/sessions', requireAuth('admin', 'superadmin'), async (c) => {
    const all = await usersStore.listUsers();
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    const result = all.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt ?? null,
      tokenVersion: u.tokenVersion,
      totpEnabled: u.totpEnabled === true,
      hasLikelyActiveSession:
        u.active && !!u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= cutoff,
    }));
    return c.json(result);
  });

  app.post('/admin/users/:id/force-logout', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const tv = await usersStore.bumpTokenVersion(id);
    if (tv === null) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
    return c.json({ ok: true, tokenVersion: tv });
  });

  app.delete(
    '/admin/users/:id',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('user.delete'),
    async (c) => {
      try {
        const id = c.req.param('id') as string;
        const target = await usersStore.findUserById(id);
        if (!target) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
        const provided = readConfirmHeader(c);
        if (!confirmMatches(provided, target.email)) {
          return jsonError(
            c,
            428,
            'CONFIRM_REQUIRED',
            `Confirme digitando o e-mail "${target.email}" no header X-Confirm-Name.`,
          );
        }
        const ok = await usersStore.deleteUser(id);
        if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
        return c.json({ ok: true });
      } catch (err) {
        return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ---------- Impersonation ----------
  // Admin/superadmin "entra" como aluno (suporte). Token tem TTL curto (30 min)
  // e claim `act` com o admin original. Tudo rastreado em audit log.

  app.post(
    '/admin/impersonate/:id',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const me = c.get('user')!;
      const targetId = c.req.param('id') as string;
      const target = await usersStore.findUserById(targetId);
      if (!target) return jsonError(c, 404, 'NOT_FOUND', 'Usuário alvo não encontrado.');
      if (!target.active)
        return jsonError(c, 409, 'INACTIVE_TARGET', 'Usuário alvo está desativado.');

      const check = canImpersonate({ role: me.role }, { role: target.role }, Boolean(me.act));
      if (!check.ok) return jsonError(c, 403, 'IMPERSONATION_DENIED', check.reason);

      const actor = await usersStore.findUserById(me.sub);
      if (!actor) return jsonError(c, 401, 'UNAUTHORIZED', 'Sessão inválida.');

      const result = await startImpersonation(actor, targetId);
      if (!result) return jsonError(c, 500, 'IMPERSONATION_FAILED', 'Falha ao gerar token.');

      await recordAudit(c, {
        action: 'impersonation.start',
        targetType: 'user',
        targetId: target.id,
        meta: { targetEmail: target.email, targetName: target.name },
      });

      return c.json({
        ok: true,
        token: result.token,
        target: result.target,
        actor: result.actor,
        expiresInSeconds: result.expiresInSeconds,
      });
    },
  );

  app.post('/admin/impersonate/exit', async (c) => {
    const me = c.get('user');
    if (!me) return jsonError(c, 401, 'UNAUTHORIZED', 'Token ausente ou inválido.');
    if (!me.act)
      return jsonError(c, 409, 'NOT_IMPERSONATING', 'Você não está em sessão de impersonation.');
    const newToken = await exitImpersonation(me);
    if (!newToken) return jsonError(c, 500, 'EXIT_FAILED', 'Falha ao restaurar sessão original.');

    await recordAudit(c, {
      action: 'impersonation.exit',
      targetType: 'user',
      targetId: me.sub,
      meta: { impersonatedEmail: me.email, restoredActorEmail: me.act.email },
    });

    return c.json({ ok: true, token: newToken });
  });

  /**
   * Endpoint pra UI saber se sessão atual é impersonation. Front-end usa pra
   * exibir banner permanente "Você está visualizando como X".
   */
  app.get('/me/impersonation', async (c) => {
    const me = c.get('user');
    if (!me) return jsonError(c, 401, 'UNAUTHORIZED', 'Token ausente.');
    if (!me.act) return c.json({ impersonating: false });
    return c.json({
      impersonating: true,
      actor: me.act,
      target: { id: me.sub, email: me.email, role: me.role },
    });
  });

  /**
   * Bulk actions em alunos/users.
   * body: { ids: string[], action: 'activate'|'deactivate'|'delete'|'unenroll'|'sendEmail'|'forceLogout',
   *         courseId?: string,  // para unenroll
   *         subject?: string, html?: string, text?: string  // para sendEmail
   *       }
   */
  app.post(
    '/admin/users/bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        ids?: unknown;
        action?: string;
        courseId?: string;
        subject?: string;
        html?: string;
        text?: string;
      };
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((x): x is string => typeof x === 'string')
        : [];
      if (ids.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'ids vazio');
      }
      if (ids.length > 1000) {
        return jsonError(c, 400, 'TOO_MANY', 'máximo 1000 ids por chamada');
      }
      const action = body.action ?? '';
      let success = 0;
      let failed = 0;
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of ids) {
        try {
          if (action === 'activate') {
            await usersStore.updateUser(id, { active: true });
          } else if (action === 'deactivate') {
            await usersStore.updateUser(id, { active: false });
          } else if (action === 'delete') {
            const ok = await usersStore.deleteUser(id);
            if (!ok) throw new Error('not found');
          } else if (action === 'unenroll') {
            if (!body.courseId) throw new Error('courseId obrigatório');
            await studentsRepo.unenrollFromCourse(id, body.courseId);
          } else if (action === 'forceLogout') {
            await usersStore.bumpTokenVersion(id);
          } else if (action === 'sendEmail') {
            if (!body.subject || !body.html) {
              throw new Error('subject e html obrigatórios');
            }
            const u = await usersStore.findUserById(id);
            if (!u || !u.active) throw new Error('user inativo');
            const r = await sendSafe({
              to: { email: u.email, name: u.name },
              subject: body.subject,
              html: body.html,
              text: body.text,
              tag: 'bulk_admin',
            });
            if (!r.ok) throw new Error(r.error ?? 'sender error');
          } else {
            throw new Error(`action desconhecida: ${action}`);
          }
          success++;
        } catch (err) {
          failed++;
          errors.push({
            id,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return c.json({ total: ids.length, success, failed, errors: errors.slice(0, 50) });
    },
  );

  /**
   * Import inline de alunos. Body: { rows: [{ email, name, courseIds?: string[] }] }.
   * Para cada row:
   *   - se email já existe: enrollInCourse (se courseIds), nunca sobrescreve dados
   *   - senão: cria user com password aleatório + enroll
   * Retorna {created, enrolled, skipped, errors}.
   */
  app.post(
    '/admin/users/import',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        rows?: Array<{ email?: string; name?: string; courseIds?: string[] }>;
        sendWelcomeEmail?: boolean;
      };
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const sendWelcome = body.sendWelcomeEmail === true;
      if (rows.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'rows vazio.');
      }
      if (rows.length > 1000) {
        return jsonError(c, 400, 'TOO_MANY', 'máximo 1000 linhas por chamada.');
      }
      let created = 0;
      let enrolled = 0;
      let skipped = 0;
      const errors: Array<{ row: number; email?: string; message: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const email = (row.email ?? '').trim().toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          skipped++;
          errors.push({ row: i + 1, email, message: 'email inválido' });
          continue;
        }
        const courseIds = Array.isArray(row.courseIds) ? row.courseIds : [];
        try {
          let userId: string;
          let userJustCreated = false;
          let plainPassword: string | undefined;
          let userName = '';
          const existing = await usersStore.findUserByEmail(email);
          if (existing) {
            userId = existing.id;
            userName = existing.name;
          } else {
            plainPassword = `pco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
            userName = row.name?.trim() || email;
            const newUser = await usersStore.createUser({
              email,
              name: userName,
              role: 'student',
              password: plainPassword,
              active: true,
            });
            userId = newUser.id;
            created++;
            userJustCreated = true;
          }
          for (const courseId of courseIds) {
            await studentsRepo.enrollInCourse(userId, courseId);
            enrolled++;
          }
          if (userJustCreated && sendWelcome && plainPassword) {
            const courseTitles: string[] = [];
            for (const cid of courseIds) {
              const course = await coursesRepo.findCourse(cid);
              if (course) courseTitles.push(course.title);
            }
            void welcome
              .sendWelcomeEmail({
                email,
                name: userName,
                tempPassword: plainPassword,
                enrolledCourseTitles: courseTitles,
              })
              .catch((err) =>
                console.error('[welcome email bulk]', err instanceof Error ? err.message : err),
              );
          }
        } catch (err) {
          errors.push({
            row: i + 1,
            email,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return c.json({
        total: rows.length,
        created,
        enrolled,
        skipped,
        errors: errors.slice(0, 100),
      });
    },
  );

  // ---------- Student search (logged) ----------

  app.get('/search', requireAuth(), async (c) => {
    const q = c.req.query('q') ?? '';
    if (q.trim().length < 2) return c.json([]);
    const limit = Number(c.req.query('limit') ?? '30');
    const hits = await studentSearch(q, Number.isFinite(limit) ? limit : 30);
    return c.json(hits);
  });

  // ---------- Admin search ----------

  app.get('/admin/search', requireAuth('admin', 'superadmin'), async (c) => {
    const q = c.req.query('q') ?? '';
    if (q.trim().length < 2) return c.json([]);
    const limit = Number(c.req.query('limit') ?? '30');
    const hits = await adminSearch(q, Number.isFinite(limit) ? limit : 30);
    return c.json(hits);
  });

  // ---------- Client error reporting (público, rate-limited) ----------

  app.post('/client-errors', rateLimit({ windowMs: 60_000, max: 30 }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message : '';
    if (!message || message.length > 1000) {
      return jsonError(c, 400, 'INVALID_INPUT', 'Mensagem ausente ou muito longa.');
    }
    await recordClientError(c, {
      message,
      stack: typeof body.stack === 'string' ? body.stack : null,
      path: typeof body.path === 'string' ? body.path : null,
      userAgent: typeof body.userAgent === 'string' ? body.userAgent : null,
    });
    return c.json({ ok: true });
  });

  // ---------- Backup sob demanda (admin) ----------

  app.post('/admin/backups/run', requireAuth('admin', 'superadmin'), async (c) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { execFile } = await import('node:child_process');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      const backupsDir = path.join(dataDir, 'backups');
      await fs.mkdir(backupsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const filename = `manual-${ts}.tar.gz`;
      const filepath = path.join(backupsDir, filename);

      // Lista arquivos JSON em data/ (não recursivo, evita backups/)
      const entries = await fs.readdir(dataDir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => e.name);
      if (files.length === 0) {
        return jsonError(c, 404, 'NO_DATA', 'Sem arquivos JSON para backup.');
      }

      await new Promise<void>((resolve, reject) => {
        execFile('tar', ['-czf', filepath, '-C', dataDir, ...files], { timeout: 30_000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const st = await fs.stat(filepath);
      return c.json(
        { ok: true, name: filename, sizeBytes: st.size, mtime: st.mtime.toISOString() },
        201,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(c, 500, 'BACKUP_FAILED', `Backup falhou: ${msg}`);
    }
  });

  // ---------- Backups (admin) ----------

  app.get('/admin/backups', requireAuth('admin', 'superadmin'), async (c) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      const backupsDir = path.join(dataDir, 'backups');
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(backupsDir, { withFileTypes: true });
      } catch {
        return c.json([]);
      }
      const out = await Promise.all(
        entries
          .filter((e) => e.isFile() && e.name.endsWith('.tar.gz'))
          .map(async (e) => {
            const st = await fs.stat(path.join(backupsDir, e.name));
            return {
              name: e.name,
              sizeBytes: st.size,
              mtime: st.mtime.toISOString(),
            };
          }),
      );
      out.sort((a, b) => (b.mtime > a.mtime ? 1 : -1));
      return c.json(out);
    } catch (err) {
      return jsonError(c, 500, 'INTERNAL', err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/admin/backups/:name/download', requireAuth('admin', 'superadmin'), async (c) => {
    const name = c.req.param('name') as string;
    if (!/^[a-zA-Z0-9_.-]+\.tar\.gz$/.test(name)) {
      return jsonError(c, 400, 'INVALID_NAME', 'Nome inválido.');
    }
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
    const filepath = path.join(dataDir, 'backups', name);
    try {
      const buf = await fs.readFile(filepath);
      // Hono supports body as Uint8Array
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Content-Length': String(buf.length),
        },
      });
    } catch {
      return jsonError(c, 404, 'NOT_FOUND', 'Backup não encontrado.');
    }
  });

  app.delete('/admin/backups/:name', requireAuth('admin', 'superadmin'), async (c) => {
    const name = c.req.param('name') as string;
    if (!/^[a-zA-Z0-9_.-]+\.tar\.gz$/.test(name)) {
      return jsonError(c, 400, 'INVALID_NAME', 'Nome inválido.');
    }
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      const filepath = path.join(dataDir, 'backups', name);
      await fs.unlink(filepath);
      return c.json({ ok: true });
    } catch (err) {
      return jsonError(c, 404, 'NOT_FOUND', 'Backup não encontrado.');
    }
  });

  // ---------- Error log ----------

  app.get('/admin/errors', requireAuth('admin', 'superadmin'), async (c) => {
    const q = c.req.query();
    const limit = q.limit ? Number(q.limit) : undefined;
    const entries = await listErrors({
      since: q.since,
      limit: typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined,
    });
    return c.json(entries);
  });

  // ---------- Payment gateways (admin) ----------

  app.get('/admin/payments/providers', requireAuth('admin', 'superadmin'), (c) =>
    c.json(ALL_PROVIDERS),
  );

  app.get('/admin/payments/gateways', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await gatewaysRepo.listAll()),
  );

  app.post('/admin/payments/gateways', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createPaymentGatewaySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await gatewaysRepo.createGateway(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/payments/gateways/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updatePaymentGatewaySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await gatewaysRepo.updateGateway(id, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Gateway não encontrado');
    return c.json(updated);
  });

  app.delete(
    '/admin/payments/gateways/:id',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('gateway.delete'),
    async (c) => {
      const id = c.req.param('id') as string;
      const ok = await gatewaysRepo.deleteGateway(id);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Gateway não encontrado');
      return c.json({ ok: true });
    },
  );

  // ---------- Products (admin CRUD + público lista ativos) ----------

  app.get('/products', async (c) => c.json(await productsRepo.listActive()));

  app.get('/admin/products', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await productsRepo.listAll()),
  );

  app.post('/admin/products', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createProductSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await productsRepo.createProduct({
      kind: v.data.kind,
      refId: v.data.refId ?? null,
      name: v.data.name,
      description: v.data.description,
      priceCents: v.data.priceCents,
      currency: v.data.currency,
      active: v.data.active,
      metadata: v.data.metadata,
    });
    return c.json(created, 201);
  });

  app.put('/admin/products/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateProductSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await productsRepo.updateProduct(id, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Produto não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/products/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const target = await productsRepo.findById(id);
    if (!target) return jsonError(c, 404, 'NOT_FOUND', 'Produto não encontrado');
    const provided = readConfirmHeader(c);
    if (!confirmMatches(provided, target.name)) {
      return jsonError(
        c,
        428,
        'CONFIRM_REQUIRED',
        `Confirme digitando o nome "${target.name}" no header X-Confirm-Name.`,
      );
    }
    const ok = await productsRepo.deleteProduct(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Produto não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Orders (user logado vê os seus, admin vê todos) ----------

  app.get('/me/orders', requireAuth(), async (c) => {
    const u = c.get('user')!;
    return c.json(await ordersRepo.listForUser(u.sub));
  });

  app.get('/admin/orders', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await ordersRepo.listAll()),
  );

  // Admin: dispara refund REAL via gateway (provider.refundPayment)
  app.post(
    '/admin/orders/:id/refund',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('order.refund'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as {
        amountCents?: number;
        reason?: string;
      };
      const order = await ordersRepo.findById(id);
      if (!order) return jsonError(c, 404, 'NOT_FOUND', 'Pedido não encontrado.');
      if (order.status !== 'paid') {
        return jsonError(
          c,
          400,
          'INVALID_STATE',
          `Apenas pedidos pagos podem ser reembolsados (status atual=${order.status}).`,
        );
      }
      if (!order.externalId) {
        return jsonError(
          c,
          400,
          'NO_EXTERNAL',
          'Pedido sem externalId no gateway — não é possível reembolsar via API.',
        );
      }
      const gw = await gatewaysRepo.findById(order.gatewayId);
      if (!gw) {
        return jsonError(c, 404, 'GATEWAY_NOT_FOUND', 'Gateway não encontrado.');
      }
      const provider = getPaymentProvider(gw.provider);
      if (!provider || !provider.refundPayment) {
        return jsonError(
          c,
          501,
          'NOT_SUPPORTED',
          `Provider ${gw.provider} não suporta refund automático. Faça manual no painel do gateway.`,
        );
      }
      const u = c.get('user')!;
      try {
        const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
        if (!creds) {
          return jsonError(c, 500, 'NO_CREDENTIALS', 'Falha ao decifrar credenciais.');
        }
        const r = await provider.refundPayment(gw, creds, order.externalId, body.amountCents);
        const partial =
          r.status === 'partial' ||
          (body.amountCents !== undefined && body.amountCents < order.amountCents);
        const finalStatus = partial ? 'paid' : 'refunded';
        const noteParts = [
          `Refund por ${u.email}`,
          body.reason ? `motivo: ${body.reason}` : null,
          r.externalRefundId ? `refundId=${r.externalRefundId}` : null,
          partial ? `parcial: ${r.refundedCents}c de ${order.amountCents}c` : 'total',
        ].filter(Boolean);
        const updated = await ordersRepo.updateStatus(id, finalStatus, noteParts.join(' · '));
        // Revoga acesso quando refund total
        if (updated && finalStatus === 'refunded') {
          try {
            await revokeAccessForOrder(updated);
          } catch (err) {
            console.error('[refund revoke access]', err);
          }
          // Webhook outbound
          void webhooksDispatcher.emit('order.refunded', {
            orderId: updated.id,
            userId: updated.userId,
            amountCents: r.refundedCents,
            externalRefundId: r.externalRefundId,
          });
          // E-mail (best-effort)
          try {
            const buyer = await usersStore.findUserById(updated.userId);
            if (buyer) {
              void sendSafe({
                to: { email: buyer.email, name: buyer.name },
                subject: `Reembolso processado — ${updated.productSnapshot.name}`,
                html: `<p>Olá${buyer.name ? `, ${buyer.name}` : ''},</p><p>O reembolso de <strong>${updated.productSnapshot.name}</strong> foi processado.</p><p>Valor: <strong>${(r.refundedCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: updated.currency || 'BRL' })}</strong></p>${body.reason ? `<p>Motivo: ${body.reason}</p>` : ''}<p>O acesso ao conteúdo foi removido. Em caso de dúvida, fale com o suporte.</p>`,
                text: `Reembolso de ${updated.productSnapshot.name} processado: ${(r.refundedCents / 100).toFixed(2)}.`,
                tag: 'order_refunded',
              });
            }
          } catch (err) {
            console.error('[refund email]', err);
          }
        }
        return c.json({
          ok: true,
          partial,
          refundedCents: r.refundedCents,
          externalRefundId: r.externalRefundId,
          order: updated,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonError(c, 502, 'REFUND_FAILED', msg);
      }
    },
  );

  // Admin: muda status manualmente (cancelar/refund)
  /**
   * Leva os pedidos do JSON para a tabela. Idempotente, não apaga a origem.
   *
   * Existe como rota porque quem precisa disso é o dono, e ele não tem shell.
   */
  app.post('/admin/payments/orders/migrar', requireAuth('superadmin'), async (c) =>
    c.json(await ordersRepo.migrarJsonParaBanco()),
  );

  app.put('/admin/orders/:id/status', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const allowed = new Set(['canceled', 'refunded', 'failed']);
    const status = typeof body.status === 'string' ? body.status : '';
    if (!allowed.has(status)) {
      return jsonError(c, 400, 'INVALID_STATUS', 'Status inválido (canceled/refunded/failed).');
    }
    const u = c.get('user')!;
    const updated = await ordersRepo.updateStatus(
      id,
      status as 'canceled' | 'refunded' | 'failed',
      `Admin ${u.email}: ${typeof body.note === 'string' ? body.note : 'sem nota'}`,
    );
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Pedido não encontrado.');
    return c.json(updated);
  });

  // Aluno: cancela own pending order
  app.get('/me/orders/:id/invoice', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const id = c.req.param('id') as string;
    const order = await ordersRepo.findById(id);
    if (!order || order.userId !== u.sub) {
      return jsonError(c, 404, 'NOT_FOUND', 'Pedido não encontrado.');
    }
    if (order.status !== 'paid' && order.status !== 'refunded') {
      return jsonError(
        c,
        400,
        'NOT_PAID',
        'Recibo disponível apenas para pedidos pagos ou reembolsados.',
      );
    }
    const user = await usersStore.findUserById(u.sub);
    const html = renderInvoiceHtml({
      order,
      user: {
        name: user?.name ?? u.email,
        email: user?.email ?? u.email,
        document: (user as { document?: string | null } | null)?.document ?? null,
      },
    });
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

  app.post('/me/orders/:id/cancel', requireAuth(), async (c) => {
    const id = c.req.param('id') as string;
    const u = c.get('user')!;
    const order = await ordersRepo.findById(id);
    if (!order) return jsonError(c, 404, 'NOT_FOUND', 'Pedido não encontrado.');
    if (order.userId !== u.sub) {
      return jsonError(c, 403, 'FORBIDDEN', 'Pedido de outro usuário.');
    }
    if (order.status !== 'pending' && order.status !== 'processing') {
      return jsonError(
        c,
        400,
        'INVALID_TRANSITION',
        `Pedido não pode ser cancelado no status atual (${order.status}).`,
      );
    }
    const updated = await ordersRepo.updateStatus(id, 'canceled', 'Cancelado pelo aluno');
    return c.json(updated);
  });

  /**
   * Bulk translate: pra todas as aulas de um curso que tem texto em fromLang
   * MAS NÃO em toLang, traduz e salva. Pula aulas onde toLang já existe
   * (não sobrescreve). Retorna relatório por aula.
   *
   * Body: { courseId, fromLang, toLang }.
   */
  app.post(
    '/admin/transcripts/bulk-translate',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 2 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        courseId?: string;
        fromLang?: string;
        toLang?: string;
      };
      const courseId = String(body.courseId ?? '').trim();
      const fromLang = String(body.fromLang ?? '')
        .trim()
        .toLowerCase();
      const toLang = String(body.toLang ?? '')
        .trim()
        .toLowerCase();
      const valid = ['pt', 'es', 'en'];
      if (!courseId) return jsonError(c, 400, 'BAD_REQUEST', 'courseId obrigatório.');
      if (!valid.includes(fromLang) || !valid.includes(toLang)) {
        return jsonError(c, 400, 'BAD_LANG', `Idiomas devem ser ${valid.join('|')}.`);
      }
      if (fromLang === toLang) {
        return jsonError(c, 400, 'SAME_LANG', 'fromLang e toLang devem ser diferentes.');
      }

      const allCourses = await coursesRepo.listCourses();
      const course = allCourses.find((co) => co.id === courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

      let config = await aiConfigRepo.getActiveByModule('tutor');
      if (!config) config = await aiConfigRepo.getActiveByModule('summaries');
      if (!config) {
        return jsonError(c, 400, 'NO_AI_CONFIG', 'Nenhum AI configurado. /admin/ias.');
      }
      const provider = getProvider(config.provider);
      if (!provider) {
        return jsonError(c, 500, 'PROVIDER_MISSING', 'Provider configurado não existe.');
      }

      const langName = (l: string) =>
        ({ pt: 'Português brasileiro', es: 'Español', en: 'English' })[l] ?? l;
      const systemPrompt = `Você é um tradutor profissional especializado em conteúdo de psicanálise e psicologia. Traduza textos de aulas mantendo: terminologia técnica precisa (Lacan, Freud, Winnicott, Klein etc.), estilo acadêmico apropriado, fluência natural no idioma de destino. Preserve quebras de linha e formatação. NÃO adicione comentários, notas de tradução ou explicações — retorne APENAS o texto traduzido.`;

      const allLessons = (course.modules ?? []).flatMap((m) => m.lessons);
      type Result = {
        lessonId: string;
        title: string;
        ok: boolean;
        skipped?: 'no_source' | 'already_has_target';
        error?: string;
      };
      const results: Result[] = [];
      let totalCost = 0;

      for (const lesson of allLessons) {
        const transcripts =
          (lesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
        const source = transcripts[fromLang];
        if (!source || source.trim().length === 0) {
          results.push({
            lessonId: lesson.id,
            title: lesson.title,
            ok: false,
            skipped: 'no_source',
          });
          continue;
        }
        const target = transcripts[toLang];
        if (target && target.trim().length > 0) {
          results.push({
            lessonId: lesson.id,
            title: lesson.title,
            ok: false,
            skipped: 'already_has_target',
          });
          continue;
        }
        try {
          const userPrompt = `Traduza o seguinte texto de aula de ${langName(fromLang)} para ${langName(toLang)}:\n\n---\n${source}\n---\n\nRetorne APENAS o texto traduzido.`;
          const r = await provider.chat({
            apiKey: config.apiKey,
            model: config.model,
            messages: [{ role: 'user' as const, content: userPrompt }],
            systemPrompt,
            temperature: 0.3,
            maxTokens: Math.min(config.maxTokens, 8000),
            timeoutMs: 60_000,
          });
          const text = r.text.trim();
          if (!text) {
            results.push({
              lessonId: lesson.id,
              title: lesson.title,
              ok: false,
              error: 'IA retornou vazio',
            });
            continue;
          }
          const newTranscripts = { ...transcripts, [toLang]: text };
          await coursesRepo.updateLesson(lesson.id, {
            transcripts: newTranscripts,
          } as Parameters<typeof coursesRepo.updateLesson>[1]);
          const costUsd = calculateCost(
            config.provider,
            config.model,
            r.inputTokens,
            r.outputTokens,
          );
          totalCost += costUsd;
          results.push({ lessonId: lesson.id, title: lesson.title, ok: true });
        } catch (err) {
          results.push({
            lessonId: lesson.id,
            title: lesson.title,
            ok: false,
            error: err instanceof Error ? err.message : 'Erro IA',
          });
        }
      }

      const u = c.get('user');
      if (totalCost > 0) {
        await aiConfigRepo.recordUsage({
          configId: config.id,
          studentId: u?.sub ?? 'admin',
          inputTokens: 0,
          outputTokens: 0,
          costUsd: totalCost,
          successful: true,
        });
      }

      const translated = results.filter((r) => r.ok).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.ok && !r.skipped).length;
      return c.json({
        total: results.length,
        translated,
        skipped,
        failed,
        totalCostUsd: Number(totalCost.toFixed(4)),
        results,
      });
    },
  );

  /**
   * Geração automática de transcrição via OpenAI Whisper a partir do videoUrl
   * da aula. Whisper aceita até 25MB nos formatos mp4/m4a/mp3/wav/webm.
   *
   * Body: { lessonId, lang } — usa o videoUrl já cadastrado.
   * Resposta: { text, durationSeconds, language, sizeMB }.
   * Salva direto em lesson.transcripts[lang].
   *
   * Requer config OpenAI ativa em algum módulo (tutor/summaries) — Whisper
   * usa a mesma API key do chat.
   */
  app.post(
    '/admin/transcripts/generate-from-video',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 3 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        lessonId?: string;
        lang?: string;
      };
      const lessonId = String(body.lessonId ?? '').trim();
      const lang = String(body.lang ?? 'pt')
        .trim()
        .toLowerCase();
      const valid = ['pt', 'es', 'en'];
      if (!lessonId) return jsonError(c, 400, 'BAD_REQUEST', 'lessonId obrigatório.');
      if (!valid.includes(lang)) {
        return jsonError(c, 400, 'BAD_LANG', `lang deve ser ${valid.join('|')}.`);
      }

      const courses = await coursesRepo.listCourses();
      let foundLesson: (typeof courses)[number]['modules'][number]['lessons'][number] | null = null;
      for (const co of courses) {
        for (const m of co.modules ?? []) {
          const l = m.lessons.find((x) => x.id === lessonId);
          if (l) {
            foundLesson = l;
            break;
          }
        }
        if (foundLesson) break;
      }
      if (!foundLesson) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada.');
      const videoUrl = (foundLesson as { videoUrl?: string }).videoUrl ?? '';
      if (!videoUrl) {
        return jsonError(
          c,
          400,
          'NO_VIDEO',
          'Aula não tem videoUrl cadastrada. Adicione antes de gerar transcrição.',
        );
      }

      // Procura config OpenAI ativa em algum módulo
      const allConfigs = await aiConfigRepo.listConfigs();
      const fullConfigs = await Promise.all(allConfigs.map((p) => aiConfigRepo.getConfig(p.id)));
      const openAiConfig = fullConfigs.find(
        (cfg) => cfg && cfg.provider === 'openai' && cfg.active !== false,
      );
      if (!openAiConfig) {
        return jsonError(
          c,
          400,
          'NO_OPENAI',
          'Whisper precisa de uma config OpenAI ativa. Configure /admin/ias com provider=openai em qualquer módulo.',
        );
      }

      try {
        const downloaded = await downloadVideoForTranscription(videoUrl);
        const filename = inferFilenameFromUrl(videoUrl);
        const result = await transcribeWithWhisper({
          apiKey: openAiConfig.apiKey,
          audio: downloaded.buffer,
          mimeType: downloaded.mimeType,
          filename,
          language: lang,
        });
        if (!result.text || result.text.trim().length === 0) {
          return jsonError(c, 502, 'EMPTY_TRANSCRIPT', 'Whisper retornou vazio.');
        }

        const existing =
          (foundLesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
        const newTranscripts = { ...existing, [lang]: result.text };
        await coursesRepo.updateLesson(lessonId, {
          transcripts: newTranscripts,
        } as Parameters<typeof coursesRepo.updateLesson>[1]);

        // Estima custo: Whisper-1 cobra ~$0.006/min
        const minutes = result.durationSeconds
          ? result.durationSeconds / 60
          : downloaded.sizeMB * 0.5; // estimativa grosseira
        const costUsd = Number((minutes * 0.006).toFixed(4));

        const u = c.get('user');
        await aiConfigRepo.recordUsage({
          configId: openAiConfig.id,
          studentId: u?.sub ?? 'admin',
          inputTokens: 0,
          outputTokens: 0,
          costUsd,
          successful: true,
        });

        return c.json({
          text: result.text,
          durationSeconds: result.durationSeconds ?? null,
          language: result.language ?? lang,
          sizeMB: downloaded.sizeMB,
          costUsd,
        });
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return jsonError(
          c,
          502,
          e.code ?? 'WHISPER_FAILED',
          e.message ?? 'Falha ao gerar transcrição.',
        );
      }
    },
  );

  /**
   * Tradução assistida por IA: pega texto de uma transcrição em fromLang e
   * gera versão em toLang usando o provider configurado pra módulo "tutor"
   * (ou "summaries" como fallback). Salva direto em lesson.transcripts[toLang].
   *
   * Body: { lessonId, fromLang, toLang }.
   * Resposta: { text, inputTokens, outputTokens, costUsd, provider, model }.
   */
  app.post(
    '/admin/transcripts/translate-with-ai',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        lessonId?: string;
        fromLang?: string;
        toLang?: string;
      };
      const lessonId = String(body.lessonId ?? '').trim();
      const fromLang = String(body.fromLang ?? '')
        .trim()
        .toLowerCase();
      const toLang = String(body.toLang ?? '')
        .trim()
        .toLowerCase();
      const valid = ['pt', 'es', 'en'];
      if (!lessonId) return jsonError(c, 400, 'BAD_REQUEST', 'lessonId obrigatório.');
      if (!valid.includes(fromLang) || !valid.includes(toLang)) {
        return jsonError(c, 400, 'BAD_LANG', `Idiomas devem ser ${valid.join('|')}.`);
      }
      if (fromLang === toLang) {
        return jsonError(c, 400, 'SAME_LANG', 'fromLang e toLang devem ser diferentes.');
      }

      const courses = await coursesRepo.listCourses();
      let foundLesson: (typeof courses)[number]['modules'][number]['lessons'][number] | null = null;
      for (const co of courses) {
        for (const m of co.modules ?? []) {
          const l = m.lessons.find((x) => x.id === lessonId);
          if (l) {
            foundLesson = l;
            break;
          }
        }
        if (foundLesson) break;
      }
      if (!foundLesson) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada.');

      const transcripts =
        (foundLesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
      const sourceText = transcripts[fromLang];
      if (!sourceText || sourceText.trim().length === 0) {
        return jsonError(
          c,
          400,
          'NO_SOURCE',
          `Aula não tem transcrição em ${fromLang} pra traduzir.`,
        );
      }

      // Tenta tutor primeiro (mais comum), cai pra summaries depois
      let config = await aiConfigRepo.getActiveByModule('tutor');
      if (!config) config = await aiConfigRepo.getActiveByModule('summaries');
      if (!config) {
        return jsonError(
          c,
          400,
          'NO_AI_CONFIG',
          'Nenhum AI configurado pra tutor/summaries. Configure em /admin/ias.',
        );
      }
      const provider = getProvider(config.provider);
      if (!provider) {
        return jsonError(c, 500, 'PROVIDER_MISSING', 'Provider configurado não existe.');
      }

      const langName = (l: string) =>
        ({ pt: 'Português brasileiro', es: 'Español', en: 'English' })[l] ?? l;
      const systemPrompt = `Você é um tradutor profissional especializado em conteúdo de psicanálise e psicologia. Traduza textos de aulas mantendo: terminologia técnica precisa (Lacan, Freud, Winnicott, Klein etc.), estilo acadêmico apropriado, fluência natural no idioma de destino. Preserve quebras de linha e formatação. NÃO adicione comentários, notas de tradução ou explicações — retorne APENAS o texto traduzido.`;
      const userPrompt = `Traduza o seguinte texto de aula de ${langName(fromLang)} para ${langName(toLang)}:\n\n---\n${sourceText}\n---\n\nRetorne APENAS o texto traduzido, sem comentários ou cabeçalhos.`;

      try {
        const result = await provider.chat({
          apiKey: config.apiKey,
          model: config.model,
          messages: [{ role: 'user' as const, content: userPrompt }],
          systemPrompt,
          temperature: 0.3,
          maxTokens: Math.min(config.maxTokens, 8000),
          timeoutMs: 60_000,
        });
        const translatedText = result.text.trim();
        if (!translatedText) {
          return jsonError(c, 500, 'EMPTY_TRANSLATION', 'IA retornou texto vazio.');
        }
        // Salva direto na aula
        const newTranscripts = { ...transcripts, [toLang]: translatedText };
        await coursesRepo.updateLesson(lessonId, {
          transcripts: newTranscripts,
        } as Parameters<typeof coursesRepo.updateLesson>[1]);

        const costUsd = calculateCost(
          config.provider,
          config.model,
          result.inputTokens,
          result.outputTokens,
        );
        // Registra no log de uso (admin user, não student)
        const u = c.get('user');
        await aiConfigRepo.recordUsage({
          configId: config.id,
          studentId: u?.sub ?? 'admin',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd,
          successful: true,
        });

        return c.json({
          text: translatedText,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd,
          provider: config.provider,
          model: config.model,
        });
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return jsonError(c, 502, e.code ?? 'AI_FAILED', e.message ?? 'Falha ao chamar IA.');
      }
    },
  );

  /**
   * Bulk update de transcrições. Body: { items: [{lessonId, lang, text}] }.
   * Cada item atualiza UMA chave de idioma de uma aula. Retorna por item se
   * sucesso ou erro. Não falha tudo se algum item falhar — admin vê relatório.
   */
  app.post(
    '/admin/transcripts/bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        items?: Array<{ lessonId?: string; lang?: string; text?: string }>;
      };
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return jsonError(c, 400, 'BAD_REQUEST', 'items[] obrigatório.');
      }
      if (body.items.length > 500) {
        return jsonError(c, 400, 'TOO_LARGE', 'Máximo 500 items por request.');
      }
      const validLangs = ['pt', 'es', 'en'] as const;
      const allCourses = await coursesRepo.listCourses();
      const lessonIndex = new Map<
        string,
        { lesson: (typeof allCourses)[number]['modules'][number]['lessons'][number] }
      >();
      for (const co of allCourses) {
        for (const m of co.modules ?? []) {
          for (const l of m.lessons) {
            lessonIndex.set(l.id, { lesson: l });
          }
        }
      }
      const results: Array<{
        lessonId: string;
        lang: string;
        ok: boolean;
        error?: string;
      }> = [];
      for (const item of body.items) {
        const lessonId = String(item.lessonId ?? '').trim();
        const lang = String(item.lang ?? '')
          .trim()
          .toLowerCase();
        const text = String(item.text ?? '');
        if (!lessonId) {
          results.push({ lessonId, lang, ok: false, error: 'lessonId vazio' });
          continue;
        }
        if (!validLangs.includes(lang as (typeof validLangs)[number])) {
          results.push({
            lessonId,
            lang,
            ok: false,
            error: `lang inválido (use: ${validLangs.join('|')})`,
          });
          continue;
        }
        if (text.length > 100_000) {
          results.push({ lessonId, lang, ok: false, error: 'text > 100k chars' });
          continue;
        }
        const found = lessonIndex.get(lessonId);
        if (!found) {
          results.push({ lessonId, lang, ok: false, error: 'aula não encontrada' });
          continue;
        }
        const existing =
          (found.lesson as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
        const newTranscripts = { ...existing, [lang]: text };
        try {
          await coursesRepo.updateLesson(lessonId, {
            transcripts: newTranscripts,
          } as Parameters<typeof coursesRepo.updateLesson>[1]);
          results.push({ lessonId, lang, ok: true });
        } catch (err) {
          results.push({
            lessonId,
            lang,
            ok: false,
            error: err instanceof Error ? err.message : 'erro',
          });
        }
      }
      const okCount = results.filter((r) => r.ok).length;
      return c.json({
        total: results.length,
        ok: okCount,
        failed: results.length - okCount,
        results,
      });
    },
  );

  /**
   * Coverage stats de transcrições por curso. Útil pro admin saber
   * quantas aulas tem transcrição em cada idioma, % cobertura, etc.
   */
  app.get('/admin/transcripts/coverage', requireAuth('admin', 'superadmin'), async (c) => {
    const courses = await coursesRepo.listCourses();
    type Lang = 'pt' | 'es' | 'en';
    const langs: Lang[] = ['pt', 'es', 'en'];
    const courseStats = courses.map((co) => {
      const lessons = (co.modules ?? []).flatMap((m) => m.lessons);
      const totalLessons = lessons.length;
      const perLang: Record<Lang, number> = { pt: 0, es: 0, en: 0 };
      let withAnyTranscript = 0;
      for (const l of lessons) {
        const tr = (l as { transcripts?: Record<string, string | undefined> }).transcripts ?? {};
        let hasAny = false;
        for (const lang of langs) {
          if (typeof tr[lang] === 'string' && tr[lang]!.trim().length > 0) {
            perLang[lang]++;
            hasAny = true;
          }
        }
        if (hasAny) withAnyTranscript++;
      }
      return {
        courseId: co.id,
        title: co.title,
        shortTitle: co.shortTitle ?? co.title,
        totalLessons,
        withAnyTranscript,
        perLang,
        coveragePct: totalLessons > 0 ? Math.round((withAnyTranscript / totalLessons) * 100) : 0,
      };
    });
    const totalsAcrossCourses = courseStats.reduce(
      (acc, s) => {
        acc.totalLessons += s.totalLessons;
        acc.withAnyTranscript += s.withAnyTranscript;
        for (const l of langs) acc.perLang[l] += s.perLang[l];
        return acc;
      },
      {
        totalLessons: 0,
        withAnyTranscript: 0,
        perLang: { pt: 0, es: 0, en: 0 } as Record<Lang, number>,
      },
    );
    return c.json({
      courses: courseStats,
      totals: {
        ...totalsAcrossCourses,
        coveragePct:
          totalsAcrossCourses.totalLessons > 0
            ? Math.round(
                (totalsAcrossCourses.withAnyTranscript / totalsAcrossCourses.totalLessons) * 100,
              )
            : 0,
      },
    });
  });

  // ---------- Imports — templates + jobs (Sprint A) ----------

  app.get('/admin/imports/templates', requireAuth('admin', 'superadmin'), (c) =>
    c.json(
      listAllTemplates().map((t) => ({
        entity: t.entity,
        filename: t.filename,
        fields: t.fields,
      })),
    ),
  );

  /**
   * Preview de CSV: retorna headers detectados + primeiras 10 rows +
   * sugestão de mapeamento auto (case-insensitive matching contra nomes/labels canônicos).
   * Multipart com file_<entity>, max 5MB.
   */
  app.post(
    '/admin/imports/preview/csv',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      let entity: string | null = null;
      let headers: string[] = [];
      let sampleRows: Array<Record<string, string>> = [];
      let totalRows = 0;
      try {
        const form = await c.req.formData();
        for (const k of form.keys()) {
          if (k.startsWith('file_')) {
            entity = k.replace('file_', '');
            const f = form.get(k);
            if (f instanceof File) {
              if (f.size > 5 * 1024 * 1024) {
                return jsonError(c, 413, 'FILE_TOO_LARGE', 'Preview limitado a 5MB.');
              }
              const buf = Buffer.from(await f.arrayBuffer());
              const parsed = parseCsvBuffer(buf);
              headers = parsed.headers;
              totalRows = parsed.rows.length;
              sampleRows = parsed.rows.slice(0, 10);
            }
          }
        }
      } catch {
        return jsonError(c, 400, 'INVALID_FORM', 'Multipart inválido.');
      }
      if (!entity || !(entity in CSV_TEMPLATES)) {
        return jsonError(c, 400, 'INVALID_ENTITY', 'Entidade inválida.');
      }
      const tpl = CSV_TEMPLATES[entity as keyof typeof CSV_TEMPLATES];
      const norm = (s: string) =>
        s
          .toLowerCase()
          .trim()
          .replace(/[\s_-]+/g, '_');
      const targetByNorm = new Map<string, string>();
      for (const f of tpl.fields) {
        targetByNorm.set(norm(f.name), f.name);
        if (f.label) targetByNorm.set(norm(f.label), f.name);
      }
      const suggestedMapping = headers.map((h) => ({
        source: h,
        target: targetByNorm.get(norm(h)) ?? null,
      }));
      return c.json({
        entity,
        headers,
        totalRows,
        sampleRows,
        targetFields: tpl.fields,
        suggestedMapping,
      });
    },
  );

  app.get('/admin/imports/templates/:entity', requireAuth('admin', 'superadmin'), (c) => {
    const entity = c.req.param('entity') as keyof typeof CSV_TEMPLATES;
    if (!(entity in CSV_TEMPLATES)) {
      return jsonError(c, 404, 'NOT_FOUND', 'Entidade desconhecida.');
    }
    const csv = generateCsvTemplate(entity);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${CSV_TEMPLATES[entity].filename}"`,
      },
    });
  });

  app.get('/admin/imports/jobs', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '200');
    const status = c.req.query('status') as
      | 'pending'
      | 'running'
      | 'completed'
      | 'completed_with_errors'
      | 'failed'
      | 'canceled'
      | 'rolled_back'
      | undefined;
    const source = c.req.query('source') as
      | 'wordpress'
      | 'learndash'
      | 'woocommerce'
      | 'csv'
      | undefined;
    const mode = c.req.query('mode') as 'api' | 'csv' | undefined;
    const dryRunRaw = c.req.query('dryRun');
    const dryRun = dryRunRaw === 'true' ? true : dryRunRaw === 'false' ? false : undefined;
    const data = await listJobsFiltered({
      limit: Number.isFinite(limit) ? limit : 200,
      status,
      source,
      mode,
      dryRun,
      dateFrom: c.req.query('dateFrom') ?? undefined,
      dateTo: c.req.query('dateTo') ?? undefined,
      q: c.req.query('q') ?? undefined,
    });
    return c.json(data);
  });

  app.get('/admin/imports/jobs/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const job = await importJobs.findJob(id);
    if (!job) return jsonError(c, 404, 'NOT_FOUND', 'Job não encontrado.');
    return c.json(job);
  });

  app.get('/admin/imports/jobs/:id/export', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const format = (c.req.query('format') ?? 'csv').toLowerCase();
    try {
      if (format === 'json') {
        const body = await exportJobAsJson(id);
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="import-${id}.json"`,
          },
        });
      }
      const body = await exportJobAsCsv(id);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="import-${id}.csv"`,
        },
      });
    } catch (err) {
      return jsonError(
        c,
        404,
        'NOT_FOUND',
        err instanceof Error ? err.message : 'Job não encontrado.',
      );
    }
  });

  app.post('/admin/imports/jobs/:id/cancel', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const job = await importJobs.findJob(id);
    if (!job) return jsonError(c, 404, 'NOT_FOUND', 'Job não encontrado.');
    if (job.status !== 'running' && job.status !== 'pending') {
      return jsonError(
        c,
        400,
        'INVALID_STATUS',
        `Job em status ${job.status} não pode ser cancelado.`,
      );
    }
    importJobs.requestCancel(id);
    await importJobs.addNote(id, 'warn', 'Cancelamento solicitado via API');
    return c.json({ ok: true, jobId: id });
  });

  app.get(
    '/admin/imports/jobs/:id/rollback/preview',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      try {
        return c.json(await previewRollback(id));
      } catch (err) {
        return jsonError(
          c,
          404,
          'NOT_FOUND',
          err instanceof Error ? err.message : 'Job não encontrado.',
        );
      }
    },
  );

  app.post(
    '/admin/imports/jobs/:id/rollback',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const id = c.req.param('id') as string;
      try {
        const result = await rollbackJob(id);
        return c.json(result);
      } catch (err) {
        return jsonError(
          c,
          400,
          'ROLLBACK_FAILED',
          err instanceof Error ? err.message : 'Falha no rollback.',
        );
      }
    },
  );

  /**
   * Dry-run via CSV multipart.
   * Aceita campos: file_<entity> (ex: file_student, file_course...).
   * Cada arquivo é um CSV com cabeçalhos canônicos (vide /admin/imports/templates).
   * Retorna o jobId imediatamente; o cliente faz polling em /admin/imports/jobs/:id.
   */
  app.post(
    '/admin/imports/dry-run/csv',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        return jsonError(c, 400, 'INVALID_FORM', 'Multipart inválido.');
      }
      const u = c.get('user')!;

      const rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>> = {};
      let totalRows = 0;
      const ENTITIES: ImportEntityType[] = [
        'student',
        'course',
        'module',
        'lesson',
        'product',
        'order',
        'enrollment',
        'progress',
      ];
      for (const entity of ENTITIES) {
        const file = form.get(`file_${entity}`);
        if (!(file instanceof File)) continue;
        if (file.size > 20 * 1024 * 1024) {
          return jsonError(c, 413, 'FILE_TOO_LARGE', `${entity}: arquivo > 20MB`);
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const parsed = parseCsvBuffer(buf);
        if (parsed.errors.length > 0 && parsed.rows.length === 0) {
          return jsonError(
            c,
            400,
            'CSV_INVALID',
            `${entity}: ${parsed.errors[0]?.message ?? 'CSV inválido'}`,
          );
        }
        rowsByEntity[entity] = parsed.rows;
        totalRows += parsed.rows.length;
      }
      if (totalRows === 0) {
        return jsonError(
          c,
          400,
          'NO_FILES',
          'Nenhum CSV reconhecido (use campos file_student/file_course/etc.).',
        );
      }

      const job = await importJobs.createJob({
        source: 'csv' as ImportSource,
        mode: 'csv',
        dryRun: true,
        entities: [],
        enrollment: {
          startRule: 'paid_date',
          expirationRule: 'start_plus_duration',
          wcStatusMap: {},
        },
        startedBy: u.email,
        startedById: u.sub,
      });

      // Roda dry-run em background (sem await — cliente polla)
      void runDryRun({ rowsByEntity, jobId: job.id }).catch(async (err) => {
        await importJobs.addNote(
          job.id,
          'error',
          `Dry-run falhou: ${err instanceof Error ? err.message : String(err)}`,
        );
        await importJobs.setStatus(job.id, 'failed', true);
      });

      return c.json({ jobId: job.id, totalRows }, 202);
    },
  );

  /**
   * Execução real CSV — persiste via adapters.
   * Aceita `enrollment_start_rule`, `enrollment_expiration_rule`, `default_access_duration_days`
   * como campos do form opcional.
   * Estratégia de conflito padrão é 'update' (admin pode customizar via field 'strategy_<entity>').
   */
  app.post(
    '/admin/imports/run/csv',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        return jsonError(c, 400, 'INVALID_FORM', 'Multipart inválido.');
      }
      const u = c.get('user')!;

      const startRule = (form.get('enrollment_start_rule') as string) || 'paid_date';
      const expirationRule =
        (form.get('enrollment_expiration_rule') as string) || 'start_plus_duration';
      const defaultDuration = Number(form.get('default_access_duration_days') ?? '0');

      const enrollmentRules: ImportEnrollmentConfig = {
        startRule: startRule as EnrollmentStartRule,
        expirationRule: expirationRule as EnrollmentExpirationRule,
        defaultAccessDurationDays:
          Number.isFinite(defaultDuration) && defaultDuration > 0 ? defaultDuration : undefined,
        wcStatusMap: {},
      };

      const rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>> = {};
      let totalRows = 0;
      const ENTITIES: ImportEntityType[] = [
        'student',
        'course',
        'module',
        'lesson',
        'product',
        'order',
        'enrollment',
        'progress',
      ];
      for (const entity of ENTITIES) {
        const file = form.get(`file_${entity}`);
        if (!(file instanceof File)) continue;
        if (file.size > 20 * 1024 * 1024) {
          return jsonError(c, 413, 'FILE_TOO_LARGE', `${entity}: arquivo > 20MB`);
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const parsed = parseCsvBuffer(buf);
        rowsByEntity[entity] = parsed.rows;
        totalRows += parsed.rows.length;
      }
      if (totalRows === 0) {
        return jsonError(c, 400, 'NO_FILES', 'Nenhum CSV reconhecido.');
      }

      const job = await importJobs.createJob({
        source: 'csv' as ImportSource,
        mode: 'csv',
        dryRun: false,
        entities: [],
        enrollment: enrollmentRules,
        startedBy: u.email,
        startedById: u.sub,
      });

      void runReal({
        rowsByEntity,
        jobId: job.id,
        source: 'csv',
        enrollmentRules,
      }).catch(async (err) => {
        await importJobs.addNote(
          job.id,
          'error',
          `Run real falhou: ${err instanceof Error ? err.message : String(err)}`,
        );
        await importJobs.setStatus(job.id, 'failed', true);
      });

      return c.json({ jobId: job.id, totalRows }, 202);
    },
  );

  // ---------- Reengajamento automático ----------

  app.get('/admin/reengagement/config', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await reengagementCfg.getConfig()),
  );

  app.put('/admin/reengagement/config', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const next = await reengagementCfg.setConfig({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      inactivityDays:
        typeof body.inactivityDays === 'number' && body.inactivityDays >= 1
          ? Math.min(365, Math.floor(body.inactivityDays))
          : undefined,
      cooldownDays:
        typeof body.cooldownDays === 'number' && body.cooldownDays >= 1
          ? Math.min(180, Math.floor(body.cooldownDays))
          : undefined,
      onlyEnrolled: typeof body.onlyEnrolled === 'boolean' ? body.onlyEnrolled : undefined,
      subject: typeof body.subject === 'string' ? body.subject : undefined,
      bodyHtml: typeof body.bodyHtml === 'string' ? body.bodyHtml : undefined,
    });
    return c.json(next);
  });

  app.get('/admin/reengagement/sent', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '200');
    return c.json(await reengagementCfg.listRecentSends(Number.isFinite(limit) ? limit : 200));
  });

  app.post(
    '/admin/reengagement/run',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const dryRun = c.req.query('dryRun') === 'true';
      const result = await reengagementWorker.tickWorker({ dryRun });
      return c.json({ dryRun, ...result });
    },
  );

  /**
   * KPIs unificados pra dashboard admin: revenue + students + completion + rating
   * com deltas dos últimos 30/60 dias para tendência.
   */
  app.get('/admin/kpis', requireAuth('admin', 'superadmin'), async (c) => {
    const orders = await ordersRepo.listAll();
    const allStudents = await usersStore.listUsers();
    const students = allStudents.filter((u) => u.role === 'student');
    const certs = await certsRepo.listAllCertificates();
    const reviews = await courseReviews.listAll();

    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60_000;
    const ms60 = 60 * 24 * 60 * 60_000;

    const paid = orders.filter((o) => o.status === 'paid');
    const refunded = orders.filter((o) => o.status === 'refunded');
    const grossRevenue = paid.reduce((s, o) => s + o.amountCents, 0);
    const refundedAmount = refunded.reduce((s, o) => s + o.amountCents, 0);

    const revenue30 = paid
      .filter((o) => o.paidAt && now - new Date(o.paidAt).getTime() < ms30)
      .reduce((s, o) => s + o.amountCents, 0);
    const revenuePrev30 = paid
      .filter((o) => {
        if (!o.paidAt) return false;
        const t = new Date(o.paidAt).getTime();
        return now - t >= ms30 && now - t < ms60;
      })
      .reduce((s, o) => s + o.amountCents, 0);

    const newStudents30 = students.filter(
      (s) => s.createdAt && now - new Date(s.createdAt).getTime() < ms30,
    ).length;
    const newStudentsPrev30 = students.filter((s) => {
      if (!s.createdAt) return false;
      const t = new Date(s.createdAt).getTime();
      return now - t >= ms30 && now - t < ms60;
    }).length;

    const issuedCerts = certs.filter((c) => c.status === 'issued');
    const issued30 = issuedCerts.filter(
      (c) => c.issuedAt && now - new Date(c.issuedAt).getTime() < ms30,
    ).length;

    const ratingsAvg =
      reviews.length === 0 ? 0 : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

    function pctDelta(curr: number, prev: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    }

    const currency = orders[0]?.currency ?? 'BRL';
    return c.json({
      generatedAt: new Date().toISOString(),
      revenue: {
        currency,
        netCents: grossRevenue - refundedAmount,
        grossCents: grossRevenue,
        refundedCents: refundedAmount,
        last30DaysCents: revenue30,
        prev30DaysCents: revenuePrev30,
        deltaPct: pctDelta(revenue30, revenuePrev30),
      },
      students: {
        total: students.length,
        active: students.filter((s) => s.active).length,
        new30Days: newStudents30,
        newPrev30Days: newStudentsPrev30,
        deltaPct: pctDelta(newStudents30, newStudentsPrev30),
      },
      completion: {
        certificatesIssued: issuedCerts.length,
        issuedLast30Days: issued30,
      },
      satisfaction: {
        averageRating: Math.round(ratingsAvg * 10) / 10,
        reviewCount: reviews.length,
      },
    });
  });

  // ---------- Quiz attempts (aluno) ----------

  /**
   * Sorteia N questões ativas do curso (ou módulo) pra montar um quiz.
   * Default: 10 questões. Aluno marca as opções e POST /quiz/:courseId/grade
   * pra obter o resultado.
   */
  app.get('/me/quiz/:courseId/start', requireAuth(), async (c) => {
    const courseId = c.req.param('courseId') as string;
    // Fazer quiz é estudar: exige matrícula viva. Antes esta rota não checava
    // nem matrícula, então qualquer logado sorteava questões de qualquer curso.
    const u = c.get('user')!;
    if (u.role === 'student') {
      const acc = await courseAccessFor(u.sub, courseId);
      if (!acc.canStudy) {
        return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
          expiresAt: acc.access?.expiresAt ?? null,
        });
      }
    }
    const moduleId = c.req.query('moduleId') || undefined;
    const max = Math.max(1, Math.min(50, Number(c.req.query('max') ?? '10')));
    const sampled = await questionBank.sampleForQuiz(courseId, max, moduleId);
    if (sampled.length === 0) {
      return c.json({ questions: [] });
    }
    const safe = sampled.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      tags: q.tags,
      difficulty: q.difficulty,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    }));
    return c.json({ questions: safe });
  });

  /**
   * Aluno submete respostas. Backend grada e retorna resultado por questão
   * com explicações. Format: { answers: [{questionId, selectedOptionIds}] }
   */
  app.post('/me/quiz/:courseId/grade', requireAuth(), async (c) => {
    const courseId = c.req.param('courseId') as string;
    const grader = c.get('user')!;
    if (grader.role === 'student') {
      const acc = await courseAccessFor(grader.sub, courseId);
      if (!acc.canStudy) {
        return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
          expiresAt: acc.access?.expiresAt ?? null,
        });
      }
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const results: Array<{
      questionId: string;
      type: string;
      correct: boolean;
      correctOptionIds: string[];
      explanation: string | null;
      aiScore?: number | null;
      aiFeedback?: string | null;
    }> = [];
    let score = 0;
    let totalPoints = 0;
    for (const a of answers) {
      const ans = a as {
        questionId?: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
      };
      if (!ans.questionId) continue;
      const q = await questionBank.findById(ans.questionId);
      if (!q || q.courseId !== courseId) continue;

      if (q.type === 'open_ended') {
        const text = (ans.textAnswer ?? '').trim();
        if (!text) {
          results.push({
            questionId: q.id,
            type: q.type,
            correct: false,
            correctOptionIds: [],
            explanation: q.explanation ?? null,
            aiScore: 0,
            aiFeedback: 'Resposta em branco.',
          });
          totalPoints += 100;
          continue;
        }
        const aiResult = await questionBank.gradeOpenEndedWithAi(q, text);
        const aiScore = aiResult?.score ?? null;
        results.push({
          questionId: q.id,
          type: q.type,
          correct: (aiScore ?? 0) >= 70,
          correctOptionIds: [],
          explanation: q.explanation ?? null,
          aiScore,
          aiFeedback: aiResult?.feedback ?? 'Correção automática indisponível.',
        });
        score += aiScore ?? 0;
        totalPoints += 100;
      } else {
        const grade = questionBank.gradeAnswer(q, ans.selectedOptionIds ?? []);
        if (grade.correct) score += 100;
        totalPoints += 100;
        results.push({
          questionId: q.id,
          type: q.type,
          correct: grade.correct,
          correctOptionIds: grade.correctOptionIds,
          explanation: q.explanation ?? null,
        });
      }
    }
    return c.json({
      score: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
      total: results.length,
      pct: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
      results,
    });
  });

  // ---------- Banco de questões (question bank) ----------

  app.get('/admin/courses/:id/questions', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json({
      questions: await questionBank.listByCourse(c.req.param('id') as string),
    });
  });

  app.post('/admin/courses/:id/questions', requireAuth('admin', 'superadmin'), async (c) => {
    const courseId = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const q = await questionBank.createQuestion({
        courseId,
        moduleId: typeof body.moduleId === 'string' ? body.moduleId : undefined,
        type: body.type as 'multiple_choice' | 'true_false' | 'open_ended',
        prompt: String(body.prompt ?? ''),
        options: Array.isArray(body.options)
          ? (body.options as Array<{ text?: string; correct?: boolean }>).map((o) => ({
              text: String(o?.text ?? ''),
              correct: !!o?.correct,
            }))
          : [],
        expectedAnswer: typeof body.expectedAnswer === 'string' ? body.expectedAnswer : undefined,
        explanation: typeof body.explanation === 'string' ? body.explanation : undefined,
        tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map((t) => String(t)) : undefined,
        difficulty: typeof body.difficulty === 'number' ? body.difficulty : undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
      });
      await recordAudit(c, {
        action: 'question.create',
        targetType: 'question',
        targetId: q.id,
        meta: { courseId },
      });
      return c.json(q, 201);
    } catch (err) {
      if (err instanceof questionBank.QuestionError) {
        return jsonError(c, err.code === 'NOT_FOUND' ? 404 : 400, err.code, err.message);
      }
      throw err;
    }
  });

  app.put('/admin/questions/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const updated = await questionBank.updateQuestion(id, {
        type: body.type as 'multiple_choice' | 'true_false' | 'open_ended' | undefined,
        prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
        options: Array.isArray(body.options)
          ? (body.options as Array<{ text?: string; correct?: boolean }>).map((o) => ({
              text: String(o?.text ?? ''),
              correct: !!o?.correct,
            }))
          : undefined,
        expectedAnswer: typeof body.expectedAnswer === 'string' ? body.expectedAnswer : undefined,
        explanation: typeof body.explanation === 'string' ? body.explanation : undefined,
        tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map((t) => String(t)) : undefined,
        difficulty: typeof body.difficulty === 'number' ? body.difficulty : undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
        moduleId:
          body.moduleId === null
            ? null
            : typeof body.moduleId === 'string'
              ? body.moduleId
              : undefined,
      });
      await recordAudit(c, {
        action: 'question.update',
        targetType: 'question',
        targetId: id,
      });
      return c.json(updated);
    } catch (err) {
      if (err instanceof questionBank.QuestionError) {
        return jsonError(c, err.code === 'NOT_FOUND' ? 404 : 400, err.code, err.message);
      }
      throw err;
    }
  });

  app.delete('/admin/questions/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await questionBank.deleteQuestion(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Questão não encontrada.');
    await recordAudit(c, {
      action: 'question.delete',
      targetType: 'question',
      targetId: id,
    });
    return c.json({ ok: true });
  });

  // ---------- AI question generation ----------

  app.post(
    '/admin/courses/:id/questions/generate',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const courseId = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const count = typeof body.count === 'number' ? Math.max(1, Math.min(30, body.count)) : 10;
      const moduleId = typeof body.moduleId === 'string' ? body.moduleId : undefined;

      const course = await coursesRepo.findCourse(courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

      const modulesContent = course.modules
        .filter((m) => !moduleId || m.id === moduleId)
        .map((m) => ({
          moduleId: m.id,
          moduleTitle: m.title,
          lessons: m.lessons.map((l) => ({
            title: l.title,
            description: l.description,
            content: (l as unknown as Record<string, unknown>).content as string | undefined,
          })),
        }));

      if (modulesContent.length === 0 || modulesContent.every((m) => m.lessons.length === 0)) {
        return jsonError(c, 400, 'NO_CONTENT', 'Curso/módulo sem aulas com conteúdo.');
      }

      const result = await questionBank.generateQuestionsFromCourse({
        courseId,
        moduleId,
        count,
        courseTitle: course.title,
        modulesContent,
      });

      if (!result) {
        return jsonError(
          c,
          503,
          'AI_UNAVAILABLE',
          'IA não configurada ou falhou. Verifique as configurações em Admin > IA.',
        );
      }

      await recordAudit(c, {
        action: 'question.ai_generate',
        targetType: 'course',
        targetId: courseId,
        meta: { count: result.questions.length, provider: result.provider, model: result.model },
      });

      return c.json({
        generated: result.questions.length,
        provider: result.provider,
        model: result.model,
        questions: result.questions,
      });
    },
  );

  // ---------- Trilhas de estudo (study paths) ----------

  app.get('/study-paths', async (c) => {
    return c.json({ paths: await studyPaths.listPublicPaths() });
  });

  app.get('/study-paths/:slug', async (c) => {
    const path = await studyPaths.findBySlug(c.req.param('slug') as string);
    if (!path || !path.publicVisible) {
      return jsonError(c, 404, 'NOT_FOUND', 'Trilha não encontrada.');
    }
    return c.json({ path });
  });

  app.get('/me/study-paths/:id/progress', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const path = await studyPaths.findById(c.req.param('id') as string);
    if (!path) return jsonError(c, 404, 'NOT_FOUND', 'Trilha não encontrada.');
    const allCourses = await coursesRepo.listCourses();
    const myProgress = await progressRepo.listForUser(u.sub);
    const completedCourseIds: string[] = [];
    for (const co of allCourses) {
      const total = co.modules.reduce((s, m) => s + m.lessons.length, 0);
      if (total === 0) continue;
      const completed = co.modules.reduce(
        (s, m) => s + m.lessons.filter((l) => myProgress.some((p) => p.lessonId === l.id)).length,
        0,
      );
      if (completed === total) completedCourseIds.push(co.id);
    }
    return c.json(computePathProgress(path, completedCourseIds));
  });

  app.get('/admin/study-paths', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json({ paths: await studyPaths.listPaths() });
  });

  app.post('/admin/study-paths', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const created = await studyPaths.createPath({
        slug: String(body.slug ?? ''),
        title: String(body.title ?? ''),
        description: typeof body.description === 'string' ? body.description : undefined,
        coverColor: typeof body.coverColor === 'string' ? body.coverColor : undefined,
        courseIds: Array.isArray(body.courseIds)
          ? (body.courseIds as unknown[]).map((x) => String(x))
          : undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
        publicVisible: typeof body.publicVisible === 'boolean' ? body.publicVisible : undefined,
      });
      await recordAudit(c, {
        action: 'study_path.create',
        targetType: 'study_path',
        targetId: created.id,
        meta: { slug: created.slug },
      });
      return c.json(created, 201);
    } catch (err) {
      if (err instanceof studyPaths.PathError) {
        return jsonError(c, err.code === 'NOT_FOUND' ? 404 : 400, err.code, err.message);
      }
      throw err;
    }
  });

  app.put('/admin/study-paths/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const updated = await studyPaths.updatePath(id, {
        title: typeof body.title === 'string' ? body.title : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        coverColor: typeof body.coverColor === 'string' ? body.coverColor : undefined,
        courseIds: Array.isArray(body.courseIds)
          ? (body.courseIds as unknown[]).map((x) => String(x))
          : undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
        publicVisible: typeof body.publicVisible === 'boolean' ? body.publicVisible : undefined,
      });
      await recordAudit(c, {
        action: 'study_path.update',
        targetType: 'study_path',
        targetId: id,
      });
      return c.json(updated);
    } catch (err) {
      if (err instanceof studyPaths.PathError) {
        return jsonError(c, err.code === 'NOT_FOUND' ? 404 : 400, err.code, err.message);
      }
      throw err;
    }
  });

  app.delete('/admin/study-paths/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await studyPaths.deletePath(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Trilha não encontrada.');
    await recordAudit(c, {
      action: 'study_path.delete',
      targetType: 'study_path',
      targetId: id,
    });
    return c.json({ ok: true });
  });

  // ---------- Roles & Permissions (admin CRUD) ----------

  app.get('/admin/roles', requireAuth('admin', 'superadmin'), async (c) => {
    const [roles, allUsers] = await Promise.all([rolesStore.listRoles(), usersStore.listUsers()]);
    const counts: Record<string, number> = {};
    for (const u of allUsers) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    const enriched = roles.map((r) => ({
      ...r,
      userCount: counts[r.slug] ?? 0,
    }));
    return c.json({ roles: enriched });
  });

  app.get('/admin/permissions', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json(await rolesStore.listPermissions());
  });

  app.post(
    '/admin/roles',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('user.role.change'),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        const role = await rolesStore.createRole({
          slug: String(body.slug ?? ''),
          name: String(body.name ?? ''),
          description: typeof body.description === 'string' ? body.description : undefined,
          permissions: Array.isArray(body.permissions)
            ? (body.permissions as unknown[]).map((p) => String(p))
            : undefined,
        });
        await recordAudit(c, {
          action: 'role.create',
          targetType: 'role',
          targetId: role.id,
          meta: { slug: role.slug, name: role.name },
        });
        return c.json(role, 201);
      } catch (err) {
        if (err instanceof rolesStore.RoleError) {
          return jsonError(c, err.code === 'NOT_FOUND' ? 404 : 400, err.code, err.message);
        }
        throw err;
      }
    },
  );

  app.put(
    '/admin/roles/:id',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('user.role.change'),
    async (c) => {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        const role = await rolesStore.updateRole(id, {
          name: typeof body.name === 'string' ? body.name : undefined,
          description: typeof body.description === 'string' ? body.description : undefined,
          permissions: Array.isArray(body.permissions)
            ? (body.permissions as unknown[]).map((p) => String(p))
            : undefined,
        });
        await recordAudit(c, {
          action: 'role.update',
          targetType: 'role',
          targetId: id,
          meta: { slug: role.slug },
        });
        return c.json(role);
      } catch (err) {
        if (err instanceof rolesStore.RoleError) {
          const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'SYSTEM_ROLE' ? 403 : 400;
          return jsonError(c, status, err.code, err.message);
        }
        throw err;
      }
    },
  );

  app.delete(
    '/admin/roles/:id',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('user.role.change'),
    async (c) => {
      const id = c.req.param('id') as string;
      try {
        await rolesStore.deleteRole(id);
        await recordAudit(c, {
          action: 'role.delete',
          targetType: 'role',
          targetId: id,
        });
        return c.json({ ok: true });
      } catch (err) {
        if (err instanceof rolesStore.RoleError) {
          const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'SYSTEM_ROLE' ? 403 : 400;
          return jsonError(c, status, err.code, err.message);
        }
        throw err;
      }
    },
  );

  // ---------- API tokens (admin CRUD) ----------

  app.get('/admin/api-tokens', requireAuth('admin', 'superadmin'), async (c) =>
    c.json({
      tokens: await apiTokens.listTokens(),
      scopes: apiTokens.ALL_SCOPES,
    }),
  );

  app.post(
    '/admin/api-tokens',
    requireAuth('admin', 'superadmin'),
    blockDuringImpersonation('apiToken.create'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const name = String(body.name ?? '').trim();
      const scopes = Array.isArray(body.scopes)
        ? (body.scopes as string[]).filter((s): s is apiTokens.ApiTokenScope =>
            apiTokens.ALL_SCOPES.includes(s as apiTokens.ApiTokenScope),
          )
        : [];
      if (!name) return jsonError(c, 400, 'INVALID_INPUT', 'name é obrigatório');
      if (scopes.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'selecione ao menos um escopo');
      }
      const u = c.get('user')!;
      const result = await apiTokens.createToken({
        name,
        scopes,
        expiresAt: body.expiresAt ? String(body.expiresAt) : undefined,
        createdBy: u.email,
      });
      return c.json(result, 201);
    },
  );

  app.post('/admin/api-tokens/:id/revoke', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await apiTokens.revokeToken(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Token não encontrado.');
    return c.json({ ok: true });
  });

  app.delete('/admin/api-tokens/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await apiTokens.deleteToken(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Token não encontrado.');
    return c.json({ ok: true });
  });

  // ---------- API pública v1 (autenticada por API token) ----------

  /**
   * OpenAPI 3.0 spec da API pública. Endpoint público (sem auth) — apenas
   * documenta as rotas. Aceita ?origin= para sobrescrever o servidor base.
   */
  app.get('/v1/openapi.json', (c) => {
    const queryOrigin = c.req.query('origin');
    const headerOrigin =
      c.req.header('x-forwarded-proto') && c.req.header('host')
        ? `${c.req.header('x-forwarded-proto')}://${c.req.header('host')}`
        : undefined;
    const spec = buildOpenApiSpec({
      origin: queryOrigin ?? process.env.PUBLIC_ORIGIN ?? headerOrigin,
      version: AVA_VERSION,
    });
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(spec);
  });

  /**
   * Mesma spec em YAML (alguns clientes/IDE preferem). Conversão simples
   * sem dependência externa.
   */
  app.get('/v1/openapi.yaml', async (c) => {
    const queryOrigin = c.req.query('origin');
    const headerOrigin =
      c.req.header('x-forwarded-proto') && c.req.header('host')
        ? `${c.req.header('x-forwarded-proto')}://${c.req.header('host')}`
        : undefined;
    const spec = buildOpenApiSpec({
      origin: queryOrigin ?? process.env.PUBLIC_ORIGIN ?? headerOrigin,
      version: AVA_VERSION,
    });
    const { jsonToYaml } = await import('./http/yaml');
    c.header('Content-Type', 'application/yaml; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=300');
    return c.body(jsonToYaml(spec));
  });

  /**
   * Swagger UI servido via CDN (apenas HTML). Aponta para /v1/openapi.json.
   * Útil pra devs externos explorarem a API sem precisar de cliente próprio.
   */
  app.get('/v1/docs', (c) => {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AVA PCO — API pública v1</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.20.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.20.0/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/v1/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;
    c.header('Cache-Control', 'public, max-age=3600');
    return c.html(html);
  });

  app.get('/v1/me', requireApiToken(), async (c) => {
    const t = c.get('apiToken')!;
    return c.json({
      id: t.id,
      name: t.name,
      scopes: t.scopes,
      prefix: t.prefix,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt ?? null,
      usageCount: t.usageCount + 1,
    });
  });

  app.get('/v1/stats/summary', requireApiToken('stats:read'), async (c) => {
    const orders = await ordersRepo.listAll();
    const revenue = orders
      .filter((o) => o.status === 'paid')
      .reduce((s, o) => s + o.amountCents, 0);
    const refunded = orders
      .filter((o) => o.status === 'refunded')
      .reduce((s, o) => s + o.amountCents, 0);
    const users = await usersStore.listUsers();
    return c.json({
      generatedAt: new Date().toISOString(),
      users: {
        total: users.length,
        active: users.filter((u) => u.active).length,
        students: users.filter((u) => u.role === 'student').length,
        admins: users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length,
      },
      orders: {
        total: orders.length,
        paid: orders.filter((o) => o.status === 'paid').length,
        refunded: orders.filter((o) => o.status === 'refunded').length,
        canceled: orders.filter((o) => o.status === 'canceled').length,
      },
      revenue: {
        currency: orders[0]?.currency ?? 'BRL',
        netCents: revenue - refunded,
        grossCents: revenue,
        refundedCents: refunded,
      },
    });
  });

  app.get('/v1/students', requireApiToken('students:read'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '100');
    const all = await usersStore.listUsers();
    return c.json(
      all
        .filter((u) => u.role === 'student')
        .slice(0, Math.min(Number.isFinite(limit) ? limit : 100, 1000))
        .map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt ?? null,
        })),
    );
  });

  app.get('/v1/orders', requireApiToken('orders:read'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '100');
    const status = c.req.query('status');
    let all = await ordersRepo.listAll();
    if (status) all = all.filter((o) => o.status === status);
    return c.json(
      all.slice(0, Math.min(Number.isFinite(limit) ? limit : 100, 1000)).map((o) => ({
        id: o.id,
        userId: o.userId,
        userEmail: o.userEmail,
        productId: o.productId,
        productName: o.productSnapshot.name,
        amountCents: o.amountCents,
        currency: o.currency,
        status: o.status,
        gatewayProvider: o.gatewayProvider,
        externalId: o.externalId,
        createdAt: o.createdAt,
        paidAt: o.paidAt ?? null,
      })),
    );
  });

  app.get('/v1/courses', requireApiToken('courses:read'), async (c) => {
    const courses = await coursesRepo.listCourses();
    return c.json(
      courses.map((co) => ({
        id: co.id,
        title: co.title,
        slug: co.slug ?? null,
        moduleCount: (co.modules ?? []).length,
        lessonCount: (co.modules ?? []).reduce((s, m) => s + (m.lessons ?? []).length, 0),
      })),
    );
  });

  /** v1: detalhe completo do curso com módulos+aulas (sem conteúdo de player). */
  app.get('/v1/courses/:id', requireApiToken('courses:read'), async (c) => {
    const id = c.req.param('id') as string;
    const course = await coursesRepo.findCourse(id);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');
    return c.json({
      id: course.id,
      title: course.title,
      slug: course.slug ?? null,
      shortTitle: course.shortTitle,
      description: course.description,
      totalHours: course.totalHours,
      tags: course.tags ?? [],
      modules: course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          durationMinutes: l.durationMinutes,
          isMandatory: l.isMandatory,
          order: l.order,
        })),
      })),
    });
  });

  /** v1: lista certificados emitidos. */
  app.get('/v1/certificates', requireApiToken('certificates:read'), async (c) => {
    const all = await certsRepo.listAllCertificates();
    return c.json(
      all
        .filter((cert) => cert.status === 'issued')
        .map((cert) => ({
          id: cert.id,
          studentId: cert.studentId,
          courseId: cert.courseId,
          validationCode: cert.validationCode,
          issuedAt: cert.issuedAt,
        })),
    );
  });

  /** v1: detalhe de certificado (com link público de validação). */
  app.get('/v1/certificates/:id', requireApiToken('certificates:read'), async (c) => {
    const id = c.req.param('id') as string;
    const all = await certsRepo.listAllCertificates();
    const cert = all.find((x) => x.id === id);
    if (!cert) return jsonError(c, 404, 'NOT_FOUND', 'Certificado não encontrado.');
    const baseUrl = process.env.PUBLIC_ORIGIN ?? '';
    return c.json({
      id: cert.id,
      studentId: cert.studentId,
      courseId: cert.courseId,
      status: cert.status,
      validationCode: cert.validationCode,
      validationUrl: `${baseUrl}/verificar/${cert.validationCode}`,
      issuedAt: cert.issuedAt,
    });
  });

  /** v1: lista produtos. */
  app.get('/v1/products', requireApiToken('products:read'), async (c) => {
    const products = await productsRepo.listAll();
    return c.json(
      products.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        priceCents: p.priceCents,
        currency: p.currency,
        active: p.active,
        refId: p.refId,
      })),
    );
  });

  // ---------- Rate-limit telemetry ----------

  app.get('/admin/rate-limits', requireAuth('admin', 'superadmin'), (c) => {
    const windowMs = Number(c.req.query('windowMs') ?? '');
    return c.json(
      rateLimitTelemetry.summarize(
        Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 24 * 60 * 60_000,
      ),
    );
  });

  // ---------- System logs (ring buffer in-memory) ----------

  app.get('/admin/logs', requireAuth('admin', 'superadmin'), (c) => {
    const level = c.req.query('level') as logBuffer.LogLevel | undefined;
    const q = c.req.query('q') ?? undefined;
    const limit = Number(c.req.query('limit') ?? '500');
    return c.json({
      total: logBuffer.size(),
      lines: logBuffer.query({
        level,
        q,
        limit: Number.isFinite(limit) ? limit : 500,
      }),
    });
  });

  // ---------- Cron / jobs viewer ----------

  app.get('/admin/jobs', requireAuth('admin', 'superadmin'), async (c) => {
    const [whPending, whAll, eqlogs] = await Promise.all([
      webhookDeliveries.pending(),
      webhookDeliveries.listAll(500),
      emailLogs.listLogs(50),
    ]);
    const cutoff24h = Date.now() - 24 * 60 * 60_000;
    const recentEmails = eqlogs.filter((l) => new Date(l.ts).getTime() >= cutoff24h).length;
    return c.json({
      jobs: [
        {
          ...webhooksDispatcher.getStatus(),
          pending: whPending.length,
          totalDeliveries: whAll.length,
        },
        {
          ...reengagementWorker.getStatus(),
          recentEmails24h: recentEmails,
        },
        expiryWorker.getStatus(),
        lembreteWorker.getStatus(),
      ],
    });
  });

  app.post(
    '/admin/jobs/:name/run',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const name = c.req.param('name') as string;
      if (name === 'webhooks') {
        const r = await webhooksDispatcher.tickWorker();
        return c.json({ name, ok: true, processed: r.processed });
      }
      if (name === 'reengagement') {
        const dryRun = c.req.query('dryRun') === 'true';
        const r = await reengagementWorker.tickWorker({ dryRun });
        return c.json({ name, ok: true, ...r, dryRun });
      }
      // Vale a pena rodar com ?dryRun=true antes de declarar accessMonths em
      // qualquer curso: mostra exatamente quem receberia aviso, sem enviar.
      if (name === 'access-expiry') {
        const dryRun = c.req.query('dryRun') === 'true';
        const r = await expiryWorker.tickWorker({ dryRun });
        return c.json({ name, ok: true, ...r, dryRun });
      }
      if (name === 'session-reminders') {
        const dryRun = c.req.query('dryRun') === 'true';
        const r = await lembreteWorker.tickWorker({ dryRun });
        return c.json({ name, ok: true, ...r, dryRun });
      }
      return jsonError(c, 404, 'NOT_FOUND', `Job desconhecido: ${name}`);
    },
  );

  // ---------- Streak ----------

  app.get('/me/streak', requireAuth(), async (c) => {
    const u = c.get('user')!;
    return c.json(await progressRepo.streakInfo(u.sub));
  });

  // ---------- Achievements / badges ----------

  app.get('/me/achievements', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const list = await achievementsStore.listForUser(u.sub);
    return c.json({
      catalog: achievementsStore.BADGES,
      awarded: list,
    });
  });

  app.post('/me/achievements/refresh', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const r = await achievementsEngine.evaluate(u.sub);
    return c.json(r);
  });

  /**
   * Analytics consolidado por aluno: matrículas + watch time + progresso +
   * reviews + última atividade + achievements.
   */
  // ---------- Convite de primeiro acesso ----------
  //
  // Quem veio da migração tem conta, matrícula e progresso, e nunca definiu
  // senha aqui. Estas rotas mostram quem deve ser convidado — e, mais
  // importante, quem NÃO deve: desistente, inadimplente, reembolsado, quem não
  // tem matrícula e quem já entrou.

  /** Panorama da lista, com a contagem de cada motivo de exclusão. */
  app.get('/admin/convites/segmentos', requireAuth('admin', 'superadmin'), async (c) => {
    const alunos = await montarListaConvite();
    const seg = segmentarConvite(alunos);
    // Quanto o provedor deixa enviar hoje. Sem isso o disparo é às cegas: no
    // plano gratuito são 300 por dia, e a lista tem mais que isso.
    const cota = await consultarCotaEmail();
    return c.json({
      total: alunos.length,
      elegiveis: seg.elegiveis.length,
      cota,
      porMotivo: seg.porMotivo,
      rotulos: ROTULO_MOTIVO_CONVITE,
      amostra: seg.elegiveis.slice(0, 25).map((a) => ({
        id: a.id,
        nome: a.name,
        email: a.email,
        matriculas: a.matriculas,
        papelOrigem: a.sourceRole ?? null,
      })),
    });
  });

  /** Quem foi excluído e por quê — a tela precisa poder mostrar a conta certa. */
  app.get('/admin/convites/excluidos', requireAuth('admin', 'superadmin'), async (c) => {
    const motivo = c.req.query('motivo') ?? '';
    const alunos = await montarListaConvite();
    const seg = segmentarConvite(alunos);
    const lista = seg.excluidos
      .filter((e) => !motivo || e.motivo === motivo)
      .slice(0, 200)
      .map((e) => ({
        id: e.aluno.id,
        nome: e.aluno.name,
        email: e.aluno.email,
        motivo: e.motivo,
        matriculas: e.aluno.matriculas,
        papelOrigem: e.aluno.sourceRole ?? null,
      }));
    return c.json({ total: seg.excluidos.length, mostrando: lista.length, lista });
  });

  /**
   * Dispara um lote. O limite por chamada é baixo de propósito: a tela chama
   * várias vezes e mostra o progresso, em vez de uma requisição de dez minutos
   * que morre no meio sem ninguém saber quantos e-mails saíram.
   */
  app.post('/admin/convites/enviar', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(enviarConvitesSchema, body);
    if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());

    const alunos = await montarListaConvite();
    const seg = segmentarConvite(alunos);
    const fila = seg.elegiveis.filter(
      (a) => !v.data.somenteIds || v.data.somenteIds.includes(a.id),
    );
    const lote = fila.slice(0, v.data.limite);

    if (v.data.simular) {
      return c.json({
        simulado: true,
        enviados: 0,
        restantes: fila.length,
        destinatarios: lote.map((a) => ({ nome: a.name, email: a.email })),
      });
    }

    const dias = v.data.diasValidade;
    let enviados = 0;
    const falhas: Array<{ email: string; erro: string }> = [];
    for (const a of lote) {
      try {
        const antes = process.env.RESET_TOKEN_TTL_MINUTES;
        process.env.RESET_TOKEN_TTL_MINUTES = String(dias * 24 * 60);
        const token = await createResetToken(a.id, a.email);
        if (antes === undefined) delete process.env.RESET_TOKEN_TTL_MINUTES;
        else process.env.RESET_TOKEN_TTL_MINUTES = antes;

        const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
        const tpl = renderPrimeiroAcesso({
          userName: a.name,
          setPasswordUrl: `${base}/redefinir-senha?token=${encodeURIComponent(token.token)}`,
          expiresInDays: dias,
        });
        const r = await sendSafe({
          to: { email: a.email, name: a.name },
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          tag: 'primeiro_acesso',
        });
        if (r.ok) {
          await registrarConvite(a.id, a.email);
          enviados++;
        } else {
          falhas.push({ email: a.email, erro: r.error ?? 'motivo não informado' });
        }
      } catch (err) {
        falhas.push({ email: a.email, erro: err instanceof Error ? err.message : 'erro' });
      }
    }

    return c.json({
      enviados,
      falhas,
      restantes: Math.max(0, fila.length - enviados),
    });
  });

  /**
   * Prazo de acesso do aluno por curso, para a ficha no admin.
   */
  app.get('/admin/students/:id/course-access', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const student = await studentsRepo.findAdminStudent(id);
    if (!student) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    const allCourses = await coursesRepo.listCourses();
    const now = new Date();
    return c.json({
      courses: (student.enrolledCourseIds ?? []).map((courseId) => {
        const course = allCourses.find((co) => co.id === courseId);
        const accessMonths =
          (course as unknown as { accessMonths?: number | null } | undefined)?.accessMonths ?? null;
        return {
          courseId,
          courseTitle: course?.title ?? courseId,
          enrolledAt: student.enrollmentDates?.[courseId] ?? null,
          accessMonths,
          ...accessInfoFor(
            {
              enrolledAt: student.enrollmentDates?.[courseId] ?? student.createdAt,
              storedExpiresAt: student.accessExpiresByCourse?.[courseId] ?? null,
              accessMonths,
            },
            now,
          ),
        };
      }),
    });
  });

  /**
   * Estende o acesso de um aluno a um curso — renovação comprada por fora,
   * cortesia, ou correção de importação.
   *
   * `{ months: 6 }` soma a partir do fim atual (ou de hoje, se já venceu),
   * `{ until: '2027-01-31' }` crava a data, `{ lifetime: true }` isenta do prazo.
   */
  app.post(
    '/admin/students/:id/courses/:courseId/extend',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const courseId = c.req.param('courseId') as string;
      const body = await c.req.json().catch(() => ({}));
      const v = validate(extendCourseAccessSchema, body);
      if (!v.ok) return jsonError(c, 400, 'VALIDATION', 'Dados inválidos', v.error.flatten());

      const grant =
        v.data.lifetime === true
          ? ({ lifetime: true } as const)
          : v.data.until
            ? ({ until: v.data.until } as const)
            : ({ months: v.data.months! } as const);

      const result = await studentsRepo.extendCourseAccess(id, courseId, grant);
      if (!result.ok) {
        return jsonError(
          c,
          404,
          'NOT_ENROLLED',
          'Este aluno não tem matrícula neste curso — matricule antes de estender.',
        );
      }
      return c.json({ ok: true, courseId, expiresAt: result.expiresAt });
    },
  );

  app.get('/admin/students/:id/analytics', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const student = await studentsRepo.findAdminStudent(id);
    if (!student) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');

    const allCourses = await coursesRepo.listCourses();
    const enrolledCourseIds = new Set(student.enrolledCourseIds ?? []);
    const enrolledCourses = allCourses.filter((c) => enrolledCourseIds.has(c.id));

    const myProgress = await progressRepo.listForUser(id);
    const completedByCourse = new Map<string, Set<string>>();
    for (const p of myProgress) {
      const set = completedByCourse.get(p.courseId) ?? new Set<string>();
      set.add(p.lessonId);
      completedByCourse.set(p.courseId, set);
    }

    const perCourse = enrolledCourses.map((co) => {
      const lessons = (co.modules ?? []).flatMap((m) => m.lessons ?? []);
      const total = lessons.length;
      const done = (completedByCourse.get(co.id) ?? new Set()).size;
      return {
        courseId: co.id,
        title: co.title,
        totalLessons: total,
        completedLessons: done,
        completionPct: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    });

    const myWatch = await watchTimeRepo.listForUser(id);
    const totalSecondsWatched = myWatch.reduce((s, w) => s + w.totalSeconds, 0);

    const allReviews = await courseReviews.listAll();
    const myReviews = allReviews.filter((r) => r.userId === id);

    const streak = await progressRepo.streakInfo(id);
    const earned = await achievementsStore.listForUser(id);

    return c.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        status: student.status,
        createdAt: student.createdAt,
        lastAccessAt: student.lastAccessAt ?? null,
      },
      enrollment: {
        total: enrolledCourses.length,
        courses: perCourse,
        totalLessonsCompleted: myProgress.length,
      },
      watchTime: {
        totalSeconds: totalSecondsWatched,
        lessonsTouched: myWatch.length,
      },
      engagement: {
        streak,
        reviewsWritten: myReviews.length,
        achievementsEarned: earned.length,
        achievementIds: earned.map((b) => b.badgeId),
      },
    });
  });

  app.get('/admin/students/:id/achievements', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const list = await achievementsStore.listForUser(id);
    return c.json({
      catalog: achievementsStore.BADGES,
      awarded: list,
    });
  });

  /**
   * Unsubscribe público — token assinado com scope=unsubscribe.
   * GET /unsubscribe?token=... → seta receiveBroadcasts=false e retorna HTML de
   * confirmação. Não exige autenticação (o token JÁ identifica o usuário).
   */
  app.get('/unsubscribe', rateLimit({ windowMs: 60_000, max: 30 }), async (c) => {
    const token = c.req.query('token') ?? '';
    if (!token) {
      return c.html(
        renderUnsubPage('error', 'Token ausente.', 'Link inválido ou incompleto.'),
        400,
      );
    }
    const claims = (await verifyToken(token).catch(() => null)) as {
      sub: string;
      email: string;
      scope?: string;
    } | null;
    if (!claims || claims.scope !== 'unsubscribe') {
      return c.html(
        renderUnsubPage('error', 'Token inválido', 'Link expirado ou adulterado.'),
        400,
      );
    }
    try {
      await notificationPrefs.setPrefs(claims.sub, { receiveBroadcasts: false });
      return c.html(
        renderUnsubPage(
          'ok',
          'Tudo certo!',
          `O e-mail ${claims.email} não receberá mais comunicados/campanhas. Você ainda receberá e-mails essenciais (reset de senha, confirmações de pagamento). Para reativar, acesse seu perfil.`,
        ),
      );
    } catch (err) {
      return c.html(
        renderUnsubPage('error', 'Falha', err instanceof Error ? err.message : 'Erro inesperado.'),
        500,
      );
    }
  });

  // ---------- Notification preferences ----------

  app.get('/me/notification-prefs', requireAuth(), async (c) => {
    const u = c.get('user')!;
    return c.json(await notificationPrefs.getPrefs(u.sub));
  });

  app.put('/me/notification-prefs', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    let snoozedUntil: string | null | undefined = undefined;
    if (body.snoozedUntil === null) snoozedUntil = null;
    else if (typeof body.snoozedUntil === 'string') snoozedUntil = body.snoozedUntil;
    const next = await notificationPrefs.setPrefs(u.sub, {
      receiveBroadcasts:
        typeof body.receiveBroadcasts === 'boolean' ? body.receiveBroadcasts : undefined,
      receiveReengagement:
        typeof body.receiveReengagement === 'boolean' ? body.receiveReengagement : undefined,
      snoozedUntil,
    });
    return c.json(next);
  });

  /** Conveniência: snooze por N dias a partir de agora. body: { days: number } */
  app.post('/me/notification-prefs/snooze', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const days = Math.max(0, Math.min(Number(body.days ?? 0), 90));
    const snoozedUntil =
      days > 0 ? new Date(Date.now() + days * 24 * 60 * 60_000).toISOString() : null;
    const next = await notificationPrefs.setPrefs(u.sub, { snoozedUntil });
    return c.json(next);
  });

  // ---------- Setup checklist ----------

  app.get('/admin/setup/status', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;

    const [gateways, emailCfgs, products, courses, allUsers] = await Promise.all([
      gatewaysRepo.listAll(),
      emailConfigs.listConfigs(),
      productsRepo.listAll(),
      coursesRepo.listCourses(),
      usersStore.listUsers(),
    ]);

    const myUser = await usersStore.findRawById(u.sub);
    const passwordChanged = (myUser?.tokenVersion ?? 0) > 0;

    const items = [
      {
        id: 'institution',
        label: 'Configurações da instituição',
        ok: true, // app-settings sempre existe (default)
        message: 'Verifique título, contato, fuso',
        link: '/admin/configuracoes',
      },
      {
        id: 'email',
        label: 'E-mail transacional configurado',
        ok: emailCfgs.some((e) => e.enabled && e.provider !== 'mock'),
        message:
          emailCfgs.length === 0
            ? 'Nenhuma configuração — alunos não recebem e-mails essenciais'
            : emailCfgs.some((e) => e.enabled && e.provider !== 'mock')
              ? `Provider ativo: ${emailCfgs.find((e) => e.enabled)?.provider}`
              : 'Apenas mock ativo — recomendado configurar Resend/SendGrid/Postmark',
        link: '/admin/email',
      },
      {
        id: 'gateways',
        label: 'Gateway de pagamento ativo',
        ok: gateways.some((g) => g.active),
        message:
          gateways.filter((g) => g.active).length > 0
            ? `${gateways.filter((g) => g.active).length} gateway(s) ativo(s)`
            : 'Sem gateway ativo — checkout não funciona',
        link: '/admin/gateways',
      },
      {
        id: 'products',
        label: 'Pelo menos um produto cadastrado',
        ok: products.some((p) => p.active),
        message: `${products.filter((p) => p.active).length} produto(s) ativo(s) de ${products.length}`,
        link: '/admin/produtos',
      },
      {
        id: 'courses',
        label: 'Catálogo de cursos',
        ok: courses.length > 0,
        message: `${courses.length} curso(s) cadastrado(s)`,
        link: '/admin/cursos',
      },
      {
        id: 'admin_password',
        label: 'Senha do admin trocada após setup inicial',
        ok: passwordChanged,
        message: passwordChanged ? 'OK' : 'Recomendado: trocar senha do admin inicial',
        link: '/perfil',
      },
      {
        id: 'has_real_users',
        label: 'Mais de um usuário cadastrado',
        ok: allUsers.length > 1,
        message: `${allUsers.length} usuário(s) total`,
        link: '/admin/usuarios',
      },
      {
        id: 'totp',
        label: '2FA habilitado pelo admin atual',
        ok: myUser?.totpEnabled === true,
        message: myUser?.totpEnabled === true ? '2FA ativo' : 'Sem 2FA — recomendado para admins',
        link: '/perfil',
      },
    ];

    const ok = items.filter((i) => i.ok).length;
    return c.json({
      total: items.length,
      ok,
      progressPct: Math.round((ok / items.length) * 100),
      items,
    });
  });

  // ---------- Onboarding wizard ----------

  app.get('/admin/onboarding/status', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;
    const me = await usersStore.findUserById(u.sub);
    if (!me) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
    return c.json({
      needsOnboarding: !me.onboardingCompletedAt,
      completedAt: me.onboardingCompletedAt ?? null,
      role: me.role,
      customRoleSlug: me.customRoleSlug ?? null,
    });
  });

  app.post('/admin/onboarding/complete', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;
    const me = await usersStore.findUserById(u.sub);
    if (!me) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
    if (me.onboardingCompletedAt) {
      return c.json({ ok: true, completedAt: me.onboardingCompletedAt });
    }
    const now = new Date().toISOString();
    await usersStore.updateUser(me.id, { onboardingCompletedAt: now });
    await recordAudit(c, {
      action: 'onboarding.complete',
      targetType: 'user',
      targetId: me.id,
    });
    return c.json({ ok: true, completedAt: now });
  });

  // ---------- Saved searches/filters ----------

  app.get('/admin/saved-searches', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;
    const scope = c.req.query('scope') as
      | 'students'
      | 'orders'
      | 'imports'
      | 'activity'
      | 'rate-limits'
      | 'logs'
      | 'broadcasts'
      | undefined;
    return c.json(await savedSearches.listForOwner(u.sub, scope));
  });

  app.post(
    '/admin/saved-searches',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 60 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const u = c.get('user')!;
      const name = String(body.name ?? '').trim();
      const scope = body.scope as Parameters<typeof savedSearches.createSearch>[0]['scope'];
      const filters =
        body.filters && typeof body.filters === 'object'
          ? (body.filters as Record<string, unknown>)
          : null;
      if (!name) return jsonError(c, 400, 'INVALID_INPUT', 'name é obrigatório');
      if (
        ![
          'students',
          'orders',
          'imports',
          'activity',
          'rate-limits',
          'logs',
          'broadcasts',
        ].includes(String(scope))
      ) {
        return jsonError(c, 400, 'INVALID_SCOPE', 'scope inválido.');
      }
      if (!filters) {
        return jsonError(c, 400, 'INVALID_FILTERS', 'filters obrigatório (objeto).');
      }
      const created = await savedSearches.createSearch({
        ownerId: u.sub,
        ownerEmail: u.email,
        scope,
        name,
        filters,
      });
      return c.json(created, 201);
    },
  );

  app.put('/admin/saved-searches/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await savedSearches.updateSearch(c.req.param('id') as string, u.sub, {
      name: body.name ? String(body.name) : undefined,
      filters:
        body.filters && typeof body.filters === 'object'
          ? (body.filters as Record<string, unknown>)
          : undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Filtro não encontrado.');
    return c.json(updated);
  });

  app.delete('/admin/saved-searches/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const u = c.get('user')!;
    const ok = await savedSearches.deleteSearch(c.req.param('id') as string, u.sub);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Filtro não encontrado.');
    return c.json({ ok: true });
  });

  // ---------- Live sessions ----------

  // Aluno autenticado vê próximas (limitado a 50). Filtra por audiência.
  app.get('/me/live-sessions', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const upcoming = await liveSessions.listUpcoming(50);
    let result = upcoming;
    if (u.role === 'student') {
      const student = await studentsRepo.findAdminStudent(u.sub);
      const enrolledSet = new Set(student?.enrolledCourseIds ?? []);
      result = upcoming.filter((s) => {
        if (s.audience === 'all') return true;
        if (s.audience === 'enrolled' && s.courseId) {
          return enrolledSet.has(s.courseId);
        }
        return false;
      });
    }
    return c.json(
      result.map((s) => ({
        ...s,
        statusComputed: liveSessions.computeStatus(s),
      })),
    );
  });

  app.get('/admin/live-sessions', requireAuth('admin', 'superadmin'), async (c) => {
    const all = await liveSessions.listAll();
    return c.json(
      all.map((s) => ({
        ...s,
        statusComputed: liveSessions.computeStatus(s),
      })),
    );
  });

  app.post(
    '/admin/live-sessions',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 20 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const title = String(body.title ?? '').trim();
      const joinUrl = String(body.joinUrl ?? '').trim();
      const startAt = String(body.startAt ?? '').trim();
      const durationMinutes = Number(body.durationMinutes ?? 0);
      const audience = body.audience === 'enrolled' ? 'enrolled' : 'all';
      if (!title || !joinUrl || !startAt) {
        return jsonError(c, 400, 'INVALID_INPUT', 'title, joinUrl e startAt obrigatórios.');
      }
      if (!/^https?:\/\//.test(joinUrl)) {
        return jsonError(c, 400, 'INVALID_URL', 'joinUrl deve começar com http(s)://');
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 720) {
        return jsonError(c, 400, 'INVALID_DURATION', 'duration entre 1 e 720 min');
      }
      const embedType = body.embedType === 'zoom_embed' ? 'zoom_embed' : 'link';
      const created = await liveSessions.createSession({
        title,
        description: body.description ? String(body.description) : undefined,
        courseId: body.courseId ? String(body.courseId) : null,
        hostName: body.hostName ? String(body.hostName) : undefined,
        joinUrl,
        startAt,
        durationMinutes: Math.floor(durationMinutes),
        audience,
        embedType,
        zoomMeetingNumber: body.zoomMeetingNumber ? String(body.zoomMeetingNumber) : undefined,
        zoomPassword: body.zoomPassword ? String(body.zoomPassword) : undefined,
      });
      return c.json(created, 201);
    },
  );

  app.put('/admin/live-sessions/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const audience =
      body.audience === 'enrolled' || body.audience === 'all' ? body.audience : undefined;
    const status =
      body.status === 'scheduled' ||
      body.status === 'live' ||
      body.status === 'ended' ||
      body.status === 'canceled'
        ? body.status
        : undefined;
    const embedType =
      body.embedType === 'zoom_embed'
        ? 'zoom_embed'
        : body.embedType === 'link'
          ? 'link'
          : undefined;
    const updated = await liveSessions.updateSession(c.req.param('id') as string, {
      title: body.title ? String(body.title) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      courseId:
        body.courseId !== undefined ? (body.courseId ? String(body.courseId) : null) : undefined,
      hostName: body.hostName !== undefined ? String(body.hostName) : undefined,
      joinUrl: body.joinUrl ? String(body.joinUrl) : undefined,
      startAt: body.startAt ? String(body.startAt) : undefined,
      durationMinutes:
        body.durationMinutes !== undefined ? Number(body.durationMinutes) : undefined,
      audience,
      embedType,
      zoomMeetingNumber:
        body.zoomMeetingNumber !== undefined ? String(body.zoomMeetingNumber) : undefined,
      zoomPassword: body.zoomPassword !== undefined ? String(body.zoomPassword) : undefined,
      status,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Sessão não encontrada.');
    return c.json(updated);
  });

  app.delete('/admin/live-sessions/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await liveSessions.deleteSession(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Sessão não encontrada.');
    return c.json({ ok: true });
  });

  // ---------- Transcription ----------

  app.get('/admin/transcription/config', requireAuth('admin', 'superadmin'), async (c) => {
    const cfg = await transcriptionConfig.getConfig();
    if (!cfg) return c.json({ configured: false });
    return c.json({ configured: true, ...transcriptionConfig.getPublicConfig(cfg) });
  });

  app.put('/admin/transcription/config', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const provider = String(body.provider ?? 'whisper');
    const apiKey = String(body.apiKey ?? '').trim();
    if (!apiKey) return jsonError(c, 400, 'INVALID_INPUT', 'apiKey obrigatório.');
    if (provider !== 'whisper' && provider !== 'deepgram') {
      return jsonError(c, 400, 'INVALID_PROVIDER', 'Provider deve ser whisper ou deepgram.');
    }
    const cfg = await transcriptionConfig.setConfig({
      provider: provider as 'whisper' | 'deepgram',
      apiKey,
      model: typeof body.model === 'string' ? body.model : undefined,
      language: typeof body.language === 'string' ? body.language : undefined,
    });
    await recordAudit(c, {
      action: 'transcription.config',
      targetType: 'config',
      targetId: 'transcription',
    });
    return c.json(transcriptionConfig.getPublicConfig(cfg));
  });

  app.post(
    '/admin/transcription/transcribe/:sessionId',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const sessionId = c.req.param('sessionId') as string;
      const session = await liveSessions.findById(sessionId);
      if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Sessão não encontrada.');

      const cfg = await transcriptionConfig.getConfig();
      if (!cfg || !cfg.enabled) {
        return jsonError(c, 503, 'NOT_CONFIGURED', 'Transcrição não configurada.');
      }

      const existing = await transcriptionStore.findBySessionId(sessionId);
      if (existing?.status === 'processing') {
        return c.json({ transcript: existing, message: 'Transcrição em andamento.' });
      }

      const provider = getTranscriptionProvider(cfg.provider);
      if (!provider) {
        return jsonError(c, 503, 'PROVIDER_ERROR', `Provider ${cfg.provider} não disponível.`);
      }

      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl : undefined;
      if (!audioUrl) {
        return jsonError(c, 400, 'INVALID_INPUT', 'audioUrl obrigatório (URL do áudio da sessão).');
      }

      const record = await transcriptionStore.createProcessing(sessionId);

      void (async () => {
        try {
          const result = await provider.transcribe({
            apiKey: transcriptionConfig.getDecryptedKey(cfg),
            audioUrl,
            language: cfg.language,
            customVocabulary: PSYCHOANALYSIS_VOCABULARY,
            model: cfg.model,
          });
          await transcriptionStore.markCompleted(record.id, {
            segments: result.segments,
            fullText: result.fullText,
            language: result.language,
            durationSeconds: result.durationSeconds,
            provider: result.provider,
            model: result.model,
          });

          const aiCfg = (await import('./ai/store')).getActiveByModule('summaries');
          if (aiCfg) {
            const aiProvider = (await import('./ai/providers')).getProvider(aiCfg.provider);
            if (aiProvider) {
              try {
                const summary = await aiProvider.chat({
                  apiKey: aiCfg.apiKey,
                  model: aiCfg.model,
                  messages: [
                    {
                      role: 'user',
                      content: `Resuma esta transcrição de aula de psicanálise em PT-BR (máx 300 palavras). Destaque: pontos-chave, conceitos abordados, e recomendações de estudo.\n\n${result.fullText.slice(0, 8000)}`,
                    },
                  ],
                  systemPrompt:
                    'Você é um assistente acadêmico da PCO. Gere resumos claros e concisos de aulas.',
                  temperature: 0.3,
                  maxTokens: 600,
                });
                await transcriptionStore.setAiSummary(record.id, summary.text);
              } catch {
                // summary is optional
              }
            }
          }
        } catch (err) {
          await transcriptionStore.markFailed(
            record.id,
            err instanceof Error ? err.message : 'Erro desconhecido.',
          );
        }
      })();

      await recordAudit(c, {
        action: 'transcription.start',
        targetType: 'live_session',
        targetId: sessionId,
      });

      return c.json({ transcript: record, message: 'Transcrição iniciada em background.' }, 202);
    },
  );

  app.get('/admin/transcriptions', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json({ transcripts: await transcriptionStore.listAll() });
  });

  app.get('/session/:sessionId/transcript', requireAuth(), async (c) => {
    const sessionId = c.req.param('sessionId') as string;
    const transcript = await transcriptionStore.findBySessionId(sessionId);
    if (!transcript) return jsonError(c, 404, 'NOT_FOUND', 'Transcrição não encontrada.');
    return c.json(transcript);
  });

  // ---------- Mentoring / booking ----------

  app.get('/me/mentoring/:courseId', requireAuth(), async (c) => {
    const courseId = c.req.param('courseId') as string;
    const configs = await mentoringStore.listByCourse(courseId);
    return c.json({ configs });
  });

  app.get('/admin/mentoring', requireAuth('admin', 'superadmin'), async (c) => {
    return c.json({ configs: await mentoringStore.listAll() });
  });

  app.post(
    '/admin/mentoring',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 20 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const courseId = String(body.courseId ?? '').trim();
      const instructorName = String(body.instructorName ?? '').trim();
      const bookingUrl = String(body.bookingUrl ?? '').trim();
      if (!courseId || !instructorName || !bookingUrl) {
        return jsonError(
          c,
          400,
          'INVALID_INPUT',
          'courseId, instructorName e bookingUrl obrigatórios.',
        );
      }
      if (!/^https?:\/\//.test(bookingUrl)) {
        return jsonError(c, 400, 'INVALID_URL', 'bookingUrl deve começar com http(s)://');
      }
      const provider = bookingUrl.includes('calendly.com')
        ? ('calendly' as const)
        : bookingUrl.includes('cal.com')
          ? ('calcom' as const)
          : ('other' as const);
      const cfg = await mentoringStore.create({
        courseId,
        instructorName,
        bookingUrl,
        provider,
        description: body.description ? String(body.description) : undefined,
        durationMinutes:
          typeof body.durationMinutes === 'number' ? body.durationMinutes : undefined,
      });
      await recordAudit(c, {
        action: 'mentoring.create',
        targetType: 'mentoring',
        targetId: cfg.id,
      });
      return c.json(cfg, 201);
    },
  );

  app.put('/admin/mentoring/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await mentoringStore.update(id, {
      instructorName: typeof body.instructorName === 'string' ? body.instructorName : undefined,
      bookingUrl: typeof body.bookingUrl === 'string' ? body.bookingUrl : undefined,
      provider:
        typeof body.provider === 'string'
          ? (body.provider as 'calendly' | 'calcom' | 'other')
          : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      durationMinutes: typeof body.durationMinutes === 'number' ? body.durationMinutes : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Config de mentoria não encontrada.');
    return c.json(updated);
  });

  app.delete('/admin/mentoring/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await mentoringStore.remove(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
    return c.json({ ok: true });
  });

  // ---------- Zoom config + signature ----------

  app.get('/admin/zoom/config', requireAuth('admin', 'superadmin'), async (c) => {
    const cfg = await zoomConfig.getConfig();
    if (!cfg) return c.json({ configured: false });
    return c.json({ configured: true, ...zoomConfig.getPublicConfig(cfg) });
  });

  app.put('/admin/zoom/config', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const sdkKey = String(body.sdkKey ?? '').trim();
    const sdkSecret = String(body.sdkSecret ?? '').trim();
    if (!sdkKey || !sdkSecret) {
      return jsonError(c, 400, 'INVALID_INPUT', 'sdkKey e sdkSecret obrigatórios.');
    }
    const cfg = await zoomConfig.setConfig({ sdkKey, sdkSecret });
    await recordAudit(c, {
      action: 'zoom.config',
      targetType: 'config',
      targetId: 'zoom',
    });
    return c.json(zoomConfig.getPublicConfig(cfg));
  });

  app.post('/zoom/signature', requireAuth(), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const meetingNumber = String(body.meetingNumber ?? '').trim();
    if (!meetingNumber) {
      return jsonError(c, 400, 'INVALID_INPUT', 'meetingNumber obrigatório.');
    }
    const cfg = await zoomConfig.getConfig();
    if (!cfg || !cfg.enabled) {
      return jsonError(c, 503, 'ZOOM_NOT_CONFIGURED', 'Zoom SDK não configurado.');
    }
    const signature = zoomConfig.generateSignature(
      cfg.sdkKey,
      cfg.sdkSecretEncrypted,
      meetingNumber,
      0,
    );
    return c.json({ signature, sdkKey: cfg.sdkKey });
  });

  // ---------- Lesson discussions ----------

  app.get('/lessons/:id/comments', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const isAdmin = u.role === 'admin' || u.role === 'superadmin';
    const list = await discussions.listForLesson(c.req.param('id') as string, {
      includeHidden: isAdmin,
    });
    return c.json(list);
  });

  app.post(
    '/lessons/:id/comments',
    requireAuth(),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const u = c.get('user')!;
      const lessonId = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const text = String(body.body ?? '').trim();
      const courseId = String(body.courseId ?? '').trim();
      const parentId = typeof body.parentId === 'string' ? body.parentId : undefined;
      if (!text) return jsonError(c, 400, 'INVALID_INPUT', 'body é obrigatório');
      if (text.length > 3000) {
        return jsonError(c, 400, 'TOO_LONG', 'máx 3000 caracteres');
      }
      if (!courseId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'courseId é obrigatório');
      }

      // Aluno comum precisa estar matriculado e com acesso no prazo. Admin escapa.
      if (u.role === 'student') {
        const acc = await courseAccessFor(u.sub, courseId);
        if (!acc.canStudy) {
          return jsonError(c, 403, accessDeniedCode(acc), accessDeniedMessage(acc), {
            expiresAt: acc.access?.expiresAt ?? null,
          });
        }
      }

      // Se for resposta, valida pai
      if (parentId) {
        const parent = await discussions.findById(parentId);
        if (!parent || parent.lessonId !== lessonId) {
          return jsonError(c, 400, 'INVALID_PARENT', 'parent inexistente ou de outra aula.');
        }
        if (parent.parentId !== null) {
          return jsonError(c, 400, 'NESTED_REPLY', 'Resposta a resposta não é permitida.');
        }
      }

      const created = await discussions.createComment({
        lessonId,
        courseId,
        parentId: parentId ?? null,
        authorId: u.sub,
        authorName: u.email.split('@')[0]!,
        authorRole: u.role,
        body: text,
      });
      return c.json(created, 201);
    },
  );

  app.put('/lessons/:lessonId/comments/:commentId', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const commentId = c.req.param('commentId') as string;
    const existing = await discussions.findById(commentId);
    if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Comentário não encontrado');
    const isAdmin = u.role === 'admin' || u.role === 'superadmin';
    if (existing.authorId !== u.sub && !isAdmin) {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas o autor ou um admin pode editar.');
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: { body?: string; pinned?: boolean; hidden?: boolean } = {};
    if (typeof body.body === 'string') patch.body = body.body.slice(0, 3000);
    if (isAdmin && typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    if (isAdmin && typeof body.hidden === 'boolean') patch.hidden = body.hidden;
    const updated = await discussions.updateComment(commentId, patch);
    return c.json(updated);
  });

  app.delete('/lessons/:lessonId/comments/:commentId', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const commentId = c.req.param('commentId') as string;
    const existing = await discussions.findById(commentId);
    if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Comentário não encontrado');
    const isAdmin = u.role === 'admin' || u.role === 'superadmin';
    if (existing.authorId !== u.sub && !isAdmin) {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas o autor ou um admin pode excluir.');
    }
    await discussions.deleteComment(commentId);
    return c.json({ ok: true });
  });

  // ---------- Course reviews (alunos avaliam) ----------

  // Público: resumo (avg + count) — sem token
  app.get('/courses/:id/rating', async (c) =>
    c.json(await courseReviews.summary(c.req.param('id') as string)),
  );

  // Público: lista de reviews (mostra na página do curso) — sem token
  app.get('/courses/:id/reviews', async (c) => {
    const limit = Number(c.req.query('limit') ?? '50');
    const list = await courseReviews.listForCourse(c.req.param('id') as string);
    return c.json(
      list.slice(0, Math.max(1, Math.min(limit, 200))).map((r) => ({
        id: r.id,
        userName: r.userName,
        rating: r.rating,
        comment: r.comment ?? '',
        createdAt: r.createdAt,
      })),
    );
  });

  // Aluno autenticado: meu review (se houver)
  app.get('/me/courses/:id/review', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const r = await courseReviews.findMine(c.req.param('id') as string, u.sub);
    return c.json(r ?? null);
  });

  // Aluno autenticado: cria/atualiza review. Só matriculados.
  app.put(
    '/me/courses/:id/review',
    requireAuth(),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const u = c.get('user')!;
      const courseId = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const rating = Number(body.rating ?? 0);
      const comment =
        typeof body.comment === 'string'
          ? body.comment.slice(0, 2000).trim() || undefined
          : undefined;
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return jsonError(c, 400, 'INVALID_RATING', 'rating deve ser inteiro 1-5');
      }
      // Só matrícula, de propósito: quem estudou pode avaliar mesmo depois de o
      // acesso expirar. Bloquear a avaliação de um ex-aluno silenciaria justo
      // quem já viu o curso inteiro.
      const student = await studentsRepo.findAdminStudent(u.sub);
      if (!student || !(student.enrolledCourseIds ?? []).includes(courseId)) {
        return jsonError(
          c,
          403,
          'NOT_ENROLLED',
          'Apenas alunos matriculados podem avaliar este curso.',
        );
      }
      try {
        const review = await courseReviews.upsertReview({
          courseId,
          userId: u.sub,
          userEmail: u.email,
          userName: student.name || u.email,
          rating: Math.round(rating),
          comment,
        });
        return c.json(review);
      } catch (err) {
        return jsonError(c, 400, 'INVALID', err instanceof Error ? err.message : 'Erro');
      }
    },
  );

  // Admin: deletar review
  app.delete(
    '/admin/courses/:courseId/reviews/:reviewId',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await courseReviews.deleteReview(c.req.param('reviewId') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Review não encontrado.');
      return c.json({ ok: true });
    },
  );

  /** Metadata da app — versão, build, env, commit. */
  app.get('/admin/about', requireAuth('admin', 'superadmin'), async (c) => {
    let version = 'unknown';
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      version = pkg.version ?? 'unknown';
    } catch {
      /* ignore */
    }
    return c.json({
      version,
      commit: process.env.GIT_COMMIT ?? null,
      buildDate: process.env.BUILD_DATE ?? null,
      env: process.env.NODE_ENV ?? 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      pid: process.pid,
      hostname: process.env.HOSTNAME ?? null,
      dataDirOverride: !!process.env.DATA_DIR,
    });
  });

  /** Estatísticas de achievements para admin: count por badge, top users. */
  app.get('/admin/achievements/stats', requireAuth('admin', 'superadmin'), async (c) => {
    const all = await achievementsStore.listAll();
    const users = await usersStore.listUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    const byBadge = new Map<string, number>();
    const byUser = new Map<string, number>();
    for (const a of all) {
      byBadge.set(a.badgeId, (byBadge.get(a.badgeId) ?? 0) + 1);
      byUser.set(a.userId, (byUser.get(a.userId) ?? 0) + 1);
    }
    const badges = Object.entries(achievementsStore.BADGES).map(([id, def]) => ({
      id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      awarded: byBadge.get(id) ?? 0,
    }));
    const topUsers = Array.from(byUser.entries())
      .map(([userId, count]) => {
        const u = userMap.get(userId);
        return {
          userId,
          count,
          name: u?.name ?? '?',
          email: u?.email ?? '?',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    return c.json({
      totalAwarded: all.length,
      uniqueRecipients: byUser.size,
      badges: badges.sort((a, b) => b.awarded - a.awarded),
      topUsers,
    });
  });

  /** Lista conversas do tutor IA (admin auditoria). */
  app.get('/admin/tutor/history', requireAuth('admin', 'superadmin'), async (c) => {
    const search = c.req.query('search')?.toLowerCase().trim();
    const userId = c.req.query('userId');
    const limit = Math.min(Number(c.req.query('limit') ?? '200'), 1000);
    const all = await tutorHistory.listAll();
    const users = await usersStore.listUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    const filtered = all
      .filter((t) => {
        if (userId && t.userId !== userId) return false;
        if (search) {
          const hay = `${t.prompt} ${t.response}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.ts > b.ts ? -1 : 1))
      .slice(0, limit)
      .map((t) => {
        const user = userMap.get(t.userId);
        return {
          id: t.id,
          userId: t.userId,
          userName: user?.name ?? '?',
          userEmail: user?.email ?? '?',
          prompt: t.prompt,
          response: t.response,
          provider: t.provider,
          model: t.model,
          ts: t.ts,
        };
      });
    return c.json(filtered);
  });

  /** Centro de alertas — agrega itens de várias fontes que precisam atenção. */
  app.get('/admin/alerts/center', requireAuth('admin', 'superadmin'), async (c) => {
    const [healthSnap, deletionPending, ticketsAll, hiddenComments, failedJobs, failedDeliveries] =
      await Promise.all([
        buildHealthSnapshot(),
        deletionRequests.listAll().then((all) => all.filter((r) => r.status === 'pending')),
        supportRepo.listAllTickets().then((all) => all.filter((t) => t.status === 'open')),
        discussions.listAll({ hidden: true, limit: 20 }),
        importJobs.listJobs(50).then((all) => all.filter((j) => j.status === 'failed')),
        webhookDeliveries.listAll(100).then((all) => all.filter((d) => d.status === 'failed')),
      ]);
    const issues = healthSnap.checks.filter((c) => c.status === 'warn' || c.status === 'error');
    return c.json({
      generatedAt: new Date().toISOString(),
      health: { issues, overall: healthSnap.overall },
      lgpdDeletionRequests: {
        count: deletionPending.length,
        items: deletionPending.slice(0, 5).map((r) => ({
          id: r.id,
          userEmail: r.userEmail,
          requestedAt: r.requestedAt,
        })),
      },
      supportTicketsOpen: {
        count: ticketsAll.length,
        items: ticketsAll.slice(0, 5).map((t) => ({
          id: t.id,
          subject: t.subject,
          studentId: t.studentId,
          createdAt: t.createdAt,
        })),
      },
      moderatedComments: {
        count: hiddenComments.length,
        recent: hiddenComments.slice(0, 5).map((c) => ({
          id: c.id,
          authorName: c.authorName,
          createdAt: c.createdAt,
        })),
      },
      failedImportJobs: {
        count: failedJobs.length,
        items: failedJobs.slice(0, 5).map((j) => ({
          id: j.id,
          source: j.source,
          mode: j.mode,
          startedAt: j.startedAt,
        })),
      },
      failedWebhookDeliveries: {
        count: failedDeliveries.length,
        items: failedDeliveries.slice(0, 5).map((d) => ({
          id: d.id,
          event: d.event,
          attempts: d.attempts,
          createdAt: d.createdAt,
        })),
      },
    });
  });

  /** Resumo de alertas que admin precisa ver no Dashboard. */
  app.get('/admin/alerts', requireAuth('admin', 'superadmin'), async (c) => {
    const snap = await buildHealthSnapshot();
    const issues = snap.checks.filter((c) => c.status === 'warn' || c.status === 'error');
    return c.json({
      generatedAt: snap.generatedAt,
      overall: snap.overall,
      total: issues.length,
      warn: issues.filter((i) => i.status === 'warn').length,
      error: issues.filter((i) => i.status === 'error').length,
      items: issues,
    });
  });

  // Backup snapshots
  app.get('/admin/backups/snapshots', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await backupWorker.listSnapshots()),
  );

  app.post(
    '/admin/backups/run-now',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 3 }),
    async (c) => c.json(await backupWorker.runBackup()),
  );

  app.get('/admin/backups/status', requireAuth('admin', 'superadmin'), (c) =>
    c.json(backupWorker.getStatus()),
  );

  /** Métricas do DATA_DIR. */
  app.get('/admin/storage/stats', requireAuth('admin', 'superadmin'), async (c) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      let totalBytes = 0;
      let jsonFiles = 0;
      let backupFolders = 0;
      let uploadFiles = 0;

      async function walk(dir: string, depth = 0): Promise<void> {
        if (depth > 3) return;
        let entries: import('node:fs').Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (e.name === 'backups' && depth === 0) {
              const sub = await fs.readdir(full).catch(() => []);
              backupFolders += sub.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).length;
            }
            if (e.name === 'uploads' && depth === 0) {
              const sub = await fs.readdir(full).catch(() => []);
              uploadFiles += sub.length;
            }
            await walk(full, depth + 1);
          } else if (e.isFile()) {
            try {
              const s = await fs.stat(full);
              totalBytes += s.size;
              if (e.name.endsWith('.json') && depth === 0) jsonFiles++;
            } catch {
              /* ignore */
            }
          }
        }
      }
      await walk(dataDir);

      return c.json({
        dataDir,
        totalBytes,
        totalMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
        jsonFilesCount: jsonFiles,
        backupFoldersCount: backupFolders,
        uploadFilesCount: uploadFiles,
      });
    } catch (err) {
      return jsonError(c, 500, 'INTERNAL', err instanceof Error ? err.message : 'erro');
    }
  });

  // Admin digest config + run
  app.get('/admin/digest/config', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await adminDigest.getConfig()),
  );

  app.put('/admin/digest/config', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await adminDigest.setConfig({
      enabled: body.enabled === true,
      hourUtc: typeof body.hourUtc === 'number' ? body.hourUtc : undefined,
      recipientRoles: Array.isArray(body.recipientRoles)
        ? (body.recipientRoles as Array<'admin' | 'superadmin'>)
        : undefined,
    });
    return c.json(updated);
  });

  app.post(
    '/admin/digest/run-now',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const r = await adminDigest.sendDigestNow({ dryRun: body.dryRun === true });
      return c.json(r);
    },
  );

  app.get('/admin/digest/preview', requireAuth('admin', 'superadmin'), async (c) => {
    const data = await adminDigest.buildDigestData();
    const r = adminDigest.renderDigestHtml(data);
    return c.json({ ...r, data });
  });

  // Admin: dashboard de vendas
  app.get('/admin/sales/summary', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '30');
    const r = await buildSalesSummary(Number.isFinite(days) ? days : 30);
    return c.json(r);
  });

  /** Export CSV de leaderboard. */
  app.get('/admin/leaderboard/export.csv', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '30');
    const limit = Number(c.req.query('limit') ?? '100');
    const r = await buildLeaderboard(
      Number.isFinite(days) ? days : 30,
      Number.isFinite(limit) ? limit : 100,
    );
    const rows = ['rank,user_name,user_email,lessons,active_days,achievements,score'];
    for (const e of r.entries) {
      const cells = [
        String(e.rank),
        e.userName.replace(/[",\n]/g, ' '),
        e.userEmail,
        String(e.lessonsCompleted),
        String(e.activeDays),
        String(e.achievements),
        String(e.score),
      ];
      rows.push(cells.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
    }
    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leaderboard-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });

  // Leaderboard global (admin) e self (aluno)
  app.get('/admin/leaderboard', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '30');
    const limit = Number(c.req.query('limit') ?? '20');
    const r = await buildLeaderboard(
      Number.isFinite(days) ? days : 30,
      Number.isFinite(limit) ? limit : 20,
    );
    return c.json(r);
  });

  app.get('/me/leaderboard', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const days = Number(c.req.query('days') ?? '30');
    const r = await getUserRank(u.sub, Number.isFinite(days) ? days : 30);
    return c.json(r);
  });

  // ---------- Wishlist ----------

  app.get('/me/wishlist', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const list = await wishlistStore.listForUser(u.sub);
    return c.json(list);
  });

  app.post('/me/wishlist/:courseId', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const courseId = c.req.param('courseId') as string;
    const course = await coursesRepo.findCourse(courseId);
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');
    const e = await wishlistStore.add(u.sub, courseId);
    return c.json(e, 201);
  });

  app.delete('/me/wishlist/:courseId', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const courseId = c.req.param('courseId') as string;
    await wishlistStore.remove(u.sub, courseId);
    return c.json({ ok: true });
  });

  app.get('/admin/wishlist/aggregate', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await wishlistStore.aggregateByCourse()),
  );

  app.get('/admin/wishlist/export.csv', requireAuth('admin', 'superadmin'), async () => {
    const agg = await wishlistStore.aggregateByCourse();
    const courses = await coursesRepo.listCourses();
    const titleMap = new Map(courses.map((co) => [co.id, co.title]));
    const rows = ['rank,course_id,course_title,total,added_last_week'];
    agg.forEach((row, i) => {
      const cells = [
        String(i + 1),
        row.courseId,
        (titleMap.get(row.courseId) ?? '').replace(/[",\n]/g, ' '),
        String(row.count),
        String(row.addedLastWeek),
      ];
      rows.push(cells.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
    });
    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="wishlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });

  // Top 5 com nomes mascarados (privacidade): "Maria S." em vez de "Maria Silva"
  app.get('/leaderboard/top', requireAuth(), async (c) => {
    const days = Number(c.req.query('days') ?? '30');
    const limit = Math.min(Number(c.req.query('limit') ?? '5'), 20);
    const r = await buildLeaderboard(
      Number.isFinite(days) ? days : 30,
      Number.isFinite(limit) ? limit : 5,
    );
    return c.json({
      ...r,
      entries: r.entries.map((e) => ({
        rank: e.rank,
        userId: e.userId,
        // Nome de exibição: primeiro nome + inicial do último
        displayName: maskName(e.userName),
        lessonsCompleted: e.lessonsCompleted,
        activeDays: e.activeDays,
        achievements: e.achievements,
        score: e.score,
      })),
    });
  });

  // Admin: lista global de reviews para moderação
  app.get('/admin/reviews', requireAuth('admin', 'superadmin'), async (c) => {
    const search = c.req.query('search')?.toLowerCase().trim();
    const courseId = c.req.query('courseId');
    const minRating = Number(c.req.query('minRating') ?? 0);
    const maxRating = Number(c.req.query('maxRating') ?? 5);
    const all = await courseReviews.listAll();
    const filtered = all.filter((r) => {
      if (courseId && r.courseId !== courseId) return false;
      if (r.rating < minRating || r.rating > maxRating) return false;
      if (search) {
        const hay = `${r.userName} ${r.userEmail} ${r.comment ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    return c.json(filtered);
  });

  // Admin: lista global de comentários para moderação
  app.get('/admin/comments', requireAuth('admin', 'superadmin'), async (c) => {
    const search = c.req.query('search') ?? undefined;
    const courseId = c.req.query('courseId') ?? undefined;
    const authorId = c.req.query('authorId') ?? undefined;
    const hiddenParam = c.req.query('hidden');
    const hidden: boolean | 'all' =
      hiddenParam === 'true' ? true : hiddenParam === 'false' ? false : 'all';
    const list = await discussions.listAll({
      search,
      courseId,
      authorId,
      hidden,
      limit: 500,
    });
    return c.json(list);
  });

  // Admin: bulk action em comments (hide/show/delete)
  app.post(
    '/admin/comments/bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 20 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const action = String(body.action ?? '');
      if (ids.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'ids vazio.');
      }
      let updated = 0;
      let removed = 0;
      for (const id of ids) {
        if (action === 'hide') {
          const r = await discussions.updateComment(id, { hidden: true });
          if (r) updated++;
        } else if (action === 'show') {
          const r = await discussions.updateComment(id, { hidden: false });
          if (r) updated++;
        } else if (action === 'delete') {
          const ok = await discussions.deleteComment(id);
          if (ok) removed++;
        } else {
          return jsonError(c, 400, 'INVALID_ACTION', `Ação desconhecida: ${action}`);
        }
      }
      return c.json({ updated, removed });
    },
  );

  // ---------- Admin notes (notas internas sobre alunos) ----------

  app.get('/admin/students/:id/notes', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await adminNotes.listForStudent(c.req.param('id') as string)),
  );

  app.post(
    '/admin/students/:id/notes',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 60 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const note = String(body.body ?? '').trim();
      if (!note) return jsonError(c, 400, 'INVALID_INPUT', 'body é obrigatório');
      if (note.length > 5000) {
        return jsonError(c, 400, 'TOO_LONG', 'body máx 5000 chars');
      }
      const u = c.get('user')!;
      const created = await adminNotes.createNote({
        studentId: c.req.param('id') as string,
        authorId: u.sub,
        authorEmail: u.email,
        body: note,
        pinned: body.pinned === true,
      });
      return c.json(created, 201);
    },
  );

  app.put(
    '/admin/students/:studentId/notes/:noteId',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const updated = await adminNotes.updateNote(c.req.param('noteId') as string, {
        body: typeof body.body === 'string' ? body.body : undefined,
        pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
      });
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Nota não encontrada');
      return c.json(updated);
    },
  );

  app.delete(
    '/admin/students/:studentId/notes/:noteId',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await adminNotes.deleteNote(c.req.param('noteId') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Nota não encontrada');
      return c.json({ ok: true });
    },
  );

  // ---------- CSV exports ----------

  app.get('/admin/users/export.csv', requireAuth('admin', 'superadmin'), async () => {
    const list = await usersStore.listUsers();
    const csv = buildCsv(list, [
      { key: 'id', label: 'id' },
      { key: 'email', label: 'email' },
      { key: 'name', label: 'name' },
      { key: 'role', label: 'role' },
      {
        key: 'active',
        label: 'active',
        map: (u) => (u.active ? 'true' : 'false'),
      },
      { key: 'createdAt', label: 'created_at' },
      {
        key: 'lastLoginAt',
        label: 'last_login_at',
        map: (u) => u.lastLoginAt ?? '',
      },
      {
        key: 'totpEnabled',
        label: 'totp_enabled',
        map: (u) => (u.totpEnabled ? 'true' : 'false'),
      },
    ]);
    return csvResponse(csv, `users-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  app.get('/admin/orders/export.csv', requireAuth('admin', 'superadmin'), async () => {
    const list = await ordersRepo.listAll();
    const csv = buildCsv(
      list.map((o) => ({
        id: o.id,
        userEmail: o.userEmail,
        productName: o.productSnapshot.name,
        productKind: o.productSnapshot.kind,
        amountCents: o.amountCents,
        currency: o.currency,
        status: o.status,
        gatewayProvider: o.gatewayProvider,
        externalId: o.externalId ?? '',
        createdAt: o.createdAt,
        paidAt: o.paidAt ?? '',
        updatedAt: o.updatedAt,
      })),
      [
        { key: 'id', label: 'id' },
        { key: 'userEmail', label: 'user_email' },
        { key: 'productName', label: 'product_name' },
        { key: 'productKind', label: 'product_kind' },
        { key: 'amountCents', label: 'amount_cents' },
        { key: 'currency', label: 'currency' },
        { key: 'status', label: 'status' },
        { key: 'gatewayProvider', label: 'gateway' },
        { key: 'externalId', label: 'external_id' },
        { key: 'createdAt', label: 'created_at' },
        { key: 'paidAt', label: 'paid_at' },
        { key: 'updatedAt', label: 'updated_at' },
      ],
    );
    return csvResponse(csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  app.get('/admin/courses/export.csv', requireAuth('admin', 'superadmin'), async () => {
    const courses = await coursesRepo.listCourses();
    const csv = buildCsv(
      courses.map((co) => ({
        id: co.id,
        title: co.title,
        slug: co.slug ?? '',
        description: co.description ?? '',
        moduleCount: (co.modules ?? []).length,
        lessonCount: (co.modules ?? []).reduce((s, m) => s + (m.lessons ?? []).length, 0),
      })),
      [
        { key: 'id', label: 'id' },
        { key: 'title', label: 'title' },
        { key: 'slug', label: 'slug' },
        { key: 'description', label: 'description' },
        { key: 'moduleCount', label: 'module_count' },
        { key: 'lessonCount', label: 'lesson_count' },
      ],
    );
    return csvResponse(csv, `courses-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  // ---------- Settings backup / restore ----------

  app.get('/admin/settings/backup', requireAuth('admin', 'superadmin'), async (c) => {
    const data = await settingsBackup.exportBackup();
    const filename = `ava-pco-backup-${data.createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });

  app.post(
    '/admin/settings/restore',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 3 }),
    async (c) => {
      const body = (await c.req.json().catch(() => null)) as
        | (settingsBackup.SettingsBackup & { dryRun?: boolean })
        | null;
      if (!body) return jsonError(c, 400, 'INVALID_INPUT', 'JSON inválido.');
      try {
        const result = await settingsBackup.restoreBackup(body, {
          dryRun: body.dryRun === true,
        });
        return c.json(result);
      } catch (err) {
        return jsonError(
          c,
          400,
          'RESTORE_FAILED',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );

  // ---------- Activity feed agregado ----------

  app.get('/admin/activity', requireAuth('admin', 'superadmin'), async (c) => {
    const kindsRaw = c.req.query('kinds');
    const kinds = kindsRaw
      ? (kindsRaw.split(',').map((s) => s.trim()) as activityFeed.ActivityKind[])
      : undefined;
    const limit = Number(c.req.query('limit') ?? '200');
    return c.json(
      await activityFeed.buildFeed({
        kinds,
        since: c.req.query('since') ?? undefined,
        until: c.req.query('until') ?? undefined,
        q: c.req.query('q') ?? undefined,
        limit: Number.isFinite(limit) ? limit : 200,
      }),
    );
  });

  // ---------- Health check agregado ----------

  app.get('/admin/saude', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await buildHealthSnapshot()),
  );

  // ---------- Imports — connections REST (Sprint C) ----------

  app.get('/admin/imports/connections', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await importConnections.listConnections()),
  );

  app.post(
    '/admin/imports/connections',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const name = String(body.name ?? '').trim();
      const siteUrl = String(body.siteUrl ?? '').trim();
      if (!name || !siteUrl) {
        return jsonError(c, 400, 'INVALID_INPUT', 'name e siteUrl são obrigatórios.');
      }
      const created = await importConnections.createConnection({
        name,
        siteUrl,
        wpUsername: body.wpUsername ? String(body.wpUsername) : undefined,
        wpAppPassword: body.wpAppPassword ? String(body.wpAppPassword) : undefined,
        wcConsumerKey: body.wcConsumerKey ? String(body.wcConsumerKey) : undefined,
        wcConsumerSecret: body.wcConsumerSecret ? String(body.wcConsumerSecret) : undefined,
        defaultUserMatchKeys: Array.isArray(body.defaultUserMatchKeys)
          ? (body.defaultUserMatchKeys as Array<
              'email' | 'document' | 'external_id' | 'wp_user_id'
            >)
          : undefined,
        defaultConflictStrategy: body.defaultConflictStrategy as
          | 'ignore'
          | 'update'
          | 'merge'
          | 'error'
          | undefined,
      });
      return c.json(created, 201);
    },
  );

  app.put('/admin/imports/connections/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await importConnections.updateConnection(id, {
      name: body.name ? String(body.name) : undefined,
      siteUrl: body.siteUrl ? String(body.siteUrl) : undefined,
      wpUsername: body.wpUsername !== undefined ? String(body.wpUsername) : undefined,
      wpAppPassword: body.wpAppPassword !== undefined ? String(body.wpAppPassword) : undefined,
      wcConsumerKey: body.wcConsumerKey !== undefined ? String(body.wcConsumerKey) : undefined,
      wcConsumerSecret:
        body.wcConsumerSecret !== undefined ? String(body.wcConsumerSecret) : undefined,
      defaultUserMatchKeys: Array.isArray(body.defaultUserMatchKeys)
        ? (body.defaultUserMatchKeys as Array<'email' | 'document' | 'external_id' | 'wp_user_id'>)
        : undefined,
      defaultConflictStrategy: body.defaultConflictStrategy as
        | 'ignore'
        | 'update'
        | 'merge'
        | 'error'
        | undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
    return c.json(updated);
  });

  app.delete('/admin/imports/connections/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await importConnections.deleteConnection(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
    return c.json({ ok: true });
  });

  app.post(
    '/admin/imports/connections/:id/test',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const conn = await importConnections.getConnection(id);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const wp = await pingWp(conn);
      const ld = await pingLd(conn);
      const wc = await pingWc(conn);
      const overall = wp.ok && ld.ok && (wc.ok || wc.skipped === true) ? 'ok' : 'error';
      const msg =
        `WP: ${wp.message}` +
        ` | LD: ${ld.message}` +
        ` | WC: ${wc.skipped ? '(não configurado)' : wc.message}`;
      await importConnections.recordTestResult(id, overall, msg);
      return c.json({ wp, ld, wc, overall });
    },
  );

  /** Diagnóstico detalhado: testa /wp-json, /users/me, /users?context=edit. */
  app.post(
    '/admin/imports/connections/:id/diagnose',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const conn = await importConnections.getConnection(id);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const result = await diagnoseWp(conn);
      return c.json(result);
    },
  );

  /** Diagnóstico LearnDash — útil quando ping LD falha. */
  app.post(
    '/admin/imports/connections/:id/diagnose-ld',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const conn = await importConnections.getConnection(id);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const result = await diagnoseLd(conn);
      return c.json(result);
    },
  );

  /**
   * Importação via API — body JSON: { connectionId, entities: ImportEntityType[],
   * dryRun?: boolean, enrollment?: ImportEnrollmentConfig }.
   * Cria job e dispara em background.
   */
  app.post(
    '/admin/imports/run/api',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        connectionId?: string;
        entities?: ImportEntityType[];
        dryRun?: boolean;
        enrollment?: Partial<ImportEnrollmentConfig>;
      };
      const u = c.get('user')!;
      if (!body.connectionId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'connectionId é obrigatório.');
      }
      const conn = await importConnections.getConnection(body.connectionId);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const VALID_ENTITIES: ImportEntityType[] = [
        'student',
        'course',
        'module',
        'lesson',
        'topic',
        'quiz',
        'question',
        'group',
        'product',
        'order',
        'enrollment',
        'progress',
      ];
      const entities: ImportEntityType[] = (body.entities ?? []).filter(
        (e): e is ImportEntityType => VALID_ENTITIES.includes(e),
      );
      if (entities.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'Selecione ao menos uma entidade.');
      }

      const enrollmentRules: ImportEnrollmentConfig = {
        startRule: (body.enrollment?.startRule ?? 'paid_date') as EnrollmentStartRule,
        expirationRule: (body.enrollment?.expirationRule ??
          'start_plus_duration') as EnrollmentExpirationRule,
        defaultAccessDurationDays: body.enrollment?.defaultAccessDurationDays,
        wcStatusMap: body.enrollment?.wcStatusMap ?? {},
        userMatchKeys: Array.isArray(body.enrollment?.userMatchKeys)
          ? (body.enrollment.userMatchKeys as Array<
              'email' | 'document' | 'external_id' | 'wp_user_id'
            >)
          : conn.defaultUserMatchKeys,
        userMatchStrategy: body.enrollment?.userMatchStrategy,
        unmatchedUserPolicy: body.enrollment?.unmatchedUserPolicy,
        conflictStrategy: body.enrollment?.conflictStrategy ?? conn.defaultConflictStrategy,
        skipValidationErrors: body.enrollment?.skipValidationErrors === true,
      };
      const dryRun = body.dryRun !== false;
      const result = await triggerApiImport({
        connectionId: conn.id,
        entities,
        dryRun,
        enrollmentRules,
        startedBy: u.email,
        startedById: u.sub,
      });
      return c.json(result, 202);
    },
  );

  // ---------- Schedules — agendamentos recorrentes ----------

  app.get('/admin/imports/schedules', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await importSchedules.listSchedules()),
  );

  app.post('/admin/imports/schedules', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const connectionId = String(body.connectionId ?? '').trim();
    if (!name || !connectionId) {
      return jsonError(c, 400, 'INVALID_INPUT', 'name e connectionId obrigatórios.');
    }
    const conn = await importConnections.getConnection(connectionId);
    if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
    const frequency = (body.frequency === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly';
    const created = await importSchedules.createSchedule({
      name,
      connectionId,
      enabled: body.enabled !== false,
      frequency,
      hourUtc: Number(body.hourUtc ?? 3),
      minute: Number(body.minute ?? 0),
      weekday:
        body.weekday !== undefined
          ? (Number(body.weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
          : undefined,
      entities: Array.isArray(body.entities) ? (body.entities as ImportEntityType[]) : [],
      dryRun: body.dryRun !== false,
      enrollment: body.enrollment as Record<string, unknown> | undefined as never,
    });
    return c.json(created, 201);
  });

  app.put('/admin/imports/schedules/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await importSchedules.updateSchedule(id, body as never);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Schedule não encontrado.');
    return c.json(updated);
  });

  app.delete('/admin/imports/schedules/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await importSchedules.deleteSchedule(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Schedule não encontrado.');
    return c.json({ ok: true });
  });

  app.post(
    '/admin/imports/schedules/:id/run-now',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const sched = await importSchedules.findSchedule(id);
      if (!sched) return jsonError(c, 404, 'NOT_FOUND', 'Schedule não encontrado.');
      const conn = await importConnections.getConnection(sched.connectionId);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const u = c.get('user')!;
      const enrollmentRules: ImportEnrollmentConfig = {
        startRule: (sched.enrollment?.startRule ?? 'paid_date') as EnrollmentStartRule,
        expirationRule: (sched.enrollment?.expirationRule ??
          'start_plus_duration') as EnrollmentExpirationRule,
        defaultAccessDurationDays: sched.enrollment?.defaultAccessDurationDays,
        wcStatusMap: {},
        userMatchKeys: sched.enrollment?.userMatchKeys ?? conn.defaultUserMatchKeys,
        unmatchedUserPolicy: sched.enrollment?.unmatchedUserPolicy,
        conflictStrategy: sched.enrollment?.conflictStrategy ?? conn.defaultConflictStrategy,
      };
      const r = await triggerApiImport({
        connectionId: sched.connectionId,
        entities: sched.entities,
        dryRun: sched.dryRun,
        enrollmentRules,
        startedBy: u.email,
        startedById: u.sub,
      });
      await importSchedules.recordRun(id, r.jobId);
      return c.json(r, 202);
    },
  );

  // ---------- Email transacional (admin CRUD + send test + logs) ----------

  app.get('/admin/email/providers', requireAuth('admin', 'superadmin'), (c) =>
    c.json({ providers: ALL_EMAIL_PROVIDERS }),
  );

  app.get('/admin/email/configs', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await emailConfigs.listConfigs()),
  );

  app.post(
    '/admin/email/configs',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const provider = String(body.provider ?? '') as EmailProviderId;
      const fromEmail = String(body.fromEmail ?? '').trim();
      if (!provider || !ALL_EMAIL_PROVIDERS.includes(provider)) {
        return jsonError(c, 400, 'INVALID_PROVIDER', 'Provider inválido.');
      }
      if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
        return jsonError(c, 400, 'INVALID_FROM', 'fromEmail inválido.');
      }
      const created = await emailConfigs.createConfig({
        provider,
        enabled: body.enabled !== false,
        fromEmail,
        fromName: body.fromName ? String(body.fromName) : undefined,
        replyToEmail: body.replyToEmail ? String(body.replyToEmail) : undefined,
        apiKey: body.apiKey ? String(body.apiKey) : undefined,
        smtpHost: body.smtpHost ? String(body.smtpHost) : undefined,
        smtpPort: body.smtpPort ? Number(body.smtpPort) : undefined,
        smtpUser: body.smtpUser ? String(body.smtpUser) : undefined,
        smtpPassword: body.smtpPassword ? String(body.smtpPassword) : undefined,
        smtpSecure: body.smtpSecure === true,
      });
      return c.json(created, 201);
    },
  );

  app.put('/admin/email/configs/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await emailConfigs.updateConfig(id, {
      provider: body.provider ? (String(body.provider) as EmailProviderId) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      fromEmail: body.fromEmail ? String(body.fromEmail) : undefined,
      fromName: body.fromName !== undefined ? String(body.fromName) : undefined,
      replyToEmail: body.replyToEmail !== undefined ? String(body.replyToEmail) : undefined,
      apiKey: body.apiKey !== undefined ? String(body.apiKey) : undefined,
      smtpHost: body.smtpHost !== undefined ? String(body.smtpHost) : undefined,
      smtpPort: body.smtpPort !== undefined ? Number(body.smtpPort) : undefined,
      smtpUser: body.smtpUser !== undefined ? String(body.smtpUser) : undefined,
      smtpPassword: body.smtpPassword !== undefined ? String(body.smtpPassword) : undefined,
      smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
    return c.json(updated);
  });

  app.delete('/admin/email/configs/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await emailConfigs.deleteConfig(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
    return c.json({ ok: true });
  });

  app.post(
    '/admin/email/configs/:id/test',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const cfg = await emailConfigs.getConfig(id);
      if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
      const result = await pingConfig(id);
      await emailConfigs.recordTest(id, result.ok ? 'ok' : 'error', result.message);
      return c.json(result);
    },
  );

  app.post(
    '/admin/email/configs/:id/send-test',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as { to?: string };
      const cfg = await emailConfigs.getConfig(id);
      if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
      const u = c.get('user')!;
      const to = body.to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to) ? body.to : u.email;
      try {
        const r = await sendWithConfig(cfg, {
          to: { email: to },
          subject: 'AVA PCO — teste de envio',
          html: `<p>Olá! Esta é uma mensagem de teste enviada via <strong>${cfg.provider}</strong>.</p><p>Configuração: <code>${cfg.id}</code></p>`,
          text: `AVA PCO — teste de envio. Configuração ${cfg.id} via ${cfg.provider}.`,
          tag: 'admin_test',
        });
        return c.json({ ok: true, result: r });
      } catch (err) {
        return jsonError(c, 500, 'EMAIL_FAILED', err instanceof Error ? err.message : String(err));
      }
    },
  );

  app.get('/admin/email/logs', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '200');
    return c.json(await emailLogs.listLogs(Number.isFinite(limit) ? limit : 200));
  });

  // ---------- Messaging logs (SMS / WhatsApp) ----------
  // Reusa o pattern de /admin/email/logs mas com filtros mais ricos.
  app.get('/admin/messaging/logs', requireAuth('admin', 'superadmin'), async (c) => {
    const messagingLog = await import('./messaging/log-store');
    const limit = Number(c.req.query('limit') ?? '200');
    const provider = c.req.query('provider') as
      | import('./messaging/types').MessagingProviderId
      | undefined;
    const status = c.req.query('status') as
      | import('./messaging/log-store').MessagingLogStatus
      | undefined;
    const to = c.req.query('to');
    const since = c.req.query('since');
    return c.json(
      await messagingLog.listLog({
        limit: Number.isFinite(limit) ? limit : 200,
        provider,
        status,
        to: to || undefined,
        since: since || undefined,
      }),
    );
  });

  // CSV export do messaging log — BOM UTF-8.
  app.get('/admin/messaging/logs/export.csv', requireAuth('admin', 'superadmin'), async (c) => {
    const messagingLog = await import('./messaging/log-store');
    const limit = Math.max(1, Math.min(Number(c.req.query('limit') ?? '1000'), 5000));
    const provider = c.req.query('provider') as
      | import('./messaging/types').MessagingProviderId
      | undefined;
    const status = c.req.query('status') as
      | import('./messaging/log-store').MessagingLogStatus
      | undefined;
    const list = await messagingLog.listLog({ limit, provider, status });
    const csv = buildCsv(list, [
      { key: 'id', label: 'id' },
      { key: 'ts', label: 'timestamp' },
      { key: 'provider', label: 'provider' },
      { key: 'to', label: 'to' },
      { key: 'status', label: 'status' },
      {
        key: 'externalId',
        label: 'external_id',
        map: (e) => e.externalId ?? '',
      },
      { key: 'tag', label: 'tag', map: (e) => e.tag ?? '' },
      {
        key: 'body',
        label: 'body_preview',
        map: (e) => e.body.slice(0, 80),
      },
      {
        key: 'error',
        label: 'error',
        map: (e) => (e.error ?? '').slice(0, 200),
      },
    ]);
    const date = new Date().toISOString().slice(0, 10);
    return csvResponse(csv, `messaging-log-${date}.csv`);
  });

  // ---------- Messaging configs CRUD (SMS / WhatsApp) ----------

  app.get('/admin/messaging-configs', requireAuth('admin', 'superadmin'), async (c) => {
    const { listConfigs } = await import('./messaging/configs-store');
    return c.json(await listConfigs());
  });

  app.post('/admin/messaging-configs', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.provider || !['mock', 'twilio', 'whatsapp-meta'].includes(body.provider)) {
      return jsonError(c, 400, 'INVALID_INPUT', 'provider inválido');
    }
    if (!body.fromNumber || typeof body.fromNumber !== 'string') {
      return jsonError(c, 400, 'INVALID_INPUT', 'fromNumber obrigatório');
    }
    const { createConfig } = await import('./messaging/configs-store');
    const created = await createConfig({
      provider: body.provider,
      enabled: body.enabled,
      fromNumber: body.fromNumber,
      apiKey: body.apiKey,
      accountSid: body.accountSid,
      whatsappPhoneNumberId: body.whatsappPhoneNumberId,
    });
    return c.json(created, 201);
  });

  app.put('/admin/messaging-configs/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { updateConfig } = await import('./messaging/configs-store');
    const updated = await updateConfig(c.req.param('id') as string, body);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada');
    return c.json(updated);
  });

  app.delete('/admin/messaging-configs/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const { deleteConfig } = await import('./messaging/configs-store');
    const ok = await deleteConfig(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada');
    return c.json({ ok: true });
  });

  /** Faz ping no provider (Twilio: account fetch, Meta: GET phone number). */
  app.post(
    '/admin/messaging-configs/:id/ping',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const { getConfig, recordTest } = await import('./messaging/configs-store');
      const { decryptApiKey } = await import('./db/encryption');
      const { getMessagingProvider } = await import('./messaging/providers/registry');
      const cfg = await getConfig(c.req.param('id') as string);
      if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada');
      const provider = getMessagingProvider(cfg.provider);
      if (!provider.ping) {
        return c.json({ ok: true, message: 'Provider sem ping disponível (provavelmente mock).' });
      }
      const creds = {
        apiKey: cfg.apiKeyEncrypted ? decryptApiKey(cfg.apiKeyEncrypted) : undefined,
        accountSid: cfg.accountSidEncrypted ? decryptApiKey(cfg.accountSidEncrypted) : undefined,
      };
      const result = await provider.ping(cfg, creds);
      await recordTest(cfg.id, result);
      return c.json(result);
    },
  );

  /** Envia mensagem de teste pra um número específico. */
  app.post(
    '/admin/messaging-configs/:id/test-send',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const to = typeof body.to === 'string' ? body.to.trim() : '';
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      const whatsappTemplate =
        typeof body.whatsappTemplate === 'string' && body.whatsappTemplate.trim().length > 0
          ? body.whatsappTemplate.trim()
          : undefined;
      if (!to || !/^\+\d{8,15}$/.test(to)) {
        return jsonError(c, 400, 'INVALID_INPUT', 'to deve estar em E.164 (ex: +5511999999999)');
      }
      if (!text && !whatsappTemplate) {
        return jsonError(c, 400, 'INVALID_INPUT', 'body ou whatsappTemplate obrigatório');
      }
      const { getConfig } = await import('./messaging/configs-store');
      const { decryptApiKey } = await import('./db/encryption');
      const { sendSafe } = await import('./messaging/sender');
      const cfg = await getConfig(c.req.param('id') as string);
      if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada');
      const creds = {
        apiKey: cfg.apiKeyEncrypted ? decryptApiKey(cfg.apiKeyEncrypted) : undefined,
        accountSid: cfg.accountSidEncrypted ? decryptApiKey(cfg.accountSidEncrypted) : undefined,
      };
      const result = await sendSafe(cfg, creds, {
        to,
        body: text || `Teste AVA PCO ${new Date().toLocaleString('pt-BR')}`,
        whatsappTemplate,
        tag: 'admin-test',
      });
      return c.json(result);
    },
  );

  app.get('/admin/email/templates', requireAuth('admin', 'superadmin'), (c) =>
    c.json({ names: TEMPLATE_NAMES }),
  );

  // ---------- A/B testing experiments ----------

  app.get('/experiments/active', async (c) => {
    const { getRunningExperiments, assignVariant, recordEvent } =
      await import('./experiments/store');
    const userId = c.req.query('userId') ?? '';
    const sessionId = c.req.query('sessionId') ?? '';
    const key = userId || sessionId;
    if (!key) return c.json({ assignments: {} });
    const running = await getRunningExperiments();
    const assignments: Record<string, string> = {};
    for (const exp of running) {
      const v = assignVariant(key, exp);
      if (v) {
        assignments[exp.id] = v;
        // Fire-and-forget evento assigned
        void recordEvent({
          experimentId: exp.id,
          variant: v,
          eventName: 'assigned',
          userId: userId || undefined,
          sessionId: sessionId || undefined,
        });
      }
    }
    return c.json({ assignments });
  });

  app.post('/experiments/:id/track', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { recordEvent, getExperiment, assignVariant } = await import('./experiments/store');
    const exp = await getExperiment(c.req.param('id') as string);
    if (!exp || exp.status !== 'running') return c.json({ ok: false });
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const eventName = typeof body.eventName === 'string' ? body.eventName : 'converted';
    const key = userId || sessionId;
    if (!key) return c.json({ ok: false });
    const variant = assignVariant(key, exp);
    if (!variant) return c.json({ ok: false });
    await recordEvent({
      experimentId: exp.id,
      variant,
      eventName,
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      meta: body.meta,
    });
    return c.json({ ok: true });
  });

  app.get('/admin/experiments', requireAuth('admin', 'superadmin'), async (c) => {
    const { listExperiments } = await import('./experiments/store');
    return c.json(await listExperiments());
  });

  app.post('/admin/experiments', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.name || !Array.isArray(body.variants)) {
      return jsonError(c, 400, 'INVALID_INPUT', 'name e variants[] obrigatórios');
    }
    const { createExperiment } = await import('./experiments/store');
    try {
      const exp = await createExperiment(body);
      return c.json(exp, 201);
    } catch (err) {
      return jsonError(c, 400, 'INVALID_INPUT', (err as Error).message);
    }
  });

  app.put('/admin/experiments/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { updateExperiment } = await import('./experiments/store');
    const updated = await updateExperiment(c.req.param('id') as string, body);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Experiment não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/experiments/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const { deleteExperiment } = await import('./experiments/store');
    const ok = await deleteExperiment(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Experiment não encontrado');
    return c.json({ ok: true });
  });

  app.get('/admin/experiments/:id/results', requireAuth('admin', 'superadmin'), async (c) => {
    const { aggregate } = await import('./experiments/store');
    const rows = await aggregate(c.req.param('id') as string);
    return c.json({ rows });
  });

  // ---------- Forum por curso ----------

  app.get('/courses/:courseId/forum/threads', async (c) => {
    const { listThreads } = await import('./forum/store');
    return c.json(await listThreads(c.req.param('courseId') as string));
  });

  app.get('/forum/threads/:id', async (c) => {
    const { getThread, listReplies } = await import('./forum/store');
    const t = await getThread(c.req.param('id') as string);
    if (!t) return jsonError(c, 404, 'NOT_FOUND', 'Thread não encontrada');
    const replies = await listReplies(t.id);
    return c.json({ thread: t, replies });
  });

  app.post('/courses/:courseId/forum/threads', requireAuth(), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const u = c.get('user')!;
    if (
      typeof body.title !== 'string' ||
      body.title.trim().length < 3 ||
      typeof body.body !== 'string' ||
      body.body.trim().length < 5
    ) {
      return jsonError(c, 400, 'INVALID_INPUT', 'title e body obrigatórios');
    }
    const kind = ['pergunta', 'dica', 'discussao'].includes(body.kind) ? body.kind : 'discussao';
    const { createThread } = await import('./forum/store');
    const t = await createThread({
      courseId: c.req.param('courseId') as string,
      authorId: u.sub,
      authorName: u.email,
      title: body.title.trim(),
      body: body.body.trim(),
      kind,
    });
    return c.json(t, 201);
  });

  app.post('/forum/threads/:id/replies', requireAuth(), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const u = c.get('user')!;
    if (typeof body.body !== 'string' || body.body.trim().length < 3) {
      return jsonError(c, 400, 'INVALID_INPUT', 'body obrigatório (mín 3 chars)');
    }
    const { createReply } = await import('./forum/store');
    const r = await createReply({
      threadId: c.req.param('id') as string,
      authorId: u.sub,
      authorName: u.email,
      body: body.body.trim(),
    });
    if (!r) return jsonError(c, 404, 'NOT_FOUND', 'Thread não encontrada');
    return c.json(r, 201);
  });

  app.post('/forum/threads/:id/like', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const { likeThread } = await import('./forum/store');
    const t = await likeThread(c.req.param('id') as string, u.sub);
    if (!t) return jsonError(c, 404, 'NOT_FOUND', 'Thread não encontrada');
    return c.json(t);
  });

  app.post('/forum/replies/:id/like', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const { likeReply } = await import('./forum/store');
    const r = await likeReply(c.req.param('id') as string, u.sub);
    if (!r) return jsonError(c, 404, 'NOT_FOUND', 'Reply não encontrada');
    return c.json(r);
  });

  app.post('/forum/threads/:id/resolve', requireAuth(), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { markThreadResolved, getThread } = await import('./forum/store');
    const t = await getThread(c.req.param('id') as string);
    const u = c.get('user')!;
    if (!t) return jsonError(c, 404, 'NOT_FOUND', 'Thread não encontrada');
    if (t.authorId !== u.sub && u.role !== 'admin' && u.role !== 'superadmin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Só o autor ou admin pode marcar resolvido');
    }
    const updated = await markThreadResolved(t.id, !!body.resolved);
    return c.json(updated);
  });

  app.delete('/forum/threads/:id', requireAuth(), async (c) => {
    const { getThread, deleteThread } = await import('./forum/store');
    const t = await getThread(c.req.param('id') as string);
    if (!t) return jsonError(c, 404, 'NOT_FOUND', 'Thread não encontrada');
    const u = c.get('user')!;
    if (t.authorId !== u.sub && u.role !== 'admin' && u.role !== 'superadmin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Só o autor ou admin pode excluir');
    }
    await deleteThread(t.id);
    return c.json({ ok: true });
  });

  app.delete('/forum/replies/:id', requireAuth(), async (c) => {
    const { deleteReply } = await import('./forum/store');
    const ok = await deleteReply(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Reply não encontrada');
    return c.json({ ok: true });
  });

  app.get('/admin/email/broadcasts', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await emailBroadcasts.listBroadcasts()),
  );

  app.post('/admin/email/broadcasts/preview', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      audience?: string;
      courseId?: string;
      inactivityDays?: number;
    };
    const recipients = await emailBroadcasts.resolveAudience(
      (body.audience ?? 'all') as Parameters<typeof emailBroadcasts.resolveAudience>[0],
      { courseId: body.courseId, inactivityDays: body.inactivityDays },
    );
    return c.json({ count: recipients.length, sample: recipients.slice(0, 10) });
  });

  app.post(
    '/admin/email/broadcasts',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        subject?: string;
        html?: string;
        text?: string;
        audience?: string;
        courseId?: string;
        inactivityDays?: number;
      };
      const u = c.get('user')!;
      if (!body.subject || !body.html) {
        return jsonError(c, 400, 'INVALID_INPUT', 'subject e html são obrigatórios.');
      }
      const broadcast = await emailBroadcasts.startBroadcast({
        subject: body.subject,
        html: body.html,
        text: body.text,
        audience: (body.audience ?? 'all') as Parameters<
          typeof emailBroadcasts.startBroadcast
        >[0]['audience'],
        courseId: body.courseId,
        inactivityDays: body.inactivityDays,
        createdBy: u.email,
      });
      return c.json(broadcast, 202);
    },
  );

  app.get('/admin/email/templates/:name/preview', requireAuth('admin', 'superadmin'), async (c) => {
    const name = c.req.param('name') as string;
    try {
      const override = await templateOverrides.getOverride(name);
      const r = previewTemplate(name, override ?? undefined);
      return c.json(r);
    } catch (err) {
      return jsonError(
        c,
        404,
        'NOT_FOUND',
        err instanceof Error ? err.message : 'Template não encontrado.',
      );
    }
  });

  /** Permite preview com override em-flight (sem salvar). */
  app.post(
    '/admin/email/templates/:name/preview',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const name = c.req.param('name') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        const override = {
          subject: typeof body.subject === 'string' ? body.subject : undefined,
          brandColor: typeof body.brandColor === 'string' ? body.brandColor : undefined,
          logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : undefined,
          orgName: typeof body.orgName === 'string' ? body.orgName : undefined,
          greeting: typeof body.greeting === 'string' ? body.greeting : undefined,
          footerNote: typeof body.footerNote === 'string' ? body.footerNote : undefined,
        };
        const r = previewTemplate(name, override);
        return c.json(r);
      } catch (err) {
        return jsonError(
          c,
          404,
          'NOT_FOUND',
          err instanceof Error ? err.message : 'Template não encontrado.',
        );
      }
    },
  );

  app.get('/admin/email/weekly-report', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await weeklyReport.getConfig()),
  );

  app.put('/admin/email/weekly-report', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const cfg = await weeklyReport.setConfig({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      dayOfWeekUtc: typeof body.dayOfWeekUtc === 'number' ? body.dayOfWeekUtc : undefined,
      hourUtc: typeof body.hourUtc === 'number' ? body.hourUtc : undefined,
      recipientRoles: Array.isArray(body.recipientRoles)
        ? (body.recipientRoles as unknown[]).filter(
            (r): r is 'admin' | 'superadmin' => r === 'admin' || r === 'superadmin',
          )
        : undefined,
      aiDigestEnabled: typeof body.aiDigestEnabled === 'boolean' ? body.aiDigestEnabled : undefined,
    });
    await recordAudit(c, {
      action: 'weekly_report.config',
      targetType: 'config',
      targetId: 'weekly-report',
    });
    return c.json(cfg);
  });

  app.post('/admin/email/weekly-report/preview', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const withAi = body.withAi === true;
    const data = await weeklyReport.buildReport();
    let aiDigest: { text: string; provider: string; model: string } | null = null;
    if (withAi) {
      aiDigest = await weeklyReport.generateAiDigest(data);
    }
    const email = weeklyReport.renderEmailHtml(data, aiDigest?.text);
    return c.json({ data, email, aiDigest });
  });

  // ---------- Student weekly progress email ----------

  app.get('/admin/email/student-progress', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await studentProgressEmail.getConfig()),
  );

  app.put('/admin/email/student-progress', requireAuth('admin', 'superadmin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const cfg = await studentProgressEmail.setConfig({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      dayOfWeekUtc: typeof body.dayOfWeekUtc === 'number' ? body.dayOfWeekUtc : undefined,
      hourUtc: typeof body.hourUtc === 'number' ? body.hourUtc : undefined,
    });
    await recordAudit(c, {
      action: 'student_progress_email.config',
      targetType: 'config',
      targetId: 'student-progress',
    });
    return c.json(cfg);
  });

  app.get('/admin/email/student-progress/status', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(studentProgressEmail.getStatus()),
  );

  app.get('/admin/email/template-overrides', requireAuth('admin', 'superadmin'), async (c) =>
    c.json({ overrides: await templateOverrides.listOverrides() }),
  );

  app.put(
    '/admin/email/template-overrides/:name',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const name = c.req.param('name') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const saved = await templateOverrides.setOverride(name, {
        subject: typeof body.subject === 'string' ? body.subject : undefined,
        brandColor: typeof body.brandColor === 'string' ? body.brandColor : undefined,
        logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : undefined,
        orgName: typeof body.orgName === 'string' ? body.orgName : undefined,
        greeting: typeof body.greeting === 'string' ? body.greeting : undefined,
        footerNote: typeof body.footerNote === 'string' ? body.footerNote : undefined,
      });
      await recordAudit(c, {
        action: 'email_template.override',
        targetType: 'email_template',
        targetId: name,
      });
      return c.json(saved);
    },
  );

  app.delete(
    '/admin/email/template-overrides/:name',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const name = c.req.param('name') as string;
      const ok = await templateOverrides.deleteOverride(name);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Override não existe.');
      await recordAudit(c, {
        action: 'email_template.override.delete',
        targetType: 'email_template',
        targetId: name,
      });
      return c.json({ ok: true });
    },
  );

  // ---------- Webhooks de saída ----------

  app.get('/admin/webhooks/events', requireAuth('admin', 'superadmin'), (c) =>
    c.json({ events: ALL_WEBHOOK_EVENTS }),
  );

  app.get('/admin/webhooks/presets', requireAuth('admin', 'superadmin'), (c) =>
    c.json({ presets: WEBHOOK_PRESETS }),
  );

  app.get('/admin/webhooks/endpoints', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await webhookEndpoints.listEndpoints()),
  );

  app.post(
    '/admin/webhooks/endpoints',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const name = String(body.name ?? '').trim();
      const url = String(body.url ?? '').trim();
      const events = Array.isArray(body.events) ? (body.events as WebhookEventType[]) : [];
      if (!name || !url) {
        return jsonError(c, 400, 'INVALID_INPUT', 'name e url são obrigatórios.');
      }
      if (!/^https?:\/\//.test(url)) {
        return jsonError(c, 400, 'INVALID_URL', 'URL deve começar com http(s)://.');
      }
      const validEvents = events.filter((e) => ALL_WEBHOOK_EVENTS.includes(e));
      if (validEvents.length === 0) {
        return jsonError(c, 400, 'INVALID_EVENTS', 'Selecione ao menos um evento válido.');
      }
      const channelType =
        body.channelType === 'slack' || body.channelType === 'discord'
          ? body.channelType
          : 'generic';
      const created = await webhookEndpoints.createEndpoint({
        name,
        url,
        events: validEvents,
        enabled: body.enabled !== false,
        channelType,
        secret: body.secret ? String(body.secret) : undefined,
        headers:
          body.headers && typeof body.headers === 'object'
            ? (body.headers as Record<string, string>)
            : undefined,
      });
      return c.json(created, 201);
    },
  );

  app.put('/admin/webhooks/endpoints/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const events = Array.isArray(body.events)
      ? (body.events as WebhookEventType[]).filter((e) => ALL_WEBHOOK_EVENTS.includes(e))
      : undefined;
    const channelType =
      body.channelType === 'slack' ||
      body.channelType === 'discord' ||
      body.channelType === 'generic'
        ? body.channelType
        : undefined;
    const updated = await webhookEndpoints.updateEndpoint(id, {
      name: body.name ? String(body.name) : undefined,
      url: body.url ? String(body.url) : undefined,
      events,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      channelType,
      secret: body.secret !== undefined ? String(body.secret) : undefined,
      headers:
        body.headers && typeof body.headers === 'object'
          ? (body.headers as Record<string, string>)
          : undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Endpoint não encontrado.');
    return c.json(updated);
  });

  app.delete('/admin/webhooks/endpoints/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const ok = await webhookEndpoints.deleteEndpoint(c.req.param('id') as string);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Endpoint não encontrado.');
    return c.json({ ok: true });
  });

  app.post(
    '/admin/webhooks/endpoints/:id/test',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => c.json(await webhooksDispatcher.testEndpoint(c.req.param('id') as string)),
  );

  app.get('/admin/webhooks/deliveries', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '200');
    const endpointId = c.req.query('endpointId');
    const list = endpointId
      ? await webhookDeliveries.listByEndpoint(endpointId, Number.isFinite(limit) ? limit : 200)
      : await webhookDeliveries.listAll(Number.isFinite(limit) ? limit : 200);
    return c.json(list);
  });

  app.post(
    '/admin/webhooks/deliveries/:id/retry',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const d = await webhookDeliveries.findById(id);
      if (!d) return jsonError(c, 404, 'NOT_FOUND', 'Entrega não encontrada.');
      await webhookDeliveries.resetForRetry(id);
      // Tick imediato
      void webhooksDispatcher.tickWorker();
      return c.json({ ok: true });
    },
  );

  /**
   * CSV export do log de entregas (BOM UTF-8 + colunas amigáveis).
   * Aceita ?endpointId= e ?limit= (default 1000, max 5000).
   */
  app.get(
    '/admin/webhooks/deliveries/export.csv',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const limit = Math.max(1, Math.min(Number(c.req.query('limit') ?? '1000'), 5000));
      const endpointId = c.req.query('endpointId');
      const list = endpointId
        ? await webhookDeliveries.listByEndpoint(endpointId, limit)
        : await webhookDeliveries.listAll(limit);

      const csv = buildCsv(list, [
        { key: 'id', label: 'id' },
        { key: 'endpointId', label: 'endpoint_id' },
        { key: 'event', label: 'event' },
        { key: 'status', label: 'status' },
        { key: 'attempts', label: 'attempts' },
        { key: 'createdAt', label: 'created_at' },
        { key: 'updatedAt', label: 'updated_at' },
        {
          key: 'completedAt',
          label: 'completed_at',
          map: (d) => d.completedAt ?? '',
        },
        {
          key: 'lastResponseStatus',
          label: 'last_status',
          map: (d) => d.lastResponseStatus ?? '',
        },
        {
          key: 'lastError',
          label: 'last_error',
          map: (d) => (d.lastError ?? '').slice(0, 500),
        },
        {
          key: 'payload',
          label: 'payload_keys',
          map: (d) => Object.keys(d.payload).join('|'),
        },
      ]);
      const date = new Date().toISOString().slice(0, 10);
      return csvResponse(csv, `webhook-deliveries-${date}.csv`);
    },
  );

  // ---------- Coupons (admin CRUD + validação pública) ----------

  app.get('/admin/coupons', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await couponsRepo.listAll()),
  );

  app.post('/admin/coupons', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createCouponSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    try {
      const created = await couponsRepo.createCoupon(v.data);
      return c.json(created, 201);
    } catch (err) {
      return jsonError(
        c,
        409,
        'CONFLICT',
        err instanceof Error ? err.message : 'Erro ao criar cupom.',
      );
    }
  });

  app.put('/admin/coupons/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateCouponSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await couponsRepo.updateCoupon(id, v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Cupom não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/coupons/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await couponsRepo.deleteCoupon(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Cupom não encontrado');
    return c.json({ ok: true });
  });

  app.post(
    '/admin/coupons/bulk',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 5 }),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        const r = await couponsRepo.createCouponsBulk({
          count: Number(body.count ?? 0),
          prefix: typeof body.prefix === 'string' ? body.prefix : undefined,
          sequential: body.sequential === true,
          randomLength: typeof body.randomLength === 'number' ? body.randomLength : 8,
          description: typeof body.description === 'string' ? body.description : undefined,
          discount: body.discount as never,
          appliesToProductIds: Array.isArray(body.appliesToProductIds)
            ? (body.appliesToProductIds as string[])
            : undefined,
          maxUsesPerCoupon:
            body.maxUsesPerCoupon === null
              ? null
              : typeof body.maxUsesPerCoupon === 'number'
                ? body.maxUsesPerCoupon
                : null,
          validFrom: typeof body.validFrom === 'string' ? body.validFrom : null,
          validUntil: typeof body.validUntil === 'string' ? body.validUntil : null,
        });
        return c.json({
          createdCount: r.created.length,
          skippedCount: r.skipped.length,
          created: r.created,
          skipped: r.skipped,
        });
      } catch (err) {
        return jsonError(
          c,
          400,
          'INVALID_INPUT',
          err instanceof Error ? err.message : 'Erro ao gerar cupons.',
        );
      }
    },
  );

  app.get('/admin/coupons/export', requireAuth('admin', 'superadmin'), async () => {
    const csv = await couponsRepo.exportCouponsAsCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cupons-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });

  // Aluno consulta validade de um cupom para um produto antes do checkout
  app.get('/coupons/check', requireAuth(), async (c) => {
    const code = c.req.query('code') ?? '';
    const productId = c.req.query('productId') ?? '';
    if (!code || !productId)
      return jsonError(c, 400, 'INVALID_INPUT', 'code e productId obrigatórios');
    const product = await productsRepo.findById(productId);
    if (!product || !product.active) {
      return jsonError(c, 404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado');
    }
    const coupon = await couponsRepo.findByCode(code);
    const result = couponsRepo.validateCoupon(coupon, productId, product.priceCents);
    if (!result.ok) return jsonError(c, 400, 'COUPON_INVALID', result.reason);
    return c.json({
      ok: true,
      discountCents: result.discountCents,
      finalAmountCents: product.priceCents - result.discountCents,
      coupon: { code: coupon!.code, description: coupon!.description, discount: coupon!.discount },
    });
  });

  // ---------- Checkout (cria order + chama provider) ----------

  app.post(
    '/payments/checkout',
    requireAuth(),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
      const u = c.get('user')!;
      const body = await c.req.json().catch(() => ({}));
      const v = validate(checkoutSchema, body);
      if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());

      const product = await productsRepo.findById(v.data.productId);
      if (!product || !product.active) {
        return jsonError(c, 404, 'PRODUCT_NOT_FOUND', 'Produto inexistente ou inativo.');
      }

      // Seleciona gateway: explícito > qualquer ativo (1º)
      let gw = null;
      if (v.data.gatewayId) {
        gw = await gatewaysRepo.findById(v.data.gatewayId);
        if (!gw || !gw.active) {
          return jsonError(c, 400, 'GATEWAY_INACTIVE', 'Gateway selecionado inativo.');
        }
      } else {
        const actives = await gatewaysRepo.listActive();
        gw = actives[0] ?? null;
      }
      if (!gw) {
        return jsonError(
          c,
          400,
          'NO_ACTIVE_GATEWAY',
          'Nenhum gateway de pagamento ativo configurado.',
        );
      }

      const provider = getPaymentProvider(gw.provider);
      if (!provider) {
        return jsonError(
          c,
          501,
          'PROVIDER_NOT_IMPLEMENTED',
          `Provider ${gw.provider} ainda não tem implementação. Use o sandbox 'mock' ou aguarde Sprint 4.`,
        );
      }

      const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
      if (!creds) return jsonError(c, 500, 'INTERNAL', 'Falha ao ler credenciais do gateway.');

      // Aplica cupom se informado
      let amountCents = product.priceCents;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let discountCents = 0;
      if (v.data.couponCode) {
        const coupon = await couponsRepo.findByCode(v.data.couponCode);
        const valid = couponsRepo.validateCoupon(coupon, product.id, amountCents);
        if (!valid.ok) {
          return jsonError(c, 400, 'COUPON_INVALID', valid.reason);
        }
        discountCents = valid.discountCents;
        amountCents = product.priceCents - discountCents;
        appliedCouponId = coupon!.id;
        appliedCouponCode = coupon!.code;
      }

      // Cria order primeiro pra ter o id no metadata
      const order = await ordersRepo.createOrder({
        userId: u.sub,
        userEmail: u.email,
        productId: product.id,
        productSnapshot: {
          name: product.name,
          priceCents: product.priceCents,
          currency: product.currency,
          kind: product.kind,
          refId: product.refId,
        },
        gatewayId: gw.id,
        gatewayProvider: gw.provider,
        amountCents,
        currency: product.currency,
      });

      try {
        const result = await provider.createPayment(gw, creds, {
          amountCents,
          currency: product.currency,
          description:
            discountCents > 0 ? `${product.name} (cupom ${appliedCouponCode})` : product.name,
          customerEmail: u.email,
          metadata: { orderId: order.id, userId: u.sub },
        });
        const updated = await ordersRepo.attachGatewayResult(order.id, {
          externalId: result.externalId,
          checkoutUrl: result.checkoutUrl,
          qrCode: result.qrCode,
          status: result.status,
        });
        if (appliedCouponId) {
          await ordersRepo.updateStatus(
            order.id,
            updated?.status ?? 'pending',
            `couponId=${appliedCouponId} discount=${discountCents}`,
          );
        }
        return c.json(updated, 201);
      } catch (err) {
        await ordersRepo.updateStatus(
          order.id,
          'failed',
          err instanceof Error ? err.message : 'Erro do provider',
        );
        return jsonError(
          c,
          502,
          'GATEWAY_FAILED',
          err instanceof Error ? err.message : 'Falha ao criar checkout no gateway.',
        );
      }
    },
  );

  // ---------- Checkout PÚBLICO (visitante não logado; provisiona conta) ----------
  // Fluxo do site público de vendas: cria/recupera a conta pelo e-mail, cria o
  // pedido e devolve a checkoutUrl do gateway (padrão hospedado, sem PCI local).
  // O webhook existente confirma → grantAccessForOrder matricula. Conta nova
  // recebe e-mail para definir senha.
  app.post('/public/checkout', rateLimit({ windowMs: 60_000, max: 8 }), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(publicCheckoutSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());

    const courses = await coursesRepo.listCourses();
    // Mesmo portão do catálogo: curso fora da vitrine não pode ser comprado por
    // quem descobriu o slug. Não basta `active` — ver isPubliclyListed().
    const course = courses.find(
      (co) =>
        (co.slug ?? String(co.id)) === v.data.courseSlug &&
        isPubliclyListed(co as unknown as Record<string, unknown>),
    );
    if (!course) return jsonError(c, 404, 'COURSE_NOT_FOUND', 'Curso não encontrado.');

    const product = await productsRepo.findByCourseId(course.id);
    if (!product || !product.active) {
      return jsonError(
        c,
        409,
        'NOT_FOR_SALE',
        'Este curso ainda não está disponível para compra online. Fale com a gente pelo WhatsApp.',
      );
    }

    // Provisiona / recupera a conta pelo e-mail (role student).
    const email = v.data.email.toLowerCase().trim();
    let user = await usersStore.findUserByEmail(email);
    let isNewAccount = false;
    if (!user) {
      const pw = crypto.randomBytes(24).toString('hex');
      await usersStore.createUser({
        email,
        name: v.data.name,
        role: 'student',
        password: pw,
        active: true,
        document: v.data.document || null,
      });
      user = await usersStore.findUserByEmail(email);
      isNewAccount = true;
    }
    if (!user || !user.active) {
      return jsonError(c, 500, 'PROVISION_FAILED', 'Não foi possível preparar a matrícula.');
    }

    // Gateway: explícito > primeiro ativo.
    const gw = v.data.gatewayId
      ? await gatewaysRepo.findById(v.data.gatewayId)
      : ((await gatewaysRepo.listActive())[0] ?? null);
    if (!gw || !gw.active) {
      return jsonError(c, 400, 'NO_ACTIVE_GATEWAY', 'Pagamento indisponível no momento.');
    }
    const provider = getPaymentProvider(gw.provider);
    if (!provider) return jsonError(c, 501, 'NOT_IMPLEMENTED', 'Provider indisponível.');
    const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
    if (!creds) return jsonError(c, 400, 'GATEWAY_MISCONFIGURED', 'Gateway sem credenciais.');

    const order = await ordersRepo.createOrder({
      userId: user.id,
      userEmail: user.email,
      productId: product.id,
      productSnapshot: {
        name: product.name,
        priceCents: product.priceCents,
        currency: product.currency,
        kind: product.kind,
        refId: product.refId,
      },
      gatewayId: gw.id,
      gatewayProvider: gw.provider,
      amountCents: product.priceCents,
      currency: product.currency,
    });

    try {
      const result = await provider.createPayment(gw, creds, {
        amountCents: product.priceCents,
        currency: product.currency,
        description: product.name,
        customerEmail: user.email,
        metadata: { orderId: order.id, userId: user.id, source: 'public' },
      });
      const updated = await ordersRepo.attachGatewayResult(order.id, {
        externalId: result.externalId,
        checkoutUrl: result.checkoutUrl,
        qrCode: result.qrCode,
        status: result.status,
      });
      // Conta nova: e-mail para definir senha (best-effort).
      if (isNewAccount) {
        try {
          const token = await createResetToken(user.id, user.email);
          const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
          const resetUrl = `${base}/redefinir-senha?token=${encodeURIComponent(token.token)}`;
          const tpl = renderPasswordReset({ userName: user.name, resetUrl, expiresInMinutes: 60 });
          void sendSafe({
            to: { email: user.email, name: user.name },
            subject: 'Bem-vindo(a) à PCO — defina sua senha de acesso',
            html: tpl.html,
            text: tpl.text,
            tag: 'welcome_checkout',
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[public-checkout welcome email]', err);
        }
      }
      return c.json(
        {
          checkoutUrl: updated?.checkoutUrl ?? result.checkoutUrl,
          orderId: order.id,
          isNewAccount,
        },
        201,
      );
    } catch (err) {
      await ordersRepo.updateStatus(
        order.id,
        'failed',
        err instanceof Error ? err.message : 'Erro do provider',
      );
      return jsonError(c, 502, 'GATEWAY_FAILED', 'Falha ao iniciar o pagamento. Tente novamente.');
    }
  });

  // ---------- Webhook (público; cada gateway tem URL própria) ----------

  app.post('/payments/webhook/:gatewayId', rateLimit({ windowMs: 60_000, max: 60 }), async (c) => {
    const gatewayId = c.req.param('gatewayId') as string;
    const gw = await gatewaysRepo.findById(gatewayId);
    if (!gw) return jsonError(c, 404, 'NOT_FOUND', 'Gateway não encontrado.');

    const provider = getPaymentProvider(gw.provider);
    if (!provider) return jsonError(c, 501, 'NOT_IMPLEMENTED', 'Provider não implementado.');

    const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
    if (!creds) return jsonError(c, 500, 'INTERNAL', 'Falha ao ler credenciais.');

    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.req.header())) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }

    let event;
    try {
      event = await provider.parseWebhook(gw, creds, rawBody, headers);
    } catch (err) {
      await recordError(c, err, 400);
      return jsonError(c, 400, 'WEBHOOK_INVALID', 'Webhook inválido.');
    }
    if (!event) {
      return jsonError(c, 400, 'WEBHOOK_INVALID', 'Não foi possível interpretar o webhook.');
    }

    // Localiza order pelo externalId
    const order = await ordersRepo.findByExternalId(event.externalId);
    if (!order) {
      // Webhook duplicado / unknown — aceita 200 para não retentar indefinidamente
      return c.json({ ok: true, ignored: true, reason: 'order-not-found' });
    }

    // Idempotência: se já paid, não duplica grant
    if (order.status === 'paid' && event.status === 'paid') {
      return c.json({ ok: true, ignored: true, reason: 'already-paid' });
    }

    const updated = await ordersRepo.updateStatus(
      order.id,
      event.status,
      `Webhook do gateway ${gw.provider}`,
    );

    // Liberação de acesso quando paga
    if (event.status === 'paid' && updated) {
      // Incrementa uso do cupom (se aplicado)
      try {
        const couponEvent = updated.events.find((e) => e.note?.includes('couponId='));
        const match = couponEvent?.note?.match(/couponId=(\S+)/);
        if (match) {
          await couponsRepo.incrementUsage(match[1]!);
        }
      } catch (err) {
        console.error('[coupon increment]', err);
      }
      try {
        await grantAccessForOrder(updated);
        await notificationsRepo.createOne({
          userId: updated.userId,
          title: '✅ Pagamento confirmado',
          body: `Sua compra de "${updated.productSnapshot.name}" foi aprovada e o acesso foi liberado.`,
          category: 'success',
          link:
            updated.productSnapshot.kind === 'course'
              ? `/curso/${updated.productSnapshot.refId ?? ''}`
              : updated.productSnapshot.kind === 'session_pack'
                ? '/analise-supervisao'
                : '/perfil',
          authorEmail: 'sistema',
        });
      } catch (err) {
        console.error('[grantAccessForOrder] erro:', err);
      }
      // E-mail de confirmação (best-effort)
      try {
        const buyer = await usersStore.findUserById(updated.userId);
        if (buyer) {
          const amount = (updated.amountCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: updated.currency || 'BRL',
          });
          const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
          const tpl = renderOrderPaid({
            userName: buyer.name,
            productName: updated.productSnapshot.name,
            amountFormatted: amount,
            orderUrl: `${base}/pedidos`,
          });
          void sendSafe({
            to: { email: buyer.email, name: buyer.name },
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            tag: 'order_paid',
            metadata: { orderId: updated.id },
          });
        }
      } catch (err) {
        console.error('[order paid email]', err);
      }
      // Webhook outbound — order.paid
      void webhooksDispatcher.emit('order.paid', {
        orderId: updated.id,
        userId: updated.userId,
        userEmail: updated.userEmail,
        productId: updated.productId,
        productName: updated.productSnapshot.name,
        amountCents: updated.amountCents,
        currency: updated.currency,
        paidAt: updated.paidAt,
      });
    } else if (event.status === 'canceled' && updated) {
      void webhooksDispatcher.emit('order.canceled', {
        orderId: updated.id,
        userId: updated.userId,
      });
    } else if (event.status === 'refunded' && updated) {
      void webhooksDispatcher.emit('order.refunded', {
        orderId: updated.id,
        userId: updated.userId,
        amountCents: updated.amountCents,
      });
    } else if (event.status === 'failed' && updated) {
      void webhooksDispatcher.emit('payment.failed', {
        orderId: updated.id,
        userId: updated.userId,
        amountCents: updated.amountCents,
        provider: gw.provider,
        externalId: updated.externalId,
        reason: event.metadata?.reason ?? null,
      });
    }

    return c.json({ ok: true });
  });

  // ---------- Stats agregadas (admin) ----------

  app.get('/admin/stats/tutor-usage', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '30');
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 90)) : 30;
    const stats = await tutorHistory.usageStats(safeDays);
    // Enriquece topUsers com email do user
    const allUsers = await usersStore.listUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, { email: u.email, name: u.name }]));
    const topUsers = stats.topUsers.map((tu) => ({
      ...tu,
      email: userMap.get(tu.userId)?.email ?? null,
      name: userMap.get(tu.userId)?.name ?? null,
    }));
    return c.json({ ...stats, days: safeDays, topUsers });
  });

  app.get('/admin/stats/audit', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '7');
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 30)) : 7;
    const series = await auditByDay(safeDays);
    const total = series.reduce((s, d) => s + d.total, 0);
    return c.json({ days: safeDays, total, series });
  });

  app.get('/admin/stats/errors', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '7');
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 30)) : 7;
    const series = await errorsByDay(safeDays);
    const total = series.reduce((s, d) => s + d.total, 0);
    const totalClient = series.reduce((s, d) => s + d.client, 0);
    return c.json({ days: safeDays, total, totalClient, totalServer: total - totalClient, series });
  });

  app.get('/admin/stats/completions', requireAuth('admin', 'superadmin'), async (c) => {
    const days = Number(c.req.query('days') ?? '7');
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 90)) : 7;
    const series = await progressRepo.completionsByDay(safeDays);
    const total = series.reduce((s, d) => s + d.count, 0);
    return c.json({ days: safeDays, total, series });
  });

  // ---------- Audit log ----------

  app.get('/admin/audit-log.csv', requireAuth('admin', 'superadmin'), async (c) => {
    const q = c.req.query();
    const limit = q.limit ? Number(q.limit) : 1000;
    const entries = await listAudit({
      action: q.action,
      actorId: q.actorId,
      targetType: q.targetType,
      targetId: q.targetId,
      since: q.since,
      until: q.until,
      limit: typeof limit === 'number' && Number.isFinite(limit) ? limit : 1000,
    });
    function esc(v: unknown): string {
      const s = v === null || v === undefined ? '' : String(v);
      // RFC 4180: aspa dupla escapada como ""
      return `"${s.replace(/"/g, '""')}"`;
    }
    const header = [
      'id',
      'ts',
      'actorId',
      'actorEmail',
      'actorRole',
      'action',
      'targetType',
      'targetId',
      'status',
      'ip',
      'userAgent',
    ];
    const rows = [
      header.join(','),
      ...entries.map((e) =>
        [
          e.id,
          e.ts,
          e.actorId,
          e.actorEmail,
          e.actorRole,
          e.action,
          e.targetType,
          e.targetId,
          e.status,
          e.ip,
          e.userAgent,
        ]
          .map(esc)
          .join(','),
      ),
    ].join('\r\n');
    return new Response(rows, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  });

  app.get('/admin/audit-log', requireAuth('admin', 'superadmin'), async (c) => {
    const q = c.req.query();
    const limit = q.limit ? Number(q.limit) : undefined;
    const entries = await listAudit({
      action: q.action,
      actorId: q.actorId,
      targetType: q.targetType,
      targetId: q.targetId,
      since: q.since,
      until: q.until,
      limit: typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined,
    });
    return c.json(entries);
  });

  // 404 catch-all
  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Rota inexistente'));

  // Erro não tratado — também grava em data/errors.json
  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    void recordError(c, err, 500);
    return jsonError(c, 500, 'INTERNAL', 'Erro interno');
  });

  return app;
}
