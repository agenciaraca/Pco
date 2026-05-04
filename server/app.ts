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
import { signToken } from './auth/jwt';
import { attachUser, requireAuth } from './auth/middleware';
import { createResetToken, consumeResetToken } from './auth/password-reset';
import { auditMiddleware } from './audit/middleware';
import { listAudit, auditByDay } from './audit/log';
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
} from '../shared/schemas';
import { rateLimit } from './rate-limit';
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
import { ALL_PROVIDERS, getPaymentProvider } from './payments/providers/registry';
import { AiError } from './ai/types';
import { hasDb } from './db/client';

/**
 * Libera acesso do usuário ao produto pago.
 * - course: enroll no curso (adiciona ao enrolledCourseIds do estudante)
 * - session_pack/tutor_pack: registra em metadata para uso futuro (sprint subsequente)
 */
async function grantAccessForOrder(order: import('./payments/types').Order): Promise<void> {
  if (order.productSnapshot.kind === 'course' && order.productSnapshot.refId) {
    await studentsRepo.enrollInCourse(order.userId, order.productSnapshot.refId);
  }
  // Demais kinds: por ora apenas registrado na order (events). Sprint futuro implementa.
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
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    });
    return c.json({ user, token });
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
      // Em produção real: dispara e-mail. Por enquanto, log + também devolve
      // o token na resposta SE NODE_ENV != 'production' (debugging em dev).
      // eslint-disable-next-line no-console
      console.log(`[forgot-password] reset token para ${u.email}: ${token.token}`);
      if (process.env.NODE_ENV !== 'production') {
        return c.json({ ok: true, devToken: token.token, expiresIn: 30 * 60 });
      }
    }
    // Sempre retorna ok pra não revelar se o e-mail existe
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
  app.post('/auth/me/password', requireAuth(), async (c) => {
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

    return c.json(entry, 201);
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
    return c.json({ valid: true, certificate: cert });
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
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createSystemUserSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const acting = c.get('user');
    if (v.data.role === 'superadmin' && acting?.role !== 'superadmin') {
      return jsonError(c, 403, 'FORBIDDEN', 'Apenas superadmin pode criar superadmin.');
    }
    try {
      const created = await usersStore.createUser(v.data);
      // Notificação de boas-vindas para o novo usuário
      await notificationsRepo.createOne({
        userId: created.id,
        title: `Bem-vindo(a) ao AVA PCO, ${created.name}!`,
        body:
          'Sua conta foi criada. Acesse seu perfil para confirmar dados e, se receber uma senha temporária, troque-a no primeiro acesso.',
        category: 'announcement',
        link: '/perfil',
        authorEmail: acting?.email ?? null,
      });
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
    try {
      const id = c.req.param('id') as string;
      const updated = await usersStore.updateUser(id, v.data);
      if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
      return c.json(updated);
    } catch (err) {
      return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
    }
  });

  app.put('/admin/users/:id/password', requireAuth('admin', 'superadmin'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(changePasswordSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const id = c.req.param('id') as string;
    const ok = await usersStore.changePassword(id, v.data.password);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
    return c.json({ ok: true });
  });

  app.delete('/admin/users/:id', requireAuth('admin', 'superadmin'), async (c) => {
    try {
      const id = c.req.param('id') as string;
      const ok = await usersStore.deleteUser(id);
      if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Usuário não encontrado');
      return c.json({ ok: true });
    } catch (err) {
      return jsonError(c, 409, 'CONFLICT', err instanceof Error ? err.message : String(err));
    }
  });

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

  app.delete('/admin/payments/gateways/:id', requireAuth('admin', 'superadmin'), async (c) => {
    const id = c.req.param('id') as string;
    const ok = await gatewaysRepo.deleteGateway(id);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Gateway não encontrado');
    return c.json({ ok: true });
  });

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
        amountCents: product.priceCents,
        currency: product.currency,
      });

      try {
        const result = await provider.createPayment(gw, creds, {
          amountCents: product.priceCents,
          currency: product.currency,
          description: product.name,
          customerEmail: u.email,
          metadata: { orderId: order.id, userId: u.sub },
        });
        const updated = await ordersRepo.attachGatewayResult(order.id, {
          externalId: result.externalId,
          checkoutUrl: result.checkoutUrl,
          qrCode: result.qrCode,
          status: result.status,
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
