// Golden path E2E: login student → ver dashboard → catálogo → enroll
// (via admin) → marcar lição como concluída → progresso atualiza.
//
// Strategy: login via API + injeta token em localStorage (evita flaky de
// form submission). Admin endpoint enroll-bulk usado pra garantir
// matrícula determinística.

import { test, expect } from '@playwright/test';
import {
  loginAs,
  loginViaApi,
  ensureEnrolled,
  fetchCourses,
  STUDENT_EMAIL,
  STUDENT_PASSWORD,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from './helpers';

// NOTE: testes que dependem de auth (login student/admin) precisam de fresh
// data/users.json pra que INITIAL_*_PASSWORD do playwright.config.ts seja
// aplicada. O e2e/global-setup.ts apaga users.json mas o JsonStore mantém
// cache em RAM no webServer reusado localmente. Em CI (fresh container)
// passam. Pra rodar local: set E2E_FRESH=1 + kill manualmente tsx antes.
const REQUIRES_FRESH = !process.env.CI && !process.env.E2E_FRESH;

test.describe('AVA PCO golden path — student journey', () => {
  test('catálogo público lista cursos (sem auth)', async ({ page, request }) => {
    const courses = await fetchCourses(request);
    expect(courses.length).toBeGreaterThan(0);

    await page.goto('/catalogo');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/catalogo');
    await expect(page.locator('body')).toContainText(courses[0].title.slice(0, 20));
  });

  test('login student via API + dashboard renderiza', async ({ page }) => {
    test.skip(REQUIRES_FRESH, 'requer fresh users.json — set E2E_FRESH=1 ou rode em CI');
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Confirma que NÃO redirecionou pra /login (o que aconteceria sem token).
    expect(page.url()).toContain('/dashboard');

    // Algum sinal do dashboard renderizado
    await expect(page.locator('body')).toContainText(/dashboard|cursos|aulas|olá|bem-vind/i);
  });

  test('login → enroll → marcar lição concluída → progresso reflete', async ({
    page,
    request,
  }) => {
    test.skip(REQUIRES_FRESH, 'requer fresh users.json — set E2E_FRESH=1 ou rode em CI');
    // 1) Login admin pra preparar matrícula
    const admin = await loginViaApi(request, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

    // 2) Pega curso com pelo menos 1 módulo + 1 lesson
    const courses = await fetchCourses(request);
    const courseWithLesson = courses.find((c) => {
      const mods = (c.modules ?? []) as Array<{
        id: string;
        lessons?: Array<{ id: string }>;
      }>;
      return mods.some((m) => (m.lessons ?? []).length > 0);
    }) as
      | {
          id: string;
          title: string;
          modules: Array<{ id: string; lessons: Array<{ id: string; title: string }> }>;
        }
      | undefined;
    expect(courseWithLesson, 'precisa de pelo menos 1 curso com lesson no seed').toBeDefined();

    const firstModule = courseWithLesson!.modules.find(
      (m) => (m.lessons ?? []).length > 0,
    )!;
    const firstLesson = firstModule.lessons[0];

    // 3) Login como student via API
    const student = await loginViaApi(request, STUDENT_EMAIL, STUDENT_PASSWORD);

    // 4) Garante matrícula via admin endpoint (idempotente)
    await ensureEnrolled(
      request,
      admin.token,
      courseWithLesson!.id,
      STUDENT_EMAIL,
    );

    // 5) Marca lesson como concluída via API student
    const completeRes = await request.post(
      `/api/lessons/${firstLesson.id}/complete`,
      {
        headers: { Authorization: `Bearer ${student.token}` },
        data: { courseId: courseWithLesson!.id, moduleId: firstModule.id },
      },
    );
    expect(completeRes.ok(), `complete falhou: ${await completeRes.text()}`).toBe(
      true,
    );

    // 6) Confirma via /me/progress que a lesson aparece como completed
    const progressRes = await request.get('/api/me/progress', {
      headers: { Authorization: `Bearer ${student.token}` },
    });
    expect(progressRes.ok()).toBe(true);
    const progress = (await progressRes.json()) as {
      completedLessonIds: string[];
    };
    expect(progress.completedLessonIds).toContain(firstLesson.id);

    // 7) UI sanity check — visita o LMS player e confirma que renderiza
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await page.goto(`/aprender/${courseWithLesson!.id}`);
    await page.waitForLoadState('networkidle');
    // Player ou listagem de módulos deve estar visível
    expect(page.url()).toContain(`/aprender/${courseWithLesson!.id}`);
  });
});
