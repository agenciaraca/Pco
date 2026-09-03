import { defineConfig, devices } from '@playwright/test';

// E2E config — chromium-only por padrão (economiza ~400MB de browsers).
// CI override: cross-browser via --project flag.

import path from 'node:path';

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Diretório de dados **da suíte**, nunca o do desenvolvedor.
 *
 * O `webServer` já neutralizava `DATABASE_URL` e `PUBLIC_ORIGIN` para a suíte
 * não escrever no banco da escola. Faltava `DATA_DIR`: o `globalSetup` roda no
 * processo do Playwright, resolve `DATA_DIR ?? cwd/data` e dá `unlink` em
 * `users.json` — ou seja, `npm run e2e` apagava as contas locais de quem
 * estivesse desenvolvendo. Fixar aqui fecha a mesma classe de vazamento de
 * ambiente, no último lugar em que ela ainda existia.
 */
const E2E_DATA_DIR = process.env.E2E_DATA_DIR ?? path.resolve(process.cwd(), 'e2e/.data');
process.env.DATA_DIR = E2E_DATA_DIR;

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
    // `testIgnore` nos projetos de desktop: sem ele, os casos de
    // `mobile-smoke.spec.ts` rodavam no projeto `chromium` — que é o que
    // `npm run e2e` executa — com `devices['Desktop Chrome']`. As asserções de
    // overflow horizontal e de altura de alvo de toque mediam **uma janela de
    // desktop**, passavam, e não provavam o que o nome do arquivo promete:
    // regressão responsiva não era coberta pelo comando padrão.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-.*\.spec\.ts$/,
    },
    // Cross-browser opt-in (--project=firefox / --project=webkit).
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /mobile-.*\.spec\.ts$/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /mobile-.*\.spec\.ts$/,
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
    // **Nunca reusa.** O comentário aqui dizia "reusa local pra dev iterativo"
    // sobre um `false` — comentário que instrui o contrário do código é a
    // mesma classe de risco do `AGENTS.md` que mandava rodar o script errado.
    // Servidor sempre novo também é o que garante que o `DATA_DIR` da suíte
    // valha, já que o store lê as contas para a memória no boot.
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
      // As duas abaixo são zeradas de propósito, e não é detalhe.
      //
      // O `webServer` herda o `process.env` de quem chamou. Na máquina de quem
      // desenvolve existe um `.env` com as credenciais reais, e sem estas duas
      // linhas a suíte rodava **contra produção**: `DATABASE_URL` faria os
      // testes criarem matrícula e agendamento no banco da escola, e
      // `PUBLIC_ORIGIN` fazia o servidor local devolver 301 para o domínio de
      // produção — o que trava o Playwright esperando um servidor que só
      // redireciona. Em CI nenhuma das duas existe, então isto não muda nada
      // lá e conserta o E2E local.
      DATABASE_URL: '',
      PUBLIC_ORIGIN: '',
      // O servidor da suíte escreve no diretório da suíte.
      DATA_DIR: E2E_DATA_DIR,
    },
  },
});
