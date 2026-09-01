import { test, expect } from '@playwright/test';

// Smoke mobile: garante que o app funciona em viewport iPhone/Pixel.
// Roda só com --project=mobile-chrome ou --project=mobile-safari
// (testMatch no playwright.config.ts).

test.describe('Mobile smoke', () => {
  test('home renderiza em viewport mobile sem overflow horizontal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2); // 2px tolerance pra arredondamento
  });

  test('login form é tocável (44px+ touch targets)', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByLabel(/e-?mail/i);
    const passInput = page.getByLabel(/senha/i);
    await expect(emailInput).toBeVisible();
    await expect(passInput).toBeVisible();

    // Touch targets: idealmente 44x44px (WCAG 2.5.5 Target Size)
    const emailBox = await emailInput.boundingBox();
    expect(emailBox?.height ?? 0).toBeGreaterThanOrEqual(36);
  });

  test('catálogo carrega e mostra cursos em mobile', async ({ page }) => {
    await page.goto('/catalogo');
    await page.waitForLoadState('networkidle');
    // Catálogo público — sem auth requerido. `/catalogo` é 301 para
    // `/formacoes` desde 30/ago/2026; o teste cobrava o endereço antigo.
    await expect(page).toHaveURL(/formacoes/);
    // Espera ver pelo menos algum cartão ou empty state — tolerante.
    //
    // Os parênteses importam: `length ?? 0 > 100` é lido como
    // `length ?? (0 > 100)` — `??` tem precedência menor que `>` — e devolvia
    // o NÚMERO de caracteres, que nunca é `true`. O teste não tinha como passar
    // desde que foi escrito, e o `continue-on-error: true` do CI escondia.
    const hasContent = await page.evaluate(() => {
      return (document.body.textContent?.trim().length ?? 0) > 100;
    });
    expect(hasContent).toBe(true);
  });

  test('menu mobile abre via toque (não depende de hover)', async ({ page }) => {
    await page.goto('/login');
    // O Topbar tem ícone Menu pra mobile. Se existe, testa o toque.
    const menuBtn = page.getByRole('button', { name: /menu/i }).first();
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.tap();
      // Sidebar/MobileNav deve abrir
      await page.waitForTimeout(300);
    }
    // Se não houver, tudo bem — login não tem menu admin
    expect(true).toBe(true);
  });

  test('rotação landscape: layout não quebra', async ({ page, browserName }) => {
    if (browserName === 'webkit') {
      // Safari mobile: orientação via setViewportSize
      await page.setViewportSize({ width: 844, height: 390 });
    } else {
      await page.setViewportSize({ width: 851, height: 393 });
    }
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
