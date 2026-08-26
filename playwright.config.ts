import { defineConfig, devices } from '@playwright/test';

// E2E config — chromium-only por padrão (economiza ~400MB de browsers).
// CI override: cross-browser via --project flag.

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Roda antes do webServer subir — reseta state determinístico.
  globalSetup: './e2e/global-setup.ts',
  // Output: e2e/.test-results (gitignored).
  outputDir: './e2e/.test-results',
  // Global timeout: 60s por teste, 5min total.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Falha rápido em CI; reruns 1x localmente.
  retries: process.env.CI ? 2 : 0,
  // Single worker SEMPRE, e não só em CI.
  //
  // O comentário aqui já dizia "single worker por padrão", mas o código deixava
  // o Playwright abrir um processo por núcleo fora do CI. Cada worker tem o
  // próprio registro de módulos, logo o próprio cache de sessão — e cada um
  // fazia o próprio login. Com `/api/auth/login` limitado a 5 por minuto, a
  // suíte estourava a cota sozinha e metade dos testes falhava com 429. Como o
  // job de E2E roda com `continue-on-error: true`, ninguém via.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Cross-browser opt-in (--project=firefox / --project=webkit).
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile (--project=mobile-chrome / --project=mobile-safari)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile-.*\.spec\.ts$/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      testMatch: /mobile-.*\.spec\.ts$/,
    },
  ],

  // Sobe o app antes dos testes. Usa o build production servido por
  // server/dev.ts para evitar duas portas (vite dev + hono dev).
  webServer: {
    command: 'npm run e2e:server',
    url: BASE_URL,
    // Reusa local pra dev iterativo, mas o globalSetup limpa users.json
    // antes do server subir. Em CI sempre fresh.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      SERVE_STATIC: './dist',
      HOST: '127.0.0.1',
      // Senhas determinísticas para users seed (em primeiro boot).
      INITIAL_STUDENT_PASSWORD: 'e2e-student-pass',
      INITIAL_ADMIN_PASSWORD: 'e2e-admin-pass',
      INITIAL_SUPERADMIN_PASSWORD: 'e2e-super-pass',
      JWT_SECRET: 'a'.repeat(48),
      ALLOWED_ORIGINS: BASE_URL,
    },
  },
});
