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
import {
  canImpersonate,
  startImpersonation,
  exitImpersonation,
} from './auth/impersonation';
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
  updateCourseSchema,
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
  createCouponSchema,
  updateCouponSchema,
} from '../shared/schemas';
import { rateLimit } from './rate-limit';
import * as rateLimitTelemetry from './rate-limit';
import { jsonError, validate } from './http';
import { getProvider, listProviders, calculateCost } from './ai/providers';
import * as aiConfigRepo from './repositories/ai-configs';
import * as supportRepo from './repositories/support';
import * as coursesRepo from './repositories/courses';
import * as newsRepo from './repositories/news';
import * as podcastsRepo from './repositories/podcasts';
import * as libraryRepo from './repositories/library';
import * as certsRepo from './repositories/certificates';
import * as retentionRepo from './repositories/retention';
import * as sessionsRepo from './repositories/sessions';
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
import {
  exportJobAsCsv,
  exportJobAsJson,
  listJobsFiltered,
} from './imports/reports';
import { rollbackJob, previewRollback } from './imports/rollback';
import * as importConnections from './imports/connections-store';
import * as importSchedules from './imports/schedules-store';
import { pingWp, diagnoseWp } from './imports/connectors/wp';
import { pingWc } from './imports/connectors/wc';
import { pingLd } from './imports/connectors/ld';
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
import * as welcome from './notifications/welcome';
import * as wishlistStore from './activity/wishlist-store';
import { buildLeaderboard, getUserRank } from './activity/leaderboard';
import * as liveSessions from './live-sessions/store';
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
import * as webhookDeliveries from './webhooks/delivery-store';
import * as webhooksDispatcher from './webhooks/dispatcher';
import { ALL_WEBHOOK_EVENTS, type WebhookEventType } from './webhooks/types';
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

/**
 * Libera acesso do usuário ao produto pago.
 * - course: enroll no curso (adiciona ao enrolledCourseIds do estudante)
 * - session_pack/tutor_pack: registra em metadata para uso futuro (sprint subsequente)
 */
function renderUnsubPage(
  kind: 'ok' | 'error',
  title: string,
  message: string,
): string {
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
  app.post(
    '/auth/login/totp',
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) => {
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
    },
  );

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
  app.post('/auth/me/totp/enable', requireAuth(), blockDuringImpersonation('user.totp.enable'), async (c) => {
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
  });

  // Disable TOTP — exige código atual para evitar lockout indireto.
  app.post('/auth/me/totp/disable', requireAuth(), blockDuringImpersonation('user.totp.disable'), async (c) => {
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
  });

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
      // Para aluno, devolve o perfil acadêmico ligado, mas com nome/email/avatar do user
      const s = await studentsRepo.getCurrentStudent();
      return c.json({
        ...s,
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
      const token = createResetToken(u.id, u.email);
      // eslint-disable-next-line no-console
      console.log(`[forgot-password] reset token para ${u.email}: ${token.token}`);
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
    const tokenEntry = consumeResetToken(v.data.token);
    if (!tokenEntry) {
      return jsonError(c, 400, 'INVALID_TOKEN', 'Token inválido ou expirado.');
    }
    const ok = await usersStore.changePassword(tokenEntry.userId, v.data.password);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
    return c.json({ ok: true, email: tokenEntry.email });
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
  app.post('/auth/me/password', requireAuth(), blockDuringImpersonation('user.password.change'), async (c) => {
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
  });

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

    return c.json({
      completedLessonIds: list.map((p) => p.lessonId),
      byCourse,
      streakDays: streak,
      lastCompletedAt: list[0]?.completedAt ?? null,
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
              cert.studentId === u.sub &&
              cert.courseId === courseId &&
              cert.status === 'issued',
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
      { course: { id: string; title: string }; module: { id: string; title: string }; lesson: { id: string; title: string } }
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
        const m = c.modules.find((mod) =>
          mod.lessons.some((l) => l.id === n.lessonId),
        );
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

  app.get(
    '/admin/lessons/:id/watch-stats',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await watchTimeRepo.aggregateLesson(c.req.param('id') as string)),
  );

  app.get(
    '/admin/courses/:id/watch-stats',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await watchTimeRepo.aggregateCourse(c.req.param('id') as string)),
  );

  /**
   * Analytics consolidado por curso: matriculados + completion + watch-time + rating.
   */
  app.get(
    '/admin/courses/:id/analytics',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const courseId = c.req.param('id') as string;
      const course = await coursesRepo.findCourse(courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');

      const allLessons = (course.modules ?? []).flatMap((m) => m.lessons ?? []);
      const totalLessonsInCourse = allLessons.length;

      // Matriculados
      const allStudents = await studentsRepo.listAdminStudents({ limit: 5000 } as never);
      const enrolled = allStudents.filter((s) =>
        (s.enrolledCourseIds ?? []).includes(courseId),
      );

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
    },
  );

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
        return jsonError(
          c,
          409,
          'CONFLICT',
          err instanceof Error ? err.message : 'Erro',
        );
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
    const used = await aiConfigRepo.countUsageInWindow(
      config.id,
      u.sub,
      30 * 24 * 60 * 60 * 1000,
    );
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
    const list = await tutorHistory.listForUser(
      u.sub,
      Number.isFinite(limit) ? limit : 50,
    );
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
    const list = await notificationsRepo.listSentBroadcasts(
      Number.isFinite(limit) ? limit : 50,
    );
    return c.json(list);
  });

  // Broadcast — admin/superadmin
  app.post(
    '/admin/notifications/broadcast',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const v = validate(broadcastNotificationSchema, body);
      if (!v.ok)
        return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
      const u = c.get('user')!;
      const sent = await notificationsRepo.broadcast({
        ...v.data,
        authorEmail: u.email,
      });
      return c.json({ ok: true, sent });
    },
  );

  // ---------- Courses ----------

  app.get('/courses', async (c) => c.json(await coursesRepo.listCourses()));
  app.get('/courses/:id', async (c) => {
    const course = await coursesRepo.findCourse(c.req.param('id'));
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(course);
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

  app.get('/certificates', async (c) =>
    c.json(await certsRepo.listCertificatesForStudent(currentStudent.id)),
  );

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
  app.post(
    '/admin/certificates',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const studentId = typeof body.studentId === 'string' ? body.studentId : '';
      const courseId = typeof body.courseId === 'string' ? body.courseId : '';
      if (!studentId || !courseId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'studentId e courseId são obrigatórios.');
      }
      const cert = await certsRepo.issueCertificate({ studentId, courseId });
      return c.json(cert, 201);
    },
  );

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

  // ---------- Sessions / Professionals ----------

  app.get('/sessions/services', async (c) => c.json(await sessionsRepo.listSessionServices()));
  app.get('/sessions/professionals', async (c) => c.json(await sessionsRepo.listProfessionals()));

  // ---------- SEO / Metrics ----------

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

  app.get('/admin/ai/configurations/:id', async (c) => {
    const cfg = await aiConfigRepo.getConfig(c.req.param('id'));
    if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    const usage = await aiConfigRepo.aggregateUsage(cfg.id);
    return c.json({ ...aiConfigRepo.toPublic(cfg), usage });
  });

  app.put('/admin/ai/configurations/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateAiConfigSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await aiConfigRepo.updateConfig(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    return c.json(aiConfigRepo.toPublic(updated));
  });

  // Test connection com a chave fornecida (não persiste).
  app.post('/admin/ai/test', async (c) => {
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

    const studentId = currentStudent.id;
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

  app.get('/support/tickets', async (c) => {
    const u = c.get('user');
    const id = u?.sub ?? currentStudent.id;
    return c.json(await supportRepo.listTicketsForStudent(id));
  });
  app.post('/support/tickets', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createSupportTicketSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const u = c.get('user');
    const id = u?.sub ?? currentStudent.id;
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

  app.get(
    '/admin/users/:id/timeline',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

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
  app.get(
    '/admin/students/export.csv',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const filtersResult = studentsFilterSchema.safeParse({
        search: c.req.query('search'),
        status: c.req.query('status'),
        courseId: c.req.query('courseId'),
        sortBy: c.req.query('sortBy'),
      });
      const filters = filtersResult.success ? filtersResult.data : {};
      const list = await studentsRepo.listAdminStudents(filters);
      const rows: string[] = [];
      rows.push(
        'id,name,email,status,risk_score,enrolled_courses,last_access_at,created_at',
      );
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
    },
  );

  app.get('/admin/students/:id', async (c) => {
    const s = await studentsRepo.findAdminStudent(c.req.param('id'));
    if (!s) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(s);
  });

  // ---------- Recovery plan ----------

  app.post('/admin/recovery-plan', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(recoveryPlanSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const message = `Plano gerado (mock) com tom ${v.data.tone}, canal ${v.data.channel}, intensidade ${v.data.intensity}.`;
    return c.json({
      message,
      plan: {
        ...v.data,
        message,
        weeklyGoalMinutes: 120,
        status: 'draft',
      },
    });
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
      const totalLessons = course.modules.reduce(
        (s, m) => s + m.lessons.length,
        0,
      );
      if (totalLessons === 0) {
        return jsonError(c, 400, 'NO_LESSONS', 'Curso sem aulas.');
      }
      const allStudents = await studentsRepo.listAdminStudents({
        limit: 5000,
      } as never);
      const enrolled = allStudents.filter((s) =>
        (s.enrolledCourseIds ?? []).includes(courseId),
      );
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
          await certsRepo.issueCertificate({ studentId: s.id, courseId });
          issued++;
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
  app.get(
    '/admin/courses-summary',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const courses = await coursesRepo.listCourses();
      const allStudents = await studentsRepo.listAdminStudents({
        limit: 5000,
      } as never);
      const allProgress = await progressRepo.listAll();
      const out = courses.map((course) => {
        const totalLessons = course.modules.reduce(
          (s, m) => s + m.lessons.length,
          0,
        );
        const enrolled = allStudents.filter((s) =>
          (s.enrolledCourseIds ?? []).includes(course.id),
        );
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
          rates.length > 0
            ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)
            : 0;
        const completed = rates.filter((r) => r >= 1).length;
        return {
          courseId: course.id,
          enrolledCount: enrolled.length,
          completedCount: completed,
          avgProgressPct: avgPct,
        };
      });
      return c.json(out);
    },
  );

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
        ? (body.studentIds as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [];
      if (ids.length === 0) {
        return jsonError(c, 400, 'INVALID_INPUT', 'studentIds vazio.');
      }
      if (ids.length > 500) {
        return jsonError(c, 400, 'TOO_MANY', 'Máximo 500 por chamada.');
      }
      let enrolled = 0;
      let already = 0;
      const errors: Array<{ studentId: string; message: string }> = [];
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
          await studentsRepo.enrollInCourse(studentId, courseId);
          enrolled++;
        } catch (err) {
          errors.push({
            studentId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return c.json({ enrolled, alreadyEnrolled: already, errors });
    },
  );

  /** Lista alunos matriculados num curso com progresso individual. */
  app.get(
    '/admin/courses/:id/students',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const courseId = c.req.param('id') as string;
      const course = await coursesRepo.findCourse(courseId);
      if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado.');

      const allLessons = course.modules.flatMap((m) => m.lessons);
      const totalLessons = allLessons.length;

      const allStudents = await studentsRepo.listAdminStudents({
        limit: 5000,
      } as never);
      const enrolled = allStudents.filter((s) =>
        (s.enrolledCourseIds ?? []).includes(courseId),
      );

      const allProgress = await progressRepo.listAll();
      const progressByUser = new Map<
        string,
        { done: number; lastCompletedAt: string | null }
      >();
      for (const p of allProgress) {
        if (p.courseId !== courseId) continue;
        const cur = progressByUser.get(p.userId) ?? {
          done: 0,
          lastCompletedAt: null as string | null,
        };
        cur.done++;
        if (
          !cur.lastCompletedAt ||
          (p.completedAt && p.completedAt > cur.lastCompletedAt)
        ) {
          cur.lastCompletedAt = p.completedAt ?? null;
        }
        progressByUser.set(p.userId, cur);
      }

      const result = enrolled.map((s) => {
        const prog = progressByUser.get(s.id) ?? { done: 0, lastCompletedAt: null };
        const pct =
          totalLessons > 0 ? Math.round((prog.done / totalLessons) * 100) : 0;
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
    },
  );

  app.put('/admin/courses/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateCourseSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateCourse(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(updated);
  });

  // ---------- Admin: News writes ----------

  app.post('/admin/news', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createNewsSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await newsRepo.createNews(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/news/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateNewsSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await newsRepo.updateNews(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Artigo não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/news/:id', async (c) => {
    const ok = await newsRepo.deleteNews(c.req.param('id'));
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Artigo não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Library writes ----------

  app.post('/admin/library', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createLibrarySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await libraryRepo.createLibrary(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/library/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateLibrarySchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await libraryRepo.updateLibrary(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Material não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/library/:id', async (c) => {
    const ok = await libraryRepo.deleteLibrary(c.req.param('id'));
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Material não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Podcasts writes ----------

  app.post('/admin/podcasts', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createPodcastSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await podcastsRepo.createPodcast(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/podcasts/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updatePodcastSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await podcastsRepo.updatePodcast(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Episódio não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/podcasts/:id', async (c) => {
    const ok = await podcastsRepo.deletePodcast(c.req.param('id'));
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
        return jsonError(
          c,
          501,
          'NOT_SUPPORTED',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );

  // ---------- Admin: Modules ----------

  app.post('/admin/courses/:courseId/modules', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createModuleSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await coursesRepo.createModule(c.req.param('courseId'), v.data);
    if (!created) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(created, 201);
  });

  app.put('/admin/modules/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateModuleSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateModule(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/modules/:id', async (c) => {
    const ok = await coursesRepo.deleteModule(c.req.param('id'));
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Lessons ----------

  app.post('/admin/modules/:moduleId/lessons', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createLessonSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await coursesRepo.createLesson(c.req.param('moduleId'), v.data);
    if (!created) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(created, 201);
  });

  app.put('/admin/lessons/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateLessonSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateLesson(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada');
    return c.json(updated);
  });

  app.delete('/admin/lessons/:id', async (c) => {
    const ok = await coursesRepo.deleteLesson(c.req.param('id'));
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Aula não encontrada');
    return c.json({ ok: true });
  });

  // ---------- Admin: Student writes ----------

  app.post('/admin/students', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createStudentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await studentsRepo.createAdminStudent(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/students/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateStudentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await studentsRepo.updateAdminStudent(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.post('/admin/students/:id/block', async (c) => {
    const updated = await studentsRepo.setStudentStatus(c.req.param('id'), 'bloqueado');
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.post('/admin/students/:id/unblock', async (c) => {
    const updated = await studentsRepo.setStudentStatus(c.req.param('id'), 'ativo');
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.put('/admin/students/:id/status', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = studentStatusEnum.safeParse(body?.status);
    if (!parsed.success)
      return jsonError(c, 400, 'INVALID_INPUT', 'Status inválido', parsed.error.flatten());
    const updated = await studentsRepo.setStudentStatus(c.req.param('id'), parsed.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json(updated);
  });

  app.delete('/admin/students/:id', async (c) => {
    const ok = await studentsRepo.deleteAdminStudent(c.req.param('id'));
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Aluno não encontrado');
    return c.json({ ok: true });
  });

  // ---------- Admin: Assessments ----------

  app.post('/admin/modules/:moduleId/assessment', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createAssessmentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const result = await coursesRepo.upsertAssessment(c.req.param('moduleId'), v.data);
    if (!result) return jsonError(c, 404, 'NOT_FOUND', 'Módulo não encontrado');
    return c.json(result);
  });

  app.put('/admin/assessments/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateAssessmentSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = await coursesRepo.updateAssessment(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Avaliação não encontrada');
    return c.json(updated);
  });

  app.delete('/admin/assessments/:id', async (c) => {
    const ok = await coursesRepo.deleteAssessment(c.req.param('id'));
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
        body:
          'Sua conta foi criada. Acesse seu perfil para confirmar dados e, se receber uma senha temporária, troque-a no primeiro acesso.',
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

  app.put('/admin/users/:id/password', requireAuth('admin', 'superadmin'), blockDuringImpersonation('user.password.change'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(changePasswordSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const id = c.req.param('id') as string;
    const ok = await usersStore.changePassword(id, v.data.password);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
    return c.json({ ok: true });
  });

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
        u.active &&
        !!u.lastLoginAt &&
        new Date(u.lastLoginAt).getTime() >= cutoff,
    }));
    return c.json(result);
  });

  app.post(
    '/admin/users/:id/force-logout',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const tv = await usersStore.bumpTokenVersion(id);
      if (tv === null) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado.');
      return c.json({ ok: true, tokenVersion: tv });
    },
  );

  app.delete('/admin/users/:id', requireAuth('admin', 'superadmin'), blockDuringImpersonation('user.delete'), async (c) => {
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
  });

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

      const check = canImpersonate(
        { role: me.role },
        { role: target.role },
        Boolean(me.act),
      );
      if (!check.ok) return jsonError(c, 403, 'IMPERSONATION_DENIED', check.reason);

      const actor = await usersStore.findUserById(me.sub);
      if (!actor) return jsonError(c, 401, 'UNAUTHORIZED', 'Sessão inválida.');

      const result = await startImpersonation(actor, targetId);
      if (!result)
        return jsonError(c, 500, 'IMPERSONATION_FAILED', 'Falha ao gerar token.');

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
      return jsonError(
        c,
        409,
        'NOT_IMPERSONATING',
        'Você não está em sessão de impersonation.',
      );
    const newToken = await exitImpersonation(me);
    if (!newToken)
      return jsonError(c, 500, 'EXIT_FAILED', 'Falha ao restaurar sessão original.');

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
                console.error(
                  '[welcome email bulk]',
                  err instanceof Error ? err.message : err,
                ),
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

  app.post(
    '/client-errors',
    rateLimit({ windowMs: 60_000, max: 30 }),
    async (c) => {
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
    },
  );

  // ---------- Backup sob demanda (admin) ----------

  app.post('/admin/backups/run', requireAuth('admin', 'superadmin'), async (c) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { execFile } = await import('node:child_process');
      const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
      const backupsDir = path.join(dataDir, 'backups');
      await fs.mkdir(backupsDir, { recursive: true });
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
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
        execFile(
          'tar',
          ['-czf', filepath, '-C', dataDir, ...files],
          { timeout: 30_000 },
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
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
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const created = await gatewaysRepo.createGateway(v.data);
    return c.json(created, 201);
  });

  app.put('/admin/payments/gateways/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updatePaymentGatewaySchema, body);
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
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
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
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
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
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
        const updated = await ordersRepo.updateStatus(
          id,
          finalStatus,
          noteParts.join(' · '),
        );
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
      const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, '_');
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
    const dryRun =
      dryRunRaw === 'true' ? true : dryRunRaw === 'false' ? false : undefined;
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

  app.get(
    '/admin/imports/jobs/:id/export',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

  app.post(
    '/admin/imports/jobs/:id/cancel',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

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

      const rowsByEntity: Partial<
        Record<ImportEntityType, Array<Record<string, unknown>>>
      > = {};
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
          Number.isFinite(defaultDuration) && defaultDuration > 0
            ? defaultDuration
            : undefined,
        wcStatusMap: {},
      };

      const rowsByEntity: Partial<
        Record<ImportEntityType, Array<Record<string, unknown>>>
      > = {};
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
    return c.json(
      await reengagementCfg.listRecentSends(Number.isFinite(limit) ? limit : 200),
    );
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

  // ---------- Roles & Permissions (admin CRUD) ----------

  app.get('/admin/roles', requireAuth('admin', 'superadmin'), async (c) => {
    const roles = await rolesStore.listRoles();
    return c.json({ roles });
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
          const status =
            err.code === 'NOT_FOUND'
              ? 404
              : err.code === 'SYSTEM_ROLE'
                ? 403
                : 400;
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
          const status =
            err.code === 'NOT_FOUND'
              ? 404
              : err.code === 'SYSTEM_ROLE'
                ? 403
                : 400;
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

  app.post(
    '/admin/api-tokens/:id/revoke',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await apiTokens.revokeToken(c.req.param('id') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Token não encontrado.');
      return c.json({ ok: true });
    },
  );

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
    const headerOrigin = c.req.header('x-forwarded-proto') && c.req.header('host')
      ? `${c.req.header('x-forwarded-proto')}://${c.req.header('host')}`
      : undefined;
    const spec = buildOpenApiSpec({
      origin: queryOrigin ?? process.env.PUBLIC_ORIGIN ?? headerOrigin,
      version: AVA_VERSION,
    });
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(spec);
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
        lessonCount: (co.modules ?? []).reduce(
          (s, m) => s + (m.lessons ?? []).length,
          0,
        ),
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
    const recentEmails = eqlogs.filter(
      (l) => new Date(l.ts).getTime() >= cutoff24h,
    ).length;
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
  app.get(
    '/admin/students/:id/analytics',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

  app.get(
    '/admin/students/:id/achievements',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const list = await achievementsStore.listForUser(id);
      return c.json({
        catalog: achievementsStore.BADGES,
        awarded: list,
      });
    },
  );

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
    const claims = (await verifyToken(token).catch(() => null)) as
      | { sub: string; email: string; scope?: string }
      | null;
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
        renderUnsubPage(
          'error',
          'Falha',
          err instanceof Error ? err.message : 'Erro inesperado.',
        ),
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
        typeof body.receiveBroadcasts === 'boolean'
          ? body.receiveBroadcasts
          : undefined,
      receiveReengagement:
        typeof body.receiveReengagement === 'boolean'
          ? body.receiveReengagement
          : undefined,
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
      days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60_000).toISOString()
        : null;
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
        message: passwordChanged
          ? 'OK'
          : 'Recomendado: trocar senha do admin inicial',
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
        message:
          myUser?.totpEnabled === true
            ? '2FA ativo'
            : 'Sem 2FA — recomendado para admins',
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

  app.delete(
    '/admin/saved-searches/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const u = c.get('user')!;
      const ok = await savedSearches.deleteSearch(c.req.param('id') as string, u.sub);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Filtro não encontrado.');
      return c.json({ ok: true });
    },
  );

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
      const created = await liveSessions.createSession({
        title,
        description: body.description ? String(body.description) : undefined,
        courseId: body.courseId ? String(body.courseId) : null,
        hostName: body.hostName ? String(body.hostName) : undefined,
        joinUrl,
        startAt,
        durationMinutes: Math.floor(durationMinutes),
        audience,
      });
      return c.json(created, 201);
    },
  );

  app.put(
    '/admin/live-sessions/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const audience =
        body.audience === 'enrolled' || body.audience === 'all'
          ? body.audience
          : undefined;
      const status =
        body.status === 'scheduled' ||
        body.status === 'live' ||
        body.status === 'ended' ||
        body.status === 'canceled'
          ? body.status
          : undefined;
      const updated = await liveSessions.updateSession(c.req.param('id') as string, {
        title: body.title ? String(body.title) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        courseId:
          body.courseId !== undefined
            ? body.courseId
              ? String(body.courseId)
              : null
            : undefined,
        hostName: body.hostName !== undefined ? String(body.hostName) : undefined,
        joinUrl: body.joinUrl ? String(body.joinUrl) : undefined,
        startAt: body.startAt ? String(body.startAt) : undefined,
        durationMinutes:
          body.durationMinutes !== undefined ? Number(body.durationMinutes) : undefined,
        audience,
        status,
      });
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Sessão não encontrada.');
      return c.json(updated);
    },
  );

  app.delete(
    '/admin/live-sessions/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await liveSessions.deleteSession(c.req.param('id') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Sessão não encontrada.');
      return c.json({ ok: true });
    },
  );

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
      const parentId =
        typeof body.parentId === 'string' ? body.parentId : undefined;
      if (!text) return jsonError(c, 400, 'INVALID_INPUT', 'body é obrigatório');
      if (text.length > 3000) {
        return jsonError(c, 400, 'TOO_LONG', 'máx 3000 caracteres');
      }
      if (!courseId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'courseId é obrigatório');
      }

      // Aluno comum precisa estar matriculado nesse curso. Admin escapa.
      if (u.role === 'student') {
        const s = await studentsRepo.findAdminStudent(u.sub);
        if (!s || !(s.enrolledCourseIds ?? []).includes(courseId)) {
          return jsonError(c, 403, 'NOT_ENROLLED', 'Apenas matriculados comentam.');
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
      // Verifica matrícula
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
  app.get(
    '/admin/achievements/stats',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

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
    const [
      healthSnap,
      deletionPending,
      ticketsAll,
      hiddenComments,
      failedJobs,
      failedDeliveries,
    ] = await Promise.all([
      buildHealthSnapshot(),
      deletionRequests
        .listAll()
        .then((all) => all.filter((r) => r.status === 'pending')),
      supportRepo
        .listAllTickets()
        .then((all) => all.filter((t) => t.status === 'open')),
      discussions.listAll({ hidden: true, limit: 20 }),
      importJobs
        .listJobs(50)
        .then((all) => all.filter((j) => j.status === 'failed')),
      webhookDeliveries
        .listAll(100)
        .then((all) => all.filter((d) => d.status === 'failed')),
    ]);
    const issues = healthSnap.checks.filter(
      (c) => c.status === 'warn' || c.status === 'error',
    );
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
    const issues = snap.checks.filter(
      (c) => c.status === 'warn' || c.status === 'error',
    );
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
      return jsonError(
        c,
        500,
        'INTERNAL',
        err instanceof Error ? err.message : 'erro',
      );
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
  app.get(
    '/admin/leaderboard/export.csv',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

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

  app.get(
    '/admin/wishlist/aggregate',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await wishlistStore.aggregateByCourse()),
  );

  app.get(
    '/admin/wishlist/export.csv',
    requireAuth('admin', 'superadmin'),
    async () => {
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
    },
  );

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

  app.get(
    '/admin/students/:id/notes',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await adminNotes.listForStudent(c.req.param('id') as string)),
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
    return csvResponse(
      csv,
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
    );
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
    return csvResponse(
      csv,
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
    );
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
        lessonCount: (co.modules ?? []).reduce(
          (s, m) => s + (m.lessons ?? []).length,
          0,
        ),
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
    return csvResponse(
      csv,
      `courses-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  });

  // ---------- Settings backup / restore ----------

  app.get(
    '/admin/settings/backup',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const data = await settingsBackup.exportBackup();
      const filename = `ava-pco-backup-${data.createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    },
  );

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

  app.get(
    '/admin/imports/connections',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await importConnections.listConnections()),
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
        wcConsumerSecret: body.wcConsumerSecret
          ? String(body.wcConsumerSecret)
          : undefined,
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

  app.put(
    '/admin/imports/connections/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const updated = await importConnections.updateConnection(id, {
        name: body.name ? String(body.name) : undefined,
        siteUrl: body.siteUrl ? String(body.siteUrl) : undefined,
        wpUsername: body.wpUsername !== undefined ? String(body.wpUsername) : undefined,
        wpAppPassword:
          body.wpAppPassword !== undefined ? String(body.wpAppPassword) : undefined,
        wcConsumerKey:
          body.wcConsumerKey !== undefined ? String(body.wcConsumerKey) : undefined,
        wcConsumerSecret:
          body.wcConsumerSecret !== undefined
            ? String(body.wcConsumerSecret)
            : undefined,
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
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      return c.json(updated);
    },
  );

  app.delete(
    '/admin/imports/connections/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const ok = await importConnections.deleteConnection(id);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      return c.json({ ok: true });
    },
  );

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
        conflictStrategy:
          body.enrollment?.conflictStrategy ?? conn.defaultConflictStrategy,
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

  app.get(
    '/admin/imports/schedules',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await importSchedules.listSchedules()),
  );

  app.post(
    '/admin/imports/schedules',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const name = String(body.name ?? '').trim();
      const connectionId = String(body.connectionId ?? '').trim();
      if (!name || !connectionId) {
        return jsonError(c, 400, 'INVALID_INPUT', 'name e connectionId obrigatórios.');
      }
      const conn = await importConnections.getConnection(connectionId);
      if (!conn) return jsonError(c, 404, 'NOT_FOUND', 'Conexão não encontrada.');
      const frequency = (body.frequency === 'weekly' ? 'weekly' : 'daily') as
        | 'daily'
        | 'weekly';
      const created = await importSchedules.createSchedule({
        name,
        connectionId,
        enabled: body.enabled !== false,
        frequency,
        hourUtc: Number(body.hourUtc ?? 3),
        minute: Number(body.minute ?? 0),
        weekday: body.weekday !== undefined ? (Number(body.weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6) : undefined,
        entities: Array.isArray(body.entities) ? (body.entities as ImportEntityType[]) : [],
        dryRun: body.dryRun !== false,
        enrollment: body.enrollment as Record<string, unknown> | undefined as never,
      });
      return c.json(created, 201);
    },
  );

  app.put(
    '/admin/imports/schedules/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const updated = await importSchedules.updateSchedule(id, body as never);
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Schedule não encontrado.');
      return c.json(updated);
    },
  );

  app.delete(
    '/admin/imports/schedules/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const id = c.req.param('id') as string;
      const ok = await importSchedules.deleteSchedule(id);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Schedule não encontrado.');
      return c.json({ ok: true });
    },
  );

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
        userMatchKeys:
          sched.enrollment?.userMatchKeys ?? conn.defaultUserMatchKeys,
        unmatchedUserPolicy: sched.enrollment?.unmatchedUserPolicy,
        conflictStrategy:
          sched.enrollment?.conflictStrategy ?? conn.defaultConflictStrategy,
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
      replyToEmail:
        body.replyToEmail !== undefined ? String(body.replyToEmail) : undefined,
      apiKey: body.apiKey !== undefined ? String(body.apiKey) : undefined,
      smtpHost: body.smtpHost !== undefined ? String(body.smtpHost) : undefined,
      smtpPort: body.smtpPort !== undefined ? Number(body.smtpPort) : undefined,
      smtpUser: body.smtpUser !== undefined ? String(body.smtpUser) : undefined,
      smtpPassword:
        body.smtpPassword !== undefined ? String(body.smtpPassword) : undefined,
      smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : undefined,
    });
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
    return c.json(updated);
  });

  app.delete(
    '/admin/email/configs/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await emailConfigs.deleteConfig(c.req.param('id') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Config não encontrada.');
      return c.json({ ok: true });
    },
  );

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
        return jsonError(
          c,
          500,
          'EMAIL_FAILED',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );

  app.get('/admin/email/logs', requireAuth('admin', 'superadmin'), async (c) => {
    const limit = Number(c.req.query('limit') ?? '200');
    return c.json(await emailLogs.listLogs(Number.isFinite(limit) ? limit : 200));
  });

  app.get('/admin/email/templates', requireAuth('admin', 'superadmin'), (c) =>
    c.json({ names: TEMPLATE_NAMES }),
  );

  app.get('/admin/email/broadcasts', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await emailBroadcasts.listBroadcasts()),
  );

  app.post(
    '/admin/email/broadcasts/preview',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

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
        audience: (body.audience ?? 'all') as Parameters<typeof emailBroadcasts.startBroadcast>[0]['audience'],
        courseId: body.courseId,
        inactivityDays: body.inactivityDays,
        createdBy: u.email,
      });
      return c.json(broadcast, 202);
    },
  );

  app.get(
    '/admin/email/templates/:name/preview',
    requireAuth('admin', 'superadmin'),
    (c) => {
      const name = c.req.param('name') as string;
      try {
        const r = previewTemplate(name);
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

  // ---------- Webhooks de saída ----------

  app.get(
    '/admin/webhooks/events',
    requireAuth('admin', 'superadmin'),
    (c) => c.json({ events: ALL_WEBHOOK_EVENTS }),
  );

  app.get(
    '/admin/webhooks/endpoints',
    requireAuth('admin', 'superadmin'),
    async (c) => c.json(await webhookEndpoints.listEndpoints()),
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

  app.put(
    '/admin/webhooks/endpoints/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
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
    },
  );

  app.delete(
    '/admin/webhooks/endpoints/:id',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const ok = await webhookEndpoints.deleteEndpoint(c.req.param('id') as string);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Endpoint não encontrado.');
      return c.json({ ok: true });
    },
  );

  app.post(
    '/admin/webhooks/endpoints/:id/test',
    requireAuth('admin', 'superadmin'),
    rateLimit({ windowMs: 60_000, max: 10 }),
    async (c) =>
      c.json(await webhooksDispatcher.testEndpoint(c.req.param('id') as string)),
  );

  app.get(
    '/admin/webhooks/deliveries',
    requireAuth('admin', 'superadmin'),
    async (c) => {
      const limit = Number(c.req.query('limit') ?? '200');
      const endpointId = c.req.query('endpointId');
      const list = endpointId
        ? await webhookDeliveries.listByEndpoint(endpointId, Number.isFinite(limit) ? limit : 200)
        : await webhookDeliveries.listAll(Number.isFinite(limit) ? limit : 200);
      return c.json(list);
    },
  );

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

  // ---------- Coupons (admin CRUD + validação pública) ----------

  app.get('/admin/coupons', requireAuth('admin', 'superadmin'), async (c) =>
    c.json(await couponsRepo.listAll()),
  );

  app.post('/admin/coupons', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createCouponSchema, body);
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
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
    if (!v.ok)
      return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
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
          description:
            typeof body.description === 'string' ? body.description : undefined,
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

  app.get(
    '/admin/coupons/export',
    requireAuth('admin', 'superadmin'),
    async () => {
      const csv = await couponsRepo.exportCouponsAsCsv();
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cupons-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    },
  );

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
      if (!v.ok)
        return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());

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
            discountCents > 0
              ? `${product.name} (cupom ${appliedCouponCode})`
              : product.name,
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

  // ---------- Webhook (público; cada gateway tem URL própria) ----------

  app.post(
    '/payments/webhook/:gatewayId',
    rateLimit({ windowMs: 60_000, max: 60 }),
    async (c) => {
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
      }

      return c.json({ ok: true });
    },
  );

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
