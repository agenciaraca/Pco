import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { currentStudent } from '../src/app/data/seed';
import * as usersStore from './auth/users-store';
import { signToken } from './auth/jwt';
import { attachUser, requireAuth } from './auth/middleware';
import { createResetToken, consumeResetToken } from './auth/password-reset';
import { auditMiddleware } from './audit/middleware';
import { listAudit } from './audit/log';
import { recordError, listErrors } from './errors/store';
import { saveUpload, UploadError } from './uploads/store';
import { gatherHealth } from './monitoring/health';
import { search as adminSearch } from './search/admin-search';
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
import { AiError } from './ai/types';
import { hasDb } from './db/client';

export function buildApp() {
  const app = new Hono().basePath('/api');

  app.use('*', logger());
  app.use('*', secureHeaders());
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
      // Para aluno, devolve o perfil acadêmico ligado
      const s = await studentsRepo.getCurrentStudent();
      return c.json({ ...s, name: u.name, email: u.email, role: u.role });
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
    return c.json({
      completedLessonIds: list.map((p) => p.lessonId),
      byCourse,
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
    return c.json(entry, 201);
  });

  app.delete('/lessons/:id/complete', requireAuth(), async (c) => {
    const u = c.get('user')!;
    const lessonId = c.req.param('id') as string;
    const ok = await progressRepo.unmarkCompleted(u.sub, lessonId);
    if (!ok) return jsonError(c, 404, 'NOT_FOUND', 'Não estava marcada como concluída');
    return c.json({ ok: true });
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
    return c.json({ valid: true, certificate: cert });
  });

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

  app.get('/support/tickets', async (c) =>
    c.json(await supportRepo.listTicketsForStudent(currentStudent.id)),
  );
  app.post('/support/tickets', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createSupportTicketSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const ticket = await supportRepo.createTicket({
      studentId: currentStudent.id,
      subject: v.data.subject,
      category: v.data.category,
      message: v.data.message,
    });
    return c.json(ticket, 201);
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

  // ---------- Admin search ----------

  app.get('/admin/search', requireAuth('admin', 'superadmin'), async (c) => {
    const q = c.req.query('q') ?? '';
    if (q.trim().length < 2) return c.json([]);
    const limit = Number(c.req.query('limit') ?? '30');
    const hits = await adminSearch(q, Number.isFinite(limit) ? limit : 30);
    return c.json(hits);
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

  // ---------- Audit log ----------

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
