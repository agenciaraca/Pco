import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import {
  courses,
  newsArticles,
  podcasts,
  libraryItems,
  certificates,
  retentionRisks,
  professionals,
  sessionServices,
  seoTimeseries,
  keywords,
  supportTickets,
  adminStudents,
  currentStudent,
} from '../src/app/data/seed';
import {
  createSupportTicketSchema,
  recoveryPlanSchema,
  studentsFilterSchema,
  loginSchema,
  updateAiConfigSchema,
  tutorAskSchema,
} from '../shared/schemas';
import { rateLimit } from './rate-limit';
import { jsonError, validate } from './http';
import {
  getProvider,
  listProviders,
  calculateCost,
} from './ai/providers';
import {
  listConfigs,
  getConfig,
  getActiveByModule,
  updateConfig,
  recordUsage,
  aggregateUsage,
  countUsageInWindow,
  toPublic,
} from './ai/store';
import { AiError } from './ai/types';

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

  app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

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

  app.get('/auth/me', (c) => c.json(currentStudent));

  // ---------- Courses ----------

  app.get('/courses', (c) => c.json(courses));
  app.get('/courses/:id', (c) => {
    const course = courses.find((x) => x.id === c.req.param('id'));
    if (!course) return jsonError(c, 404, 'NOT_FOUND', 'Curso não encontrado');
    return c.json(course);
  });

  // ---------- News ----------

  app.get('/news', (c) => c.json(newsArticles));

  // ---------- Podcasts ----------

  app.get('/podcasts', (c) => c.json(podcasts));
  app.get('/podcasts/:id', (c) => {
    const ep = podcasts.find((p) => p.id === c.req.param('id'));
    if (!ep) return jsonError(c, 404, 'NOT_FOUND', 'Episódio não encontrado');
    return c.json(ep);
  });

  // ---------- Library ----------

  app.get('/library', (c) => {
    const { type, courseId, mandatoryOnly } = c.req.query();
    let list = libraryItems;
    if (type) list = list.filter((i) => i.type === type);
    if (courseId) list = list.filter((i) => i.relatedCourseIds?.includes(courseId));
    if (mandatoryOnly === 'true') list = list.filter((i) => i.mandatory);
    return c.json(list);
  });

  // ---------- Certificates ----------

  app.get('/certificates', (c) => c.json(certificates));

  // ---------- Retention ----------

  app.get('/retention/risks', (c) => {
    const level = c.req.query('level');
    const list =
      level && level !== 'todos'
        ? retentionRisks.filter((r) => r.level === level)
        : retentionRisks;
    return c.json(list);
  });

  // ---------- Sessions / Professionals ----------

  app.get('/sessions/services', (c) => c.json(sessionServices));
  app.get('/sessions/professionals', (c) => c.json(professionals));

  // ---------- SEO / Metrics ----------

  app.get('/metrics/seo/timeseries', (c) => c.json(seoTimeseries));
  app.get('/metrics/seo/keywords', (c) => c.json(keywords));

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

  app.get('/admin/ai/configurations', (c) => c.json(listConfigs()));

  app.get('/admin/ai/configurations/:id', (c) => {
    const cfg = getConfig(c.req.param('id'));
    if (!cfg) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    return c.json({ ...toPublic(cfg), usage: aggregateUsage(cfg.id) });
  });

  app.put('/admin/ai/configurations/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(updateAiConfigSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const updated = updateConfig(c.req.param('id'), v.data);
    if (!updated) return jsonError(c, 404, 'NOT_FOUND', 'Configuração não encontrada');
    return c.json(toPublic(updated));
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

    const config = getActiveByModule('tutor');
    if (!config) {
      return c.json({
        message:
          'Tutor Virtual não está configurado. Acesse /admin/ias para selecionar provider, modelo e chave de API.',
        provider: null,
        model: null,
        usage: null,
      });
    }

    // Limites por aluno (mock — usaria o studentId real do JWT)
    const studentId = currentStudent.id;
    const dailyUse = countUsageInWindow(config.id, studentId, 24 * 60 * 60 * 1000);
    if (dailyUse >= config.perStudentLimit) {
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
      recordUsage({
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
      recordUsage({
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
        if (err.code === 'TIMEOUT')
          return jsonError(c, 504, 'AI_TIMEOUT', err.message);
      }
      return jsonError(c, 502, 'AI_UPSTREAM', 'Falha ao chamar provider IA.');
    }
  });

  // ---------- Support ----------

  app.get('/support/tickets', (c) => c.json(supportTickets));
  app.post('/support/tickets', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const v = validate(createSupportTicketSchema, body);
    if (!v.ok) return jsonError(c, 400, 'INVALID_INPUT', 'Dados inválidos', v.error.flatten());
    const ticket = {
      id: `t-${Date.now()}`,
      studentId: currentStudent.id,
      subject: v.data.subject,
      category: v.data.category,
      status: 'open' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message: v.data.message,
    };
    return c.json(ticket, 201);
  });

  // ---------- Admin students ----------

  app.get('/admin/students', (c) => {
    const filtersResult = studentsFilterSchema.safeParse({
      search: c.req.query('search'),
      status: c.req.query('status'),
      courseId: c.req.query('courseId'),
      sortBy: c.req.query('sortBy'),
    });
    const filters = filtersResult.success ? filtersResult.data : {};

    let list = [...adminStudents];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      );
    }
    if (filters.status && filters.status !== 'todos')
      list = list.filter((s) => s.status === filters.status);
    if (filters.courseId && filters.courseId !== 'todos')
      list = list.filter((s) => s.enrolledCourseIds.includes(filters.courseId!));
    list.sort((a, b) => {
      if (filters.sortBy === 'risk') return b.riskScore - a.riskScore;
      if (filters.sortBy === 'lastAccess')
        return new Date(b.lastAccessAt).getTime() - new Date(a.lastAccessAt).getTime();
      return a.name.localeCompare(b.name);
    });
    return c.json(list);
  });

  app.get('/admin/students/:id', (c) => {
    const s = adminStudents.find((x) => x.id === c.req.param('id'));
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

  // 404 catch-all
  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Rota inexistente'));

  // Erro não tratado
  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return jsonError(c, 500, 'INTERNAL', 'Erro interno');
  });

  return app;
}
