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
  aiConfigurations,
  supportTickets,
  adminStudents,
  currentStudent,
} from '../src/app/data/seed';
import {
  createSupportTicketSchema,
  recoveryPlanSchema,
  studentsFilterSchema,
  loginSchema,
} from '../shared/schemas';
import { rateLimit } from './rate-limit';
import { jsonError, validate } from './http';

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
      // Em prod, isso volta como cookie HttpOnly via Set-Cookie. Mock retorna no body.
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
    const list = level && level !== 'todos'
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

  // ---------- AI ----------

  app.get('/ai/configurations', (c) => c.json(aiConfigurations));

  // Tutor proxy: env-gated. Sem ANTHROPIC_API_KEY, retorna resposta mockada.
  app.post('/ai/tutor', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const message = String(body?.message ?? '').trim();
    if (!message) return jsonError(c, 400, 'INVALID_INPUT', 'message é obrigatório');

    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json({
        message:
          'Resposta mockada do Tutor — defina ANTHROPIC_API_KEY no servidor para habilitar IA real.',
        usage: { inputTokens: 0, outputTokens: 0 },
      });
    }

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1200,
          system:
            'Você é o Tutor Virtual da PCO. Responde apenas dúvidas pedagógicas dos cursos. Não substitui supervisão clínica, atendimento psicológico, médico ou jurídico.',
          messages: [{ role: 'user', content: message }],
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        return jsonError(c, 502, 'AI_UPSTREAM', `Provider error: ${r.status}`, { text });
      }
      const data = await r.json();
      const text = (data?.content?.[0]?.text ?? '') as string;
      return c.json({
        message: text || 'Sem resposta gerada.',
        usage: data?.usage ?? null,
      });
    } catch (err) {
      return jsonError(c, 502, 'AI_UPSTREAM', 'Falha ao chamar provedor IA', { error: String(err) });
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
