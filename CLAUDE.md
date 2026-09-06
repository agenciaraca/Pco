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

São **treze** (eram doze até 5/set/2026), e esta tabela listava cinco até
3/set/2026. Quem lia a
documentação para decidir o que acontece num restart subestimava a superfície
por mais da metade — e três dos ausentes tocam dinheiro (Sandra), acesso
(vencimento) e compromisso com aluno (lembrete de sessão).

| Module                                            | Tick                             |
| ------------------------------------------------- | -------------------------------- |
| `webhooks/dispatcher.startWorker`                 | 30s                              |
| `imports/schedules-worker.startWorker`            | 60s                              |
| `payments/sandra-poll-worker.startWorker`         | 5min                             |
| `sessions/lembrete-worker.startWorker`            | 15min                            |
| `notifications/admin-digest.startWorker`          | 30min (fires at configured hour) |
| `notifications/weekly-report.startWorker`         | 1h                               |
| `notifications/student-progress-email.startWorker`| 1h                               |
| `db/backup-worker.startWorker`                    | 1h tick (snapshot at 04:00 UTC)  |
| `services/log-rotator.startWorker`                | 1h                               |
| `payments/alerta-checkout-worker.startWorker`     | 15min                            |
| `services/retention-worker.startWorker`           | 6h                               |
| `reengagement/worker.startWorker`                 | 24h                              |
| `access/expiry-worker.startWorker`                | 24h                              |

Workers expose `getStatus()` surfaced under `/admin/jobs` / `/admin/saude`. **Vercel Functions don't run these** — long-lived workers are VPS-only.

**Todo `startWorker` é idempotente** (`if (timer) return`). Os dois de
notificação — relatório semanal e progresso do aluno — não eram, e são
justamente os que mandam e-mail para aluno: uma segunda chamada criava um
segundo intervalo e o aluno recebia tudo em duplicata.

**Erro dentro do tick não pode sumir.** Cinco workers têm `.catch()` vazio de
propósito (falhar um ciclo não derruba o processo), mas o da Sandra é diferente:
ele é o **único** confirmador de pagamento daquele gateway, porque a Sandra
ainda não emite `charge.paid`. Enquanto o `catch` era vazio, credencial expirada
fazia pagamento real deixar de virar matrícula em silêncio, com o `/admin/jobs`
dizendo que o worker rodava, até a janela de 10 dias fechar sozinha. Hoje ele
conta `falhasSeguidas`, expõe `saudavel` no status e grita a partir da terceira.

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
- **`data/` é ignorado por padrão** (`data/*` no `.gitignore`), com as seis
  sementes abertas nominalmente por `!`. Semente nova exige acrescentar a linha
  — de propósito. A lista era por arquivo até 2/set/2026 e **vinte tinham ficado
  de fora**, inclusive os hashes dos tokens `pcok_*` e o registro de pedidos de
  exclusão. Versionar um destes sobrescreve a configuração de produção no
  próximo `git reset --hard` do deploy.
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

> ### 5/set/2026, noite — a auditoria auditou o que subiu de manhã
>
> A passada 004 rodou sobre `26cb33c` — o primeiro HEAD desta série que está
> **em produção, com aluno dentro e dinheiro passando**. Os relatórios estão em
> `H:/ia/dev/auditoria-ava-pco/relatorios/`, com uma seção "Passada 004" cada.
>
> **O que ela achou foi o código escrito naquela mesma manhã**, e os cinco
> defeitos do expurgo têm todos a mesma forma: a rotina rodava, contava e
> reportava sucesso. Ver a seção do expurgo, mais abaixo — o resumo é que o CPF
> sobrevivia à anonimização, o fórum não estava nem na exportação nem no
> expurgo, e um store fora do ar era impresso como "nada a apagar" no ensaio que
> o operador lê antes de autorizar.
>
> **Tudo isso está corrigido, com testes.** O que **não** está, e é decisão:
>
> 1. **`orders.userEmail` continua em claro depois do expurgo**, e o `userId` do
>    pedido continua o mesmo da conta anonimizada. Ou é dado fiscal — e então é
>    retido *declarado como tal* —, ou é conveniência de exibição e deve ir para
>    a marca anônima. Hoje o relatório lista `user: anonimizar` entre as
>    tratadas, e a dissociação é parcial.
> 2. **Decidir se atraso no carnê suspende o acesso** (`CARNE_ATRASO_SUSPENDE`,
>    desligada). Segue sendo a pendência de maior alavancagem: hoje o acesso é
>    liberado integral na parcela 1 de 6, e nada o reverte automaticamente.
> 3. **Lifecycle do bucket S3** — ação no provedor. Agrava o item 1: snapshot
>    sem expiração guarda o titular indefinidamente depois do expurgo.
> 4. **Revogar a Application Password do WordPress** — sétima sessão registrando.
> 5. **Habilitar o produto Checkout no painel do Pagar.me.** Enquanto não for,
>    ele não pode voltar à rota. Quando for, ligá-lo como **reserva do cartão**
>    é ganho sem custo (os dois declaram 12x); como reserva do **boleto**,
>    derrubaria a promessa de 6x para 1x — o Asaas é o único provider
>    implementado que parcela boleto, e isso torna o gateway único do boleto um
>    problema estrutural, não uma configuração pendente.
> 6. **O resto dos `isLoading` sem `isError`** — trabalho mecânico em `/admin`.
> 7. **O certificado ainda sai de contagem de cliques** — nenhuma nota, nenhum
>    tempo assistido, nenhum quiz participa. Decisão de produto.
> 8. Nada mais de acessibilidade no player — seek, volume e transcrição
>    entraram (A11Y4-001, 002 e 004). **A migration `0021` roda antes do código
>    subir**: ela cria `podcasts.transcript`.
>
> **Fechados depois do deploy da noite**, e os três primeiros eram os de maior
> dano:
> o **fallback de pagamento** deixou de tratar 5xx como "não cobrou" (SEC4-001 —
> o reserva podia cobrar a mesma pessoa duas vezes); o **restaurador de banco**
> passou a gravar em transação e a exigir `SEI_O_QUE_FACO=1` (SEC4-002 — ele
> apagava tudo antes de inserir, sem volta, numa máquina cujo `.env` aponta para
> produção); e existe **alarme por taxa de falha de checkout**, décimo terceiro
> worker, que era o que faltava para a venda não ficar dois dias fora do ar de
> novo. Ver as três seções próprias, mais abaixo.
>
> Entrou junto o que faltava de acessibilidade no player de podcast — barra de
> progresso que é controle de verdade (clique e teclado), volume, e
> **transcrição** (migration `0021`), que é a única via de acesso a conteúdo
> só-áudio para quem é surdo. E a área do aluno inteira passou a distinguir
> "sem rede" de "não existe": a pior era o episódio de podcast, que jogava o
> ouvinte para fora com `<Navigate>` quando o celular perdia sinal.
>
> **Também entrou hoje à noite:** o drip passou a trancar a aula, e não só o
> botão de concluir (ver a seção do drip); `/admin/pedidos` ganhou coluna
> **Método** com marcador de carnê; e `/admin/vendas` ganhou **receita paga por
> método**, que era a base numérica que a decisão de roteamento exigia e não
> existia em tela nenhuma.

> ### 5/set/2026, fim do dia — tudo publicado, e a venda religada
>
> **`main`, `origin/main` e produção estão no mesmo commit.** O dia teve três
> blocos, e o do meio é o que importa.
>
> **1. Publicação.** Os 29 commits da auditoria subiram, com as migrations
> `0018` e `0019` aplicadas antes do código. Uma parada salvou a vitrine: com
> dois gateways ativos e nenhum roteamento, a regra do mínimo derrubava todos os
> métodos para 1x e a linha "ou 12x de R$ 99,88" **sumiria do site**. A tabela de
> rotas foi escrita antes do deploy, e o código antigo a ignora — sem janela.
>
> **2. A venda estava quebrada desde 3/set, e ninguém sabia.** `/admin/pedidos`
> mostrou nove tentativas da mesma pessoa, hoje, todas falhando com
> `The checkout payment method is not available for this account` — **a conta do
> Pagar.me não tem o produto Checkout habilitado**. 14 pedidos perdidos entre 3 e
> 5/set, 4 pessoas distintas, tráfego de anúncio pago (`Exatas-Otimizada-2025`).
> Em setembro: 18 falhas, 1 pago — e esse um foi lançamento manual.
>
> **Religada roteando tudo para o Asaas**, que parcela cartão pelo mesmo campo do
> carnê. Provado com uma compra de teste real: `CREDIT_CARD`, `value: 99.88`,
> parcela 1 de 12 — e a cobrança de teste foi apagada depois. **Habilitar o
> Checkout no painel do Pagar.me é ação do dono**; quando habilitarem, é um
> seletor em `/admin/gateways`.
>
> **3. Modo autônomo.** Percorri dez dashboards em produção pelo Chrome e
> consertei o que achei: `/admin/jobs` mostrava **5 workers de 12** (e um card
> sem nome, com `NaN dia(s)`); `/admin/retencao` chamava nove cursos de `8495`;
> o painel dizia "Alunos ativos" duas vezes com números diferentes. Depois, os
> dois maiores abertos da auditoria: **o backup ganhou restaurador** (ARCH3-006)
> e **o expurgo de dados passou a existir** (PRIV2-001).
>
> **O que segue aberto**, em ordem:
>
> 1. **Decidir se atraso no carnê suspende o acesso** — o mecanismo existe e
>    está desligado (`CARNE_ATRASO_SUSPENDE`). É política comercial.
> 2. **O resto dos `isLoading` sem `isError`** — 61 arquivos, quase todos em
>    `/admin`, onde o custo é painel que gira em vez de aluno lendo mentira
>    sobre si. As quatro telas do aluno que importavam foram corrigidas.
>
> **Fechado no fim do dia:** as três telas incompletas. PCNews abre matéria
> (`/news/:id` — as 77 têm corpo no banco e nenhuma tela mostrava); o player de
> podcast toca o arquivo de verdade (era um `setInterval` que, aos 80% do
> progresso inventado, **gravava `listened: true`** — a métrica de engajamento
> era produzida por uma animação); e a biblioteca ganhou upload, com documento
> restrito à administração, porque `POST /uploads` é aberto a qualquer aluno e
> PDF hospedado no domínio da escola é o que phishing procura.
> 3. **Configurar o lifecycle do bucket S3** — é ação no provedor, não código:
>    o AVA não apaga backup de propósito.
> 4. **Revogar a Application Password do WordPress** — sexta sessão registrando.

> ### 5/set/2026 — a fila de consertos da auditoria foi ao fim, e nada publicado
>
> **Sete consertos**, cada um com teste que falha contra o código anterior. A
> branch `correcoes-auditoria-2026-09-03` está agora bem à frente de `main`, e
> **nada foi enviado ao remoto** — confira com `git rev-list --count main..HEAD`.
> Publicar segue sendo decisão do dono, e as três pendências dele não mudaram:
> revogar a Application Password do WordPress, escolher **um** gateway ativo
> (Pagar.me e Asaas estão os dois "Ativo" em produção, e o código pega
> `listActive()[0]` — **e isso agora tem tela**, ver o roteamento por método),
> e rodar as migrations `0018` e `0019` **antes** de o código subir.
>
> O que entrou, em ordem:
>
> 1. **A tela da aula sem rede** (TELA3-003) — era a única das cinco irmãs que
>    ficara de fora, e a única que exibe o vídeo.
> 2. **Três defeitos do próprio botão de testar gateway** (SEC3-703, DATA3-011,
>    DATA3-013) mais a paridade das duas listas de provider (QA3-003).
> 3. **Rebaixar de papel não invalidava o token** (SEC3-705) — até 7 dias de
>    acesso administrativo depois do desligamento.
> 4. **Curso desativado congelava conclusão e tempo de assistência**
>    (LEARN3-001).
> 5. **A exportação de dados entregava o e-mail de quem escreveu a nota**
>    (PRIV3-702).
> 6. **A rota mais sensível do produto não deixava rastro** (PRIV3-707): a busca
>    em todas as conversas com o tutor de IA, mais a exportação CSV de alunos.
> 7. **Despublicar um curso o apagava de quem já tinha pago** (ALU4-001 a 004,
>    da auditoria da experiência do aluno rodada no mesmo dia). Ver a seção
>    "`active` é regra de descoberta", abaixo — é a que mais provavelmente
>    volta a morder.
> 8. **Roteamento de pagamento por método**, com principal e reserva — o dono
>    abriu `/admin/gateways` em produção e viu dois gateways "Ativo" ao mesmo
>    tempo. Não havia roteamento nenhum: quem cobrava era o primeiro da lista,
>    que é o último cadastrado. Ver a seção própria, abaixo. **A migration
>    `0019` é nova nesta branch e roda antes do código subir, junto com a
>    `0018`.**
>
> **O que segue aberto**, em ordem de custo/benefício:
>
> - **O backup do banco não tem restaurador** (ARCH3-006). O despejo existe
>   desde 3/set; caminho de volta, não — e `docs/deploy.md` ensina a restaurar
>   um `.tar.gz` que o código não produz, com `pkill` de um processo que hoje é
>   gerenciado por PM2. **É o maior aberto.**
> - **As três telas incompletas** (PCNews sem página de matéria, Podcasts com
>   player 100% simulado que nunca lê `episode.audioUrl`, Biblioteca sem
>   upload), e quatro telas do aluno que ainda dizem "vazio" quando é "sem
>   conexão".
> - **O expurgo de dados não existe** (PRIV2-001, meio verificado): o pedido de
>   exclusão vira `completed` sem chamar rotina de expurgo nenhuma.
> - Achados menores da passada do aluno (`ALU4-007` a `ALU4-009`) no relatório.
>
> Relatórios: `H:/ia/dev/auditoria-ava-pco/relatorios/` — a passada do aluno
> está em `aluno-passada-004.md`.

> ### 4/set/2026 — dois consertos, uma auditoria, e nada publicado
>
> **Comece por `H:/ia/dev/auditoria-ava-pco/RETOMAR-AQUI.md`, pelo bloco do
> fim** (“⏸ Retomar daqui — 4/set”). Ele fica **fora deste repositório** de
> propósito: relatório de auditoria com evidência não se mistura a código.
>
> O que aquele bloco diz e não pode esperar a leitura:
>
> 1. **Nada está no ar.** `main` e produção seguem em `699bac3`; a branch
>    `correcoes-auditoria-2026-09-03` está à frente, árvore limpa, **nada
>    enviado ao remoto**. Confira com `git rev-list --count main..HEAD`. Quando
>    o dono abriu `/admin/gateways` em produção e viu o aviso “só o Sandbox está
>    implementado” e a falta do botão de testar, a causa era essa — as duas
>    coisas já estão corrigidas na branch.
> 2. **A migration `0018` é nova nesta branch e roda ANTES do código subir.** O
>    Drizzle seleciona coluna a coluna: app nova contra banco velho quebra toda
>    consulta a `lessons`.
> 3. **Dois gateways estão “Ativo” em produção ao mesmo tempo** (Pagar.me e
>    Asaas), e o código pega `listActive()[0]` — o primeiro da lista, não “o
>    ativo”. Deixe só um antes de qualquer teste de compra.
> 4. **A Application Password do WordPress continua pendente de revogação**, e é
>    ação do dono: tirar do código não desfaz o histórico do git.
>
> A auditoria da passada 003 rodou sobre `04350f4` e **seus achados estão em
> relatório**, não só em conversa — cinco arquivos em `relatorios/`, com uma
> seção “Passada 003” cada. O primeiro conserto da próxima sessão é
> `LMSLesson.tsx`: a correção das telas sem rede pulou justamente a tela que
> exibe o vídeo, e sem rede o aluno é expulso do meio da aula.

> ### 3/set/2026 — o handoff vivo mudou de lugar (registro anterior)
>
> **Comece por `H:/ia/dev/auditoria-ava-pco/RETOMAR-AQUI.md`**, que fica
> **fora deste repositório** de propósito (relatório de auditoria com evidência
> não se mistura a código).
>
> Três coisas que aquele arquivo diz e que não podem esperar a leitura:
>
> 1. **Há uma ação do dono pendente, e ela é a primeira:** uma Application
>    Password de administrador do WordPress de `portalpco.online` esteve em
>    texto puro num arquivo versionado (`server/imports/seeds/portalpco.ts`)
>    desde 5/mai/2026. Tirei do código; **isso não resolve** — o valor está no
>    histórico do git. **Revogar no painel do WordPress é o que corta o acesso.**
> 2. **Existe branch pendente:** `correcoes-auditoria-2026-09-03`, árvore limpa
>    e **nada enviado ao remoto** — confira com
>    `git rev-list --count main..HEAD`. `main` e produção seguem em `699bac3`. Publicar é decisão do dono — e há duas decisões de
>    conteúdo dentro dela que merecem um olhar antes (os números da home e o
>    que a exportação de dados passou a entregar).
>
>    **Para rodar a suíte nesta máquina:** `npx vitest run --maxWorkers=1`.
>    Referência: 242 arquivos / 2275 testes. Sem o `--maxWorkers=1` a execução
>    morre no meio por falta de memória, e o sintoma engana (testes `.ts`
>    passam, `.tsx` falham no arranque).
> 3. **A importação por API não está pronta para uso.** Cinco das oito entidades
>    não chegam a tabela nenhuma, toda matrícula importada nasce com a data de
>    hoje e todo pedido vira `pending`. Rodá-la contra produção produz estrago
>    silencioso.

O handoff anterior é **`docs/SESSAO-2026-09-02-vazamento-e-checkout.md`** — comece
pelo fim dele, em "Por onde retomar". O de mais cedo no mesmo dia,
`SESSAO-2026-09-02-campo-sem-coluna.md`, é independente e continua valendo.

**Nada ficou pela metade em 2/set/2026.** Sem branch pendente, sem conserto
esperando teste; `main` local, `origin/main` e produção em `f01588a`.

**O vazamento do curso interno está fechado** (`aac4f58` + `306eb91`), com
`test/curso-interno-nao-vaza.test.ts` — 18 casos por persona, 8 dos quais falham
contra o código anterior. Escrever o teste achou duas coisas que ler o código
não achou: uma regressão que a branch trazia (o editor de curso perderia a URL
dos vídeos ao salvar) e um quarto caminho de vazamento. Ver a seção do
`/api/courses`, mais abaixo.

**376 matrículas suspensas ou canceladas não eram comunicadas em tela nenhuma**
(`e046083`, no ar). O portão sempre esteve certo; quem mentia era a tela — e a
do admin dizia "No prazo" para quem a coordenação precisa revisar. **A revisão
dessas pessoas é caso a caso com a equipe, e ninguém deve ser ativado à toa** —
decisão do dono, em 2/set/2026. Nada do que subiu move estado de matrícula. Ver
"Status de pedido manda na matrícula".

**A venda estava quebrada e voltou** (commit `a3872c3`, no ar): o Pagar.me
recusava toda compra feita por dentro do app. Falta a prova que só o dono pode
dar — uma compra de ponta a ponta.

**Três telas seguem incompletas, e são o que sobrou:** PCNews não abre matéria,
Podcasts não têm player e a Biblioteca não tem upload. Detalhes e ordem no
handoff — e a CSP vem junto com o player de áudio, pelo mesmo motivo que o
`frame-src` faltava para o vídeo.

**O bloqueio dos vídeos foi resolvido em 1º/set/2026** — e não era só a Vimeo.
O dono autorizou o domínio na conta "Psicanalise Digital"; faltavam ainda o
`frame-src` da nossa CSP e a política de referer no iframe. Ver
"Vídeo de aula" mais abaixo antes de reabrir o assunto.

## `active` é regra de descoberta, nunca de operação

`courses.active` decide **o que aparece** — vitrine, estante, listagem. Não
decide o que acontece com quem já está com a aula aberta. `listCourses()` filtra
por ele no caminho de banco; `listCoursesIncludingInactive()` e
`findCourseIncludingInactive()` existem para o outro lado.

Isso custou dois consertos em dois dias, e o segundo só apareceu porque uma
auditoria foi atrás do primeiro:

- **4/set:** `localizarAula` varria a lista filtrada, e desativar um curso
  congelava conclusão de aula e tempo de assistência de quem estava estudando —
  com `404 NOT_FOUND`, que se lê como "esta aula não existe".
- **5/set:** as rotas de **leitura** tinham o mesmo defeito, e pior. Despublicar
  um curso — ou "excluir", que é o mesmo `active: false`, porque a exclusão é
  lógica — tirava o conteúdo e o vídeo da aula de quem tinha matrícula e prazo,
  sumia com o certificado de quem já se formou (a tela casa cada certificado com
  o curso de origem) e apagava o curso da lista do **admin**, que não tem outra
  rota para listar curso e ficava sem caminho de volta pela interface.

Quatro rotas passaram a ler a lista inteira, e **quem separa é a regra por
persona que já existia**: `isPubliclyListed` é
`active !== false && publicListed !== false`. Para isso, `active` precisou
passar a ser copiado no caminho de banco — o mapeamento montava o curso campo a
campo e não o trazia, porque nunca precisou. **Sem esse campo o conserto vira
vazamento**, porque a regra lê `undefined` e deixa passar.

`courseAccessFor` entrou junto, por um motivo diferente: é do curso que sai o
`accessMonths`, e com a busca filtrada um curso despublicado voltava `null` — o
prazo sumia com ele, e a matrícula virava vitalícia em silêncio.

De quebra, a tela do admin voltou a funcionar como foi escrita: `AdminCourses`
**já** tinha o selo "Despublicado" e a ação em massa de publicar; o dado é que
nunca chegava.

## Expurgo de dados: "concluída" só pode significar que a rotina rodou

`server/privacy/expurgo.ts` (5/set/2026). Antes, marcar a solicitação de
exclusão como `completed` gravava um campo e uma nota — **e nada era apagado**.
Não havia rotina, não havia rota de exclusão de usuário, e `deleteUser()` vivia
no store sem chamador.

A regra que orienta o arquivo: **o que a exportação entrega é o que o expurgo
tem de tratar.** As duas respondem à mesma pergunta e não podem discordar;
`test/expurgo-cobre-o-que-exporta.test.ts` compara as listas nos dois sentidos.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **Três destinos, não dois.** `apagar` é o padrão; `anonimizar` é para quando o
  registro vale para outra pessoa (comentário apagado deixa a resposta de outro
  aluno sem a pergunta; avaliação apagada reescreve a média que os outros leem);
  `reter` é **decisão jurídica** e vem sempre com o motivo escrito — pedido pago
  é documento fiscal (art. 16, I) e certificado é declaração a terceiros.
- **Retenção sem justificativa é retenção indevida**, e o teste cobra isso — e
  cobra também que quem não retém não invente motivo.
- **Toda categoria tem rotina**, e as duas que gravam em banco (`support`,
  `retention`) apagam **nos dois caminhos** — limpar só o JSON diria "apagado"
  sem apagar em produção, que é a forma exata do defeito de campo sem coluna.
  Se alguma voltar a ficar sem rotina, o expurgo a declara pendente e `completo`
  fica falso, o que trava a conclusão do pedido.
- **Ensaio é o padrão.** `POST /admin/deletion-requests/:id/expurgo` sem
  `?commit=true` lista o que faria. E `completed` responde **409** se o expurgo
  não tiver rodado: o relatório fica anexado ao pedido, e é ele que distingue "a
  escola apagou" de "alguém marcou a caixinha".

### A auditoria do mesmo dia achou cinco buracos nesta rotina

Ela nasceu de manhã e foi auditada à tarde. Os cinco valem lembrar porque
**nenhum deles dava erro** — a rotina rodava, contava e reportava sucesso:

- **O CPF sobrevivia, e não por esquecimento.** A anonimização chamava
  `updateUser`, cujo `UpdateInput` **não declara `document`** — passar o campo
  não compilaria. Depois de a escola registrar a exclusão como concluída,
  `findUserByDocument` ainda achava a conta, exibindo "Titular removido" **ao
  lado do CPF real**. Hoje quem anonimiza é `usersStore.anonimizarConta()`,
  função à parte de propósito: alargar o `UpdateInput` daria à tela de edição do
  admin um caminho para gravar CPF que ela não tem. Ela limpa também
  `passwordHash` e o material de TOTP — `active: false` fecha o portão, e fechar
  acesso não é apagar dado.
- **O pseudônimo carregava o id.** Era
  `removido-${userId.slice(-6)}@invalido.local`: seis caracteres do
  identificador que a anonimização existe para dissociar. Hoje é hash. Continua
  estável, que é o requisito real — o e-mail é único na tabela e duas execuções
  não podem criar dois "titulares".
- **O agendamento não tinha caminho de banco.** Era a **única** função do
  `bookings-repo` sem `bancoSeTabelaExiste` — e produção tem banco. A linha de
  `session_bookings` seguia com `user_email` do titular em texto puro, ligada ao
  horário, ao profissional e ao valor. Gravava ainda um `studentName` que não
  existe no tipo nem na coluna.
- **O fórum não estava em ponta nenhuma.** `forumAndComments` lia só
  `discussions` (comentário de aula); `server/forum/store.ts` é outro store, com
  `authorId` **e** `authorName`, e ficou fora do `/me/export` e do expurgo. O
  teste que deveria pegar isso **não pegava por construção**: ele compara as
  duas listas entre si, e as duas erravam junto. Hoje `forum` é categoria
  própria — juntá-las sob um nome só foi exatamente como o fórum sumiu. A
  varredura tira o titular de `likedBy` de conteúdo **de terceiros** e reconta
  `likes`, senão o número fica um a mais para sempre.
- **Erro virava zero.** `contar()` tinha `catch { return [] }` e envolvia a fase
  de *encontrar* de dez categorias. Store fora do ar produzia `encontrados: 0`
  **sem `erro`**, e `completo` dizia `true`: no ensaio, "não consegui olhar" era
  impresso igual a "não havia nada" — e é sobre o ensaio que alguém decide
  autorizar a execução. Mesma regra das telas de métrica, aplicada tarde ao
  relatório da operação mais destrutiva do sistema.

**Executar exige `approved`; ensaiar, não.** O ensaio é leitura pura e é
justamente o que ajuda a decidir — negá-lo antes da aprovação faria aprovar às
cegas. Apagar sem aprovação transformaria a aprovação em etiqueta, e ela é o
único ponto em que uma pessoa confere que o pedido é do titular daquela conta.

**Treze rotinas usavam `getAll()` + `setAll()`.** `getAll` devolve a lista viva,
mas o par monta um array novo fora dela e o instala por cima; entre as duas
chamadas há `await`, e qualquer escrita concorrente no mesmo store é perdida sem
erro. Todas passaram a `JsonStore.modify`, que muta a lista viva.

**A tela acompanha:** `/admin/exclusoes` tem "Ensaiar expurgo" (leitura pura,
mostra o relatório categoria a categoria, com o motivo de cada retenção) e
"Executar expurgo", que só aparece depois do ensaio e da aprovação. "Marcar
concluída" só aparece depois do expurgo — antes, ela perguntava *"confirmar que
os dados foram REMOVIDOS?"* e não removia nada.

**Duas categorias entraram depois**, e uma delas tem armadilha de ordem:

- **`emailLogs` é apagada**, e a fila é chaveada pelo **endereço**, não pelo
  `userId` — quem escreve nela é o remetente, que só conhece o e-mail. Por isso
  o e-mail é lido **no começo** de `expurgarTitular`: a categoria `user` troca
  esse endereço pela marca anônima, e ler depois faria a busca procurar por
  `removido-…@invalido.local` e não achar nada. O relatório diria "0
  encontrados" sobre uma fila cheia, e nada denunciaria isso.
- **`auditLog` é retida**, com o motivo escrito: é o registro que prova o que a
  escola fez com os dados da pessoa — inclusive que **este expurgo** rodou, por
  quem e quando. Apagá-lo destruiria a evidência da própria exclusão.

**O que segue aberto, e é decisão:** `orders.userEmail` continua em claro e o
`userId` do pedido continua o mesmo da conta anonimizada. Ou é dado fiscal — e
então é retido **declarado como tal** —, ou é conveniência de exibição e deve ir
para a marca anônima. E as snapshots de backup em S3 não têm lifecycle: elas
guardam o titular indefinidamente depois do expurgo.

`test/expurgo-apaga-de-verdade.test.ts` é o que faltava:
`expurgo-cobre-o-que-exporta` roda sobre `'u-inexistente'`, então `encontrados` é
0 em tudo e uma rotina que não fizesse nada passaria igual. O novo cria uma
pessoa com dado real em cada canto e afirma sobre o que **sobrou**.

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

## Gateway de pagamento agora tem botão de testar — e ele não cobra ninguém

`POST /admin/payments/gateways/:id/test`, botão **Testar** em `/admin/gateways`
(3/set/2026). Existia para e-mail, para os conectores de importação, para os
webhooks de saída e para a IA; faltava justamente em pagamento, o único desses
domínios em que credencial vencida custa dinheiro — e o modo de falha já é
conhecido daqui, ver a Sandra logo abaixo.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **Todo `ping` é leitura.** Testar conexão não pode criar cobrança, nem em
  `live` nem em `test`. `test/gateway-responde.test.ts` percorre os providers e
  cobra `GET` em todos — a única exceção é o PayPal, cujo `client_credentials`
  é a própria conferência da credencial e não cria pedido.
- **Cada ping lê o mesmo recurso que o checkout escreve** (sessão no Stripe,
  pedido no Pagar.me, cliente no Asaas, cobrança no tenant da Sandra). Chave que
  enxerga o recurso consegue criá-lo; o contrário não vale para chave restrita,
  e um ping que consulta outra coisa diria "OK" para credencial que não vende.
- **`alcancou` separa duas falhas que pedem ações opostas.** 401/403 é o gateway
  respondendo que a chave não vale (ir ao painel dele); erro de rede é não ter
  dado para falar com ele (esperar, olhar a rede). A tela não pode achatar os
  dois em "falhou", e configuração faltando — Sandra sem `baseUrl`/`tenantSlug`
  — nem chega a sair da máquina.
- **Provider sem `ping` não responde "OK".** `manual` e `legado-wp` registram
  venda feita fora do sistema e não têm o que consultar; dizem isso. Provider
  novo sem ping falha o teste, que é o momento de escrever o dele. A garantia
  depende de `ALL_PROVIDERS` e do `registry` não divergirem — são duas listas à
  mão, e há um caso que compara as duas.
- **2xx não basta, e o corpo não é persistido** (4/set/2026). Portal de wi-fi e
  proxy respondem 200 com HTML: sem olhar o `content-type`, o card ficava verde
  sobre chave que ninguém conferiu. E `lastTestMessage` é gravado no gateway,
  entra no despejo do banco e sobe para um bucket **sem lifecycle** — corpo de
  erro de gateway traz id de conta, `request-id` e, em validação malformada,
  pedaço da credencial. O corpo vai para o log, que tem rotação; o card recebe
  rótulo e status. Pela mesma razão, endereço apontado para dentro da rede
  (`169.254.169.254` e afins) não sai da máquina: só a Sandra monta a URL a
  partir de campo do admin.

O resultado fica gravado no gateway (`lastTestedAt`/`lastTestStatus`/
`lastTestMessage`) e aparece no card: credencial que parou de valer não avisa
ninguém sozinha.

## Roteamento de pagamento: quem cobra sai da escolha, não da posição

`server/payments/roteamento.ts` (5/set/2026). Antes, os três checkouts faziam

```
gw = body.gatewayId ? findById(body.gatewayId) : listActive()[0]
```

e `listActive()[0]` é **o primeiro da lista**, não "o ativo" — a tela dizia, no
singular, "apenas o gateway ativo é usado", e nada impedia dois estarem ativos.
Em produção estavam: Pagar.me e Asaas. E como `createGateway` faz `unshift`, o
primeiro da lista é o **último cadastrado**: cadastrar um gateway novo e já
ativo tomava na hora todas as vendas da escola, sem ninguém escolher e sem nada
na tela dizendo que o adquirente mudou.

Cinco coisas que qualquer mexida aqui tem de respeitar:

- **O método é um dado nosso, e vem antes do gateway.** Era o problema de
  fundo: cada provider decidia sozinho (o Asaas cobrava **PIX** por omissão) e,
  enquanto o método só existisse dentro do provider, não havia onde pendurar
  roteamento. Hoje `metodo` atravessa `shared/metodos-pagamento.ts`, o corpo do
  checkout, `CreatePaymentInput`, cada provider e a coluna `metodo` do pedido
  (migration `0019`).
- **`metodosSuportados` é obrigatório no contrato do provider.** Provider novo
  não compila sem declarar o que sabe cobrar, e a tela só oferece o que ele
  declara — é o que impede rotear boleto para o Stripe e descobrir na venda.
- **O reserva só entra quando é certo que nada foi cobrado.**
  `PaymentProviderError.criouCobranca` tem `'talvez'` como **padrão**: erro não
  classificado não autoriza retentativa, erro de rede não autoriza (a
  requisição pode ter chegado) e o 502 da Sandra não autoriza (vem com
  `invoiceId` — a fatura existe). Venda perdida se refaz; cobrança dobrada se
  devolve com dor.
- **Quando o reserva cobra, o pedido passa a ser dele.** Não é cosmético:
  `findByExternalId` casa o webhook por `externalId` **e** `gatewayId`, então
  pedido cobrado no gateway B e marcado com o A nunca receberia o `paid` — a
  pessoa pagaria e não entraria no curso.
- **`acharPendenteEquivalente` chaveia pelo método, não pelo gateway.** Com o
  gateway podendo mudar depois da criação, chavear por ele faria cada
  retentativa criar um pedido novo — a cobrança dobrada pela porta dos fundos.

Sem rota configurada e sem método, vale o comportamento antigo (primeiro ativo)
— compatibilidade, não desenho. A tela de saúde é que cobra a configuração.

## Fallback de pagamento: `!res.ok` não é "não cobrou"

`server/payments/providers/criou-cobranca.ts` (5/set/2026). O motor sempre
esteve certo — só `PaymentProviderError` com `criouCobranca: 'nao'` autoriza o
próximo gateway, e o padrão do construtor é `'talvez'`. **A falha estava na
classificação.** Cinco providers faziam

```ts
if (!res.ok) throw new PaymentProviderError(CODE, msg, 'nao');
```

com o comentário *"o gateway respondeu recusando: nada foi criado"* — que
descreve o 400 e o 422, e não o 500, o 502, o 503, o 504 nem o 429.

O caso concreto: o adquirente grava o pedido, o proxy à frente dele estoura o
tempo e devolve 502. **A cobrança existe.** Com `'nao'`, o reserva cria a
segunda.

Três coisas que qualquer mexida aqui tem de respeitar:

- **`'nao'` exige que o gateway tenha dito que recusou antes de gravar.** É o
  4xx de validação e de autorização. Todo o resto é `'talvez'`, e `'talvez'` não
  autoriza o reserva.
- **409 e 425 não são `'nao'`.** 409 é quase sempre chave de idempotência já
  usada — isto é, a cobrança existe. 425 diz que a requisição pode ser repetida
  pelo cliente, o que não é o mesmo que não ter efeito.
- **Falha antes de a requisição sair continua `'nao'` no ponto de origem**:
  credencial ausente, documento inválido, configuração faltando. Ali é certo, e
  o classificador não deve ser aplicado por simetria.

Isso torna o fallback **mais raro**, e é o lado certo para errar: venda perdida
se refaz com um e-mail; cobrança dobrada se devolve com dor, e quem paga o prazo
do estorno é o aluno.

O 502 da Sandra segue fora da regra geral — ele vem com `invoiceId`, a fatura
existe **por declaração do gateway**, e nenhuma classificação por status pode
passar por cima disso.

## O alarme que faltava: a venda pode parar sem ninguém notar

`server/payments/saude-do-checkout.ts` + `alerta-checkout-worker.ts`
(5/set/2026), décimo terceiro worker.

A venda ficou fora do ar de 3 a 5/set com campanha paga rodando, e a detecção
foi alguém abrir `/admin/pedidos` por outro motivo. **O botão de testar gateway
não pega esse caso, e não é falha dele**: ele lê credencial, e a credencial
estava boa — "produto não habilitado na conta" só aparece na cobrança real.

Quatro decisões que qualquer mexida aqui tem de respeitar:

- **Duas condições, não uma.** Taxa de falha **e** mínimo de tentativas. Só a
  taxa dispara com um pedido abandonado num domingo (1 de 1 = 100%); só a
  contagem não distingue cinco falhas em cinquenta de cinco em cinco.
- **`pending` não é falha e `canceled` também não.** Boleto e pix vivem em
  aberto por dias; desistência é do negócio. Só `failed` conta.
- **Um aviso por episódio.** Enquanto a condição durar, não se repete; e a
  **volta também é avisada**, senão quem recebeu o alarme fica conferindo à mão.
- **Sem base, silêncio.** `taxaFalhaPct` nulo não é `ok` nem `alerta` — na tela
  de saúde vira `na`, não verde.

O motivo mais comum entre as falhas vai no aviso. É o que transforma "o checkout
está falhando" em "a conta do Pagar.me não tem o produto Checkout habilitado" —
sem ele, o alerta manda alguém abrir a tela para descobrir o que o alerta já
sabia.

## O restaurador não pode piorar o dia do desastre

`server/db/restore-db.ts` grava **dentro de uma transação** desde 5/set/2026.
Antes, apagava todas as tabelas da snapshot e só depois inseria: falha na
inserção deixava o banco vazio, sem volta, com o relatório dizendo
`completo: false` — honesto e inútil, porque o dado já tinha saído.

Três coisas que não se inferem lendo o arquivo:

- **Cada tentativa tem savepoint** (`tx.transaction()`). No Postgres, um comando
  que falha aborta a transação inteira; o laço de passadas — que é como este
  módulo resolve FK sem conhecer a ordem das tabelas — depende de tentar,
  falhar e tentar de novo. As duas coisas só convivem com savepoint.
- **Pendência desfaz tudo.** Restauração pela metade deixa o banco num estado
  que ninguém consegue descrever de fora. `desfeito: true` no relatório é a
  informação que muda o que o operador faz em seguida.
- **`--commit` exige `SEI_O_QUE_FACO=1`**, no mesmo molde de `restart_vps.py`.
  O script imprime o banco alvo desde sempre — e **imprimir não é exigir que
  alguém leia**; o `.env` da máquina de quem desenvolve aponta para produção. O
  ensaio não exige a variável, porque é leitura pura e é o que se roda para
  decidir.

## Sandra: o gateway em que o dinheiro não passa pelo gateway

Sétimo provedor (`server/payments/providers/sandra.ts`, desde 31/ago/2026). A
cobrança é criada no gateway da **própria escola**, com a credencial dela.

- **A chave de repetição é o `orderId`** — e ela sozinha **não** cobre o duplo
  clique, ao contrário do que este parágrafo afirmou até 3/set/2026. O `orderId`
  é gerado a cada POST: a chave protege contra repetir *a mesma tentativa*
  (coisa que o código nunca faz, porque não há laço de retry) e não contra a
  segunda tentativa, que cria outro pedido e outra cobrança. Quem cobre isso
  agora é `ordersRepo.acharPendenteEquivalente()`, chamada nos dois checkouts:
  havendo pedido em aberto da mesma pessoa para o mesmo produto nos últimos 10
  minutos, ele é reusado. Botão desabilitado no React não substitui — resolve o
  clique e não a retentativa de rede.
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

**O portão estar certo não é a tela dizer a verdade.** Até 2/set/2026 as duas
rotas que descrevem o acesso para a interface (`/me/course-access` e
`/admin/students/:id/course-access`) olhavam **só a data**, nunca
`enrollmentStatusByCourse` — então matrícula suspensa chegava como
`state: 'active'`. Em produção são **238 suspensas e 138 canceladas**: 376
pessoas com card normal na estante, sem aviso na página do curso, e um *"Conteúdo
desta aula ainda não disponível"* no lugar do 403 explicado (a tela nunca lia
`isError`). A tela do admin dizia **"No prazo"** justamente para quem a
coordenação precisa revisar caso a caso.

`accessForEnrollment` (em `server/access/course-access.ts`) compõe situação e
prazo, e **as duas rotas passam por ela**. A situação vence o prazo; `expiresAt`
e `daysLeft` seguem preenchidos, porque é com eles que o admin decide a
reativação. O texto mora em `shared/mensagens-acesso.ts`, lido pelo servidor e
pelo React — a mesma frase em dois lugares acabaria discordando, e discordar
aqui deixa o aluno sem saber o que fazer.

**Isso não move ninguém de estado.** Nenhuma escrita, `courseAccessFor`
intocado. Ativar ou reativar matrícula é decisão de gente, caso a caso — o dono
foi explícito quanto a isso em 2/set/2026.

Cancelar não apaga: `revokeAccessForOrder` marca `cancelada` e o portão fecha
por ali, preservando data de compra e progresso. `unenrollFromCourse` continua
para o desmatricular do admin — e **ganhou o caminho de banco que nunca teve**;
até 1º/set/2026 ela escrevia só no JSON de semente e era um no-op em produção.

## Parcelamento: 12x no cartão, 6x no boleto — e quem promete é quem cobra

`shared/parcelamento.ts` guarda a **política**; `server/payments/condicoes.ts`
transforma política em **promessa**, cruzando-a com o que o gateway roteado sabe
fazer. A vitrine lê do segundo, nunca do primeiro.

A distinção nasceu de um caso concreto (5/set/2026): a escola vende "12x no
cartão ou 6x no boleto", e **o objeto `boleto` da API v5 do Pagar.me não tem
campo de parcelamento**. Quem faz carnê é o Asaas (`installmentCount` +
`totalValue`, que emitem N boletos agrupados). Anunciar 6x sem olhar o gateway
seria repetir, noutro método, o defeito do 12x fantasma.

Quatro regras que qualquer mexida aqui tem de respeitar:

- **`parcelasMaximas` do provider é obrigatório e declara o que o código
  envia**, não o que o gateway suportaria. Stripe e Mercado Pago estão em `1`
  porque este código não manda parcelas para eles.
- **A promessa é o mínimo entre os candidatos da rota.** Principal que faz 6x
  com reserva que faz 1x anuncia **1x** — senão quem cai no reserva descobre a
  troca depois de ter decidido comprar.
- **Teto `0` é "não oferecemos", não "à vista".** Método sem gateway some da
  vitrine e do checkout.
- **É sem juros**: toda opção manda o mesmo total, e `totalValue` (em vez de
  `installmentValue`) faz o arredondamento cair na última parcela, para a soma
  fechar no preço anunciado.

**A parcela do meio do carnê já encontra o pedido** (5/set/2026). Cada parcela é
uma cobrança com id próprio e o pedido guarda o da primeira, então o aviso da
parcela 3 não casava com nada e sumia. A coluna `gateway_installment_id`
(migration `0020`) guarda o parcelamento, e o webhook cai nela quando o
`externalId` não bate.

Duas coisas que qualquer mexida aqui tem de respeitar:

- **Parcela vencida não derruba o pedido.** Ele foi pago — a parcela 1 entrou e
  o acesso saiu. Marcá-lo `failed` porque a 3 atrasou reescreveria a história da
  compra. O que se faz é registrar no histórico e auditar.
- **Suspender é decisão comercial, e está desligada.**
  `CARNE_ATRASO_SUSPENDE=true` liga; sem ela, o atraso aparece para gente
  decidir. Cortar o curso de quem atrasou um boleto por dois dias é política da
  escola, não escolha de quem programa — e enquanto a política não existir, o
  lado certo para errar é manter o acesso.

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

Em 2/set/2026 o dono relatou que o **Treinamento PCO**, curso interno de
operadores, estava visível e cursável por todo aluno. A trava existia e estava
ligada — o curso já era `publicListed: false`, com só 19 matrículas. **Três
caminhos ignoravam a marca** — e um quarto só apareceu depois que os três
fecharam, ver abaixo. O pior deles não era tela: um `curl` sem token
em `/api/courses` baixava o curso inteiro com as 9 URLs de vídeo. Somando os
quatro cursos ativos, **105 URLs expostas** a quem nem estava logado.

Para um curso feito de podcasts gravados, **o vídeo é o curso** — tirar
`content` e deixar `videoUrl` protegia a apostila e entregava a aula.

A resposta passou a depender de quem pergunta:

| quem | quais cursos | com `videoUrl`? |
| --- | --- | --- |
| anônimo | só os publicamente listados | não |
| aluno | os listados **+ aqueles em que tem matrícula** | não |
| admin | todos | sim |

Dois cuidados que qualquer conserto aqui tem de respeitar:

- **Matrícula entra na conta, não só visibilidade.** "Como ser um Super Aluno
  Online" também é `publicListed: false` e tem **655 alunos legítimos**.
- **Admin escapa — e em `/courses/:id` isso não é conveniência, é o dado.**
  São 21 telas de administração lendo deste endpoint, e **não existe
  `GET /admin/courses/:id`**: o editor de curso lê da rota pública, e é dela
  que prefill o campo "URL do vídeo". Esconder o campo do admin faria o
  formulário abrir vazio e **gravar o vazio por cima** ao salvar — as 171 aulas
  com vídeo perderiam a URL uma a uma, sem erro nenhum, à medida que alguém
  editasse. É a mesma classe do campo sem coluna: salva, responde 200, e o dado
  some em silêncio. Foi escrever o teste que achou isso.

**`GET /courses/:id` segue a mesma regra, e foi o quarto caminho.** Sobrou
depois de os outros três serem fechados: com o curso fora da lista, fora da tela
e o vídeo atrás do portão, um `curl` anônimo por id ainda trazia a ementa
inteira do treinamento de operador. Responde **404**, não 403 — 403 confirmaria
que o curso existe, mesmo motivo de `/public/checkout`. Quem abre por ali:
`/curso-preview/:id` (público), o quiz do aluno e duas telas de admin.

O aluno recebe o vídeo pela mesma porta do texto —
`/me/courses/:c/lessons/:l/content`, atrás de `courseAccessFor`. Repetir o
portão dentro do catálogo seria repetir regra, e regra repetida diverge.

`test/curso-interno-nao-vaza.test.ts` cobra tudo isso **por persona**, não por
rota: o defeito nunca foi uma rota errada, era a mesma rota respondendo igual
para quem tem direitos diferentes.

## `/api/courses` — o que já estava resolvido antes disso

O catálogo é aberto de propósito (ementa vende), mas `listCourses()` inclui
`lesson.content`. Até 27/ago/2026 um `curl` sem token baixava o material pago
de todos os cursos — os 2,93 mi de caracteres restaurados pela migration 0008.

`server/access/conteudo-aula.ts` tira o corpo nas rotas públicas; o aluno pega
por `GET /me/courses/:courseId/lessons/:lessonId/content`, que passa por
`courseAccessFor` (matrícula **e** prazo). A chave é removida, não esvaziada:
`content: ''` faria a tela mostrar a descrição como se fosse a aula.

## O backup copiava a metade que não importa

`db/backup-worker` roda todo dia às 04:00 UTC e, até 3/set/2026, copiava **só
`data/*.json`**. Em produção `DATABASE_URL` está definida desde sempre e
`AUTH_STORE=db` desde 19/ago/2026: contas e credenciais, fichas de aluno,
matrículas, pedidos, agendamentos, certificados e uso de IA vivem no Postgres —
e **nenhum worker os copiava**.

O que torna isso o achado mais caro da auditoria não é o tamanho do buraco, é a
aparência dele: **o backup não estava quebrado, estava incompleto**. Todo dia
ele copiava dezenas de arquivos, somava quilobytes e reportava zero erros; a
tela mostrava verde e dizia, corretamente, "Snapshots automáticos (JSON
stores)". Número que sobe todo dia dá impressão de saúde mais forte que número
parado, e backup incompleto é indistinguível de backup completo até o dia em que
alguém precisa dele.

`server/db/backup-db.ts` faz **despejo lógico** — uma linha por tabela, JSON,
dentro da mesma pasta datada que o upload para S3 já varre. Três coisas que não
se inferem lendo o arquivo:

- **Não é `pg_dump`, de propósito.** O binário teria de existir no servidor na
  versão compatível com o servidor de banco — dependência externa que falha em
  silêncio e só aparece no dia do desastre. Aqui se usa a conexão que a app já
  tem, e nenhum caminho de código novo no S3.
- **Não guarda schema, índices nem sequences.** A estrutura vem das migrations,
  que estão no git. **Restaurar é: migrations primeiro, linhas depois.**
- **`bancoCoberto` distingue três estados**, e essa é a parte que faltava:
  `null` (não há banco — modo JSON, e os arquivos já são a base inteira),
  `true` (as tabelas entraram) e `false` (**há banco e ele não está na
  snapshot**). O terceiro era o estado real da instalação, e nenhuma tela sabia
  dizê-lo.

`test/backup-cobre-o-banco.test.ts` cobra os três, e traz a guarda que importa:
`completo` é `tablesDumped === alvos.length`, que é **trivialmente verdadeiro
com zero tabelas**. A detecção usa um símbolo interno do Drizzle; se uma versão
futura o renomear, a lista fica vazia sem erro nenhum e o backup passaria a
dizer "banco salvo" cobrindo nada. O caso que exige mais de 20 tabelas é o que
avisa.

**A volta existe desde 5/set/2026** — `server/db/restore-db.ts` e
`scripts/restaurar_banco.ts`. Antes disso o despejo não tinha consumidor nenhum
no repositório, e `docs/deploy.md` ensinava a extrair um `.tar.gz` que o worker
não produz. Três coisas que qualquer mexida aqui tem de respeitar:

- **Migrations primeiro, linhas depois.** O despejo é lógico; a estrutura vem
  do git.
- **Ensaio é o padrão.** Sem `--commit` ele lista o que faria e imprime
  usuário, host e base — nunca a senha.
- **FK sem saber a ordem das tabelas:** apaga e insere em várias passadas,
  repetindo enquanto houver progresso. O atalho
  (`session_replication_role = 'replica'`) exige superusuário e normalmente não
  existe em banco gerenciado.

E uma que só apareceu rodando: **o nome do arquivo é o da tabela, não o do
export**. O despejo usava `Object.entries(schema)` e escrevia
`db-paymentOrders.json`; o restaurador procura `payment_orders`, e nada casaria
— backup completo, restauração vazia. O teste passava dos dois lados porque a
fixture usava o nome certo. Hoje o despejo grava o nome da tabela e o
restaurador **aceita os dois**, porque snapshot antiga tem de continuar
restaurável.

**O S3 não apaga nada, e isso é decisão, não pendência de código.** Quem sobe
backup não pode ter permissão de apagar backup: credencial de escrita
comprometida que também apague transforma um incidente em perda total. A
retenção pertence ao **lifecycle do bucket**, com a credencial do AVA em
`s3:PutObject` e sem `s3:DeleteObject`. Enquanto a regra não existir, o custo
cresce e nada se perde — o lado certo para errar.

O despejo carrega hash de senha e colunas cifradas; o que é cifrado usa chave
derivada de `AI_KEY_ENCRYPTION_SECRET`, que vive no ambiente e **não** entra no
despejo, mas a pasta e o bucket merecem o mesmo cuidado do banco.

## Sem rede não é "não existe": `isLoading` mente offline

No TanStack Query v5, requisição feita **sem conexão** fica com
`fetchStatus: 'paused'`. Nesse estado **`isLoading` é `false`** — ele é
`isPending && isFetching`, e nada está sendo buscado — e `isError` também é
`false`, porque não houve erro: a requisição nem partiu.

Ou seja, o estado mais comum do mundo real (celular no metrô) não é nem
"carregando" nem "erro". Numa tela que só conhece esses dois, a execução escorre
até o ramo final. E o ramo final era, em quatro telas do aluno,
`<Navigate to="/cursos" />`: **o aluno era jogado para fora da aula sem uma
palavra**. No `LearningLayout` era pior — a tela afirmava *"Este curso não
existe ou não está na sua estante"* sobre um curso que ele cursa e pagou.

A auditoria de 3/set/2026 achou **76 arquivos** com `isLoading` e sem `isError`
em lugar nenhum. **Toda a área do aluno está corrigida** desde 5/set/2026 —
lista de podcasts, episódio, notícias, biblioteca, eventos, detalhe de evento,
transcrição de sessão, comparação e pré-visualização de curso, além das cinco
telas de aula que já tinham sido feitas. **O que sobra é `/admin`**, e é
trabalho mecânico: lá o custo é painel que gira, não aluno lendo mentira sobre
si.

A pior das que faltavam era o **episódio de podcast**, e ela é o caso do
manual: `if (isLoading) …; if (!episode) return <Navigate to="/podcasts" />`.
Offline, os dois primeiros ramos são falsos e o ouvinte era **jogado para fora
do episódio sem uma palavra** — no metrô, que é onde se ouve podcast.

**A regra:** use `isPending` ("ainda não tenho dado"), não `isLoading`. E trate
`fetchStatus === 'paused'` **antes** dele, porque "sem internet" e "o servidor
falhou" pedem ações diferentes de quem lê. Os três cartões estão em
`src/app/components/EstadosDeConsulta.tsx` — `SemConexao`, `FalhaAoCarregar`
(sempre com botão de tentar de novo) e `NaoEncontrado`.

Três coisas que não se inferem lendo o componente:

- **Erro nunca redireciona.** No editor de curso um soluço de rede tirava o
  admin da tela e levava junto o que ele não tinha salvo. Erro pede "tentar de
  novo", nunca "sair da tela".
- **A tela não afirma que o curso não existe, nem no ramo de "não encontrei".**
  Ela não sabe: há **418 contas com login e sem ficha de aluno** em produção, e
  para elas o catálogo não devolve as matrículas que a pessoa de fato tem.
  Dizer "não existe" a quem pagou manda embora justamente quem precisa de
  ajuda — por isso o texto é "não achei na sua estante" e aponta para a
  secretaria.
- **Painel que não carregou diz que não carregou.** Três cartões do
  `/admin` faziam `if (!data) return null` e simplesmente sumiam, deixando a
  tela com aparência de completa. Ausência é lida como "não houve", que é o
  oposto de "não medi" — a mesma regra das telas de métrica.

## Havia duas CSP, e elas discordavam

O projeto tem **dois alvos de deploy**, e cada um trazia a sua política de
segurança escrita à mão: o VPS (`server/public/csp.ts`, usado por `dev.ts`) e a
Vercel (`vercel.json`). Divergiram em três pontos, todos na direção insegura —
corrigido em 3/set/2026:

- **`script-src 'unsafe-inline'` na Vercel.** Derrubava exatamente a defesa que
  as tags de marketing existem para ter: o servidor monta o trecho e serve de
  `/_pub/tags.js`, same-origin, **porque** `script-src 'self'` bloqueia inline.
- **Sem `frame-src`.** O bug do player de vídeo, de novo.
- **HSTS `includeSubDomains; preload`.** O `dev.ts` gasta doze linhas
  explicando por que não pode: `old.` hospeda a loja e não tem certificado, e
  HSTS não tem escapatória por clique. `preload` é pior — sair da lista
  embutida nos navegadores leva meses.

**A explicação mora em `test/duas-csp-nao-podem-discordar.test.ts` porque JSON
não aceita comentário.** Arquivo de configuração sem lugar para o porquê é
arquivo que diverge. O teste não exige políticas idênticas — os alvos são
diferentes —, exige que as **garantias** sejam as mesmas.

Duas coisas entraram junto:

- **`media-src`**, que não era emitido. Sem ele o áudio cai em
  `default-src 'self'` — a mesma parede do vídeo, com o mesmo sintoma (o player
  não toca, sem erro na tela). Entrou **antes** de o player de podcast existir,
  de propósito: o bug do vídeo custou dias porque a diretiva faltante só
  apareceu depois de muito procurar na conta da Vimeo.
- **Os cabeçalhos passaram a valer nos dois modos.** Viviam dentro do
  `if (staticRoot)` do `dev.ts`, então `npm run dev` — o modo em que se
  desenvolve — servia o site público SSR **sem CSP, sem HSTS e sem
  X-Frame-Options**. Era isso que tornava bug de política irreproduzível
  localmente: o player funcionava na máquina de quem programava porque não
  havia política para bloqueá-lo.

## Versionar arquivo em `data/` é ordem para apagá-lo em produção

Os dois caminhos de deploy fazem `git reset --hard origin/main`, e isso
**reverte arquivo versionado**. Todo arquivo de `data/` que estiver no git é,
na prática, uma instrução para sobrescrever o equivalente em produção no
próximo deploy.

Em 3/set/2026 duas exceções nominais saíram da lista, e não devem voltar:

- **`data/notification-prefs.json`** guarda quem pediu para **não** receber
  comunicado. Estava versionado como `[]`: cada deploy zerava a lista e o
  sistema voltava a escrever para quem se descadastrou — consentimento revogado
  ressuscitando sozinho.
- **`data/course-reviews.json`** guarda as avaliações escritas pelos alunos.
  Também `[]`, também apagado a cada deploy.

Nenhum dos dois precisava existir no repositório: o `JsonStore` cria o arquivo
com `() => []` na primeira leitura.

**As quatro que ficam são padrão de instalação nova** (nome da escola, texto da
tela de login, horário dos dois relatórios) — sem elas um clone limpo sobe sem
nada disso. Mas são igualmente editáveis em tela, então os **dois** scripts de
deploy passaram a preservá-las: guardam a versão de produção antes do reset e
devolvem depois. Sem isso, todo ajuste feito em `/admin/settings` voltava ao
padrão no deploy seguinte, em silêncio — a tela salva, responde 200, e o valor
só some depois.

`test/semente-nao-atropela-producao.test.ts` cobra as duas metades, e a lista é
comparada **exatamente**: arquivo novo versionado em `data/` falha o teste, que
é o momento de perguntar "isto some em produção no próximo deploy?".

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

## Drip: trancar o botão de concluir não é trancar a aula

A migration `0018` fez `releaseAfterEnrollmentDays` ser gravado de verdade, e o
gate correspondente foi plugado em **uma** rota: `POST /lessons/:id/complete`.
Essa rota registra a conclusão — ela não entrega nada.

Quem entrega o texto **e a URL do vídeo** é
`GET /me/courses/:c/lessons/:l/content`, e ela não checava. O heartbeat de
tempo assistido, também não. E o `lessonId` de aula trancada **já está com o
aluno**: `semConteudoDeAula` tira `content` e `videoUrl` da resposta do catálogo
e mantém a lista de aulas inteira, módulos trancados incluídos.

Resultado, sem esperteza nenhuma: link salvo, histórico do navegador ou URL
montada à mão abriam a aula completa antes da data. O que ficava trancado era o
botão de dizer "concluí" — e, como o certificado sai de contagem de cliques em
aula obrigatória, ele também não saía cedo. **O drip protegia a cerimônia de
conclusão, não a aprendizagem.**

Três coisas que a correção fixou e que valem para qualquer trava futura:

- **A checagem vai onde o dado sai, não onde ele é registrado.** Rota que
  entrega conteúdo é a que precisa do portão; rota que carimba progresso é
  consequência.
- **`423`, não `403`.** O conteúdo é dele e existe — só não abriu ainda, e a
  resposta diz quando (`lockedUntil` no corpo). `403` se lê como "você não tem
  direito a isto", que é outra conversa e outra ação de quem lê.
- **A data sai legível.** `dataDeLiberacao()` existe porque o aluno lia
  `liberação em 2026-09-19T03:00:00.000Z`. O campo cru continua no corpo, para a
  tela que quiser formatar sozinha.

**A tela do módulo não sabia do lock.** `LMSModule.tsx` não tinha uma única
ocorrência de `locked` e desenhava toda aula como `<Link>` — só `LMSCourse.tsx`
respeitava. Agora aula de módulo trancado é `<div aria-disabled>` com cadeado, e
a tela diz quando abre: fila de linhas apagadas sem uma frase se lê como
defeito, não como gotejamento.

**O que isso NÃO corrige:** o gatilho do certificado continua sendo contagem de
cliques em aula obrigatória — nenhuma nota, nenhum tempo assistido, nenhum quiz
participa (`server/repositories/certificates.ts` grava `progress: 100` fixo).
Isso é decisão de produto, e está aberta.

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

> ### ⛔ A importação por API não está pronta para uso (3/set/2026)
>
> Isto vale para o conector de API (`/admin/imports`, os connectors WP /
> LearnDash / WooCommerce). **Não a rode contra produção.** Ela não falha: ela
> completa, informa números e deixa a base pior, que é a forma cara de errar.
>
> O que a auditoria mediu:
>
> - **Cinco das oito entidades não chegam a tabela nenhuma.** `module` e
>   `lesson` gravam **nada** e mesmo assim contam como importadas; `order`
>   conta `created` sem criar.
> - **Toda matrícula importada nasce com a data de hoje** — e prazo de acesso
>   se conta a partir da matrícula. Ver "Prazo de acesso", acima: declarar
>   meses é retroativo, então importar assim reescreve o vencimento de quem
>   entrou em 2021.
> - **Todo pedido importado vira `pending`**, e status de pedido manda na
>   matrícula pelo ponto único. Importar pedido pago como pendente é suspender
>   acesso de quem pagou.
> - **A colisão de IDs entre os dois WordPress voltou.** A correção (prefixo
>   `portal:` / `psi:`) está só no script de carga, não no produto — os dois
>   sites numeram usuários a partir de 1, e o conector funde as duas bases.
> - `document`, `phone` e `active` são descartados na entrada.
>
> O caminho que funciona hoje continua sendo o dos scripts, descrito em
> `docs/migration-wp-ld.md`, sempre com ensaio antes de `--commit`.

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
