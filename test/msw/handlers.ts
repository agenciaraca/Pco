import { http, HttpResponse } from 'msw';

const BASE = '/api';

export const mockUser = {
  id: 'stu-001',
  name: 'Aluno Teste',
  email: 'aluno@test.local',
  role: 'student' as const,
};

export const mockCourses = [
  {
    id: 'c-psi',
    title: 'Psicanálise Clínica',
    shortTitle: 'Psicanálise',
    description: 'Curso introdutório de psicanálise.',
    coverColor: '#0a2540',
    modules: [
      {
        id: 'psi-mod-1',
        title: 'Introdução',
        status: 'available',
        lessons: [
          { id: 'psi-mod-1-les-1', title: 'O que é psicanálise', status: 'available', durationMinutes: 20 },
          { id: 'psi-mod-1-les-2', title: 'Freud e a descoberta', status: 'available', durationMinutes: 25 },
        ],
        assessment: null,
      },
    ],
    tags: [],
  },
];

export const handlers = [
  http.post(`${BASE}/auth/login`, () => {
    return HttpResponse.json({
      user: mockUser,
      token: 'mock-jwt-token-123',
    });
  }),

  http.get(`${BASE}/courses`, () => {
    return HttpResponse.json(mockCourses);
  }),

  http.get(`${BASE}/me/progress`, () => {
    return HttpResponse.json({ completedLessonIds: ['psi-mod-1-les-1'] });
  }),

  http.get(`${BASE}/me/student`, () => {
    return HttpResponse.json({
      ...mockUser,
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': { lessonsCompleted: 1, lastAt: new Date().toISOString() } },
      status: 'ativo',
      riskScore: 10,
    });
  }),

  http.get(`${BASE}/me/notifications`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/me/live-sessions`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/me/mentoring/:courseId`, () => {
    return HttpResponse.json({ configs: [] });
  }),

  http.get(`${BASE}/me/notes`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/me/quiz/:courseId/start`, () => {
    return HttpResponse.json({
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'O que é transferência?',
          tags: [],
          difficulty: 3,
          options: [
            { id: 'o1', text: 'Deslocamento de afetos' },
            { id: 'o2', text: 'Técnica de relaxamento' },
          ],
        },
      ],
    });
  }),

  http.post(`${BASE}/me/quiz/:courseId/grade`, () => {
    return HttpResponse.json({
      score: 100,
      total: 1,
      pct: 100,
      results: [
        { questionId: 'q1', type: 'multiple_choice', correct: true, correctOptionIds: ['o1'], explanation: 'Correto!' },
      ],
    });
  }),

  http.get(`${BASE}/admin/onboarding/status`, () => {
    return HttpResponse.json({
      needsOnboarding: false,
      completedAt: new Date().toISOString(),
      role: 'admin',
      customRoleSlug: null,
    });
  }),

  http.get(`${BASE}/retention/risks`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/products`, () => {
    return HttpResponse.json([
      {
        id: 'prod-psi',
        name: 'Psicanálise Clínica',
        kind: 'course',
        refId: 'c-psi',
        priceCents: 99900,
        active: true,
      },
    ]);
  }),

  http.get(`${BASE}/admin/setup/status`, () => {
    return HttpResponse.json({
      total: 8,
      ok: 6,
      progressPct: 75,
      items: [],
    });
  }),
];
