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

**E o E2E vermelho para o deploy automático, em silêncio.** `deploy.yml` dispara
por `workflow_run` condicionado à CI: com o job `e2e` falhando, ele sai
`skipped` — não falha, não avisa, apenas não acontece. Foi o que se mediu em
6/set/2026: **onze pushes seguidos com a CI vermelha** (de `b61cbec`, 5/set, a
`d736503`), o último verde sendo `699bac3` de 2/set, e **um único teste
falhando** — o menu mobile. `Quality` e `Build` passavam nos onze. Produção só
não ficou para trás porque houve deploy manual pelo caminho.

**Ao voltar a uma sessão, `gh run list --workflow=CI --limit 10` diz isso em
dois segundos** e nenhum arquivo do repositório diz. Um `git log` limpo e a
suíte verde localmente **não** provam que a esteira está andando.

## Checkout: nascimento e endereço — e o CPF que não chegava ao Asaas

`shared/endereco.ts` (7/set/2026). O checkout pedia nome, e-mail, CPF e
WhatsApp, e mais nada. Faltavam **data de nascimento e endereço completo**, e
não é preferência de formulário: o Asaas **recusa boleto sem CEP e sem
número**, e a análise antifraude de cartão pontua com nascimento e endereço.
Coletar o dado depois da recusa é perder a venda.

**Ao ligar os campos apareceu um defeito maior, no caminho do dinheiro:** o
provider do Asaas **nunca enviava o CPF**. O checkout coletava o documento,
conferia o dígito verificador e o passava adiante; o `createPayment` montava o
cadastro do cliente com `name` e `email`, só. O campo existia em
`CreatePaymentInput` desde 31/ago/2026 e ninguém o lia — e o roteamento de
produção manda **boleto** justamente para o Asaas. É a mesma classe do campo de
aula sem coluna: coletado, validado, e descartado em silêncio na última curva.

Cinco coisas que qualquer mexida aqui tem de respeitar:

- **A regra mora em `shared/`**, como `documento.ts` e `visibilidade.ts`: o
  navegador valida para dar erro na hora e o servidor revalida porque não
  confia no navegador. Duas cópias acabam discordando, e quem paga é quem está
  comprando.
- **Não há trava de 18 anos, de propósito.** Seria defensável — capacidade
  civil plena — mas quem compra pode ser o responsável por um estudante mais
  novo, e a trava recusaria venda legítima sem ninguém ter decidido isso. É
  política comercial; se a escola quiser, entra declarada.
- **Obrigatório no público, opcional no logado.** A assimetria é deliberada: a
  rota do aluno logado atende quem pode estar comprando o segundo curso.
  **Desde 8/set/2026 há prefill** (migration `0022` — ver a seção abaixo), mas
  ele só existe para quem já comprou uma vez; na primeira compra pelo app não
  há de onde preencher, e exigir ali obrigaria a redigitar tudo. A exceção é o
  boleto, que exige nos dois — o gateway o recusa sem endereço.
- **`city` não vai para o Asaas.** Naquela API é o **id numérico** da cidade;
  mandar o nome dá erro de tipo. O Asaas resolve o município pelo `postalCode`.
  E `province`, lá, é o **bairro**.
- **CEP não tem dígito verificador.** Conferir existência exigiria consultar os
  Correios, e uma checagem que depende de rede não pode barrar uma compra. O
  que se afirma é o formato — com `00000000` fora, porque é o que sai de
  formulário preenchido a esmo.

## Nascimento e endereço passaram a ser guardados (migration `0022`)

Até 8/set/2026 o checkout coletava os dois, mandava para o gateway e **não
guardava nada**. Quem comprava o segundo curso redigitava seis campos, e o
titular que pedia exportação ou exclusão não via nem apagava um endereço que a
escola de fato coletou — dado pessoal fora das duas pontas da LGPD, que é o
defeito que o fórum e a transcrição de sessão tinham.

**Onde mora: em `users`**, ao lado do `document`. Não em `students` (ficaria de
fora das 418 contas com login e sem ficha) nem em `payment_orders` (guardaria
histórico por compra, que não tem consumidor hoje, e duplicaria a superfície de
dado pessoal a apagar). Identidade da pessoa junto da identidade da pessoa, e a
anonimização já passa por ali.

Cinco coisas que qualquer mexida aqui tem de respeitar:

- **`birth_date` é `text` em `AAAA-MM-DD`, não `date`.** O tipo do Postgres
  volta como `Date` no driver e passa por fuso na serialização: `1990-03-15`
  vira `1990-03-14` para quem está a oeste de Greenwich. Data de nascimento não
  tem hora.
- **Quem grava é `salvarDadosDeCobranca`, não o `updateUser`.** Função à parte
  pela mesma razão que `document` não está no `UpdateInput`: alargá-lo daria à
  tela de edição do admin um caminho para gravar dado pessoal de cobrança que
  ela não tem nem deve ter. Há teste cobrando que os schemas de conta não
  ganhem esses campos.
- **Só grava o que veio.** Compra sem endereço (o caso do aluno logado fora do
  boleto) não pode apagar o endereço da compra anterior — é exatamente o que se
  quer preencher da próxima vez.
- **Gravar não derruba a compra.** Vai antes de cobrar, para que a segunda
  tentativa já venha preenchida se o gateway recusar; e o erro é engolido com
  log, porque o dado já seguiu para o gateway de qualquer forma.
- **O prefill marca os campos como "não digitados nesta sessão".** Sem isso,
  corrigir o CEP deixaria a rua da compra anterior colada no CEP novo — a
  pessoa ficaria com o CEP de uma cidade e a rua de outra, e o gateway
  recusaria sem explicar.

**A migration roda ANTES do código, e desta vez pelo VPS.** A porta 5432 do
DivZ não é alcançável da máquina de desenvolvimento, mas é do servidor: copiar
a pasta `server/db/migrations` para `/tmp` de lá e rodar o migrator com a
credencial de owner **no ambiente do processo** aplica sem que a credencial
toque o disco do servidor. Coluna nova em `users` com o código velho é seguro
(o Drizzle seleciona coluna a coluna); o contrário — código novo com banco
velho — quebraria **toda consulta a `users`**, inclusive o login.

## CEP: a consulta é nossa, e "não achei" não é "não consegui olhar"

`server/public/cep.ts` + `GET /public/cep/:cep` (8/set/2026). O checkout passou
a pedir seis campos de endereço porque o Asaas recusa boleto sem CEP e sem
número. Seis campos com o cartão na mão é onde a compra morre; com o
preenchimento pelo CEP sobram **dois** — o número e, se houver, o complemento.

**Por que a consulta sai do servidor e não do navegador de quem compra:**

- **O IP e o CEP do visitante não vão para terceiro nenhum.** Quem fala com o
  ViaCEP somos nós.
- **O cache é nosso.** CEP repetido não vira requisição externa nenhuma.
- **A queda do terceiro é nossa para tratar**, em vez de virar erro de rede no
  console de quem está pagando.

**Correção de uma afirmação anterior:** o handoff de 7/set dizia que a rota
própria era necessária porque "a CSP bloqueia terceiro". **Não bloqueia** — a
nossa emite `connect-src 'self' https:`, e um `fetch` direto do navegador
passaria. O motivo é privacidade, e ele basta; repetir o argumento falso faria
a próxima pessoa afrouxar a CSP achando que resolveria alguma coisa.

Cinco coisas que qualquer mexida aqui tem de respeitar:

- **Três respostas, não duas.** `200 {encontrado:true}`, `200
  {encontrado:false}` (os Correios responderam que não existe) e **`503` com
  `Retry-After`** (não deu para perguntar). Achatar as duas últimas faz a tela
  mandar conferir um CEP correto porque um serviço externo caiu por dez
  segundos — no exato momento em que a pessoa ia pagar. É o mesmo defeito da
  vitrine (`falhas-de-leitura.ts`), no lugar em que ele custa a venda.
- **Nada disso barra a compra.** Falhou, os campos continuam editáveis e o
  servidor revalida o endereço no checkout de qualquer jeito.
- **Só se sobrescreve o que o próprio preenchimento pôs** (marca
  `data-de-cep`). O que a pessoa digitou à mão fica de pé; corrigir o CEP
  depois refaz apenas o que veio do CEP anterior.
- **Falha não entra no cache.** Achado dura um dia, inexistente uma hora,
  indisponível nunca — senão uma queda de dez segundos ficaria colada no CEP
  de alguém.
- **`logradouro` e `bairro` vazios são normais** — é o CEP de cidade inteira e
  o de faixa. Vazio não pode ser gravado por cima do que já está no campo.

E **três segundos de timeout**, não os dez do ping de gateway: do outro lado há
uma pessoa parada no checkout, e digitar o endereço custa vinte segundos.

**As duas telas de compra usam a mesma rota e a mesma regra.** O site público
faz por `PUBLIC_JS`; a do aluno logado, pelo hook `usePreenchimentoPorCep`
(`src/app/data/cep.ts`). Elas já divergiram antes — até 2/set/2026 a do aluno
logado mandava ao gateway só o e-mail e nenhuma compra por dentro do app se
concluía —, então a paridade é cobrada por teste dos dois lados, e o que se
cobra é a **regra**, não o desenho: as três respostas, o que pode ser
sobrescrito, e resposta atrasada não pisar no CEP atual.

## A faixa final da home nasce do pincel do rodapé

`.cta-final` em `server/public/styles.ts` (8/set/2026). O último convite da
home — "Pronto para dar o primeiro passo?" — era `.hero-deep`: o **mesmo**
degradê petróleo do rodapé. As duas faixas se fundiam numa mancha só, e a
oferta final da página tinha aparência de rodapé, que é o lugar onde ninguém
procura oferta.

Agora é laranja com a textura de ondas (`public/img/pattern-ondas.webp`), e
encosta no rodapé sem vão.

Quatro decisões que um retoque futuro desfaz sem perceber:

- **O divisor é o `.pincel-topo`**, as ondas petróleo que sobem para dentro do
  rodapé — ele mora dentro de `footer()` e é dele que se fala quando se fala do
  "divider do rodapé". Quando a última seção é a faixa laranja, ele é **puxado
  para dentro dela** (`margin-top` negativo) e a faixa reserva embaixo a folga
  equivalente. Os dois saem do mesmo token, `--pincel-altura`: mudar um sozinho
  sobra ou falta exatamente essa diferença.
- **É um fundo só, não duas caixas encostadas.** Pintar o laranja e a textura
  em dois elementos deixaria a textura fora de fase justamente na junta — uma
  linha visível atravessando a página inteira.
- **O texto sobre o laranja é escuro** (`--on-orange`, 7,5:1). Branco sobre
  `#ff914d` dá 2,8:1 e reprova em qualquer tamanho. É a troca que mais tenta
  quem mexe em faixa colorida, e o token existe na paleta exatamente para
  isto. O botão é claro com tinta petróleo — o `.btn-cta` é laranja e sumiria.
- **A regra é `main:has(> .cta-final:last-child)`.** Entrar qualquer seção
  depois da faixa devolve o vão de 64px sem quebrar nada e sem ninguém ver;
  `test/faixa-final-encosta-no-rodape.test.ts` cobra isso, mais a existência do
  arquivo da textura — `url()` para caminho errado não dá erro em lugar nenhum,
  dá 404 no navegador de quem visita e uma faixa lisa.

## O custo do site público é ida-e-volta ao banco, não consulta

Medido contra o banco de produção a partir do próprio VPS em 8/set/2026, com
12 amostras por consulta:

| consulta              | mínimo | linhas |
| --------------------- | ------ | ------ |
| `select 1`            | 196 ms |      1 |
| `courses`             | 197 ms |      4 |
| `modules`             | 197 ms |    116 |
| `lessons` (sem corpo) | 203 ms |    590 |
| `lessons` (completa)  | 342 ms |    590 |
| `assessments`         | 196 ms |      0 |

**Ler 590 aulas custa o mesmo que `select 1`.** O tempo é a latência de rede
até o DivZ, e nenhuma otimização de SQL a toca — índice, `EXPLAIN`, coluna a
menos, nada disso mexe nos 196 ms. A única alavanca é **quantas idas** a página
faz.

Por isso `loadFromDb` passou a ler `courses`, `modules`, `lessons` e
`assessments` numa `Promise.all`: eram quatro `await` em fila, 791 ms de piso —
a soma exata dos quatro ida-e-voltas —, e nenhuma depende do resultado da
outra. Juntas, o piso é 203 ms.

**E o que a medição não autoriza afirmar:** o piso melhora 4×, a **mediana
não**. Quinze amostras × três rodadas intercaladas deram sequencial 803 ms e
paralelo 827 ms de mediana, com o paralelo variando de 203 a 1046 ms — o banco
é hospedagem compartilhada e parece serializar concorrência quando está
ocupado. O ganho é do melhor caso. Vale mesmo assim porque esta forma **não tem
como** custar mais idas que a anterior; no pior caso empata.

Três armadilhas de medição que custaram tempo aqui, e todas dariam conclusão
errada:

- **Sem o `Host` certo, a app responde 301** e `curl` mede o custo do
  redirecionamento: 1,5 ms, que parece um site instantâneo. Use
  `curl -H 'Host: psicanaliseclinica.online' http://127.0.0.1:3035/`.
- **Uma amostra não é medição.** A primeira comparação que fiz mostrou o site
  *piorando* depois da mudança — e o blog, que não lê curso nenhum, "piorou"
  junto. Era ruído do link. Compare mínimo e mediana de uma série.
- **Antes e depois têm de sair do mesmo minuto.** Comparar uma amostra de ontem
  com uma série de hoje não compara nada. O jeito honesto é cronometrar as duas
  formas lado a lado, no mesmo processo — foi assim que os 791 ms × 203 ms
  apareceram.

Quem quiser o caso típico melhor precisa atacar a latência (banco mais perto)
ou cachear — e cachear a vitrine tem o custo descrito na seção seguinte.

## A home levava 2,5 s de servidor, e lia a mesma coisa duas vezes

`server/public/memo-da-requisicao.ts` (8/set/2026). Medido no próprio VPS, com
`curl` no `127.0.0.1` — sem rede no meio: **2,5 a 3,7 s** só para responder a
home. No celular com 4G lento isso virava **LCP de 6,9 s**. Curso e checkout
ficavam em 1,4 s; o blog, em 0,46 s.

Cronometrado leitura a leitura contra o banco de produção: `numerosDoSite`
**2483 ms**, `listPublicCourses` 1054 ms, `listPublicPosts` 412 ms. Duas causas,
as duas dentro de `numerosDoSite`: as três leituras rodavam **em sequência**, e
a pior era `coursesRepo.listCourses()` — a árvore inteira de cursos, com o
conteúdo das 590 aulas, **só para contar quantas aulas existem**. Como a home
também chama `listPublicCourses()`, os ~3 MB vinham do banco remoto **duas
vezes na mesma página**.

**Por que memo por requisição e não cache com relógio.** Um cache de 60 s seria
mais rápido e traria um problema: a vitrine mostraria por até um minuto um curso
que o admin acabou de despublicar. `publicListed` não é preferência de exibição
aqui — foi a marca que segurava o curso interno de operadores, e o vazamento
dela custou um sprint em 2/set. E cache com relógio exigiria invalidar na
escrita: são **17 funções de escrita** só no repositório de cursos, e gancho
espalhado por dezessete lugares é gancho que alguém esquece.

Duas regras do arquivo: **falha não fica guardada** (a promessa rejeitada sai do
armazém, e o `safe()` de quem chamou decide o que a tela diz) e **fora de
requisição não há memo** — script, teste e boot leem direto, porque memo global
é estado compartilhado entre pessoas diferentes.

**A foto do herói também.** Todo mundo baixava a de 1792px (147 kB), inclusive
um celular de 393px — e já existia uma de 1280px pela metade do peso, que nada
usava. A imagem saiu do `style` do markup para o CSS, onde media query existe:
760px (32 kB) no telefone, 1280 no meio, a grande só acima de 1400. **O padrão
é a menor**: quem não casar com nenhuma media query fica com a leve, não com a
pesada.

**E a vitrine parou de trazer a apostila para montar cartão.**
`listCoursesResumidos()` seleciona as colunas de aula **sem `content` e sem
`transcripts`** — os 2,93 milhões de caracteres que vinham do banco remoto e
eram jogados fora logo em seguida, porque o caminho público já os removia da
resposta (`semConteudoDeAula`). As quatro leituras de curso da vitrine passaram
a usar essa variante, pelo mesmo memo.

**Isso não afrouxa nada.** O corpo da aula continua saindo só por
`/me/courses/:c/lessons/:l/content`, atrás de `courseAccessFor` — o que mudou é
que ele deixou de ser trazido para ser descartado. `listCourses()` completo
segue para quem edita e para quem estuda, e há teste cobrando que a vitrine não
volte a chamá-lo.

## A home não tem mais corte reto — e o `fill` do SVG não entende degradê

`server/public/styles.ts` + a home em `router.ts` (8/set/2026). O site tem um
divisor próprio, o **pincel**: três ondas do tom da seção **seguinte** subindo
por cima da atual. Ele existia em duas passagens — a do herói e a da faixa de
matrícula — e faltava em seis. A mesma página tinha os dois tratamentos.

Agora a regra é uma só: **toda troca de cor entre seções tem a onda, e onde a
cor não muda não entra divisor nenhum** (ele seria desenhado na própria cor do
fundo — invisível, e só um vão a mais).

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **A cor da onda é SÓLIDA, sempre.** O `fill` de um SVG **não entende**
  `linear-gradient()`: ele ignora o valor e cai no **preto**. Três passagens
  saíram pretas assim antes de a captura mostrar, e é a razão de o pincel do
  rodapé sempre ter usado `--brand-grad-topo` em vez de `--brand-gradient`.
  Para faixa em degradê, a sólida é a cor do **topo** — que é onde a onda
  encosta. Daí `--cta-grad-topo`, irmão do que já existia.
- **A folga embaixo acompanha `--pincel-altura`.** Era `120px` cravado contra
  uma onda que vai a `150px`: em 1440px a onda passava por cima dos 30px
  finais do conteúdo, e na faixa de matrícula isso cobria os **dois botões**.
- **O fim da página é calculado, não cravado.** As duas últimas seções são
  condicionais (formações e blog); com elas ausentes, o vizinho de baixo muda.
  Cor cravada erraria exatamente no dia em que o blog ficasse sem post.
- **Textura em faixa colorida é `.com-textura`, e a faixa é UMA seção.** A
  textura de duas caixas encostadas fica fora de fase na junta e a emenda
  aparece como um risco atravessando a página — foi por isso que o
  reconhecimento RNTP e os números declarados viraram um bloco azul só.

`test/home-sem-corte-reto.test.ts` cobra a regra lendo o HTML servido, e
inclui o caso do degradê no `fill`.

## O alarme da venda enxergava o pedido falhando, não o pedido faltando

`server/payments/recusas-de-checkout.ts` (8/set/2026). O alarme de checkout
existe desde 5/set e mede **taxa de falha sobre pedidos**. Ele estava certo
para o incidente que o criou — o gateway recusando a cobrança — e cego para o
vizinho, que aconteceu dois dias depois.

Quando a venda para **antes** de virar pedido, não há pedido para contar. A
validação roda antes de `createOrder`, então a recusa não existe em
`payment_orders`: `tentativas` fica em 0, `taxaFalhaPct` fica `null`, o painel
escreve *"sem base para medir"* — que é a frase honesta — e o worker
`return`ava antes de avisar ninguém. **Medido no banco de produção: em 7/set,
o dia em que o script velho em cache derrubou o checkout, foram zero pedidos
criados**, contra 3 a 13 por dia na semana anterior. O alarme escrito para o dia
em que a venda para ficou calado no dia em que a venda parou.

A segunda medida conta as recusas anteriores ao pedido, e dispara com **duas
condições juntas**: recusas acima do mínimo **e** nenhuma venda na janela.
Recusa sozinha é vida normal — gente digita CPF errado todo dia —, e recusa com
a venda passando não é a venda parada.

Cinco coisas que qualquer mexida aqui tem de respeitar:

- **A anotação é um middleware, não uma chamada em cada `return`.** As duas
  rotas de checkout somam mais de dez saídas de erro; espalhar o registro por
  todas é a receita conhecida — gancho em muitos lugares é gancho que alguém
  esquece ao acrescentar a décima primeira.
- **4xx conta, 5xx não.** Nas duas rotas a falha do gateway é `502` e acontece
  **depois** de o pedido existir: ele já vai para `failed` e já é contado pela
  outra metade. Contar aqui faria o mesmo incidente aparecer em dobro. E `429`
  fica de fora porque limitador é freio, não recusa de conteúdo.
- **Não se guarda nada de quem tentou comprar** — três campos: quando, qual
  rota, e a frase que a pessoa leu. Sem IP, sem e-mail, sem nome. É o que
  mantém isto fora das duas pontas da LGPD sem precisar de categoria nem de
  rotina, e há teste cobrando as três chaves.
- **`alertaDeRecusas` é conferido ANTES do `null`**, no painel e no worker. A
  ordem é o conserto inteiro: era o `taxaFalhaPct === null` que devolvia
  primeiro e pintava `na`.
- **O número nunca anda sozinho.** O motivo mais comum vai junto com o
  percentual dele — é o que separa robô postando lixo (motivos variados) de
  checkout quebrado (a mesma frase repetida), e é a frase que diz o que
  consertar.

`test/venda-parada-sem-pedido-nao-fica-calada.test.ts` — 12 casos, 5 falham
contra o código anterior. Metade deles é sobre **não** alarmar, pela mesma
razão do arquivo irmão: alarme que grita à toa vira filtro de caixa de entrada.

## A página nova rodava o script velho — e culpava quem estava comprando

`server/public/versao-de-asset.ts` (8/set/2026). O HTML do site sai **sem
`Cache-Control`**: cada visita traz a página nova. O script saía de
`/_pub/site.js`, endereço **fixo**, com `max-age=3600`. Depois de um deploy que
mexesse nos dois, o navegador de quem já tinha visitado montava a página nova
por cima do script guardado.

Em 7/set o checkout passou a exigir data de nascimento e endereço. Quem tinha o
script anterior em cache **via os campos novos na tela**, preenchia a data,
clicava em pagar — e o servidor respondia *"Informe a data de nascimento"* sobre
um campo visivelmente preenchido, no momento exato de pagar. Não havia o que a
pessoa fizesse.

**O diagnóstico tem um atalho, e ele vale para qualquer erro de validação
deste checkout:** *"Informe a data de nascimento"* só sai quando a chave **não
vem no corpo** (`invalid_type`); com a chave presente e vazia a mensagem é
*"Data de nascimento inválida"*. As duas mensagens separam "o navegador não
mandou" de "a pessoa não preencheu" — e a primeira acusa o script, nunca quem
compra. Um `curl` com o corpo sem a chave reproduz o texto exato em segundos.

E **não havia erro em log nenhum**: do lado do servidor era um 400 de validação
como outro qualquer, em 1 ms. O que se via era a venda não acontecer — dez 400s
seguidos em `pm2 logs`, sem uma linha dizendo por quê.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **A impressão digital vai no CAMINHO, não em `?v=`.** Proxy configurado para
  ignorar query string em arquivo estático serviria a cópia velha do mesmo
  jeito — e é justamente de proxy e de cache que se está falando.
- **Ela ocupa um SEGMENTO inteiro** (`/_pub/v/<hash>/site.js`). O roteador casa
  parâmetro por segmento; `site.:v.js` não casa nada, e o sintoma seria 404 no
  script do site inteiro — sem menu no celular, sem carrinho, sem checkout.
- **O endereço antigo continua servindo o script ATUAL.** Há páginas apontando
  para ele guardadas em navegador por aí; 404 ali deixaria essas páginas sem JS.
  O que mudou é a validade: um minuto, não uma hora.
- **O CSS não tem esse problema porque é inline** (`PUBLIC_CSS_SERVIDO` vai
  dentro do `<style>`). `/_pub/tags.js` tem `max-age=300` e é configuração, não
  código acoplado ao HTML — se um dia passar a ser, entra na mesma regra.

`test/pagina-nova-nao-roda-script-velho.test.ts` cobra as três metades, e a que
importa é a terceira: que a URL **mude** quando o script mudar. Impressão
constante passaria pelas outras duas e não protegeria nada.

## Crase dentro de template literal quebra o arquivo inteiro

Três arquivos deste projeto são um template literal gigante: `public/client.ts`
(o `PUBLIC_JS`), `public/styles.ts` (o CSS) e todo bloco `html\`...\`` de
`router.ts` e `layout.ts`. **Um acento grave num comentário fecha o template**,
e o erro que aparece é `Unterminated template literal` centenas de linhas
adiante — parece corrupção do arquivo, e é uma crase.

Custou quatro interrupções em 7/set/2026. Ao comentar dentro desses arquivos,
escreva `shared/endereco.ts` sem crase, e prefira mover a explicação para fora
do template — um comentário de JS antes da função diz a mesma coisa e não vai
junto no HTML servido a cada visita.

### A irmã silenciosa: barra invertida também some

A crase pelo menos **quebra a compilação**. A barra invertida não: no template
literal, `\D` é uma sequência de escape desconhecida e o resultado é `D`.

Foi o que aconteceu com a máscara de CEP, escrita em 7/set/2026 e encontrada em
8/set. `String(el.value).replace(/\D/g, '')` chegava ao navegador como
`replace(/D/g, '')` — apagava **a letra D** e deixava passar o hífen. Digitando
o oitavo dígito, o campo mostrava `12345--67`. Compilou, subiu, e a suíte ficou
verde o tempo todo, porque **nada avaliava o `PUBLIC_JS`**: os testes liam o
HTML servido e nunca executavam o script.

**Toda barra invertida dentro do `PUBLIC_JS` vai dobrada** (`/\\D/g`), e
`test/cep-preenche-no-navegador.test.ts` agora executa o script de verdade em
jsdom — é o único lugar onde esse defeito aparece.

## `getAll()` + `setAll()` perde escrita concorrente — em mais 24 lugares

Este arquivo já documentava o padrão desde 5/set/2026, quando treze rotinas do
expurgo viraram `modify`. **Ele sobreviveu em 24 outros pontos**, encontrados
por varredura em 7/set/2026.

A mecânica: `getAll()` devolve uma **cópia rasa** do array vivo, `setAll()`
instala outra cópia por cima. Entre as duas há `await` — e a requisição A quase
sempre aguarda algo nesse intervalo (uma consulta, um hash, uma chamada HTTP).
Tudo que a requisição B gravar nessa janela é jogado fora, sem erro e sem log.

**Os piores eram os logs de acréscimo** — auditoria, erros, e-mail, mensageria,
tutor, entrega de webhook. São exatamente os que recebem escrita concorrente em
**rajada**: quando muita coisa falha ao mesmo tempo é quando os registros se
perdem. O log de erros perdia registro de erro justamente durante um incidente;
o de auditoria, a prova do que a escola fez; o de e-mail é lido pelo expurgo da
LGPD para dizer o que foi enviado a uma pessoa.

Dois métodos novos no `JsonStore` resolvem a maioria sem repetir `modify` vinte
vezes:

- **`unshiftComTeto(item, max)`** — insere no topo e apara numa passada só.
  `items.length = max` corta no lugar, sem criar array novo.
- **`removeAll(predicate)`** — `remove` só tira o primeiro que casa, e quem
  precisava tirar vários caía no par. Varre de trás para a frente, senão
  remover o índice 0 faz o antigo 1 virar 0 e a varredura pula ele.

Nove exclusões por id viraram `store.remove(...)`, que **já existia atômico** e
ninguém usava.

**O que ficou de fora, de propósito:** `setAll([])` (limpar) e a gravação que
monta a linha inteira a partir da entrada (`zoom-config.setConfig`,
`transcription.setConfig`) não são leitura-seguida-de-escrita — são
substituição deliberada, e não têm a janela.

> **Correção de 8/set/2026.** Este parágrafo dizia `setAll([cfg])`
> (configuração de uma linha só), e isso estava errado para o formato que
> **todas** as telas de configuração deste projeto usam:
> `const atual = await getConfig(); const next = {...atual, ...patch}; await
> store.setAll([next])`. Isso é ler, mesclar e gravar — dois pedidos leem a
> mesma base e o segundo apaga a mudança do primeiro. Oito pontos assim
> viraram `modify`: configurações da escola, tela de login, tags de marketing
> (onde a perda também refecha a CSP e o script volta a ser bloqueado sem
> explicação), os três agendamentos de relatório, o reengajamento e o
> `zoom-config.disable`.
>
> **E um nono escapou por não ter o formato `setAll([x])`:**
> `reengagement/config-store.recordSent` fazia `[novo, ...todos].slice(0, N)`,
> que é exatamente o `unshiftComTeto` criado naquele mesmo sprint. É o livro
> que impede reenviar para a mesma pessoa — registro perdido ali não é linha
> faltando num log, é **o aluno recebendo o e-mail outra vez**.
>
> `test/config-de-uma-linha-perde-escrita.test.ts` demonstra as duas perdas.

`test/getall-setall-perde-escrita.test.ts` **demonstra a perda** em vez de
descrevê-la, e guarda uma pegadinha: escrever `const p = store.unshift(...)`
sem `await` **não** reproduz o defeito. Ordem de microtarefa — o `setAll`
instala a cópia de forma síncrona antes da continuação do `unshift`, e a linha
nova cai na lista já instalada. O defeito exige a escrita concluída dentro da
janela, que é o caso real de duas requisições.

## O painel de saúde não perguntava pelos workers

`server/health/dashboard.ts` (7/set/2026). Ele tinha dezesseis verificações —
gateways, e-mail, webhooks, IA, erros recentes, disco, checkout — e **nenhuma**
sobre os treze processos que rodam sozinhos. É a primeira tela que alguém abre
quando desconfia de alguma coisa, e não olhava para onde o silêncio custa mais.

Três escolhas deliberadas:

- **O estado sai só de `saudavel === false`**, que é falha medida. `enabled`
  ficou de fora: em Vercel Functions worker nenhum roda, e tratar isso como
  problema encheria o painel de alarme falso onde não há o que alarmar. Quem
  quiser ver quem está parado tem `/admin/jobs`.
- **`na` quando nada rodou ainda**, nunca `ok`. Verde sem medição é a mesma
  mentira das telas de métrica.
- **O nome de quem falhou vai na mensagem.** É o que transforma "algum worker
  falhou" em "o aviso de vencimento de acesso falhou" — a mesma razão de o
  alarme de checkout carregar o motivo mais comum junto.

De quebra, o selo de `/admin/jobs` deixou de mentir: o texto dele dizia que "a
maioria dos workers não sabe dizer da própria saúde" e que "só três respondem
de verdade". Hoje respondem os treze, e `null` mudou de significado — passou de
"este worker não sabe dizer" para **"ainda não rodou nesta vida do processo"**.
Num worker de 24h isso é normal logo depois de um restart; num de 30 segundos,
é sinal de que algo não arrancou.

## O site público dizia "não existe" quando era "não consegui ler"

`server/public/falhas-de-leitura.ts` (7/set/2026). O site tem uma regra boa e
tinha uma consequência ruim. A regra: `projections.ts` embrulha toda leitura em
`safe()` e **nunca** devolve 500 por erro de banco — a vitrine não cai porque
uma tabela não respondeu. A consequência: o fallback passava por verdade.

Com as 21 leituras falhando que o log de produção registrou — período
terminando em 4/set/2026, ver a seção acima —, o visitante via:

- **`/formacoes` dizendo "Em breve novos cursos"** — a escola parecendo não ter
  nada à venda;
- **`/formacao/:slug` respondendo 404** — a página que vende afirmando que o
  curso não existe. Para o comprador e para o robô de busca, que registra a
  página como inexistente por causa de uma queda de um segundo;
- **a home omitindo a seção inteira** de formações, com um `courses.length ?
  ... : ''`, ficando com cara de completa. É o mesmo `if (!data) return null`
  já corrigido nos cartões do `/admin`.

É a mesma regra que o projeto já aplica às telas de métrica ("zero diz *medi e
não houve*") e às telas do aluno ("sem rede não é *não existe*"). Faltava no
único lugar em que o leitor é um desconhecido decidindo comprar.

Três coisas que qualquer mexida aqui tem de respeitar:

- **`safe()` registra, não só loga.** A falha é anotada onde acontece e
  consultada onde importa — o render.
- **O armazém é por requisição** (`AsyncLocalStorage`). Variável de módulo
  vazaria a falha de um visitante para a página do seguinte. Fora de
  requisição (script, teste, boot) não há coletor e registrar é inócuo, de
  propósito: anotar falha não pode ser motivo de erro novo.
- **503 com `Retry-After`, nunca 404.** O 404 é uma afirmação — "isto não
  existe" — e o índice de busca acredita nela. O 503 diz "volte", que é o que
  se sabe.

**Por que não trocar as assinaturas.** As projeções são chamadas de oito
lugares e devolvem listas e objetos diretos; um `{ ok, valor }` espalharia a
checagem pelo roteador inteiro e convidaria a esquecê-la em um ponto — que é
como o defeito nasceu.

## Queda de conexão com o banco custava o chamado do aluno

`server/db/repetir-consulta.ts` (7/set/2026). Medido no log de erro de produção,
que cobre um período terminando em **4/set/2026 21:53 UTC** — daí para cá o
`stderr` não recebeu uma linha, então isto é um problema **intermitente e em
rajada**, não contínuo. No período, com 7 quedas de conexão:

- **10 `insert into support_tickets` falharam** — o aluno escreveu o chamado,
  clicou em enviar e levou erro;
- **21 leituras do site público** falharam (cursos, posts, certificados);
- a primeira linha do log é `[auto-issue cert] erro ao verificar`: **certificado
  que não foi emitido**.

As mensagens são `Connection terminated unexpectedly` e `read ETIMEDOUT` — a
assinatura de uma conexão TCP de longa distância derrubada no meio. O banco
(DivZ) é remoto, não havia nada errado com as consultas, e **não existia
retentativa em lugar nenhum**: uma queda de rede de um segundo virava erro na
cara de quem estava usando.

**A regra é a mesma que este projeto já escreveu para pagamento**, e é o que
torna o conserto seguro. Em `criou-cobranca.ts`, `!res.ok` não provava que a
cobrança não fora criada, e repetir gerava cobrança dobrada. Aqui:

- **Leitura repete sempre.** `SELECT` não tem efeito.
- **Escrita só repete quando é certo que a consulta NÃO SAIU.** Conexão morta
  *durante* um `INSERT` pode ter deixado o commit gravado do outro lado — o que
  se perdeu foi a resposta. Só as falhas de **aquisição** de conexão provam que
  nada foi enviado (`timeout exceeded when trying to connect`,
  `Connection terminated due to connection timeout`), porque nelas a consulta
  nunca chegou a existir.

Errar para o lado de não repetir custa uma mensagem que a pessoa refaz à mão.
Errar para o outro cria chamado, certificado e matrícula em duplicata — e
ninguém vai atrás do que não deu erro.

Três coisas que não se inferem lendo o arquivo:

- **`WITH` não conta como leitura**, de propósito: uma CTE pode terminar em
  `INSERT ... RETURNING`. A checagem é estrita em vez de esperta porque o custo
  de errar é gravar duas vezes.
- **Só o `query` do pool é embrulhado.** Transação abre um `PoolClient`
  dedicado, e repetir um comando dentro de uma transação já abortada não
  recupera nada — no Postgres um comando que falha aborta a transação inteira.
- **`keepAlive: true` entrou junto no pool**, e é a metade preventiva: sem ele,
  conexão parada é derrubada em silêncio por NAT ou firewall no meio do
  caminho, que é exatamente como as duas mensagens do log aparecem.

**Correção de uma afirmação minha:** a mensagem do commit `b1bc2d9` diz que as
falhas "continuam acontecendo agora, medidas minutos atrás". Está errado, e o
erro foi ler o `tail` do log sem olhar o carimbo do arquivo: o
`ava-pco-error.log` não recebe uma linha desde 4/set/2026 21:53 UTC. As falhas
são reais e custaram o que está descrito; o que não se pode afirmar é
continuidade. **Ao citar log de produção como evidência, confira o `stat -c %y`
antes** — `tail` mostra o fim do arquivo, não o presente.

## Worker que falha todo ciclo não pode aparecer verde

`server/jobs/registro-de-tick.ts` (7/set/2026). Os treze workers seguem o mesmo
molde: `setInterval` chamando um tick assíncrono, com o erro engolido para que
um ciclo ruim não derrube o processo. **A parte engolida está certa.** O errado
era o que sobrava depois.

O tick típico gravava `lastRunAt` e `lastRunResult` **no fim**. Uma exceção
pulava a gravação, e o `.catch(() => {})` apagava o rastro: o status ficava com
o último resultado **bem-sucedido**, `enabled` seguia `true`, e `/admin/jobs`
mostrava um worker saudável com um carimbo de hora velho. Ninguém vigia carimbo
de hora — o worker podia estar falhando há um mês.

**Nove dos treze estavam assim**, e `server/jobs/inventario.ts` os declarava
`saudavel: null` com literal fixo no código — a ausência de medição estava
escrita no painel, não no worker. Entre os nove: o que avisa o aluno que o
acesso vence, o que lembra da sessão paga, e os dois que mandam e-mail para
aluno.

É a mesma classe do `catch` vazio da sondagem da Sandra, que fez pagamento real
deixar de virar matrícula em silêncio. Lá o conserto foi caso a caso; aqui
virou peça única.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **`comRegistro` nunca lança.** O `setInterval` continua vivo como antes; a
  diferença é que a falha passa a existir no status em vez de sumir.
- **Uma falha já derruba `saudavel`, sem limiar.** Para um worker diário, um
  ciclo perdido é um dia inteiro de aluno não avisado — esperar a terceira
  falha seria esperar três dias. Como ele volta a `true` no primeiro sucesso,
  descreve o estado de agora e não vira alarme. Quem quiser graduar gravidade
  tem `falhasSeguidas`.
- **`null` é "ainda não rodou", nunca "ok".** Dois workers afirmavam saúde
  antes de medir: a **Sandra** nascia `saudavel: true` com o comentário dizendo
  "a varredura completou alguma vez desde o boot?" — e nenhuma tinha completado;
  o **alerta de checkout** calculava `ultimoErro === null`, que é `true` antes
  da primeira avaliação. Os dois são justamente os que existem para avisar que
  dinheiro parou de entrar.
- **O carimbo é do sucesso.** Onde o tick atualizava `lastTickAt` no fim, isso
  virou uma função à parte: falha vai para o registro, não para o relógio.

**O dispatcher de webhooks era o pior, e por outro motivo.** As duas chamadas do
`startWorker` eram `void tickWorker()` **sem `catch` nenhum**. Rejeição não
tratada derruba o processo por padrão no Node desde a v15, e este repositório
não instala `process.on('unhandledRejection')` — a falha não era só invisível,
era capaz de matar a aplicação e deixar o PM2 reerguendo. (Não há evidência de
que tenha acontecido: os `[api] unhandled error` do log de produção são do
tratador do Hono, não do processo.) Ele também tem duas medidas diferentes, e
as duas contam: `falhasAoEnfileirar` é evento que nem entrou na fila — não há
retry que o salve —, e `saudavel` é o ciclo de entrega.

`test/worker-que-falha-nao-fica-verde.test.ts` trava as três garantias: que os
treze expõem `saudavel`, que nenhum nasce verde, e que o `startWorker` de cada
um passa por `comRegistro`. Worker novo que chegue sem isso falha o teste.

## Ciclo que termina não é ciclo que fez alguma coisa

`server/jobs/inventario.ts` + `server/health/dashboard.ts` (8/set/2026). O
sprint de 7/set fechou o worker que **lança**: todos passam por `comRegistro` e
uma exceção derruba `saudavel`. Ficou de fora o caso vizinho, que é o mais
provável de acontecer.

Os workers que percorrem itens pegam o erro **por item**, contam e seguem — e
isso está certo: um endereço inválido não pode derrubar o envio dos outros 199.
Só que o tick termina normalmente, `comRegistro` grava sucesso, e um ciclo que
examinou 200 lembretes e falhou nos 200 aparecia **verde** no painel. A rotina
rodou, contou e reportou sucesso; o que ninguém recebeu foi o aviso da sessão
que a pessoa pagou.

Três coisas que qualquer mexida aqui tem de respeitar:

- **`saudavel` e `ultimoCiclo` respondem perguntas diferentes.** O primeiro é
  "o tick terminou?", o segundo é "ele entregou?". Fundir os dois faria o
  worker cair por um endereço inválido entre duzentos.
- **`ultimoCiclo: null` é "não conta itens", nunca `{ ok: 0, erros: 0 }`** —
  zero é uma medição, e a maioria dos workers não tem itens para contar. Cada
  adaptador do inventário traduz os campos do seu worker à mão (`enviados/erros`,
  `sent/errors`, `filesBackedUp/errors[]`), pelo mesmo motivo que o arquivo
  inteiro é assim: um normalizador por heurística quebra em silêncio.
- **Dois níveis no painel, porque as ações são diferentes.** *Nada passou*
  (`erros > 0` e `ok === 0`) é vermelho — é o worker mudo, e a causa costuma
  ser uma só, credencial de e-mail vencida. *Algo falhou* com o resto entregue
  é amarelo: não pode pintar o painel de vermelho, e não pode sumir.

## O expurgo não pode calar sobre o que não alcança

Duas metades do mesmo defeito, fechadas em 7/set/2026. Nenhuma dava erro — a
rotina rodava, contava e reportava `completo: true`.

### A referência externa sobrevivia à anonimização

`external-references.json` amarra a conta ao usuário do WordPress de origem
(`psi:1234`, `portal:567`), e é **indexada pelo id da conta**. O expurgo
trocava o nome e o e-mail na tabela de contas e deixava, na linha ao lado, o
ponteiro para o nome real. Anonimizar assim é de fachada: o caminho de volta
continua escrito, no mesmo `data/`.

Agora é categoria (`externalReferences`), destino **apagar**, nas duas pontas —
exportação e expurgo, como o invariante exige.

Duas coisas que qualquer mexida aqui tem de respeitar:

- **`internalId` só é o id do usuário nas referências de `student`.** As de
  pedido e de matrícula carregam o id do pedido e o da matrícula, e seguem o
  destino das suas próprias categorias — pedido pago é documento fiscal retido.
  Por isso a busca é por id, sem filtrar tipo: acerta a linha de identidade e
  não encosta nas outras.
- **A consequência operacional, que não é óbvia:** sem a referência, uma
  reimportação da mesma origem não reconhece a pessoa e criaria conta nova —
  ressuscitando o que o titular mandou apagar. O conserto disso não é guardar o
  vínculo; é a escola remover o titular **na origem**, obrigação dela do mesmo
  jeito. Guardar o mapeamento "para o caso de reimportar" seria manter o
  identificador exatamente pelo motivo que a anonimização existe para eliminar.

### A transcrição de sessão não estava em ponta nenhuma

Não saía no `/me/export`, não aparecia no expurgo, e não era declarada. O
relatório afirmava completude por cima de um lugar que ninguém tinha olhado —
mesma classe do `contar()` com `catch` vazio que este arquivo já corrigiu.

**Ela não virou categoria com rotina, e a razão é do modelo, não esquecimento.**
`SessionTranscript` guarda `sessionId`; `LiveSession` **não tem lista de
participante** — nenhum campo, em nenhum dos dois stores, liga a transcrição a
uma pessoa. O `speaker` dos segmentos é rótulo do provedor ("Speaker 0"), não
identidade. Procurar o nome no `fullText` seria pior que não procurar: falso
positivo apaga a fala de terceiros, falso negativo mente dizendo que apagou. E
a gravação é de aula coletiva: apagá-la a pedido de um aluno destruiria o
registro dos outros.

**Também não virou `reter`**, e a distinção importa: retenção é decisão
jurídica sobre algo que se sabe existir e se sabe achar, com motivo escrito.
Aqui não se sabe se existe. Chamar isto de retenção usaria uma palavra que
promete conhecimento que não temos.

O que sobrou é `SEM_INDICE_POR_TITULAR` no resultado (`semIndice`), impresso no
**ensaio** — que é o que o operador lê antes de autorizar. Ele traz o total do
**store**, não do titular: é o que distingue "não há o que procurar" de "há 300
arquivos para alguém olhar à mão". `null` ali é "não consegui contar", nunca
zero.

`test/expurgo-nao-cala-o-que-nao-alcanca.test.ts` cobra os dois lados, e um dos
casos é a prova de que a ausência de rotina é do modelo: ele lê os dois stores
e falha no dia em que a sessão ganhar lista de participante — que é exatamente
quando a categoria tem de deixar de ser manual.

## Upload: quem diz o que o arquivo é são os bytes, não o cliente

`server/uploads/assinaturas.ts` (7/set/2026). Até então `saveUpload` lia
`file.type` — o `Content-Type` que quem envia escreve na parte do multipart,
texto livre — e a extensão gravada saía dali. Nenhum byte do conteúdo era
olhado. Era o `SEC4-003`, anotado como "meia-verificação" desde 6/set.

**O que era, medido:** `POST /uploads` é `requireAuth()`, não
`requireAuth('admin')`. Bastava declarar `image/png` para qualquer um dos ~1.600
alunos gravar bytes arbitrários e receber de volta uma URL sob o domínio da
escola.

**O que NÃO era, e vale escrever para ninguém superestimar depois:** execução
de script. `/uploads/*` sai com `X-Content-Type-Options: nosniff`
(`server/public/csp.ts` vale em `root.use('*')`, cobre o estático também) e o
`serveStatic` deriva o `Content-Type` da extensão — HTML gravado como `.png`
chega como `image/png` e não roda. O que havia era hospedagem de arquivo
arbitrário no domínio de uma escola, que é o que empresta credibilidade a um
golpe — a mesma razão de documento já ser restrito à administração.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **O tipo declarado não participa mais da decisão** — nem para confirmar, nem
  para desempatar. PNG enviado com rótulo de PDF é gravado como `.png`.
- **Nada reconhecido é recusado.** "Não sei o que é isto" não pode virar "então
  deixa passar".
- **A separação entre as duas listas continua sendo da rota.** Detectar melhor
  não pode dar ao aluno o que só a administração tem: PDF genuíno enviado à
  rota de imagem é recusado pela lista, não pela assinatura.
- **O limite de tamanho é conferido ANTES de ler os bytes.** Decidir pelo
  conteúdo exige carregar o arquivo; sem o limite antes, a leitura viraria o
  próprio ataque.

Duas armadilhas de formato que o detector resolve e que não se inferem: **todo
EPUB é um ZIP**, e o que o separa de um `.zip` qualquer é a exigência do OCF de
o arquivo `mimetype` vir primeiro e sem compressão — o valor fica em claro no
deslocamento 30. E o **PDF** aceita o cabeçalho dentro do primeiro kilobyte,
não só no byte zero (ISO 32000): exigir o byte zero recusaria apostila legítima.

**A suíte ficou verde durante toda a vida do defeito, e o motivo é o de sempre
neste projeto:** as fixtures eram `new Uint8Array(n)` — zeros com um `type`
declarado no construtor do `File`. Elas provavam que o upload aceitava o
**rótulo**. Os bytes de verdade agora moram em `test/apoio-arquivos.ts`, e as
duas suítes antigas passaram a usá-los. **Teste de upload com buffer de zeros
não testa upload.**

## O menu mobile é um diálogo — e o papel entra e sai por JS

`server/public/client.ts` (6/set/2026). O painel do menu no celular **é o mesmo
`<nav id="site-nav">`** que serve de barra de navegação no desktop: abaixo de
900px o CSS esconde o `<nav>` e mostra o `.menu-toggle`, e `.nav.open` o traz de
volta como painel absoluto sob o cabeçalho.

Até 6/set/2026 abrir o menu era só `classList.toggle('open')`. Não havia papel
de diálogo, nome acessível de painel, `Esc`, foco preso nem clique-fora. Quem
abrisse o menu pelo teclado ficava sem como fechá-lo, e o `Tab` saía do painel
aberto para os links **atrás** dele: invisíveis para quem enxerga, alcançáveis
para quem navega por teclado ou leitor de tela.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **`role="dialog"` não pode estar no markup.** O mesmo elemento é a navegação
  principal em toda tela larga; um papel fixo mentiria ali. Ele entra em
  `abrirMenu()` e sai em `fecharMenu()`, junto com `aria-modal` e com a troca do
  nome acessível — `"Principal"` descreve a barra, `"Menu"` descreve o painel.
- **O foco preso é a razão de o `aria-modal` ser honesto**, e a saída é o `Esc`.
  O botão que abre fica **fora** do painel, então ele não entra no ciclo do
  `Tab`: com `aria-modal="true"`, o que está fora não é anunciado, e pôr o botão
  no ciclo prometeria um alcance que o leitor de tela não tem.
- **Clique fora fecha.** O painel não tem cortina; deixar o clique atravessar
  faria o `aria-modal` prometer um isolamento que não existe.
- **Voltar para largura de desktop fecha.** O CSS some com o painel sozinho, e
  um diálogo invisível continuaria sendo anunciado — daí o ouvinte de
  `matchMedia('(min-width:901px)')`, dentro de `try/catch` porque jsdom não
  implementa `matchMedia`.

O contrato é cobrado nos dois níveis, de propósito:
`e2e/mobile-smoke.spec.ts` (navegador de verdade, toque de verdade) e
`test/menu-mobile-acessivel.test.ts` (milissegundos, na suíte que se roda antes
de commitar). O segundo nasceu porque o primeiro **já cobrava isso desde
5/set/2026 e ficou onze commits vermelho** sem que ninguém visse.

**Uma armadilha ao mexer nesse teste:** o `PUBLIC_JS` é avaliado **uma vez** por
arquivo. Os ouvintes dele vivem em `document`; avaliá-lo por caso empilharia
handlers, e dois toggles no mesmo clique se anulam — o teste passaria a medir a
si mesmo. O estado de aberto/fechado mora no fechamento do script, não no DOM,
e é por isso que o `beforeEach` dispara um `Esc` depois de trocar o corpo.

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

**Acesso SSH — e isto depende da máquina.** Em 27/ago/2026 a chave `pco_deploy`
foi instalada no usuário `avapco` (pelo painel da Hostinger) e o atalho `vps`
passou a apontar para ele; ali o `sudo -u avapco -i` deixou de ser necessário.
**Na máquina de 6/set/2026 (`C:`) essa chave não existe** — `~/.ssh/pco_deploy`
não veio junto, porque chave não viaja com o repositório. O que funciona aqui é
o atalho genérico `vps` (root, chave `enlevo_vps195`), e por ele **todo comando
da app volta a exigir `sudo -u avapco -i`**. Antes de seguir qualquer receita
desta seção, confira com `ssh vps whoami`: se responder `root`, use o prefixo.

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
local funcionava no mesmo minuto. Não era código nem chave.

**Tente o re-run ANTES do deploy manual.** A falha se repetiu em 7/set/2026, no
mesmo formato, e `gh run rerun <id> --failed` resolveu na primeira tentativa: a
indisponibilidade é do caminho de rede entre o runner e o VPS, e ela passa.
Custa um comando e trinta segundos, contra reconstruir tudo à mão.

Se o re-run também falhar, aí sim o caminho é `bash scripts/deploy_producao.sh`,
que confere o host, faz backup do `data/` e compara o hash do bundle. **Bundle igual antes e depois é esperado** quando o
commit não toca no frontend — o aviso do script é genérico; confirme pelo
`git log -1` do servidor.

Logs: `pm2 logs ava-pco` ou `~/ava-pco/app.log`.

## Onde o trabalho parou

> ### 8/set/2026, tarde — a venda estava quebrada em produção, e nada dizia
>
> O dono relatou o checkout recusando data de nascimento preenchida. **Não era
> a validação**: era o navegador rodando um script velho por cima de uma página
> nova. Duas seções acima contam o porquê de cada metade; o que interessa ao
> retomar:
>
> | commit | o quê |
> | --- | --- |
> | `a871f3e` | o script do site passou a ter a impressão digital no endereço |
> | `c642e97` | o alarme da venda deixou de ser cego para a recusa antes do pedido |
> | `846a557` | a leitura de curso fazia quatro idas ao banco, uma esperando a outra |
> | `2e460b4` | a medição do ganho, e a correção do que o commit anterior superestimou |
>
> **Como o diagnóstico foi fechado, porque o atalho vale para a próxima vez:**
> a frase *"Informe a data de nascimento"* só sai quando a chave **não vem no
> corpo**; com a chave vazia a mensagem é outra. Um `curl` contra produção com
> o corpo sem a chave reproduziu o texto exato em segundos, e um navegador de
> cache limpo (Playwright, com a requisição interceptada para não criar pedido)
> comprava normalmente. Servidor certo, cliente velho.
>
> **O número que fecha o caso**, medido no banco de produção: 2/set a 6/set
> tiveram 4, 1, 2, 13 e 3 pedidos criados; **7/set teve zero** — o dia em que o
> campo entrou. E zero pedidos é exatamente o que faz o alarme calar, porque
> ele mede taxa de falha *sobre pedidos*.
>
> **Duas armadilhas de ferramenta que custaram tempo aqui**, e nenhuma é do
> projeto:
>
> - **A barra invertida some entre o shell e o arquivo.** Escrever um regex com
>   duas barras invertidas num heredoc pelo Bash chega ao disco com uma só, e o erro
>   aparece como "Unterminated group" numa linha que parece correta. Arquivo com
>   barra invertida vai pelo Write, não pelo heredoc — é a mesma classe da crase
>   dentro do template literal, noutro lugar.
> - **`server/app.ts` e o `CLAUDE.md` já estão fora do padrão do Prettier em
>   `main`.** Rodar `--write` neles reformata mais de cem linhas alheias e
>   afoga o diff. Confira com `git stash` antes de culpar a sua mudança.
>
> #### Estado ao fechar a sessão
>
> **`main` = `origin/main` = produção**, árvore limpa, sem branch pendente e sem
> migration pendente. Suíte em **285 arquivos / 2672 testes**, verde com
> `npx vitest run --maxWorkers=1` (o `--maxWorkers=1` continua obrigatório
> nesta máquina). Os dois sprints têm teste que falha contra o código anterior:
> 3 de 7 casos num, 5 de 12 no outro.
>
> **Uma sujeira que eu deixei, de propósito, e que você vai encontrar:** há
> **uma** linha em `~/ava-pco/data/checkout-recusas.json` em produção, de
> 8/set 17:11 UTC, com o motivo `"Informe a data de nascimento."`. **É minha**,
> da verificação pós-deploy — não houve comprador recusado ali. O limiar do
> alarme é cinco, então ela não dispara nada; não a apaguei porque o arquivo é
> lido para a memória no boot e removê-la exigiria reiniciar produção, o que
> custa mais do que ela atrapalha. Ela sai sozinha quando as 500 posições
> girarem.
>
> #### O que a auditoria cobriu, e o que ela NÃO cobriu
>
> A passada de auditoria sobre o código de 7 e 8/set foi **parcial**, e vale
> saber onde ela parou:
>
> - ✅ **Escapes do `PUBLIC_JS`** — o script servido tem uma única sequência de
>   escape (`\D`), e ela chega certa. Aquela classe está limpa hoje.
> - ✅ **O dado pessoal da migration `0022`** — `toRow`/`fromRow` levam
>   `birthDate` e `address` nos dois sentidos, e `anonimizarConta` limpa os
>   dois. Produção tem 1 conta com os campos gravados: o caminho funciona de
>   ponta a ponta, não é só código.
> - ✅ **O alarme da venda** — virou o sprint `c642e97`.
> - ✅ **`memo-da-requisicao.ts`, `repetir-consulta.ts` e `public/cep.ts`** —
>   auditados depois, e **os três estão sãos**. O memo está ligado
>   (`publicSite.use('*')`) e suas quatro chaves são de leituras sem argumento,
>   então não há colisão; o retry está instalado no pool (`instalarRetry`) com
>   `keepAlive`; o CEP tem 13 casos, limite de 20/min e as três respostas
>   separadas.
>
>   **Duas hipóteses minhas sobre eles estavam ERRADAS**, e verifiquei antes de
>   mexer: `listCoursesResumidos` **não** perde `active`/`publicListed` (o
>   primeiro vem da coluna, o segundo do `meta`), e as leituras de gateway e
>   roteamento no checkout **não** são banco — são `JsonStore` em memória.
>
>   O que a passada rendeu não veio de ler, veio de **medir**: o custo do site
>   público é ida-e-volta ao banco (`select 1` = 196 ms), e `loadFromDb` fazia
>   quatro em fila. Ver a seção própria acima, inclusive o que a medição **não**
>   autoriza afirmar.
>
> #### Na ordem em que eu retomaria
>
> 1. **Node 20 no VPS**, fora de suporte desde abril/2026. É ação de operação
>    com risco real numa app sob PM2: merece janela e plano de volta, e por isso
>    não foi feita sozinha.
> 2. **As sete decisões do dono**, que continuam sendo dele — a lista está no
>    bloco de 6/set/2026, mais abaixo, e nenhuma mudou.
> 3. **Se for atrás de desempenho de novo**, comece pela seção "O custo do site
>    público é ida-e-volta ao banco": o caminho que sobra é reduzir idas ou
>    aproximar o banco, e otimizar SQL não move nada. Leia junto as três
>    armadilhas de medição — a primeira delas quase me fez concluir que a
>    própria melhora era uma piora.
>
> Ainda vale o que está escrito abaixo: **CI verde não é deploy feito**, e a
> terceira linha do bloco seguinte é a que não tem substituto.
>

> ### 8/set/2026 — catorze sprints, e a migration `0022` já está no banco
>
> **Árvore limpa, `main` = `origin/main`.** A suíte saiu de 273 arquivos /
> 2587 testes para **280 / 2650**. Cada sprint tem teste que falha contra o
> código anterior.
>
> #### A primeira coisa a conferir ao retomar
>
> ```bash
> gh run list --limit 5          # a CI anda?
> git fetch && git status        # a árvore está limpa?
> ssh vps 'sudo -u avapco -i bash -c "cd ~/ava-pco && git log --oneline -1"'
> ```
>
> A terceira linha é a que importa e não tem substituto: **CI verde não é
> deploy feito**. Em 8/set a CI do sprint de desempenho falhou por um mock
> desatualizado, o `deploy.yml` saiu `skipped` — não falha, não avisa — e
> produção ficou dois commits atrás sem nada dizer.
>
> #### Os catorze, em ordem de commit
>
> | commit | o quê |
> | --- | --- |
> | `349f096` | CEP preenche o endereço no checkout público — e a **máscara estava quebrada em produção** |
> | `651b38e` | faixa final laranja com textura, nascendo do pincel do rodapé |
> | `a5b78ee` | o mesmo CEP na compra do aluno logado |
> | `e9a7a15` | três trechos do `docs/deploy.md` que mandavam fazer a coisa errada no incidente |
> | `f19251b` | nove pontos que **ainda** perdiam escrita concorrente |
> | `690a93c` | worker que roda e não entrega deixou de ficar verde |
> | `5869e45` | nenhuma passagem de seção da home com corte reto; RNTP virou bloco azul |
> | `bd97dab` | números declarados saíram da faixa azul para "Sobre a PCO" |
> | `ea395ad` | **nascimento e endereço passam a ser guardados** (migration `0022`) |
> | `bc9ebc7` | a home levava 2,5s de servidor e lia a mesma coisa duas vezes |
> | `687a41b` | o auditor de carregamento no celular virou ferramenta do repositório |
> | `db40c69` | a vitrine parou de trazer a apostila para montar cartão |
> | `9de86f1` | o simulador de falha de leitura mirava a função que a vitrine deixou de chamar |
>
> Cada um tem seção própria acima, com o porquê.
>
> #### O que MUDOU no banco de produção
>
> **A migration `0022` já está aplicada** (`users.birth_date`, `users.address`),
> rodada pelo VPS antes do código subir. Não há migration pendente. O caminho
> está descrito na seção "Nascimento e endereço passaram a ser guardados" — e a
> parte que não se infere é que **o banco não é alcançável da máquina de
> desenvolvimento, mas é do servidor**: copiar `server/db/migrations` para
> `/tmp` de lá e rodar o migrator com a credencial de owner no ambiente do
> processo aplica sem que ela toque o disco.
>
> #### Quatro achados que a auditoria de 7/set não tinha pego
>
> 1. **A máscara de CEP estava quebrada em produção.** `\D` dentro do template
>    literal do `PUBLIC_JS` vira `D`: a máscara apagava a letra D e deixava
>    passar o hífen, e o oitavo dígito virava `12345--67`. A suíte ficou verde
>    a vida inteira do defeito porque **nada avaliava o `PUBLIC_JS`**.
> 2. **O livro do reengajamento perdia registro.** `recordSent` fazia
>    `[novo, ...todos].slice(0, N)` — o `unshiftComTeto` criado no sprint
>    anterior existia e não foi usado ali. Registro perdido nesse arquivo é o
>    aluno recebendo o mesmo e-mail outra vez.
> 3. **Configuração de uma linha também é leitura-seguida-de-escrita.** O
>    CLAUDE.md dizia o contrário, e a frase saiu corrigida junto com oito
>    conversões.
> 4. **A home custava 2,5s de servidor.** `numerosDoSite` trazia a árvore
>    inteira de cursos — com o conteúdo das 590 aulas — **só para contar
>    aulas**, e as três leituras rodavam em sequência.
>
> #### Retomar daqui
>
> **O desempenho do celular está medido, e o número está fechado:**
>
> | medida (Pixel 5, Slow 4G, CPU 4x) | antes | depois |
> | --- | --- | --- |
> | home — LCP | 6932 ms | **2172 ms** |
> | home — TTFB | 5599 ms | **1569 ms** |
> | home — bytes de imagem | 191 kB | **76 kB** |
> | home — tempo de servidor (no VPS) | 2,5–3,7 s | **0,86–0,95 s** |
> | curso / checkout — TTFB | 2440 / 2475 ms | **1863 / 1823 ms** |
>
> Refazer com `npx tsx scripts/auditar_carregamento_mobile.mts`. **Ele aquece
> antes de medir**, e isso não é detalhe: sem o aquecimento a PRIMEIRA página
> da lista come o processo frio e aparece com 6 s de TTFB enquanto o servidor
> responde em 0,9 s — a conclusão sairia sobre a página errada.
>
> Na ordem em que eu faria, daqui:
>
> 1. **Node 20 no VPS**, fora de suporte desde abril/2026. É ação de operação,
>    com risco real numa app gerenciada por PM2 — merece janela e plano de
>    volta, e por isso não foi feita sozinha.
> 2. **Uma passada de auditoria sobre o que foi escrito hoje.** Foi assim que a
>    passada 004 achou os cinco defeitos do expurgo escrito na mesma manhã, e é
>    assim que os quatro achados acima apareceram. Código novo não auditado é a
>    maior superfície aberta.
> 3. As sete decisões do dono, que continuam sendo dele (ver o bloco de
>    6/set/2026, mais abaixo).
>
> #### O que me bloqueou, e não é código
>
> - **Chrome não alcança o `localhost`** desta máquina, então verificação
>   visual foi feita com **Playwright headless** — que funciona e virou o
>   caminho normal: `chromium.launch()`, captura por seção, e comparação de
>   estilo computado. É mais confiável que olhar, e deixa evidência.
> - **A porta 5432 do banco continua inalcançável daqui.** O que destravou foi
>   passar pelo VPS; ver acima.
>
> #### Uma armadilha que custou tempo hoje
>
> **Crase dentro de template literal, de novo** — nos comentários que eu mesmo
> tinha acabado de escrever no CSS, dez linhas abaixo da seção do CLAUDE.md que
> avisa sobre isso. O erro aparece como `Unterminated template literal`
> centenas de linhas adiante.

> ### 7/set/2026 — dez sprints, tudo publicado, nada pela metade
>
> **Árvore limpa, `main` = `origin/main`, e produção acompanhando.** A suíte
> saiu de **263 arquivos / 2483 testes** para **273 / 2587**. Cada sprint tem
> teste que falha contra o código anterior — foi assim que se conferiu.
>
> #### O que destravou o dia
>
> **A CI estava vermelha havia onze commits e ninguém sabia.** Último verde:
> `699bac3`, de 2/set. Falhava **um** teste E2E — o menu mobile —, e como o
> `deploy.yml` dispara por `workflow_run` condicionado à CI, o deploy saía
> `skipped`: não falha, não avisa, apenas não acontece. **O deploy automático
> não rodava desde 2/set.**
>
> Ao retomar, `gh run list --workflow=CI --limit 10` diz isso em dois segundos,
> e nenhum arquivo do repositório diz. Suíte verde na máquina não prova que a
> esteira anda.
>
> #### Os dez, em ordem de commit
>
> | commit | o quê |
> | --- | --- |
> | `4bb3d25` | menu mobile virou diálogo de verdade — destravou CI e deploy |
> | `4589a17` | upload decide pelo **conteúdo**, não pelo tipo declarado |
> | `7ecc234` | LGPD: a referência externa sobrevivia à anonimização |
> | `f052acd` | 9 dos 13 workers podiam falhar todo ciclo e aparecer verdes |
> | `6243fa2` | queda de conexão custava chamado de aluno e um certificado |
> | `b1bc2d9` | a vitrine dizia "não existe" quando era "não consegui ler" |
> | `a3e6327` | painel de saúde passou a perguntar pelos workers |
> | `db765d1` | `getAll+setAll` perdia escrita concorrente em 24 lugares |
> | `fd888a0` | hero e duas seções da home + Sobre/Contato para o rodapé |
> | `9fa0615` `4601ddb` | checkout com nascimento e endereço + erros em português |
>
> Cada um tem seção própria acima, com o porquê. **O fio que une quase todos é
> o mesmo de sempre neste projeto: a rotina rodava, contava e reportava
> sucesso.**
>
> #### Dois achados que a auditoria não tinha pego
>
> 1. **O provider do Asaas nunca enviava o CPF nem o telefone.** O checkout
>    coletava, conferia o dígito verificador, passava adiante — e o
>    `createPayment` montava o cadastro do cliente com nome e e-mail, só. O
>    campo existia em `CreatePaymentInput` desde 31/ago e ninguém o lia, com o
>    roteamento de produção mandando **boleto** justamente para o Asaas.
> 2. **Dois workers afirmavam saúde antes de medir**, e são os que existem para
>    avisar que dinheiro parou de entrar: a Sandra nascia `saudavel: true` com o
>    comentário dizendo *"a varredura completou alguma vez desde o boot?"*; o
>    alarme de checkout calculava `ultimoErro === null`, que é `true` antes da
>    primeira avaliação.
>
> #### Retomar daqui
>
> A frente aberta é o **preenchimento automático por CEP**, e o desenho já está
> decidido: rota nossa (`GET /public/cep/:cep`), não `fetch` do navegador — a
> CSP bloqueia terceiro, e assim o IP do visitante não vai para o ViaCEP.
> Cache em memória, limite por IP, e falha em silêncio: se não responder, a
> pessoa digita. **Nada disso foi começado**, então não há nada a limpar.
>
> Depois dela, na ordem em que eu faria:
>
> 1. **Persistir endereço e nascimento** — bloqueado, ver abaixo.
> 2. **Node 20 no VPS**, fora de suporte desde abril/2026.
> 3. As sete decisões da auditoria, que continuam sendo do dono.
>
> #### O que ME bloqueia, e não é código
>
> - **Migration não roda desta máquina.** A porta 5432 do DivZ dá timeout daqui
>   (DNS resolve, TCP não conecta), então `db:migrate` e
>   `scripts/confere_banco_antes_do_deploy.ts` morrem. Sem coluna nova, o
>   endereço do checkout **não é persistido** — vive só no cadastro do gateway.
>   Persistir traz junto o prefill e a entrada nas duas pontas da LGPD.
> - **`~/.ssh/pco_deploy` não existe aqui.** `ssh vps` entra como **root**, e
>   por isso todo comando da app precisa de `sudo -u avapco -i`. A chave
>   `pco_avapco` foi gerada nesta máquina e **ainda não foi instalada** no
>   servidor; a pública está em `~/.ssh/pco_avapco.pub`.
> - **Chrome não alcança o `localhost`** desta máquina (permissão de site da
>   extensão), então verificação visual foi feita por HTML servido + conta de
>   CSS, não por captura de tela.
>
> #### Duas armadilhas que custaram tempo hoje
>
> - **Crase dentro de template literal quebra o arquivo inteiro** — seção
>   própria acima. Quatro interrupções.
> - **`tail` de log de produção não é o presente.** O `ava-pco-error.log` não
>   recebe uma linha desde 4/set 21:53, e eu afirmei num commit que as falhas
>   "continuam acontecendo agora". Confira `stat -c %y` antes de citar log
>   como evidência.

> ### 6/set/2026, madrugada — a auditoria 004 foi ao fim, e tudo está no ar
>
> **`main`, `origin/main` e produção no mesmo commit.** Banco com as migrations
> `0020` (parcelamento) e `0021` (transcrição de podcast) aplicadas — sempre
> **antes** do código, e há um script que confere isso:
> `npx tsx scripts/confere_banco_antes_do_deploy.ts`.
>
> A passada 004 rodou sobre `26cb33c`, o primeiro HEAD desta série **em
> produção**. Os relatórios estão em `C:/ia/dev/auditoria-ava-pco/relatorios/`,
> com uma seção "Passada 004" cada; `correcoes-aplicadas.md` tem a tabela do que
> foi consertado, em três rodadas.
>
> **O fio que une quase todos os achados:** a rotina rodava, contava e reportava
> sucesso. Nenhum deles dava erro.
>
> #### O que foi corrigido, em ordem de dano
>
> 1. **O gateway reserva podia cobrar duas vezes** (SEC4-001). Cinco providers
>    tratavam todo não-2xx como "não criou cobrança"; um 502 depois de o
>    adquirente gravar o pedido faria o reserva criar a segunda.
> 2. **O restaurador de banco podia piorar o dia do desastre** (SEC4-002).
>    Apagava tudo antes de inserir, sem transação, sem trava de ambiente.
> 3. **A venda podia parar sem ninguém notar** (PROD4-001). Décimo terceiro
>    worker: alarme por taxa de falha de checkout.
> 4. **O expurgo da LGPD deixava o CPF, a senha e o 2FA** (PRIV4-001 a 005), o
>    fórum ficava fora das duas pontas, e store fora do ar era impresso como
>    "nada a apagar" no ensaio que o operador lê antes de autorizar.
> 5. **O drip trancava o botão de concluir, não a aula** (LEARN4-001).
> 6. **O quiz não deixava registro nenhum** — achado indo atrás do item da
>    auditoria que estava como "não verificado". A escola não conseguia
>    responder se alguém foi avaliado, e **é a razão técnica de o certificado
>    ser contagem de cliques**.
> 7. **O player de podcast sem seek, sem volume e sem transcrição**
>    (A11Y4-001/002/004).
> 8. **`/admin/roles` mostrava um controle que não existe** (SEC3-706 medido):
>    `permissions` e `tier` são gravados e nenhuma rota os lê.
> 9. **`isLoading` sem `isError` — encerrado.** Não resta **nenhum** arquivo em
>    `src/` com `isLoading` e sem tratamento de erro ou de `paused`.
>
> #### E um achado que só apareceu olhando a configuração real
>
> O **Pagar.me estava como reserva das três rotas de pagamento**. Pela regra do
> mínimo isso derrubava a promessa do boleto de 6x para 1x, e a linha do site
> dizia só *"12x no cartão"*. Pior: aquele reserva **não cobra nada** hoje.
> Removido; a linha voltou a ser "12x no cartão ou 6x de R$ 199,77 no boleto".
> A configuração vive em `data/payment-routing.json` no servidor, com backup
> `.bak-<data>` ao lado.
>
> ### O que segue aberto — e as sete primeiras são AÇÃO SUA, não código
>
> 1. **Revogar a Application Password do WordPress.** Oitava sessão
>    registrando. Tirar do código não desfaz o histórico do git.
> 2. **Habilitar o produto Checkout no painel do Pagar.me.** Enquanto não for,
>    ele não pode voltar à rota. Quando for, ligá-lo como **reserva do cartão**
>    é ganho sem custo; como reserva do **boleto**, derruba a promessa de 6x
>    para 1x de novo.
> 3. **Configurar lifecycle no bucket S3.** Snapshot sem expiração guarda o
>    titular indefinidamente depois de a escola dizer que apagou os dados dele.
> 4. **Decidir `CARNE_ATRASO_SUSPENDE`.** O acesso é liberado integral na
>    parcela 1 de 6 e nada o reverte. É política comercial.
> 5. **Decidir `orders.userEmail` no expurgo.** Ou é dado fiscal — e então é
>    retido *declarado como tal* — ou vai para a marca anônima. Hoje o relatório
>    já **declara** que o pedido guarda o e-mail e o mesmo id de conta, o que
>    tornou o problema visível; a dissociação continua parcial.
> 6. **Decidir se o certificado passa a depender de avaliação.** Agora existe
>    dado sobre o que decidir — antes não existia. Mudar a regra afeta quem já
>    se formou: precisa de política para o retroativo.
> 7. **Decidir se `/admin/*` terá autorização por permissão.** Hoje há um
>    catálogo de papéis que não restringe nada, com aviso na tela dizendo isso.
>    Implementar significa declarar uma permissão em **cada** rota
>    administrativa, com risco de trancar o operador para fora.
>
> **O que sobrou de código, e é pouco:**
>
> - ~~**A contradição do carnê**~~ — **resolvida em 7/set/2026.** O comentário do
>   `asaas.ts` afirmava, no presente, que as parcelas 2..N "não encontram pedido
>   nenhum" e que "o que falta não é código" — descrição de um estado anterior à
>   migration `0020`, que criou `gatewayInstallmentId`, e à segunda busca do
>   webhook (`findByInstallment`). Ele mandava a próxima pessoa não procurar o
>   que já existe. Reescrito para dizer como o elo funciona e separar o que
>   continua aberto, que é só a política `CARNE_ATRASO_SUSPENDE`.
> - ~~**`SEC4-003`**~~ — **fechado em 7/set/2026.** A extensão passou a vir do
>   conteúdo; o tipo declarado não decide mais nada. E a avaliação de "risco
>   baixo" estava incompleta: o caso não era o admin subindo documento, era a
>   rota de imagem, que é `requireAuth()` e alcança os ~1.600 alunos. Ver a
>   seção do upload.
> - ~~Os "não verificado" da passada 004 sobre transcrição de sessão e
>   `external-references.json`~~ — **fechados em 7/set/2026**, um com rotina e o
>   outro com declaração. Ver a seção do expurgo. Restam as snapshots em S3
>   — esta última é o item 3 acima.
>
> ### Como retomar
>
> 1. `git fetch && git status` — a regra de sempre depois de trocar de máquina.
> 2. `npx tsx scripts/confere_banco_antes_do_deploy.ts` diz se o banco está
>    pronto para o código.
> 3. A suíte roda com `npx vitest run --maxWorkers=1`. **Sem o `--maxWorkers=1`
>    ela morre por memória no meio**, e o sintoma engana.
> 4. O deploy é `bash scripts/deploy_producao.sh` — confere o host, faz backup
>    do `data/` e compara o hash do bundle.
> 5. O índice da auditoria, com o que cada trilha achou e o que não verificou,
>    está em `C:/ia/dev/auditoria-ava-pco/RETOMAR-AQUI.md`, no bloco do topo.


> ### 5/set/2026, noite — a auditoria auditou o que subiu de manhã
>
> A passada 004 rodou sobre `26cb33c` — o primeiro HEAD desta série que está
> **em produção, com aluno dentro e dinheiro passando**. Os relatórios estão em
> `C:/ia/dev/auditoria-ava-pco/relatorios/`, com uma seção "Passada 004" cada.
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
>    ele não pode voltar à rota — e, até 6/set/2026, **estava lá como reserva
>    das três**, derrubando a promessa do boleto de 6x para 1x sem cobrar nada
>    em troca. A linha do site dizia só "12x no cartão". Removido; ver a seção
>    do roteamento. Quando for, ligá-lo como **reserva do cartão**
>    é ganho sem custo (os dois declaram 12x); como reserva do **boleto**,
>    derrubaria a promessa de 6x para 1x — o Asaas é o único provider
>    implementado que parcela boleto, e isso torna o gateway único do boleto um
>    problema estrutural, não uma configuração pendente.
> 6. **O resto dos `isLoading` sem `isError`** — trabalho mecânico em `/admin`.
> 7. **O certificado ainda sai de contagem de cliques** — nenhuma nota, nenhum
>    tempo assistido, nenhum quiz participa. Segue decisão de produto, mas
>    deixou de ser a única opção possível: **as tentativas de quiz passaram a
>    ser registradas** (6/set/2026), e antes disso não havia dado nenhum sobre
>    o qual apoiar outra regra. Ver a seção do quiz.
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
> Relatórios: `C:/ia/dev/auditoria-ava-pco/relatorios/` — a passada do aluno
> está em `aluno-passada-004.md`.

> ### 4/set/2026 — dois consertos, uma auditoria, e nada publicado
>
> **Comece por `C:/ia/dev/auditoria-ava-pco/RETOMAR-AQUI.md`, pelo bloco do
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
> **Comece por `C:/ia/dev/auditoria-ava-pco/RETOMAR-AQUI.md`**, que fica
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
de qualquer edição. O procedimento completo — o que vem por `git clone` e o que
precisa ser copiado à mão, incluindo a pasta de memória do Claude Code, que é
indexada **pelo caminho** e some em silêncio ao mudar de letra de disco — está em
`docs/setup-maquina-nova.md`. A cópia em `C:\ia\dev\pco` ainda existe, aponta para o mesmo
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

**Reserva errado custa promessa, e isso aconteceu.** Em 5/set/2026 as três rotas
de produção foram criadas com o Pagar.me como reserva. Efeito medido no site:
`ou 12x de R$ 99,88 no cartão` — e **nada sobre boleto**. A regra do mínimo
estava fazendo o seu trabalho: o Asaas faz 6x no boleto, o Pagar.me faz 1x, e
`min(6, 1) = 1`. A escola anuncia 6x no boleto e o site não oferecia.

Pior: aquele reserva **não cobra nada** hoje — é a mesma conta sem o produto
Checkout habilitado que derrubou a venda por dois dias. Ele custava a promessa
do boleto e não comprava seguro nenhum em troca.

O reserva foi removido das três rotas (6/set/2026), e a linha voltou a ser
`ou 12x de R$ 99,88 no cartão ou 6x de R$ 199,77 no boleto`. **Quando o Checkout
do Pagar.me for habilitado, ele volta como reserva do cartão — nunca do
boleto**, enquanto for o único provider implementado que parcela boleto.

A configuração fica em `data/payment-routing.json` no servidor, e a versão
anterior está ao lado como `.bak-<data>`.

**Antes de pôr qualquer gateway como reserva, olhe o `parcelasMaximas` dele.**
O prejuízo não aparece como erro: aparece como uma linha a menos na vitrine.

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
`architecture.md`, `security.md`, `payments.md`, `imports.md`, `webhooks.md`, `webhooks-cookbook.md`, `email.md`, `engagement.md`, `live-sessions.md`, `analytics.md`, `admin-ops.md`, `admin-user-guide.md`, `api-public.md`, `deploy.md`, `production-checklist.md`, `migration-wp-ld.md`, `prazo-de-acesso.md`, `sessoes.md`, `setup-maquina-nova.md`.

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
em lugar nenhum. **Está encerrado desde 6/set/2026**: não resta um único
arquivo em `src/` com `isLoading` e sem tratamento de `isError` ou de
`fetchStatus === 'paused'`. Confira com

```bash
cd src && for f in $(grep -rl "isLoading" --include=*.tsx app); do   grep -q "isError\|fetchStatus" "$f" || echo "$f"; done
```

Três formas apareceram na varredura, e a terceira é a que se esquece:

1. **Guarda no topo** (`if (X.isLoading) return <Skeleton/>`) — vira a cadeia
   `paused` → `isError` → `isPending`, nessa ordem.
2. **Expressão no JSX** (`{X.isLoading ? … : …}`) — mesma cadeia, aninhada.
3. **Contador em texto** (`{X.isLoading ? 'Carregando…' : `${n} itens`}`) —
   sem rede isso imprimia **"0 evento(s)"** sobre um feed cheio. É a mesma
   mentira das telas de métrica, num lugar em que ninguém procura por ela.

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

## O quiz corrigia a prova e não guardava nada

`server/repositories/quiz-attempts.ts` (6/set/2026). Até então,
`POST /me/quiz/:courseId/grade` calculava a nota, devolvia `passed` e a conversa
acabava ali. **Nenhuma tentativa era registrada** — para nenhum aluno, em nenhum
curso, desde sempre.

O que isso significava, e nada disso aparecia como erro:

- **A escola não conseguia responder se alguém foi avaliado.** Num LMS.
- O aluno que fechasse a aba perdia a nota. E o botão "Refazer com novas
  questões", que sempre existiu, piorava: cada refação apagava na prática a
  anterior.
- **É a razão técnica de o certificado ser contagem de cliques.** Ninguém podia
  apoiá-lo em desempenho nem querendo — não havia dado. Isso continua sendo
  decisão de produto, mas agora existe sobre o que decidir, e a decisão não
  precisa inventar histórico retroativo.
- O `/me/export` da LGPD não entregava avaliação nenhuma, corretamente: não
  havia o que entregar.

Quatro coisas que qualquer mexida aqui tem de respeitar:

- **O texto da resposta dissertativa NÃO é guardado.** Fica o resultado por
  questão — acertou, não acertou, ou ficou pendente de correção. O registro
  existe para provar que houve avaliação e com que desempenho; arquivar a
  redação aumenta a superfície de dado pessoal sem servir a isso. Passar a
  guardá-la é decisão nova, com retenção declarada.
- **Toda tentativa fica**, inclusive a reprovada e a repetida. Guardar só a
  melhor apagaria o histórico de esforço, que é o que mostra quem está travado.
  `melhorDe()` calcula na hora de exibir.
- **A nota de corte gravada é a da época.** O admin pode mudá-la depois, e
  recalcular a aprovação com a regra nova reescreveria uma prova já feita.
- **Falhar ao gravar não derruba a correção.** O aluno já respondeu; perder a
  nota dele por causa do registro seria trocar um problema por um pior. Vai
  para o log e a rota responde.

`correct: null` sobrevive no registro: é "não deu para corrigir" (IA
indisponível), que é diferente de errou — ela não entrou no denominador da nota,
e achatar em `false` diria ao aluno que ele não sabe por causa de uma
configuração que falta do lado da escola.

Duas rotas de leitura: `GET /me/quiz/:courseId/attempts` (o aluno reencontra a
própria nota) e `GET /admin/courses/:id/quiz-attempts` (a coordenação vê quem
foi avaliado e como). A tela do quiz mostra o histórico **abaixo** do resultado
e só a partir da segunda tentativa — uma lista de uma linha repetindo o que está
logo acima é ruído.

## `/admin/roles` mostra um controle que não existe

As permissões marcadas ali são gravadas, listadas de volta e desenhadas na
tela — e **nenhuma rota do servidor as consulta**. Quem decide o acesso é o
campo `role` da conta (`student` / `admin` / `superadmin`), lido do token por
`requireAuth`. Conta marcada como admin alcança todo `/admin/*`, qualquer que
seja o papel atribuído a ela.

O `tier` do papel também é gravado e nunca lido — e nem chega a ser gravável:
nem `POST` nem `PUT /admin/roles` repassam o campo do corpo, então todo papel
custom nasce e permanece `student`. **A ausência de escalonamento é real, e é
acidental** — o que impede são duas linhas que não foram escritas.

Isso ganhou um aviso na tela, e não uma implementação, porque autorização por
permissão significa declarar uma permissão em cada rota de administração:
decisão de produto, com risco real de trancar o operador para fora enquanto se
acerta o mapa. O que não podia continuar é a tela **implicar** um controle que
não existe — quem marca três caixinhas e sai achando que limitou o acesso de
alguém tomou uma decisão de segurança com base em informação falsa.

`test/papeis-nao-prometem-o-que-nao-cumprem.test.ts` trava as duas metades: que
nenhuma rota lê `permissions`, e que o aviso está lá. No dia em que a
autorização por permissão existir, o teste falha — que é quando o aviso sai.

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
