import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { currentStudent } from '../src/app/data/seed';
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

  app.get('/health', (c) =>
    c.json({ ok: true, ts: Date.now(), db: hasDb() ? 'connected' : 'fallback' }),
  );

  // ---------- Auth (mock) ----------

  app.post('/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return jsonError(c, 400, 'INVALID_INPUT', parsed.error.message);
    const { email } = parsed.data;
    const isAdmin = email.toLowerCase().includes('admin');
    return c.json({
      user: {
        id: isAdmin ? 'admin-001' : 'stu-001',
        name: isAdmin ? 'Admin Demo' : 'Aluno Demo',
        email,
        role: isAdmin ? 'admin' : 'student',
      },
      token: 'mock-jwt-' + Math.random().toString(36).slice(2),
    });
  });

  app.get('/auth/me', async (c) => c.json(await studentsRepo.getCurrentStudent()));

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

  // 404 catch-all
  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Rota inexistente'));

  // Erro não tratado
  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return jsonError(c, 500, 'INTERNAL', 'Erro interno');
  });

  return app;
}
