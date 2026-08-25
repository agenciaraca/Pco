# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

**AVA PCO** — Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online. LMS full-stack TypeScript: React 18 SPA + Hono API. Single repo deploys to Vercel (functions) **or** to a Node VPS (`server/dev.ts` serves both `/api/*` and the static `dist/`).

## Common commands

Repo root é `C:\ia\dev\pco\` — `package.json`, `.git` e todas as pastas (`src/`, `server/`, `shared/`, `api/`, etc.) ficam aqui. Não existe mais subpasta `Pco/` (consolidado em 2026-05-22).

```bash
npm run dev            # concurrent: Vite (5173) + Hono dev server (3001)
npm run dev:web        # frontend only
npm run dev:api        # API only — tsx watch on server/dev.ts
npm run build          # tsc -b && vite build (writes dist/)
npm run typecheck      # tsc -b --noEmit
npm run lint           # ESLint (flat config in eslint.config.js)
npm run lint:fix
npm run format         # Prettier --write
npm run format:check   # Prettier --check (CI dry-run)
npm run test           # Vitest (executable mode)
npm run test:watch
npm run test:ui        # Vitest browser UI
npm run test:coverage  # Vitest + v8 coverage
npm run test -- <pattern>            # run a subset, e.g. `npm run test -- jwt`
npm run test -- test/jwt.test.ts     # single file
npm run db:generate    # drizzle-kit generate (after schema.ts change)
npm run db:migrate     # apply migrations (needs DATABASE_URL)
npm run db:push        # dev-only schema sync without migration
npm run db:seed        # idempotent (onConflictDoNothing)
npm run db:studio
npm run e2e            # Playwright smoke (chromium)
npm run e2e:ui         # Playwright interactive UI
```

Env setup: copy `.env.example` → `.env` (or `.env.local`). Minimum for local dev: no vars needed (JSON fallback, no DB). For Postgres: set `DATABASE_URL`. For encryption: set `AI_KEY_ENCRYPTION_SECRET` (32 bytes hex).

CI (`.github/workflows/ci.yml`) runs typecheck → lint → test → build on every push/PR to `main`. PR is blocked if any step fails.

## Architecture (the parts you can't infer from one file)

### Two storage backends, one repository surface

Each entity has a repo in `server/repositories/*.ts` (or domain-specific dirs like `server/payments/*-repo.ts`, `server/imports/*-store.ts`). Repos call `hasDb()` / `getDb()` from `server/db/client.ts`:

- **`DATABASE_URL` set** → reads/writes Postgres via Drizzle (schema in `server/db/schema.ts`).
- **Not set** → falls back to `JsonStore<T>` (`server/db/json-store.ts`), which persists to `data/*.json` with an internal write-lock queue.

When migrating an entity from JSON to DB, follow the `server/repositories/courses.ts` template: query DB first, fall back to seed if the table is empty. Don't delete the JSON path.

### Single Hono app, multiple deploy targets

`server/app.ts` exports `buildApp()` → a Hono instance with `basePath('/api')`. It's consumed by:

- `server/dev.ts` — local Node server. Two modes:
  - default (`npm run dev:api`): API only on `:3001`.
  - with `SERVE_STATIC=./dist` env: serves `dist/` + `/api/*` on a single port (this is how production runs on the VPS at `0.0.0.0:3035`). Also injects CSP/HSTS/Frame headers, robots.txt, dynamic sitemap.xml, `/uploads/*` static, and SPA fallback.
- `api/[[...route]].ts` — Vercel Functions catch-all that wraps the same `buildApp()` via `handle()` from `hono/vercel`.

When changing app behavior, edit `server/app.ts`. The two entrypoints stay thin.

**Note:** `server/app.ts` is a monolith — all route handlers are defined inline in this single file (~3k+ lines). There is no `server/routes/` directory. New endpoints go directly into `buildApp()` following the existing grouping pattern (auth, admin CRUD, student-facing, public API).

### Background workers

Started in `server/dev.ts` via dynamic imports after `serve()` returns:

| Module | Tick |
|---|---|
| `webhooks/dispatcher.startWorker` | 30s |
| `reengagement/worker.startWorker` | 24h |
| `imports/schedules-worker.startWorker` | 60s |
| `notifications/admin-digest.startWorker` | 30min (fires at configured hour) |
| `db/backup-worker.startWorker` | 1h tick (snapshot at 04:00 UTC) |

Workers expose `getStatus()` surfaced under `/admin/jobs` / `/admin/saude`. **Vercel Functions don't run these** — long-lived workers are VPS-only.

### Auth model

JWT HS256 with payload `{ sub, email, role, tv, iat, exp }`. The `tv` field is the user's `tokenVersion` — bumping it (change-password, logout-all-devices, force-rotate) invalidates all outstanding tokens at the middleware layer (`server/auth/middleware.ts`). 2FA TOTP is gated by issuing an intermediate ticket token with `totp: 'pending'` and a 10-minute exp.

Public read-only API uses a parallel mechanism: `pcok_*` tokens hashed SHA-256, scopes enforced by `requireApiToken(scope?)`. See `docs/api-public.md`.

### Validation contract

`shared/schemas.ts` is the single source of truth for both client and server Zod schemas (Zod v4). Naming convention: `createXSchema` for POST bodies, `updateXSchema = createXSchema.partial()`. Server always validates via `validate(schema, body)` from `server/http.ts`, returning `jsonError(c, 400, 'VALIDATION', …)` on failure. Frontend infers types via `z.infer<typeof xSchema>`.

**Zod v4 + React Hook Form pitfall:** Zod v4 is stricter (e.g. `z.string().email()` rejects addresses without TLD). Always pass `onInvalid` to `handleSubmit` and surface validation errors in a toast/banner — otherwise the form silently does nothing on submit.

### Encryption at rest

`server/db/encryption.ts` exposes `encryptApiKey` / `decryptApiKey` returning `<iv>.<ct>.<tag>` base64 with AES-GCM 256, master key derived from `AI_KEY_ENCRYPTION_SECRET`. Used for: payment gateway keys, email provider keys, webhook HMAC secrets, import connector credentials, AI provider keys, TOTP seeds. **Without `AI_KEY_ENCRYPTION_SECRET`** dev mode falls back to a `dev:` prefix + base64 — flagged as insecure but lets local dev run without a master key.

### AI provider abstraction

`server/ai/providers/` — six providers (Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq) implement a common `AiProvider` interface. Configs live in `ai_configurations` (DB) or JSON, keys decrypted only at call time. Admins switch provider/model from `/admin/ias` with no redeploy. Adding a provider = new file in `providers/` + register in `providers/index.ts`.

### Outras abstrações multi-provider (mesmo padrão)

| Domínio | Providers | Localização |
|---|---|---|
| Pagamentos | 6 (Mock, Stripe, Asaas, Pagar.me, MercadoPago, PayPal) | `server/payments/providers/` |
| E-mail | 8 (Mock, Resend, SendGrid, Postmark, Mailgun, Brevo, AWS SES, SMTP nativo) | `server/notifications/email/` |
| Webhooks outbound | 7 tipos (Generic, Slack, Discord, Telegram, Teams, Mattermost, Pushover) | `server/webhooks/` |
| Imports | 3 connectors (WP, LearnDash, WooCommerce) + CSV | `server/imports/connectors/` |

Padrão idêntico ao de IA: interface comum, factory, credenciais AES-GCM, switch sem redeploy.

### Frontend data flow

`src/app/data/client.ts` (`request<T>` + `ApiError`) is the single fetch wrapper — adds Bearer token from `localStorage['ava-pco-auth']`, handles JSON+text, dispatches a `auth:expired` window event on 401 so `AuthContext` can sign out.

`src/app/data/api.ts` is a thin namespace of typed callers; `src/app/data/hooks.ts` wraps them in TanStack Query hooks. Pages should consume hooks, not call `request` directly.

Routes are in `src/app/routes.tsx` — three layouts (`StudentLayout`, `AdminLayout`, `LearningLayout`), nearly all pages lazy-loaded. Admin routes nest under `/admin/*` and are guarded by `ProtectedRoute` with role check.

### Styling

Tailwind CSS 3 with PostCSS. Config in `tailwind.config.js` + `postcss.config.js`. No component library — utility classes throughout, with custom `@media print` rules for certificates/invoices.

## Conventions to keep

- **Aditivo, não destrutivo.** New features plug in without changing existing public contracts (URLs, schemas, JSON keys). The same goes for repo signatures — add new exports, don't rename.
- **Server returns HTML for printable docs (certificates, invoices)**; frontend triggers `window.print()` with `@media print` styles. No PDF generation deps.
- **Workers via `setInterval`, not external cron.** Anything that needs to run periodically goes in a `*Worker` module with `startWorker(intervalMs)` + `getStatus()`.
- **JSON in `data/*.json` with hashes/secrets is gitignored.** Only explicit seed files commit.
- **Audit/errors/log buffer** are observability primitives that already exist — wire new sensitive mutations through `auditMiddleware` and surface 5xx via `recordError`.

## Tests

Vitest with jsdom env, setup at `test/setup.ts`. Tests live in `test/` (not colocated). Most are unit/integration on server modules; component tests use Testing Library. Coverage runs via `npm run test:coverage`. Coverage badge no README atualiza com `npm run coverage:badge` (lê `coverage/coverage-summary.json` e reescreve a linha do badge).

When adding a feature, add tests in the same sprint — the project pattern is 3–10 new tests per sprint. Server stores ship with their own test (e.g. `test/wishlist-store.test.ts`).

### E2E (Playwright)

Suite smoke em `e2e/` rodada com `npm run e2e` (chromium-only). Pré-requisitos: `npm run e2e:install` (instala chromium) e `npm run build` (gera `dist/` que o `webServer` config serve via `server/dev.ts` em SERVE_STATIC mode, porta 5173 default). Tipos isolados em `e2e/tsconfig.json` para não conflitar com vitest. CI roda como job `e2e` separado, com `continue-on-error: true` enquanto a suite cresce.

## Deploying production (VPS)

The production target is a Node VPS, not Vercel. After `git push origin main`:

```bash
# Full deploy (git pull + npm install + build + restart)
HOST=177.7.35.13 USER_NAME=avapco PORT=22 SSH_PASSWORD='…' \
  python scripts/update_vps_pwd.py

# Restart only (no rebuild)
HOST=177.7.35.13 USER_NAME=avapco PORT=22 SSH_PASSWORD='…' \
  python scripts/restart_vps.py
```

The app runs via `tsx` (not a built Node entrypoint) under `nohup` (no systemd unit). Health check: `curl http://127.0.0.1:3035/api/health` should return `{"ok":true}`. Logs in `~/ava-pco/app.log` on the host.

When the user says "atualize a produção", run `restart_vps.py` (after pushing) — it uses `setsid + nohup` to detach the process, avoiding the `pkill`-kills-ssh-channel hang that `update_vps_pwd.py` historically had.

## Reference docs

`docs/` has deeper notes per subsystem when you need them:
`architecture.md`, `security.md`, `payments.md`, `imports.md`, `webhooks.md`, `webhooks-cookbook.md`, `email.md`, `engagement.md`, `live-sessions.md`, `analytics.md`, `admin-ops.md`, `admin-user-guide.md`, `api-public.md`, `deploy.md`, `production-checklist.md`, `migration-wp-ld.md`.

## Migração WP/LD/WC — alunos, cursos e progressões NÃO migraram direito

Migração dos dois sites WP (`portalpco.online` LMS + `psicanaliseclinica.online` loja) para o AVA. Os dados de **alunos, cursos e progressões em produção estão sabidamente errados** desde o deploy v2 (2026-05-15) — não confiar neles antes da v3 reaplicar.

**O que está quebrado em produção hoje:**

| Entidade | Estado em prod (v2) | Estado esperado |
|---|---|---|
| Alunos (`users.json`) | 1641 importados, **333 faltando**, **~436 com nomes spam SEO** (Russian blogspot etc.) | ~1972 únicos limpos |
| Cursos (`courses.json`) | 13 LD + 3 seed, mas 7 estão como `draft` no portal e foram importados como ativos | 6 publicados ou flag `published` por curso |
| Matrículas (`admin-students.progressByCourse`) | **10.205 enrollments fantasma** — cada um dos 785 alunos aparece em todos os 13 cursos | ~1500 reais |
| Progressões | 679 registros não-zero, média 39.7% — **amarrados aos enrollments errados**, então quase todos apontam pro curso errado | progresso só nos cursos realmente cursados |
| `external-references.json` | 14.049 entries com colisões portal↔psi (mesmo WP user ID em ambos os sites era fundido num só) | refs prefixadas `portal:` / `psi:` |

**Por que quebrou (raiz):**

1. `GET /ldlms/v2/cursos/{id}/usuarios` mente quando autenticado como admin — retorna **todos** os users do site, não os matriculados. Fix: iterar users e chamar `/users/{id}/courses`.
2. WP user IDs colidem entre os dois sites (`1125` é Adriana no portal e spam no psi) e o `refsStore` fundia ambos. Fix: prefixar com origem.
3. Bots SEO encheram `display_name` de 436 customers do psi com lixo russo. Fix: `filterSpam()` com 8 patterns.

**Status da recuperação v3 (= re-migrar tudo do zero com os fixes):** o pipeline é o mesmo dos scripts de import — re-coleta busca **alunos + cursos + aulas + tópicos + matrículas + progressões + produtos + pedidos** dos dois WP via REST com os connectors corrigidos; re-aplica persiste em `data/*.json` substituindo o estado v2 quebrado.

Estado:
1. ✅ Código corrigido (`server/imports/connectors/ld.ts`, `scripts/migrate_wp_to_ava.ts`)
2. ✅ Reset local executado (`scripts/reset_imported_data.ts` — mantém só seeds + superadmin)
3. ⏳ **Re-coleta v3 rodando em background** (~30 min) — gera novo dump em `data/migration/<ts>/raw/{portal,psi}.json`
4. ⏳ Re-aplicar: `npx tsx scripts/migrate_wp_to_ava.ts --apply --from-raw=data/migration/<ts>` (~15 min) → reescreve `users.json`, `admin-students.json`, `external-references.json`, `payment-products.json` com dados corretos
5. ⏳ `npx tsx scripts/import_lessons_and_map_products.ts` → monta `courses.json` com aulas e link cursos↔produtos
6. ⏳ Sync para VPS: `python scripts/sync_data_to_vps.py` + restart
7. ⏳ Secundários: 112 questões → `question-bank.json`, 77 posts → `news.json`, 1 cupom → `coupons.json`

**Antes de mexer na migração, releia `docs/migration-wp-ld.md`** — é o handoff vivo com slugs PT-BR, snapshot de contagens, mappings, seções "Bug #1/#2/#3" e checklist em "Como continuar de onde paramos". Creds dos dois WP ficam em `.env.import` (gitignored).
