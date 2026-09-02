# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**AVA PCO** — Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online. LMS full-stack TypeScript: React 18 SPA + Hono API. Single repo deploys to Vercel (functions) **or** to a Node VPS (`server/dev.ts` serves both `/api/*` and the static `dist/`).

## Common commands

Repo root é `H:\ia\dev\pco\` — `package.json`, `.git` e todas as pastas (`src/`, `server/`, `shared/`, `api/`, etc.) ficam aqui. Não existe mais subpasta `Pco/` (consolidado em 2026-05-22).

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

**`attachUser` NÃO autentica.** Ele roda em `app.use('*')` e coloca o usuário
no contexto **quando há token** — quem exige é `requireAuth`, rota a rota. Ler
o código rápido dá a impressão de um middleware global de autenticação onde
existe só um de conveniência. Em 27/ago/2026 isso custou caro: `GET
/admin/students` devolvia nome, e-mail, progresso e risco de todos os alunos
sem token nenhum, e mais sete rotas estavam na mesma situação.

Duas suítes vigiam isso e devem ser mantidas:

- `test/admin-rotas-sem-auth.test.ts` — percorre `app.routes` e cobra 401 em
  **toda** rota `/admin/*`. Amostra não serve: foi uma amostra que deixou
  passar as cinco.
- `test/rotas-publicas-inventario.test.ts` — mantém a lista do que é público
  **com o motivo escrito**. Tornar uma rota pública exige acrescentá-la ali.

**O padrão a procurar:** par de rotas em que a de escrita tem guarda e a de
leitura não. Foi a forma de quatro dos oito problemas encontrados naquele dia,
inclusive o vazamento do material pago.

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

Suite smoke em `e2e/` rodada com `npm run e2e` (chromium-only). Pré-requisitos: `npm run e2e:install` (instala chromium) e `npm run build` (gera `dist/` que o `webServer` config serve via `server/dev.ts` em SERVE_STATIC mode, porta 5173 default). Tipos isolados em `e2e/tsconfig.json` para não conflitar com vitest. CI roda como job `e2e` separado e **bloqueia o merge desde 26/ago/2026** — o
`continue-on-error: true` que este parágrafo descrevia foi removido lá, e era ele
que escondia uma suíte que nunca rodava inteira.

## Deploying production (VPS)

O alvo de produção é um VPS Node, não a Vercel.

**Servidor atual: `195.200.0.253`** (hostname `srv539124`), usuário da app `avapco`,
app em `/home/avapco/ava-pco`, porta `3035`, **gerenciada por PM2** (`ava-pco`).
O `~/.ssh/config` local já tem o atalho `vps` (root, chave `enlevo_vps195`), que é
a via de acesso que funciona — o usuário `avapco` não aceita essa chave, então
comandos da app vão via `sudo -u avapco -i`.

> **O IP `177.7.35.13` está morto** — a app migrou para o 195 e a porta 22 do host
> antigo não responde de lugar nenhum. Onde ele ainda aparece hoje, aparece
> **dito morto**: nos docs, num comentário do `deploy.sh` e nos logs de migração,
> que são registro histórico e ficam como estão.
>
> **A revisão dos scripts foi feita em 2/set/2026, e o problema deles não era o
> IP** — os três leem o host de variável de ambiente e nunca tiveram IP fixo.
> Era o PM2: `restart_vps.py`, `update_vps_pwd.py` e o bloco final do
> `sync_data_to_vps.py` são anteriores a ele e subiam a app com
> `setsid nohup npx tsx`, **por fora** do processo gerenciado. O
> `sync_data_to_vps.py` ainda dava `pkill` antes — o PM2 reergue o que foi
> morto, os dois disputam a 3035, e produção fica em laço de reinício. Os dois
> primeiros agora **recusam** rodar sem `SEI_O_QUE_FACO=1` e dizem qual é o
> caminho; o terceiro passou a reiniciar via `pm2 restart ava-pco`.
>
> **O `AGENTS.md` era o pior deles**, e não é script: mandava, com todas as
> letras, rodar `restart_vps.py` quando o usuário pedisse "atualize a produção".
> Era uma cópia congelada deste arquivo (195 linhas contra 642) e virou um
> ponteiro para cá. Instrução errada em arquivo escrito para agente não é doc
> desatualizado — é ordem que alguém executa.

**Acesso SSH resolvido em 27/ago/2026:** a chave está instalada no usuário
`avapco` (pelo painel da Hostinger), e o atalho `vps` aponta para ele. Como o
`avapco` é o dono da app, **não é mais preciso `sudo -u avapco -i`**.

O caminho recomendado é `bash scripts/deploy_producao.sh`, que confere estar no
servidor certo antes de tocar em nada, faz backup do `data/` e compara o hash
do bundle antes e depois — `/api/health` responde 200 com código velho, então é
o bundle que prova que o deploy subiu.

**Migração é passo separado, e vem antes.** `pco_lms_app` não faz DDL; use
`DATABASE_URL=<owner> npx tsx server/db/migrate.ts` a partir da máquina local
(o banco DivZ aceita conexão de fora, então a credencial de owner não precisa
tocar o disco do servidor). Se o `db:migrate` tentar recriar tabela que já
existe, o problema é carimbo divergente no journal — ver `docs/deploy.md`.

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
- **O deploy automático foi consertado em 30/ago/2026** — passou a autenticar
  por **chave**, não por senha. O problema anterior: `.github/workflows/deploy.yml`
  conectava em `srv1621737`, não em produção (`srv539124` = 195.200.0.253). Lá
  existe uma cópia do repo e **nenhum processo PM2** — daí o sintoma enganoso:
  `git pull` e `npm run build` passavam, e só o `pm2 restart ava-pco` falhava
  com "Process or Namespace not found". Host e senha guardados eram do mesmo
  servidor errado, então acertar só um não resolvia.
  **O que mudou:** secrets `VPS_SSH_KEY` (chave `~/.ssh/pco_deploy`, já instalada
  no usuário `avapco`), `VPS_HOST=195.200.0.253`, `VPS_USER=avapco`,
  `VPS_PORT=22`, `PUBLIC_URL`. O secret `VPS_PASSWORD` foi **removido** — não há
  mais senha guardada. O workflow segue checando `pm2 describe ava-pco` **antes**
  de qualquer pull e falha dizendo o hostname, em vez de trabalhar à toa.
  ✅ **Rodou em 31/ago/2026**, depois de a cobrança ser regularizada: tipos, lint,
  testes e build passaram e o deploy automático subiu sozinho. O deploy manual
  (`scripts/deploy_producao.sh`) continua valendo e é o que confere o hash do
  bundle — use-o quando quiser certeza imediata.

**Quando o deploy automático falhar por rede, não perca tempo relendo o
workflow.** Em 1º/set/2026 ele falhou com `ssh: connect to host ***: Connection
timed out` — o runner do GitHub não alcançou o VPS, enquanto o SSH da máquina
local funcionava no mesmo minuto. Não era código nem chave. O caminho é
`bash scripts/deploy_producao.sh`, que confere o host, faz backup do `data/` e
compara o hash do bundle. **Bundle igual antes e depois é esperado** quando o
commit não toca no frontend — o aviso do script é genérico; confirme pelo
`git log -1` do servidor.

Logs: `pm2 logs ava-pco` ou `~/ava-pco/app.log`.

## Onde o trabalho parou

O handoff vivo é **`docs/SESSAO-2026-09-02-vazamento-e-checkout.md`** — comece
pelo fim dele, em "Por onde retomar". O de mais cedo no mesmo dia,
`SESSAO-2026-09-02-campo-sem-coluna.md`, é independente e continua valendo.

**Há trabalho salvo fora da `main`.** A branch
**`entrega-2-vazamento-curso`** (`b02a67b`, publicada no GitHub) fecha o
vazamento do curso interno e **não tem testes ainda** — por isso não foi
mergeada nem subiu. Não a mergeie sem escrever
`test/curso-interno-nao-vaza.test.ts`; o caso que mais importa é o dos **655
alunos de "Como ser um Super Aluno Online"**, que é `publicListed: false` e
sumiria da tela deles se o filtro olhasse só para visibilidade.

**A venda estava quebrada e voltou** (commit `a3872c3`, no ar): o Pagar.me
recusava toda compra feita por dentro do app. Falta a prova que só o dono pode
dar — uma compra de ponta a ponta.

**Três telas seguem incompletas:** PCNews não abre matéria, Podcasts não têm
player e a Biblioteca não tem upload. Detalhes e ordem no handoff.

**O bloqueio dos vídeos foi resolvido em 1º/set/2026** — e não era só a Vimeo.
O dono autorizou o domínio na conta "Psicanalise Digital"; faltavam ainda o
`frame-src` da nossa CSP e a política de referer no iframe. Ver
"Vídeo de aula" mais abaixo antes de reabrir o assunto.

## Copiar a pasta do projeto não copia o git

Em 31/ago/2026 o repositório mudou de `C:` para `H:`. Os arquivos vieram
inteiros; o `.git`, não — veio dez commits atrás, e todo o trabalho já publicado
aparecia como "alteração por salvar". Uma sessão que começasse ali refaria tudo
ou commitaria por cima. Parte dos objetos veio pela metade: `git log` dava erro.

**Regra:** depois de mover ou copiar o projeto, `git fetch && git status` **antes**
de qualquer edição. A cópia em `C:\ia\dev\pco` ainda existe, aponta para o mesmo
remoto e será apagada pelo dono.

## Script de manutenção precisa carregar o `.env`

Dois no mesmo dia miraram o seed em vez do banco por não importarem
`dotenv/config`: o resolvedor de duração e o aplicador de conteúdo. Ambos
**diziam o que iam gravar** — na base errada. Rode sempre sem `--commit` /
`--aplicar` primeiro e confira a linha `[db] conectado ao Postgres`.

## O desenho do site vem de fora do repositório

A referência visual **não é o código**: é um projeto do Claude Design aprovado
pelo dono ("Inspiração Loyalist College"). O pacote completo e atual é
**`design pagina publicas pco/design_handoff_ava_paginas_publicas/`** (17
artboards, `tokens.css`, `assets/`, `seo/`) — comece pelo `README-HANDOFF.md`
dele. `docs/design/` é uma cópia **parcial e mais velha** (9 artboards, sem
`SiteHeader`/`SiteFooter`); em 31/ago/2026 foi ela que fez os botões e as CTAs
saírem fora do padrão.

Isso está escrito aqui porque já custou: em 30/ago/2026 só o resumo
(`CHANGELOG-design.md`) foi aplicado, o handoff completo nunca chegou ao
repositório, e a sessão seguinte começou a refazer a página do curso a partir
do código existente — que era exatamente o que devia ser substituído.

**Antes de mexer em qualquer tela pública, confira se ela já tem artboard.**

Duas coisas do protótipo nunca atravessam para o produto: **preço** (é do
produto ativo, em `/admin/produtos` — o `price: 1497` de lá é maquete) e
**contagem de módulos/aulas/horas** (conta-se do curso real). Texto atravessa;
número e oferta, não.

## Link interno não pode apontar para um 301

`/catalogo`, `/comparar` e `/landing` viraram redirecionamento em 30/ago/2026.
O botão **"Matricular-se"** da página do curso continuou apontando para
`/catalogo` — quem decidia comprar era devolvido à lista de cursos. No mesmo
período o `/checkout`, que funciona e conversa com `POST /public/checkout`,
ficou **sem um único link apontando para ele** em todo o produto.

Ou seja: o diagnóstico de que "o site não fecha venda" era creditado só à falta
de preço, e havia esta segunda causa, que sobreviveria ao cadastro dos preços.

O mapa de rotas fundidas saiu de dentro do `server/dev.ts` para
`server/public/rotas-fundidas.ts` justamente para poder ser testado, e
`test/links-internos.test.ts` cobra o que ninguém cobrava.

## Tags de marketing: só identificador entra, nunca script

`/admin/marketing` (desde 31/ago/2026). O campo "cole aqui o código do Google"
seria XSS com aparência de recurso: conta de admin comprometida executaria
JavaScript em toda página, para todo visitante. Então cada campo valida o
formato do provedor (`GTM-…`, `G-…`, dígitos) e **o servidor monta o trecho**,
servido de `/_pub/tags.js` — same-origin, porque a CSP é `script-src 'self'`.

Três consequências que valem lembrar antes de mexer:

- **A CSP só afrouxa o que está cadastrado.** Sem tag, é byte a byte a de antes;
  com GTM libera googletagmanager e não facebook, e vice-versa
  (`hostsParaCsp()`).
- **Tag de HTML customizado dentro do GTM continua barrada** pela mesma CSP. É
  efeito de lado desejado: o painel do GTM não vira porta de execução aqui.
- **Consentimento nasce ligado.** Nada de terceiro sobe antes do aceite, e o
  aviso só aparece quando há tag esperando. Sem JS não há como pedir nem
  respeitar escolha, então o `<noscript>` do pixel só existe quando o site não
  exige aceite.

A **conversão pelo servidor** (`server/marketing/meta-capi.ts`) manda o
`Purchase` quando o pedido vira pago — `event_id` é o id do pedido, para o Meta
deduplicar com o pixel do navegador. PII só em SHA-256 normalizado. Nasce
desligada; o token é cifrado em repouso e nunca volta para a tela.

## Sandra: o gateway em que o dinheiro não passa pelo gateway

Sétimo provedor (`server/payments/providers/sandra.ts`, desde 31/ago/2026). A
cobrança é criada no gateway da **própria escola**, com a credencial dela.

- **A chave de repetição é o `orderId`.** Sem ela, retentativa de rede ou duplo
  clique viram duas cobranças reais. Nunca um id gerado na hora.
- **CPF/CNPJ é obrigatório**, conferido aqui com dígito verificador antes de
  chamar — para que erro de formulário volte como erro de formulário.
- **`502` não é para repetir**: vem com `invoiceId`, a fatura existe e a escola
  reemite pelo painel.
- **`charge.paid` ainda não é emitido** (fase 2 na Sandra). Quem confirma é
  `payments/sandra-poll-worker.ts`, de 5 em 5 min, parando 10 dias depois do
  pedido. `parseWebhook` já está no contrato documentado e recusa o que não bate.

Configuração fica em `options` do gateway: `baseUrl`, `tenantSlug`, `metodo`.
Doc de origem: `H:\ia\dev\Sandra\docs\cobranca-api\`.

## Vídeo de aula: a Vimeo era metade do problema, e a outra metade era nossa

Os vídeos da PCO são `privacy.embed: "whitelist"`. Por um tempo a lista só
autorizava `portalpco.online`, e disso saiu o diagnóstico "é a Vimeo" — que
ficou de pé por dias e escondeu duas causas dentro do próprio código.

**O domínio foi autorizado pelo dono em 1º/set/2026** e está medido:
`player.vimeo.com/video/<id>` responde **200 com `Referer` do site** e **403 sem
ele**; o oEmbed devolve `domain_status_code: 200` e a duração junto.

As duas causas que sobraram, ambas nossas:

1. **A CSP não emitia `frame-src`.** A diretiva só existia quando havia tag de
   marketing cadastrada; sem tag, caía em `default-src 'self'` — e o site
   **bloqueava o próprio player**, em toda aula, para todo aluno. Corrigido em
   `server/public/csp.ts`, que existe separado justamente para poder ser
   testado (`test/video-da-aula.test.tsx`).
2. **O `Referer` não chegava à Vimeo.** O site responde com *dois*
   `Referrer-Policy`: o nosso, `strict-origin-when-cross-origin`, e um
   `same-origin` posto por um proxy à frente — e o `same-origin` zera o referer
   para terceiros, que é o mesmo que a Vimeo enxerga como domínio não
   autorizado. O conserto é a política **por elemento** no iframe
   (`src/app/components/VideoAula.tsx`), que vence a do documento e é o que o
   embed oficial da Vimeo já traz.

**A mensagem engana.** "Este conteúdo está bloqueado — entre em contato com o
proprietário do site" é escrita pela Vimeo e se lê como problema de conta.
Antes de mexer na conta, meça: `curl -sI -H "Referer: https://<dominio>/"
https://player.vimeo.com/video/<id>`. 200 ali significa que a Vimeo está certa e
o problema é daqui.

De quebra, a preview pública montava o embed com `<video src>` — e
`player.vimeo.com/video/<id>` devolve uma **página**, não um arquivo de mídia.
Nunca funcionou. As duas telas passaram a usar o mesmo `VideoAula`.

**Durações:** as aulas com vídeo já têm duração real (2 a 14 min). O placeholder
de 15 min sobrou nas **363 aulas sem vídeo nenhum**, e o resolvedor se recusa a
inventar duração para elas — corretamente. De 590 aulas, 171 têm vídeo.

**A URL do vídeo também vinha escapada** (corrigido em 2/set/2026). Ela é
extraída de dentro de um atributo HTML — o regex de `extract_video_url` parar em
`"` e `<` é o sinal disso — e ali `&` vem como `&amp;`. Três aulas em produção
tinham `?color&amp;autopause=0&amp;dnt=true`, o que a Vimeo lê como os
parâmetros `amp;autopause` e `amp;dnt` e ignora sem reclamar: o vídeo toca e a
configuração não vale, inclusive o "não rastreie este espectador". Corrigido na
entrada (`server/imports/pipeline/transforms.ts`, desescapando **depois** de
casar o regex, senão `&lt;` viraria `<` e cortaria a URL) e nas 3 linhas por
`scripts/corrigir_entidades_video.ts`. Mesmo caso do título: valor lido de
dentro de HTML não é o valor.

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

## Dois limitadores no mesmo caminho dividiam o contador

`server/rate-limit.ts` guardava o balde na chave `ip:path`. Como existe um
limitador global (`app.use('*')`, 120/min) por cima dos de rota, os dois
incrementavam **o mesmo contador**. Duas consequências, ambas em produção e
nenhuma visível de fora, porque o 429 é o mesmo que o atacante recebe:

- **`/auth/login` bloqueava na 3ª tentativa, não na 6ª.** `max: 5` valia 2, e
  quem errava a senha duas vezes ficava um minuto fora.
- **Janela curta vencia janela longa.** `/auth/forgot-password` pede 3 por 5
  minutos; o global cria o balde com `resetAt` de 1 minuto, e quem chega
  primeiro define a janela — a proteção durava um quinto do previsto.

Corrigido em 1º/set/2026 com um escopo por instância de limitador. Se for
empilhar mais um `rateLimit` em cima de rota que já tem o seu, é isto que faz
os dois conviverem. Coberto por `test/rate-limit.test.ts`.

## O E2E local rodava contra produção

`playwright.config.ts` monta o `webServer` herdando o `process.env` de quem
chamou — e a máquina de quem desenvolve tem um `.env` com as credenciais reais.
Sem trava, `npm run e2e` criava matrícula e agendamento **no banco da escola**, e
`PUBLIC_ORIGIN` fazia o servidor local responder 301 para o domínio de produção,
travando o Playwright à espera de um servidor que só redirecionava.

Agora `DATABASE_URL` e `PUBLIC_ORIGIN` são fixados em branco no `webServer`. Em
CI nenhuma das duas existe, então isso não muda nada lá. **Ao acrescentar
variável nova ao `webServer`, pense se ela também precisa ser neutralizada.**

Três coisas que mantinham a suíte vermelha e foram consertadas junto:

- O aluno da suíte nasce de `INITIAL_STUDENT_PASSWORD` — tem credencial e não
  tem ficha, então nunca apareceu em `/admin/students`. A busca passou a ser em
  `/admin/users`, e o id da conta é o que `enrollInCourse` usa para criar a
  ficha (o mesmo caminho de quem compra pelo site).
- `enroll-bulk` responde `alreadyEnrolled`; o helper lia `already`, e concluía
  "não matriculou ninguém" justamente quando estava tudo certo.
- `/catalogo` é 301 para `/formacoes` desde 30/ago/2026, e dois testes ainda
  cobravam o endereço antigo.

Com isso a suíte fecha **26 de 26, sem pulados** — rode com `E2E_FRESH=1`
localmente, senão os 12 testes que dependem de login são pulados em silêncio.

## Status de pedido manda na matrícula — por um ponto único

`aplicarSituacaoDoPedido()` em `server/app.ts` é o **único** lugar onde status
de pedido vira acesso. Chamam-no: criar e editar pedido no admin, mudar status,
webhook do gateway (pago e não-pago) e o worker da Sandra. A regra em si mora em
`server/access/situacao-matricula.ts` — pago ativa, estorno e desistência
cancelam, atraso suspende, e nada disso escapa do prazo (`courseAccessFor`).

Três coisas que já custaram caro e não se inferem lendo um arquivo:

- **A regra existir não é a regra rodar.** Entre a manhã e a tarde de
  1º/set/2026 ela existiu testada e documentada, chamada só pelo script de
  importação. Nesse intervalo o lançamento manual "já pago" criava pedido que
  não matriculava ninguém, e estornar pelo admin deixava o aluno estudando.
- **A situação sai de TODOS os pedidos da pessoa para o curso**, não do pedido
  da vez (`situacaoDeVarios`). Quem comprou, foi estornado e comprou de novo
  fica ativo; um pedido novo em aberto não suspende o acesso já pago.
- **`paidAt` não prova pagamento.** A importação da loja o preencheu em todo
  pedido, boleto cancelado incluído. A prova é um evento `paid` no histórico.
  Confiar em `paidAt` quis cancelar cinco matrículas legítimas de produção;
  o ensaio de `scripts/reconciliar_situacao_matriculas.ts` pegou antes de
  aplicar, e o teste que cobra isso é `test/matricula-segue-o-pedido.test.ts`.

Cancelar não apaga: `revokeAccessForOrder` marca `cancelada` e o portão fecha
por ali, preservando data de compra e progresso. `unenrollFromCourse` continua
para o desmatricular do admin — e **ganhou o caminho de banco que nunca teve**;
até 1º/set/2026 ela escrevia só no JSON de semente e era um no-op em produção.

## Checkout: duas rotas de compra, e só uma mandava quem estava comprando

`POST /public/checkout` (visitante) sempre coletou nome, CPF e telefone.
`POST /payments/checkout` (aluno logado) nasceu com três campos e mandava ao
gateway **só o e-mail**. O Pagar.me então derivava o nome de
`email.split('@')[0]` — o `"name":"mariadyduda"` que apareceu no erro — e, sem
documento, recusava a cobrança.

Somado a isso, a API v5 do Pagar.me **recusa o pedido inteiro** quando um método
está em `accepted_payment_methods` e o bloco de configuração dele não vem junto.
Pedíamos cartão, boleto e pix e mandávamos zero blocos. Corrigido em 2/set/2026
montando os dois da mesma lista.

Três coisas que não se inferem lendo o arquivo:

- **Sem CPF, boleto não é oferecido.** Oferecê-lo faz o gateway recusar a compra
  inteira, e a pessoa perde também cartão e pix.
- **O CPF é conferido antes de criar o pedido**, para que dígito trocado volte
  como "confira o número" e não vire pedido órfão em `pending_payment`.
- **`documentoValido` mora em `shared/documento.ts`**, não mais só na Sandra: o
  navegador valida e o servidor revalida, e duas cópias da mesma regra acabam
  discordando — o mesmo motivo de `shared/visibilidade.ts` existir.

## `/api/courses` é público — e não pode levar `content` nem `videoUrl`

> **Metade disto está numa branch, não na `main`** — ver
> `entrega-2-vazamento-curso`. O que está descrito abaixo sobre `videoUrl` e
> sobre o filtro de visibilidade **ainda não está no ar**.

Em 2/set/2026 o dono relatou que o **Treinamento PCO**, curso interno de
operadores, estava visível e cursável por todo aluno. A trava existia e estava
ligada — o curso já era `publicListed: false`, com só 19 matrículas. **Três
caminhos ignoravam a marca**, e o pior deles não era tela: um `curl` sem token
em `/api/courses` baixava o curso inteiro com as 9 URLs de vídeo. Somando os
quatro cursos ativos, **105 URLs expostas** a quem nem estava logado.

Para um curso feito de podcasts gravados, **o vídeo é o curso** — tirar
`content` e deixar `videoUrl` protegia a apostila e entregava a aula.

Dois cuidados que qualquer conserto aqui tem de respeitar:

- **Matrícula entra na conta, não só visibilidade.** "Como ser um Super Aluno
  Online" também é `publicListed: false` e tem **655 alunos legítimos**.
- **Admin escapa.** São 21 telas de administração lendo deste endpoint, e o
  editor de curso precisa do `videoUrl` para editá-lo.

## `/api/courses` — o que já estava resolvido antes disso

O catálogo é aberto de propósito (ementa vende), mas `listCourses()` inclui
`lesson.content`. Até 27/ago/2026 um `curl` sem token baixava o material pago
de todos os cursos — os 2,93 mi de caracteres restaurados pela migration 0008.

`server/access/conteudo-aula.ts` tira o corpo nas rotas públicas; o aluno pega
por `GET /me/courses/:courseId/lessons/:lessonId/content`, que passa por
`courseAccessFor` (matrícula **e** prazo). A chave é removida, não esvaziada:
`content: ''` faria a tela mostrar a descrição como se fosse a aula.

## Analytics: a medição é própria, sem cookie e sem IP

`server/analytics/` mede o tráfego do site desde 27/ago/2026 — antes disso
`/admin/metricas` e `/admin/retencao` eram quase inteiramente números
inventados dentro do `.tsx`. O beacon manda um sinal por página; o que persiste
é contador por dia (`analytics_daily` ou `data/analytics-daily.json`).

Duas regras que valem para qualquer tela de número deste projeto:

- **`null` não vira zero.** Zero diz "medi e não houve"; travessão diz "não
  medi".
- **Percentual anda com a base.** "58%" não deixa ninguém desconfiar; "58% de
  10.205 matrículas" num sistema com 785 alunos denuncia o problema sozinho.

Detalhes em `docs/analytics.md`.

## Campo de aula sem coluna: o defeito que não dá erro

Três vezes o mesmo padrão, e nenhuma delas apareceu em teste: um campo existia
no `createLessonSchema`, no editor do admin e nas telas do produto — e **não
tinha coluna na tabela `lessons`**. O caminho de banco, que é produção,
descartava o valor ao gravar e devolvia `undefined` ao ler.

| campo         | até         | o que o admin via                                      | o que acontecia                                                                                               |
| ------------- | ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `content`     | 21/ago/2026 | aula salva                                             | 309 aulas terminavam no meio da frase                                                                         |
| `isPreview`   | 2/set/2026  | caixa "aula de demonstração" marcada                   | `/lessons/:id/preview` dava 403 em **toda** aula; o selo "tem aula grátis" do catálogo nunca aparecia         |
| `transcripts` | 2/set/2026  | painel de três idiomas, com botão de copiar entre eles | as duas rotas de transcrição respondiam `NO_TRANSCRIPT` sempre — e isso se lia como "ninguém cadastrou ainda" |

**O que une os três é a ausência de erro.** O formulário salva, a API responde
200, e o dado se perde em silêncio. `test/courses-repo-fields.test.ts` não pega
porque roda sobre o `JsonStore` — o caminho que sempre funcionou.

`test/aula-cabe-no-banco.test.ts` compara `createLessonSchema` com as colunas de
`lessons` e falha na hora se divergirem. **Campo novo de aula passa por ali
antes de existir.**

A migration `0017` criou `is_preview` e `transcripts`. Ela é aditiva, mas o
código **não sobe antes dela**: o Drizzle seleciona coluna a coluna, então a
app nova contra o banco velho quebra toda consulta a `lessons`.

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

## Migração WP/LD/WC — a carga v3 está aplicada; o que sobrou é outra coisa

> **Corrigido em 30/ago/2026.** Esta seção descrevia por três meses o estado v2
> quebrado (10.205 matrículas fantasma, 333 alunos faltando, nomes com spam) e
> mandava "re-aplicar a migração v3". **Isso já foi feito em 07/jul/2026.**
> Medido em produção hoje, com `scripts/backup_divz_students.ts`:
> **1601 alunos, 615 fichas, 1122 matrículas** — números sãos, ~1,8 matrícula
> por aluno, nada parecido com o quadro fantasma.
>
> A instrução velha era **perigosa**, não só desatualizada: a base local está
> zerada pelo `reset_imported_data.ts` (3 usuários), e `load_v3_to_divz.ts`
> marca como inativo quem não vier na fonte. Rodá-lo a partir daqui derrubaria
> os 1601. **Antes de qualquer carga, confira a contagem local contra a de
> produção.**

Migração dos dois sites WP (`portalpco.online` LMS + `psicanaliseclinica.online`
loja) para o AVA. O handoff vivo, com slugs, mapeamentos, os três bugs de origem
e a sequência de comandos correta, é `docs/migration-wp-ld.md` — **leia ele, não
esta seção**, antes de mexer em migração.

### O que continua aberto

- **160 pessoas apagadas na origem** entre julho e agosto (52 desistentes, 35
  inadimplentes, 7 reembolsados, 6 inativos, 14 ativos) seguem em produção com
  256 matrículas, 97 com progresso real. Por isso o loader deixou de fazer
  wipe-and-reload e o dump de 07/jul virou a fonte de verdade — sumir do
  WordPress não é ordem para apagar do AVA. Decidir o destino delas é do dono.
- ~~**Delta da loja**~~ — **aplicado em 1º/set/2026.** `scripts/sync_wc_delta.ts
  --commit` criou 1 conta e 1 matrícula; os outros 19 dos 20 pedidos pagos desde
  06/jul já existiam. Rodar de novo hoje devolve `0 criada(s) · 20 já
  existia(m)`, que é como se confere. A conta nasce **sem senha** de propósito:
  entra pelo "esqueci minha senha", e não há nada a provisionar no VPS enquanto
  `AUTH_STORE=db` estiver ligado.
- **418 contas com login e sem ficha** (medido em produção em 1º/set/2026:
  2030 contas, 1612 fichas). O `--db` do `scripts/auditar_contas_sem_ficha.ts`
  era citado aqui e no próprio script desde a auditoria e **não existia no
  código** — a função só lia JSON. Agora existe: contas e fichas saem do banco.
  **Mas a origem dessas 418 continua sem resposta**, e agora o script diz isso
  em vez de fingir: `external-references.json` em produção é de 16/mai, anterior
  à recarga v3 de 07/jul, e não conhece nenhum dos ids atuais — "0 da loja"
  seria mentira, não medição. Para responder é preciso um mapa de referências
  regerado pela carga v3.
  O que dá para afirmar hoje: **zero matrículas órfãs**, e a única conta com
  progresso de aula e sem ficha é `admin@psicanaliseclinica.online` — superadmin
  testando, não aluno perdido. Referência e progresso não têm tabela; vivem em
  `data/*.json` e só existem inteiros no servidor, então copie-os para um
  `DATA_DIR` antes de rodar (o relatório imprime a fonte de cada metade
  justamente para não repetir a confusão de misturar banco com JSON local).
- **Durações de aula**: todas gravadas como 15 min (placeholder do import).
  `scripts/resolver_duracoes_aulas.ts` resolve pelo provedor do vídeo e nunca
  inventa duração.

### As quatro causas que já foram corrigidas no código

1. `GET /ldlms/v2/cursos/{id}/usuarios` mente quando autenticado como admin —
   devolve **todos** os users do site, não os matriculados. Corrigido iterando
   users e chamando `/users/{id}/courses`.
2. WP user IDs colidem entre os dois sites e o `refsStore` fundia ambos.
   Corrigido prefixando a origem (`portal:` / `psi:`).
3. Bots de SEO encheram `display_name` de 436 customers da loja com lixo.
   Corrigido com `filterSpam()`.
4. O WordPress entrega o título já **renderizado** — escapado para HTML — e o
   `unwrap()` do conector gravava assim. O React escapa de novo na exibição, e
   faz certo: quem lia `A psicoterapia pode dar &#8220;errado&#8221;?` na lista
   de aulas era o aluno. Corrigido na entrada com
   `shared/entidades-html.ts`; as 5 linhas já gravadas foram acertadas por
   `scripts/corrigir_entidades_titulos.ts` em 1º/set/2026. **Só título** —
   descrição e conteúdo são HTML de verdade, e desescapar ali mudaria o texto.

Creds dos dois WP em `.env.import` (gitignored).
