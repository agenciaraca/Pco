import { test, expect } from '@playwright/test';

// Smoke test: garante que o app sobe, /api/health responde, rotas
// públicas renderizam e o login flow básico funciona com seed users.
//
// NÃO depende de banco — usa o JsonStore em memória que seeda
// aluno@pco.local com a senha fixada em playwright.config.ts (env
// INITIAL_STUDENT_PASSWORD=e2e-student-pass).

test.describe('AVA PCO smoke', () => {
  test('GET /api/health retorna 200 ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('home pública renderiza sem erro', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/PCO/i);
    // Aceita qualquer landing — login, marketing ou catálogo.
    await page.waitForLoadState('networkidle');

    // Filtra ruídos esperados — e **só** eles.
    //
    // O filtro antigo descartava tudo que casasse `/404/i` ou
    // `/Failed to load resource/i`. A segunda é como o Chromium relata
    // **qualquer** requisição falha, 500 e 429 inclusive: a home podia carregar
    // com a API inteira quebrada e este teste passava. O que ele provava era
    // "o HTML renderiza e não houve exceção de JS" — não "renderiza sem erro".
    const ruidoEsperado = [
      /favicon/i,
      /sentry/i,
      // 404 de recurso opcional (imagem de capa ausente no seed, por exemplo).
      /Failed to load resource.*40[34]/i,
    ];
    const realErrors = errors.filter((e) => !ruidoEsperado.some((r) => r.test(e)));
    expect(
      realErrors,
      'A home carregou com erro de console. 5xx e 429 falham aqui de propósito: ' +
        'antes eram engolidos pelo filtro.',
    ).toEqual([]);
  });

  test('rota /login mostra formulário', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  /*
    Este caso testava o fallback do SPA pedindo `/algum-caminho-que-nao-existe`
    e cobrando 200. A intenção era boa — provar que o aplicativo é servido —
    mas o meio escolhido virou uma afirmação: "rota inexistente responde 200".

    Em 10/set/2026 isso deixou de valer, e por um defeito medido: **qualquer**
    endereço respondia 200 com o `index.html`, então cada URL inventada era uma
    página válida para o robô de busca indexar. Ver `server/rotas-do-app.ts`.

    A intenção continua coberta, agora por uma rota que existe de verdade.
  */
  test('o aplicativo é servido nas rotas dele', async ({ request }) => {
    const res = await request.get('/dashboard', { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<div id="root">');
  });

  test('rota inexistente responde 404, e não a tela do aplicativo', async ({ request }) => {
    const res = await request.get('/algum-caminho-que-nao-existe', {
      headers: { Accept: 'text/html' },
    });
    expect(res.status()).toBe(404);
    const body = await res.text();
    // A página de erro é do site, não o casco do aplicativo esperando JS.
    expect(body).toContain('Esta página não existe');
    expect(body).not.toContain('<div id="root">');
  });

  test('GET /api/v1/courses sem token retorna 401 (não 500)', async ({ request }) => {
    const res = await request.get('/api/v1/courses');
    expect([401, 403]).toContain(res.status());
  });
});
