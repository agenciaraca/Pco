// Golden path E2E: login student → ver dashboard → catálogo → enroll
// (via admin) → marcar lição como concluída → progresso atualiza.
//
// Strategy: login via API + injeta token em localStorage (evita flaky de
// form submission). Admin endpoint enroll-bulk usado pra garantir
// matrícula determinística.

import { test, expect } from '@playwright/test';
import {
  loginAs,
  concluirOnboardingAdmin,
  sessaoCompartilhada,
  ensureEnrolled,
  fetchCourses,
  STUDENT_EMAIL,
  STUDENT_PASSWORD,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
} from './helpers';

// Os testes autenticados rodam SEMPRE — não há mais o que pular.
//
// Eles nasceram cercados por uma guarda que os desligava fora do CI, porque
// dependiam de um `data/users.json` novo para que as senhas de
// `INITIAL_*_PASSWORD` valessem, e o `webServer` reusado localmente mantinha o
// cache do JsonStore em RAM. Isso deixava **12 dos 26 casos pulados fora do
// CI** — ou seja, todo o percurso que importa (login, matrícula, marcar aula,
// progresso, agendar, admin) não corria na máquina de quem desenvolve,
// enquanto o relatório imprimia um tranquilizador "26/26".
//
// As duas causas foram removidas em 3/set/2026: `reuseExistingServer: false`
// (já era, mas o comentário dizia o contrário) e um `DATA_DIR` próprio da
// suíte (`e2e/.data`), que o `playwright.config.ts` fixa e passa ao servidor.
// Servidor novo + diretório limpo a cada execução = as senhas sempre valem.

test.describe('AVA PCO golden path — student journey', () => {
  test('catálogo público lista cursos (sem auth)', async ({ page, request }) => {
    const courses = await fetchCourses(request);
    expect(courses.length).toBeGreaterThan(0);

    // Entra por `/catalogo` de propósito: desde 30/ago/2026 ele é um 301 para
    // `/formacoes` (`server/public/rotas-fundidas.ts`), e o endereço antigo
    // ainda circula em link de fora. Cobrar o destino testa as duas coisas —
    // o redirecionamento e a página.
    await page.goto('/catalogo');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/formacoes');

    // O catálogo mostra só o que está publicamente listado — `/api/courses`
    // devolve mais do que isso. Cobrar o PRIMEIRO da lista era cobrar que um
    // curso não publicado aparecesse: o teste falhava por estar certo o
    // produto. Basta que ALGUM dos cursos conhecidos esteja na página.
    const corpo = (await page.locator('body').textContent()) ?? '';
    const algumVisivel = courses.some((c) => corpo.includes(c.title.slice(0, 20)));
    expect(
      algumVisivel,
      `nenhum dos ${courses.length} cursos apareceu no catálogo público`,
    ).toBe(true);
  });

  test('login student via API + dashboard renderiza', async ({ page }) => {
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
    // 1) Login admin pra preparar matrícula
    const admin = await sessaoCompartilhada(request, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);

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
    const student = await sessaoCompartilhada(request, STUDENT_EMAIL, STUDENT_PASSWORD);

    // 4) Garante matrícula via admin endpoint (idempotente)
    await ensureEnrolled(
      request,
      admin.token,
      courseWithLesson!.id,
      student.user.id,
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

    // 7) UI sanity check — visita o curso e confirma que renderiza conteúdo.
    //
    // Aqui havia duas falhas somadas, e uma escondia a outra. A rota era
    // `/aprender/:id`, que não existe — o teste media a tela de 404. E a
    // asserção era `expect(page.url()).toContain(...)` logo depois de um
    // `goto` para essa mesma URL: não tem como falhar, nem no 404, nem se a
    // página vier em branco. Verde por não poder ficar vermelho.
    //
    // Quem encontrou foi a medição de tráfego, que passou a registrar as
    // rotas em que o SPA cai no 404 — este apareceu lá no primeiro E2E.
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await page.goto(`/curso/${courseWithLesson!.id}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/módulo|aula|lição|conteúdo/i);
    await expect(page.locator('body')).not.toContainText(/página não encontrada|404/i);
  });

  test('student navega conteúdo do curso (módulos + lições)', async ({
    page,
    request,
  }) => {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);

    const courses = await fetchCourses(request);
    const course = courses[0];
    expect(course).toBeDefined();

    // A rota é `/curso/:courseId` — `/aprender/...` não existe e caía no 404,
    // então este teste media a página de erro em vez do conteúdo do curso.
    await page.goto(`/curso/${course.id}`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain(`/curso/${course.id}`);
    await expect(page.locator('body')).toContainText(/módulo|aula|lição|conteúdo/i);
  });

  test('student acessa página de quiz do curso', async ({ page, request }) => {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);

    const courses = await fetchCourses(request);
    const course = courses[0];

    await page.goto(`/curso/${course.id}/quiz`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain(`/curso/${course.id}/quiz`);
    await expect(page.locator('body')).toContainText(
      /quiz|questão|questões|nenhuma questão/i,
    );
  });

  test('student acessa página de eventos', async ({ page }) => {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);

    await page.goto('/eventos');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/eventos');
    await expect(page.locator('body')).toContainText(
      /eventos|encontros|sem encontros|ao vivo/i,
    );
  });
});

test.describe('AVA PCO golden path — admin journey', () => {
  test('login admin + dashboard renderiza KPIs', async ({ page, request }) => {
    const admin = await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await concluirOnboardingAdmin(request, admin.token);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/dashboard');
    await expect(page.locator('body')).toContainText(/dashboard|receita|alunos|certificados/i);
  });

  test('admin acessa health check', async ({ page, request }) => {
    const admin = await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await concluirOnboardingAdmin(request, admin.token);
    await page.goto('/admin/saude');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/saude');
    await expect(page.locator('body')).toContainText(/saúde|uptime|memória|health/i);
  });

  test('admin acessa gestão de cursos', async ({ page, request }) => {
    const admin = await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await concluirOnboardingAdmin(request, admin.token);
    await page.goto('/admin/cursos');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/cursos');
    await expect(page.locator('body')).toContainText(/cursos|psican|terapia/i);
  });

  test('admin acessa configuração de Zoom SDK', async ({ page, request }) => {
    const admin = await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await concluirOnboardingAdmin(request, admin.token);
    await page.goto('/admin/zoom');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/zoom');
    await expect(page.locator('body')).toContainText(/zoom sdk|configurad|sdk key/i);
  });
});
