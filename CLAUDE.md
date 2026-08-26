# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

| Module                                   | Tick                             |
| ---------------------------------------- | -------------------------------- |
| `webhooks/dispatcher.startWorker`        | 30s                              |
| `reengagement/worker.startWorker`        | 24h                              |
| `imports/schedules-worker.startWorker`   | 60s                              |
| `notifications/admin-digest.startWorker` | 30min (fires at configured hour) |
| `db/backup-worker.startWorker`           | 1h tick (snapshot at 04:00 UTC)  |

Workers expose `getStatus()` surfaced under `/admin/jobs` / `/admin/saude`. **Vercel Functions don't run these** — long-lived workers are VPS-only.

### Auth model

JWT HS256 with payload `{ sub, email, role, tv, iat, exp }`. The `tv` field is the user's `tokenVersion` — bumping it (change-password, logout-all-devices, force-rotate) invalidates all outstanding tokens at the middleware layer (`server/auth/middleware.ts`). 2FA TOTP is gated by issuing an intermediate ticket token with `totp: 'pending'` and a 10-minute exp.

Public read-only API uses a parallel mechanism: `pcok_*` tokens hashed SHA-256, scopes enforced by `requireApiToken(scope?)`. See `docs/api-public.md`.

**Onde mora a credencial:** `server/auth/users-store.ts` tem dois backends. Sem `AUTH_STORE`, persiste em `data/users.json`; com `AUTH_STORE=db` (**produção desde 19/ago/2026**), nas colunas de credencial da tabela `users`. Antes disso, login e aluno viviam em bases separadas e sem sincronia — quem entrava por um caminho que escrevia só no banco aparecia no admin com matrícula e não conseguia logar. Reverter é remover a variável e reiniciar; o JSON segue congelado no estado da virada. Detalhes e a ordem de migração em `docs/security.md`.

A lista de contas é lida para a memória **no boot**: conta criada por outro processo (script, SQL direto) só passa a existir para quem está servindo depois de um restart.

### Validation contract

`shared/schemas.ts` is the single source of truth for both client and server Zod schemas (Zod v4). Naming convention: `createXSchema` for POST bodies, `updateXSchema = createXSchema.partial()`. Server always validates via `validate(schema, body)` from `server/http.ts`, returning `jsonError(c, 400, 'VALIDATION', …)` on failure. Frontend infers types via `z.infer<typeof xSchema>`.

**Zod v4 + React Hook Form pitfall:** Zod v4 is stricter (e.g. `z.string().email()` rejects addresses without TLD). Always pass `onInvalid` to `handleSubmit` and surface validation errors in a toast/banner — otherwise the form silently does nothing on submit.

### Encryption at rest

`server/db/encryption.ts` exposes `encryptApiKey` / `decryptApiKey` returning `<iv>.<ct>.<tag>` base64 with AES-GCM 256, master key derived from `AI_KEY_ENCRYPTION_SECRET`. Used for: payment gateway keys, email provider keys, webhook HMAC secrets, import connector credentials, AI provider keys, TOTP seeds. **Without `AI_KEY_ENCRYPTION_SECRET`** dev mode falls back to a `dev:` prefix + base64 — flagged as insecure but lets local dev run without a master key.

### AI provider abstraction

`server/ai/providers/` — six providers (Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq) implement a common `AiProvider` interface. Configs live in `ai_configurations` (DB) or JSON, keys decrypted only at call time. Admins switch provider/model from `/admin/ias` with no redeploy. Adding a provider = new file in `providers/` + register in `providers/index.ts`.

### Outras abstrações multi-provider (mesmo padrão)

| Domínio           | Providers                                                                  | Localização                   |
| ----------------- | -------------------------------------------------------------------------- | ----------------------------- |
| Pagamentos        | 6 (Mock, Stripe, Asaas, Pagar.me, MercadoPago, PayPal)                     | `server/payments/providers/`  |
| E-mail            | 8 (Mock, Resend, SendGrid, Postmark, Mailgun, Brevo, AWS SES, SMTP nativo) | `server/notifications/email/` |
| Webhooks outbound | 7 tipos (Generic, Slack, Discord, Telegram, Teams, Mattermost, Pushover)   | `server/webhooks/`            |
| Imports           | 3 connectors (WP, LearnDash, WooCommerce) + CSV                            | `server/imports/connectors/`  |

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

O alvo de produção é um VPS Node, não a Vercel.

**Servidor atual: `195.200.0.253`** (hostname `srv539124`), usuário da app `avapco`,
app em `/home/avapco/ava-pco`, porta `3035`, **gerenciada por PM2** (`ava-pco`).
O `~/.ssh/config` local já tem o atalho `vps` (root, chave `enlevo_vps195`), que é
a via de acesso que funciona — o usuário `avapco` não aceita essa chave, então
comandos da app vão via `sudo -u avapco -i`.

> **O IP `177.7.35.13` que aparecia aqui e em vários docs/scripts está morto** — a
> app migrou para o 195 e a porta 22 do host antigo não responde de lugar nenhum.
> `scripts/update_vps_pwd.py`, `restart_vps.py`, `sync_data_to_vps.py`, `deploy.sh`
> e `docs/migration-*.md` ainda apontam pro host antigo e precisam de revisão.

Deploy manual completo (após `git push origin main`):

```bash
ssh vps 'sudo -u avapco -i bash -c "cd ~/ava-pco \
  && git checkout -- package-lock.json && git fetch --all -q \
  && git reset --hard origin/main \
  && npm install --legacy-peer-deps --no-audit --no-fund \
  && npm run build && pm2 restart ava-pco --update-env"'

# Verificação (deve devolver {"ok":true,...,"db":"connected"})
ssh vps 'sudo -u avapco -i curl -s http://127.0.0.1:3035/api/health'
```

Só restart, sem rebuild: `ssh vps 'sudo -u avapco -i pm2 restart ava-pco'`.

**Gotchas:**

- `git pull` aborta com `package-lock.json` modificado — daí o `git checkout --` antes.
- `git` como root reclama de `dubious ownership` no repo do `avapco`; sempre use `sudo -u avapco`.
- Confirme o que subiu comparando o hash do bundle: `curl -s https://ava.psicanaliseclinica.online/login | grep -o 'assets/index-[^"]*\.js'` contra o `dist/index.html` local. `/api/health` responde 200 mesmo com código velho.
- **O deploy automático vai para o servidor ERRADO** (medido em 21/ago/2026).
  `.github/workflows/deploy.yml` conecta em `srv1621737`, não em produção
  (`srv539124` = 195.200.0.253). Lá existe uma cópia do repo e **nenhum processo
  PM2** — daí o sintoma enganoso: `git pull` e `npm run build` passavam, e só o
  `pm2 restart ava-pco` falhava com "Process or Namespace not found".
  Prova: o deploy automático "puxou" `ed524f8` e produção continuou em `7440f2a`
  até o deploy manual.
  **Correção (só o dono pode):** trocar os secrets `VPS_HOST` **e**
  `VPS_PASSWORD` juntos — a senha guardada é do host errado. Produção aceita
  senha (`50-cloud-init.conf` traz `PasswordAuthentication yes` e vence o
  `60-cloudimg-settings.conf`; no sshd a primeira ocorrência manda).
  Enquanto isso, o workflow checa `pm2 describe ava-pco` **antes** de qualquer
  pull e falha dizendo o hostname, em vez de trabalhar à toa.

Logs: `pm2 logs ava-pco` ou `~/ava-pco/app.log`.

## Reference docs

`docs/` has deeper notes per subsystem when you need them:
`architecture.md`, `security.md`, `payments.md`, `imports.md`, `webhooks.md`, `webhooks-cookbook.md`, `email.md`, `engagement.md`, `live-sessions.md`, `analytics.md`, `admin-ops.md`, `admin-user-guide.md`, `api-public.md`, `deploy.md`, `production-checklist.md`, `migration-wp-ld.md`, `prazo-de-acesso.md`, `sessoes.md`.

## Sessões: opcionais por LEI, e o preço vem da titulação

Análise, supervisão e orientação são contratadas à parte e **nunca** podem ser
requisito de curso: condicionar a venda é **venda casada**, vedada pelo art. 39,
I, do CDC. Por isso a regra é código, não parágrafo — `server/sessions/regra-opcional.ts`,
exposta em `GET /sessions/policy`, com testes que cobram a citação da lei.

O preço vem de **quem atende**, não do serviço: `session_price_tiers` (escola
R$ 80 / mestrado R$ 140 / doutorado R$ 450). E `professionals.available` ≠
`active` — agenda cheia é estado do dia, e é `available` que decide quem aparece
para o aluno. Detalhes em `docs/sessoes.md`.

**O agendamento existe desde 26/ago/2026** (`server/sessions/bookings-repo.ts`,
`POST /sessions/bookings`). Três coisas que não são óbvias: o preço e os nomes
são **copiados** para o agendamento, para que reajuste de faixa não mude o que
já foi combinado; profissional sem serviço marcado ou sem faixa de preço ativa
**não é oferecido** (falha fechada — antes, sem serviço marcado ele era
oferecido para todos); e as rotas públicas de profissional omitem `email` e
`hourlyRate`, que só saem em `/admin/sessions/professionals`.

**O pagamento reusa o checkout dos cursos, menos o preço.**
`POST /sessions/bookings/:id/checkout` usa os mesmos gateways e a mesma tabela
de pedidos, mas o valor vem do agendamento, não de uma linha de produto —
sessão custa conforme a titulação de quem atende, então não há produto que a
descreva. O pedido leva `kind: 'session_pack'` e `refId` do agendamento; o
webhook `paid` confirma, o estorno devolve para `pending_payment` (cancelar de
vez é decisão de gente). Ver `docs/sessoes.md`.

## Aulas: `description` é resumo, `content` é o corpo

Dois campos, e confundi-los já custou caro. A importação grava `description`
cortada em `slice(0,500)` e `content` com o HTML completo. Até 21/ago/2026 a
tabela `lessons` não tinha coluna para o conteúdo, então 309 aulas em produção
terminavam no meio da frase. Corrigido pela migration 0008 +
`scripts/restaurar_conteudo_aulas.ts` (522 aulas, 2,93 mi de caracteres).

O `slice(0,500)` continua nos scripts de importação — reimportar cortaria de
novo. Ver `docs/migration-wp-ld.md`.

## Prazo de acesso — declarar os meses é RETROATIVO

Cada curso define por quantos meses a matrícula dá acesso (`accessMonths`, sem
coluna própria: vive em `courses.meta` jsonb). Portão único:
`courseAccessFor()` em `server/access/guard.ts`, no mesmo espírito de
`isPubliclyListed()`.

**A armadilha:** `resolveExpiry` só respeita o prazo **gravado na matrícula**.
Matrícula sem prazo gravado — todas as que vieram da importação — passa a valer
`enrolledAt + accessMonths` no instante em que o curso declara o prazo. Com
datas reais de 2021 a 2026, declarar "6 meses" tranca centenas de uma vez.
Isso é o comportamento desejado; o que não pode é ser descoberto depois.

Duas ferramentas para isso, ambas em `server/access/impacto.ts`:
`GET /admin/courses/:id/impacto-acesso?meses=N` (simula, só lê, aparece ao vivo
ao lado do campo) e `POST /admin/courses/:id/carencia` (grava um prazo comum em
todos os que ficariam vencidos, sem tocar em quem tem prazo próprio).

**O aviso de vencimento existe desde 26/ago/2026**
(`server/access/expiry-worker.ts`, diário, `access-expiry` em `/admin/jobs`):
faixas de 30, 7 e 1 dia mais o aviso de vencido, um por faixa. Antes de declarar
`accessMonths` em qualquer curso, rode
`POST /admin/jobs/access-expiry/run?dryRun=true` — ele lista quem receberia
aviso sem enviar nada.

Em 21/ago/2026 **nenhum dos 6 cursos declarava prazo** — ninguém está vencido.
Detalhes, números por curso e os smokes em `docs/prazo-de-acesso.md`.

## Migração WP/LD/WC — alunos, cursos e progressões NÃO migraram direito

Migração dos dois sites WP (`portalpco.online` LMS + `psicanaliseclinica.online` loja) para o AVA. Os dados de **alunos, cursos e progressões em produção estão sabidamente errados** desde o deploy v2 (2026-05-15) — não confiar neles antes da v3 reaplicar.

**O que está quebrado em produção hoje:**

| Entidade                                       | Estado em prod (v2)                                                                                                     | Estado esperado                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Alunos (`users.json`)                          | 1641 importados, **333 faltando**, **~436 com nomes spam SEO** (Russian blogspot etc.)                                  | ~1972 únicos limpos                        |
| Cursos (`courses.json`)                        | 13 LD + 3 seed, mas 7 estão como `draft` no portal e foram importados como ativos                                       | 6 publicados ou flag `published` por curso |
| Matrículas (`admin-students.progressByCourse`) | **10.205 enrollments fantasma** — cada um dos 785 alunos aparece em todos os 13 cursos                                  | ~1500 reais                                |
| Progressões                                    | 679 registros não-zero, média 39.7% — **amarrados aos enrollments errados**, então quase todos apontam pro curso errado | progresso só nos cursos realmente cursados |
| `external-references.json`                     | 14.049 entries com colisões portal↔psi (mesmo WP user ID em ambos os sites era fundido num só)                          | refs prefixadas `portal:` / `psi:`         |

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
