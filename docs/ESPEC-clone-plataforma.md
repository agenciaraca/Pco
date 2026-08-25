# Especificação funcional e arquitetural — Plataforma LMS + Commerce

> **Para quem é este documento:** uma IA/dev que vai construir uma plataforma nova
> a partir desta especificação. O documento descreve **estruturas, recursos e
> decisões de arquitetura** de um LMS full-stack em produção.
>
> **O que NÃO está aqui (de propósito):** paleta de cores, design system, textos de
> marca, copy, identidade visual, nicho. Tudo isso será criado do zero no projeto
> de destino. Trate este arquivo como **planta baixa**, não como estilo.

---

## 1. Visão geral

Plataforma única que junta três produtos normalmente separados:

| Plano | Quem acessa | Como é servido |
|---|---|---|
| **Site público** | visitante anônimo | SSR no servidor (HTML gerado no backend), otimizado para SEO/GEO |
| **Área do aluno (LMS)** | aluno autenticado | SPA React |
| **Painel administrativo** | admin/superadmin | SPA React (mesmo bundle, rotas protegidas) |

Tudo roda em **um único processo Node** e **um único repositório**. Não há
microserviços, não há CMS externo, não há segundo build.

Escala de referência do projeto original: ~2.000 alunos, ~16 cursos,
~9.400 linhas no arquivo de rotas do backend, 165 arquivos de teste,
~330 endpoints REST.

---

## 2. Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Linguagem | TypeScript estrito (`tsc -b`) | client + server + shared |
| Frontend | React 18 + Vite 5 | SPA, React Router 6 |
| Estado servidor | TanStack Query 5 | nenhum Redux/Zustand |
| Formulários | React Hook Form + Zod resolver | |
| Estilo | Tailwind CSS 3 + PostCSS | **sem** biblioteca de componentes — utility classes |
| Gráficos | Recharts | |
| Ícones | Lucide React | |
| Drag & drop | dnd-kit | reordenação de módulos/aulas |
| Backend | Hono 4 (`@hono/node-server`) | um app, `basePath('/api')` |
| Validação | Zod 4 | schemas compartilhados client↔server |
| ORM | Drizzle ORM + drizzle-kit | Postgres |
| Banco | PostgreSQL (driver `pg`) | **opcional** — ver §4 |
| Auth | JWT HS256 próprio + bcryptjs | sem Auth0/Clerk/NextAuth |
| Testes | Vitest (jsdom) + Testing Library + MSW | testes em `test/`, não colocados |
| E2E | Playwright (chromium) | suite smoke |
| Vídeo ao vivo | Zoom Meeting SDK | opcional |
| Lint/format | ESLint 9 flat config + Prettier | |

**Deliberadamente ausente:** Next.js, biblioteca de UI, gerador de PDF, cron
externo, fila de mensagens, Redis, S3 obrigatório, serviço de auth terceirizado.

---

## 3. Estrutura de pastas

```
/
├── src/app/                 # SPA React
│   ├── routes.tsx           # todas as rotas, lazy-loaded
│   ├── layouts/             # StudentLayout, AdminLayout, LearningLayout
│   ├── auth/                # AuthContext, ProtectedRoute
│   ├── data/
│   │   ├── client.ts        # wrapper fetch único (request<T> + ApiError)
│   │   ├── api.ts           # namespace de chamadas tipadas
│   │   └── hooks.ts         # hooks TanStack Query
│   ├── pages/               # páginas do aluno + público
│   └── pages/admin/         # páginas do admin
├── server/
│   ├── app.ts               # MONÓLITO: buildApp() com todas as rotas inline
│   ├── dev.ts               # entrypoint Node (API-only ou API+estático)
│   ├── auth/                # jwt.ts, middleware.ts, api-tokens.ts, oauth, saml
│   ├── db/                  # client.ts, schema.ts, json-store.ts, encryption.ts,
│   │                        # migrations/, seed, backup-worker
│   ├── repositories/        # um arquivo por entidade
│   ├── public/              # site público SSR (ver §9)
│   ├── ai/providers/        # abstração multi-provider de IA
│   ├── payments/providers/  # abstração multi-gateway
│   ├── notifications/       # e-mail: providers/, templates, sender, digests
│   ├── messaging/           # WhatsApp/SMS: providers/
│   ├── webhooks/            # outbound: endpoints, dispatcher, signer, formatters
│   ├── imports/             # ETL: connectors/, pipeline/, schemas/, runner
│   ├── transcription/       # providers/ (Whisper, Deepgram)
│   ├── live-sessions/       # sessões ao vivo + config Zoom
│   ├── achievements/        # engine + store de gamificação
│   ├── forum/ reviews/ mentoring/ experiments/ search/
│   ├── observability/ errors/ audit/ activity/ monitoring/ health/
│   └── services/            # workers: retenção, rotação de log
├── shared/schemas.ts        # ÚNICA fonte de verdade dos schemas Zod
├── api/[[...route]].ts      # adaptador serverless (opcional)
├── data/*.json              # persistência de fallback (ver §4)
├── test/                    # Vitest
├── e2e/                     # Playwright
├── docs/                    # documentação por subsistema
└── scripts/                 # migração, deploy, manutenção
```

**Convenção importante:** o backend é um **monólito de rotas** — todos os handlers
ficam inline em `server/app.ts`, agrupados por domínio (auth → admin CRUD → aluno
→ API pública). Não existe `server/routes/`. Isso é intencional: reduz indireção
e facilita busca. Se o projeto novo preferir dividir, mantenha os **grupos**.

---

## 4. Persistência: dois backends, uma superfície

Padrão central e replicável. Cada entidade tem um repositório em
`server/repositories/*.ts` que checa `hasDb()`:

- **Com `DATABASE_URL`** → lê/escreve Postgres via Drizzle.
- **Sem `DATABASE_URL`** → cai para `JsonStore<T>`, que persiste em `data/*.json`
  com fila de lock de escrita interna.

```ts
const store = new JsonStore<MyType>('arquivo.json', () => seedDefault);
await store.getAll(); await store.findOne(pred); await store.filter(pred);
await store.unshift(item); await store.update(pred, mutator);
await store.modify(arrMutator); await store.setAll(arr);
```

**Por que isso vale a pena copiar:** desenvolvimento local roda com **zero
configuração** (sem Docker, sem banco), testes ficam rápidos e determinísticos, e
a migração para Postgres pode ser feita entidade por entidade sem parar o produto.

Regra ao migrar uma entidade para o banco: consulta o DB primeiro, cai para o
seed se a tabela estiver vazia, e **não apaga o caminho JSON**.

### Entidades principais (schema Drizzle)

`users`, `students`, `courses`, `modules`, `lessons`, `assessments`,
`enrollments`, `news_articles`, `podcasts`, `library_items`, `certificates`,
`support_tickets`, `retention_risks`, `professionals`, `session_services`,
`ai_configurations`, `ai_usage_logs`.

Convenções do schema:
- PKs em `text` (slug-like ou nanoid) — legíveis em URL e log.
- Datas em `timestamptz` com `defaultNow()`.
- Sem soft delete; quando necessário, coluna `archived_at`.
- `jsonb` para campos polimórficos (tags, escopos, listas de IDs relacionados).
- Enums Postgres para: role, status do aluno, status da aula, categoria/status de
  ticket, módulo de IA, provider de IA.

### Entidades ainda em JSON (no projeto original)

Pedidos, produtos, cupons, gateways, webhooks (endpoints + entregas), jobs de
import, conexões de import, logs de e-mail, configs de e-mail, notificações,
preferências de notificação, progresso de aula, auditoria, erros, reviews de
curso, banco de questões, referências externas, configuração de login,
configurações globais.

> Num projeto novo, **modele tudo em Postgres desde o início** e use o JsonStore
> apenas como fallback de dev. A lista acima é dívida histórica, não recomendação.

---

## 5. Autenticação, autorização e sessão

### JWT próprio

Payload: `{ sub, email, role, tv, iat, exp }` — HS256, 7 dias por padrão.

O campo **`tv` (tokenVersion)** é o truque central: ele espelha o `tokenVersion`
do usuário no banco. Trocar senha, "sair de todos os dispositivos" ou uma rotação
forçada pelo admin **incrementa** o `tv`, e o middleware invalida instantaneamente
todos os tokens em circulação — sem tabela de sessões, sem Redis, sem blocklist.

### 2FA (TOTP)

Login com 2FA emite um **ticket intermediário** — um JWT com `totp: 'pending'` e
exp de 10 minutos, que só serve para chamar `/auth/login/totp`. Segredo TOTP
guardado criptografado. Códigos de backup regeneráveis.

### SSO

OAuth Google e Microsoft (fluxo de redirect com callback no backend) e SAML 2.0
(`/auth/saml/login` + `/auth/saml/acs`, assinatura validada com `xml-crypto`).
Todos opcionais e configuráveis pelo admin.

### Papéis

`student` | `admin` | `superadmin`, com sistema de **permissões granulares** por
papel (`/admin/papeis`, endpoint `GET /admin/permissions`).

### Impersonação

Admin pode assumir a sessão de um aluno para suporte
(`/me/impersonation`, `POST /admin/impersonate/exit`) — auditado.

### API pública com tokens

Mecanismo paralelo ao JWT: tokens `pcok_*`, armazenados como hash SHA-256, com
**escopos read-only**. Middleware `requireApiToken(scope?)`. Ver §12.

### Middlewares de borda

`secureHeaders` (CSP, HSTS, no-sniff, frame-options), CORS por env
`ALLOWED_ORIGINS`, `rateLimit()` em rotas sensíveis (com painel admin de
rate-limits), `auditMiddleware` em mutações sensíveis.

---

## 6. Contrato de validação (padrão a replicar)

`shared/schemas.ts` é a **única fonte de verdade** dos schemas Zod, importada por
cliente e servidor.

- Nomenclatura: `createXSchema` para POST, `updateXSchema = createXSchema.partial()`.
- Servidor sempre valida com `validate(schema, body)` e devolve
  `jsonError(c, 400, 'VALIDATION', …)`.
- Frontend infere tipos com `z.infer<typeof xSchema>`.

**Armadilha conhecida (Zod 4 + React Hook Form):** Zod 4 é mais estrito
(ex.: `z.string().email()` rejeita endereço sem TLD). Sempre passe `onInvalid` no
`handleSubmit` e mostre os erros num toast/banner agregado — senão o formulário
**silenciosamente não faz nada** ao submeter.

---

## 7. Área do aluno — recursos

### 7.1 Consumo de curso (o núcleo do LMS)

Hierarquia: **Curso → Módulo → Aula → Avaliação**.

Rotas do "modo aprendizagem" (layout próprio, sem distrações):
`/curso/:courseId`, `/curso/:courseId/modulo/:moduleId`,
`/curso/:courseId/aula/:lessonId`, `/curso/:courseId/avaliacao/:assessmentId`,
`/curso/:courseId/quiz`, `/curso/:courseId/forum`.

Recursos por aula:
- Vídeo (URL externa) + **conteúdo rich-text HTML** (até 200k chars) com áudios
  embutidos e materiais.
- **Transcrições multi-idioma** (pt/es/en, 100k chars cada), com download em
  formatos alternativos (`/lessons/:id/transcript.:format`).
- **Anotações do aluno** por aula, com página agregadora `/anotacoes` e
  **exportação em Markdown** (`/me/notes/export.md`).
- **Comentários** por aula (com moderação no admin).
- **Marcar como concluída** (e desfazer).
- **Watch-time tracking** — tempo real assistido, agregado em estatísticas por
  aula e por curso no admin.
- Flag `isPreview`: aula liberada para visitante não matriculado (isca de marketing).

Estados de aula: `locked | available | in_progress | completed | pending_assessment`.

### 7.2 Liberação de conteúdo (drip) e pré-requisitos

- **Drip absoluto**: módulo com `releaseAt` (data fixa).
- **Drip relativo**: `releaseAfterEnrollmentDays` — N dias após a matrícula do
  aluno naquele curso (1–365).
- Se os dois estiverem definidos, **vence o lock mais tardio**.
- **Pré-requisitos entre cursos**: `prerequisiteCourseIds` — o aluno só se
  matricula depois de concluir os cursos exigidos (`GET /me/courses/:id/prereq`).

### 7.3 Avaliações e banco de questões

- Avaliação por módulo com `questionCount`, `passingScore`, `timeLimitMinutes`.
- **Banco de questões por curso**, gerenciado no admin, com geração assistida por IA.
- Quiz: `GET /me/quiz/:courseId/start` → `POST /me/quiz/:courseId/grade`.

### 7.4 Certificados

- Emissão automática ao concluir (status `in_progress | available | issued`).
- **Código de validação público** — página aberta `/verificar/:code` e endpoint
  `GET /certificates/validate/:code`; toda validação é registrada.
- **Template customizável por curso**: título, preâmbulo, corpo, cores de destaque
  e fita, nome da organização, assinatura (nome + cargo), logo.
- **Renderização em HTML** (`/certificates/:id/render`) com regras `@media print`;
  o aluno usa `window.print()`. **Nenhuma dependência de geração de PDF.**

### 7.5 Gamificação (passiva, sem interação social)

- **Badges/conquistas** concedidos por um engine idempotente que reavalia o estado
  do aluno após eventos (primeira aula, primeiro curso, três cursos, etc.).
- **Streak** de dias de estudo (`/me/streak`).
- **Heatmap de estudo** (`/me/study-heatmap`).
- **Leaderboard** (`/leaderboard/top`, `/me/leaderboard`) com exportação CSV no admin.
- **Meta semanal de minutos** editável pelo aluno (`PUT /me/weekly-goal`).

### 7.6 Conteúdo de apoio

- **Biblioteca**: PDFs, apostilas, leituras, artigos — com flag de obrigatoriedade,
  tags e vínculo a cursos/módulos.
- **Notícias/Blog** (`/news`) com categorias, tags, destaque e cursos relacionados.
- **Podcasts** (`/podcasts`, `/podcasts/:id`) com tracking de engajamento
  (`PUT /podcasts/:id/engagement`).
- **Trilhas de estudo** (`/study-paths`, `/study-paths/:slug`) com progresso próprio.
- **Busca unificada** do aluno (`GET /search`) e busca do admin com
  **buscas salvas** (`/admin/saved-searches`).

### 7.7 Tutor de IA

Chat com IA restrito ao contexto pedagógico:
- `POST /ai/tutor` com escopos permitidos e tópicos bloqueados definidos no admin.
- Histórico por aluno (`/tutor/history`, apagável pelo aluno).
- **Cotas**: por aluno, por dia, por mês, e **teto de custo mensal em USD**.
- `GET /me/tutor/usage` mostra o consumo do aluno.
- Admin vê todo o histórico (`/admin/tutor-chat`) e estatísticas de uso.

### 7.8 Fórum por curso

Threads e respostas por curso, com likes, marcação de resolvido e moderação.
(No projeto original este módulo existe mas o produto optou por **não ter
interação entre alunos** — avalie no destino se ativa ou remove.)

### 7.9 Sessões ao vivo, eventos e mentorias

- **Eventos/sessões ao vivo** (`/eventos`, `/eventos/:id`) com integração
  **Zoom Meeting SDK** (assinatura gerada no backend em `POST /zoom/signature`).
- **Transcrição da sessão** (`/eventos/:id/transcript`) via provider de
  transcrição (Whisper ou Deepgram), com vocabulário customizado.
- **Mentorias** por curso (`/me/mentoring/:courseId`).
- **Análise e supervisão**: agendamento de sessões 1:1 com profissionais
  cadastrados (serviços com duração, preço, tipo `analise|supervisao|orientacao`
  e regra de pagamento antes da confirmação).

### 7.10 Comercial (aluno)

- **Catálogo** público, **comparador de cursos**, **pacotes/bundles**.
- **Wishlist** (`/me/wishlist`) com agregação e exportação no admin — vira sinal
  de demanda para o time de produto.
- **Pedidos** (`/me/orders`), **cancelamento** e **fatura em HTML imprimível**
  (`/me/orders/:id/invoice`).
- **Cupons** com desconto percentual ou fixo (`GET /coupons/check`).
- **Avaliações de curso** (nota + review), com média pública por curso.

### 7.11 Conta e LGPD

- Perfil, troca de senha, 2FA, logout de todos os dispositivos.
- **Preferências de notificação** por categoria, com **snooze**.
- **Exportação dos próprios dados** (`GET /me/export`).
- **Solicitação de exclusão de conta** (`POST /me/request-deletion`), com fila de
  aprovação no admin (`/admin/lgpd-exclusoes`) e cancelamento pelo aluno.
- Link de **descadastro de e-mail** sem login (`GET /unsubscribe`).
- Páginas de Termos e Privacidade.

### 7.12 Onboarding

Fluxo de primeiro acesso do aluno (`/onboarding`) e wizard de primeira
configuração do sistema para o admin (`/admin/setup`, `/admin/onboarding`).

---

## 8. Painel administrativo — mapa de telas

O admin é a maior superfície do produto (~80 telas). Agrupamento sugerido:

**Conteúdo**
`cursos` · `cursos/:id` (editor) · `cursos/:id/preview` · `modulos` · `aulas` ·
`transcricoes` · `cursos/:id/questoes` · `biblioteca` · `news` · `podcasts` ·
`trilhas` · `conquistas` · `moderacao` (comentários/fórum) · `certificados` ·
`sobre`

**Alunos e retenção**
`alunos` · `alunos/:id` · `cursos/:id/alunos` · `evasao` · `retencao` ·
`plano-retomada-ia` · `reengajamento` · `reengajamento-auto` · `leaderboard` ·
`wishlist` · `atividade`

**Analytics**
`dashboard` (KPIs) · `metricas` · `cursos/:id/analytics` · `vendas` ·
`experiments` (A/B testing) · `alertas`

**Comercial**
`produtos` · `pedidos` · `cupons` · `gateways` · `vendas`

**Comunicação**
`email` (providers/configs) · `email/templates` · `email/weekly-report` ·
`broadcasts` · `mensageria` (WhatsApp/SMS) · `notificacoes` · `digest` ·
`webhooks` · `suporte`

**IA**
`ias` (configuração por módulo) · `tutor` · `tutor-chat`

**Sessões**
`sessoes-ao-vivo` · `mentorias` · `analise-supervisao` · `zoom`

**Usuários e acesso**
`usuarios` · `usuarios/:id` · `usuarios/import` · `papeis` (permissões) ·
`api-tokens` · `sessoes` · `login-modelos` · `login-customizacao`

**Importação de dados**
`imports` · `imports/wizard` (CSV) · `imports/wizard-api` · `imports/schedules` ·
`imports/history` · `imports/jobs/:id`

**Operação e conformidade**
`configuracoes` · `saude` · `jobs` (workers) · `logs` · `erros` · `auditoria` ·
`rate-limits` · `backups` · `backup` · `lgpd-exclusoes` · `setup` · `onboarding`

### Recursos transversais do admin

- **Exportação CSV** em praticamente toda listagem (alunos, cursos, pedidos,
  cupons, wishlist, leaderboard, auditoria, logs de mensageria).
- **Editor de curso com drag & drop** para reordenar módulos e aulas, inclusive
  **movendo aula entre módulos** (endpoint de reorder em massa).
- **Preview de curso** com o olhar do aluno.
- **Timeline por usuário** (`/admin/users/:id/timeline`).
- **Busca global do admin** com filtros salvos.

---

## 9. Site público SSR (SEO / GEO / E-E-A-T)

Este é um dos diferenciais estruturais. O front público é renderizado **no
servidor pelo próprio Hono** (`hono/html`), no mesmo processo — sem Next.js, sem
segundo build, sem CMS.

### Isolamento físico público × restrito

Três planos separados, com regras invioláveis:

1. **Nenhuma página pública recebe row cru do banco.** Tudo passa por
   `server/public/projections.ts` — um **whitelist explícito de campos**. Campo
   novo no modelo só aparece em público se for adicionado de propósito à projeção.
   Torna estruturalmente impossível vazar PII de aluno, matrícula, custo interno
   ou rascunho.
2. **Gate de visibilidade** de curso: curso ativo **E** produto ativo apontando
   para ele — o mesmo critério usado pelo sitemap.
3. Router público montado **antes** do fallback da SPA, sem middleware de auth.
4. **CSP `script-src 'self'`** respeitada: zero `<script>` inline; o JS do site é
   servido como asset same-origin.

### Módulos

| Arquivo | Papel |
|---|---|
| `config.ts` | dados de Organização + Autor (E-E-A-T) |
| `projections.ts` | camada de isolamento (whitelist) |
| `jsonld.ts` | construtores JSON-LD, grafo conectado por `@id` |
| `styles.ts` | tokens CSS inline (zero webfont) |
| `client.ts` | JS progressivo (tema, carrinho, accordion) |
| `layout.ts` | shell `<head>` + header/footer |
| `router.ts` | rotas públicas |

### Rotas públicas

`/` (home) · `/sobre` · `/autor` · `/contato` · `/blog` · `/blog/:slug` ·
`/formacoes` (lista de cursos) · `/formacao/:slug` (página de venda do curso) ·
`/checkout` · `/llms.txt` · `/robots.txt` · `/sitemap.xml`

Redirects 301 de URLs legadas para os slugs amigáveis.

### SEO/GEO assado no build

- **JSON-LD por tipo de página**: Organization + EducationalOrganization, WebSite,
  Person, Course + CourseInstance + Offer, FAQPage, BreadcrumbList, About/ContactPage —
  tudo em um grafo conectado por `@id`.
- **Autor como entidade** (`Person` com `hasCredential` + `sameAs`) — sinal central
  de E-E-A-T, essencial em conteúdo YMYL (saúde, finanças, direito).
- **TL;DR / answer-first** por curso e por post — o campo que faz LLMs citarem
  a página.
- **Disclaimers YMYL** onde o nicho exigir.
- **Core Web Vitals**: CSS crítico inline, `system-ui` (sem webfont, sem CLS),
  JS com `defer`, canonical/robots/OG por rota, imagens com dimensão explícita.
- `robots.txt` / `sitemap.xml` / `llms.txt` **gerados das rotas reais**, não escritos à mão.

### Campos públicos editáveis do curso

Extensão aditiva do schema do curso, alimentando a página de vendas e o JSON-LD:
`badge`, `tagline`, `tldr`, `level`, `language`, `monthsMin/Max`, `forWhom[]`,
`faqs[{q,a}]`, `curriculum[{n,title,desc}]`, `learningOutcomes[]`,
`instructorName/Bio/PhotoUrl`, `collaborators[]`, `changelog[]`, `coverImageUrl`, `tags[]`.

### Checkout externo

Visitante → gateway hospedado → webhook confirma → **cria a conta automaticamente**
e concede acesso ao produto comprado (`POST /public/checkout` +
`POST /payments/webhook/:gatewayId`).

---

## 10. Abstrações multi-provider (padrão repetido 6×)

O mesmo padrão em seis domínios: **interface comum + factory/registry +
credenciais criptografadas em AES-GCM + troca de provider pelo admin sem redeploy**.

| Domínio | Providers implementados |
|---|---|
| **IA** | Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq |
| **Pagamentos** | Mock, Stripe, Asaas, Pagar.me, MercadoPago, PayPal |
| **E-mail** | Mock, Resend, SendGrid, Postmark, Mailgun, Brevo, AWS SES, SMTP nativo |
| **Mensageria** | Mock, Twilio, WhatsApp Cloud API (Meta) |
| **Transcrição** | Whisper (OpenAI), Deepgram |
| **Webhooks outbound** | Genérico, Slack, Discord, Telegram, Teams, Mattermost, Pushover |

Adicionar um provider = **um arquivo novo** na pasta + registro no `index.ts`/`registry.ts`.

### Configuração de IA por módulo

Cada módulo de IA (`tutor`, `recovery_plan`, `evasion`, `recommendations`,
`support`, `summaries`, `grading`, `question_generation`) tem sua própria
configuração: provider, modelo, temperatura, max tokens, system message, escopos
permitidos, tópicos bloqueados, resposta de fallback, e **limites por aluno / por
dia / por mês + teto de custo mensal**. Todo uso é logado com tokens de entrada,
saída e custo estimado.

### Criptografia em repouso

`encryptApiKey(plain) → "<iv>.<ct>.<tag>"` em base64, AES-GCM 256, master key
derivada de uma env var. Usada para: chaves de gateway, chaves de e-mail, segredo
HMAC de webhook, credenciais de conector de import, chaves de IA, segredo TOTP.

Em dev sem master key, cai para um prefixo `dev:` + base64 — marcado como inseguro,
mas permite rodar local sem configurar nada.

---

## 11. Importação de dados (ETL)

Subsistema completo para migrar de plataformas legadas:

- **Conectores**: WordPress (REST), LearnDash (LMS), WooCommerce (loja), CSV, HTTP genérico.
- **Wizard no admin** para CSV (mapeamento de colunas) e para API (conexão + credenciais).
- **Jobs** com histórico, detalhe passo a passo, cancelamento, exportação do relatório e **rollback**.
- **Agendamentos** — importações recorrentes com worker próprio.
- **Templates** de importação por entidade.
- **Referências externas**: tabela que mapeia ID de origem → ID interno, **prefixada
  pela origem** para evitar colisão entre dois sistemas de origem diferentes.

Três armadilhas aprendidas na prática (valem para qualquer migração):
1. APIs de LMS podem **mentir** quando autenticadas como admin (ex.: retornar todos
   os usuários do site em vez dos matriculados no curso). Sempre valide contagens
   e prefira iterar pelo usuário, não pelo curso.
2. **IDs de sistemas de origem diferentes colidem** — prefixe sempre com a origem.
3. Campos livres de sistemas legados (`display_name`) costumam vir com **spam de SEO** —
   tenha um filtro de spam no pipeline.

---

## 12. API pública (v1)

REST read-only, autenticada por token `pcok_*` com escopos:

`/v1/courses` · `/v1/courses/:id` · `/v1/students` · `/v1/certificates` ·
`/v1/certificates/:id` · `/v1/orders` · `/v1/products` · `/v1/stats/summary` · `/v1/me`

Com **OpenAPI gerado** (`/v1/openapi.json`, `/v1/openapi.yaml`) e página de docs
(`/v1/docs`). Gestão de tokens (criar, listar, revogar) no admin.

---

## 13. Workers em background

Iniciados após o servidor subir, via `setInterval` — **sem cron externo, sem fila**.
Cada worker expõe `startWorker(intervalMs)` e `getStatus()`, e o status aparece em
telas de admin (`/admin/jobs`, `/admin/saude`).

| Worker | Intervalo | Função |
|---|---|---|
| Dispatcher de webhooks | 30s | entrega com retry e assinatura HMAC |
| Reengajamento | 24h | e-mails automáticos para alunos em risco |
| Agendamentos de import | 60s | dispara importações recorrentes |
| Digest do admin | 30min | envia no horário configurado |
| Backup do banco | 1h (snapshot em horário fixo) | snapshot + retenção |
| Cálculo de retenção | — | recalcula score de risco por aluno |
| Rotação de log | — | |

> Em ambiente serverless esses workers **não rodam** — este é um dos motivos de o
> alvo de produção ser um VPS Node, não functions.

### Motor de retenção/evasão

Calcula um **score de risco** por aluno a partir de: progresso esperado × real,
avaliações pendentes, uso do tutor, consumo de podcast, interações com biblioteca
e último acesso. Classifica em `baixo|medio|alto|critico`, guarda as **razões** e
uma **ação recomendada**. Alimenta as telas de evasão, retenção e o gerador de
**plano de retomada por IA**.

---

## 14. Observabilidade, segurança e conformidade

Primitivas que já nascem prontas e nas quais qualquer feature nova deve se plugar:

- **Auditoria** — middleware em mutações sensíveis, com listagem filtrável e export CSV.
- **Erros** — captura de 5xx no servidor + endpoint `POST /client-errors` para erros do browser; painel `/admin/erros`.
- **Buffer de logs** em memória com painel `/admin/logs` e rotação.
- **Atividade** — trilha de eventos por usuário.
- **Health checks** — `/health`, `/health/full`, `/ready`, `/version`.
- **Alertas** — central de alertas operacionais.
- **Rate limits** — configuráveis e visíveis no admin.
- **Backups** — snapshots automáticos, listagem, download e execução manual.
- **LGPD** — export de dados do titular, fila de solicitações de exclusão, unsubscribe sem login.

---

## 15. Convenções de engenharia (o que sustenta o resto)

1. **Aditivo, não destrutivo.** Feature nova se pluga sem alterar contratos
   públicos existentes (URLs, schemas, chaves JSON). Vale também para repositórios:
   adiciona export, não renomeia.
2. **Servidor devolve HTML para documentos imprimíveis** (certificados, faturas);
   o frontend chama `window.print()` com `@media print`. Zero dependência de PDF.
3. **Workers via `setInterval`**, não cron externo.
4. **JSON com hashes/segredos fica fora do versionamento.** Só arquivos de seed
   explícitos são commitados.
5. **Páginas consomem hooks**, nunca chamam o wrapper de fetch diretamente.
6. **Um único wrapper de fetch** que injeta o Bearer token, trata JSON e texto, e
   dispara um evento de janela em 401 para o contexto de auth deslogar.
7. **Testes na mesma sprint da feature** — padrão de 3 a 10 testes novos por sprint.
   Todo store novo nasce com o seu teste.

---

## 16. Deploy

Alvo primário: **VPS Node**, processo único servindo API + estáticos na mesma porta
(modo `SERVE_STATIC`), com injeção de CSP/HSTS, robots, sitemap dinâmico, uploads
estáticos e fallback de SPA.

Alvo secundário (opcional): adaptador serverless catch-all que embrulha o mesmo
`buildApp()` — **sem os workers**.

CI: `typecheck → lint → test → build` em todo push/PR, bloqueando merge se falhar.
Suite E2E como job separado.

---

## 17. O que adaptar no projeto novo (checklist)

Este documento é estrutural. O que **precisa ser criado do zero** no destino:

- [ ] Identidade visual completa: paleta, tipografia, espaçamento, componentes.
- [ ] Todos os textos de interface, e-mail e site público.
- [ ] Nome, domínio, logo, favicon, OG images.
- [ ] Dados de Organização e Autor no `config.ts` do site público (E-E-A-T).
- [ ] System prompts dos módulos de IA — hoje carregam o nicho de origem.
- [ ] Templates de e-mail (estrutura reaproveitável, conteúdo não).
- [ ] Template de certificado (campos reaproveitáveis, arte não).
- [ ] Taxonomia de conteúdo: categorias, tags, tipos de biblioteca.
- [ ] Nomenclatura de rotas se o idioma/nicho pedir.
- [ ] Disclaimers YMYL adequados ao nicho.
- [ ] Decidir se ativa fórum/interação entre alunos (o original optou por não ter).
- [ ] Decidir se ativa multi-tenant (o original é single-tenant dedicado).

Ao final, rode um grep do vocabulário do projeto de origem para garantir que nada vazou.

---

## 18. Ordem de construção sugerida

Cada fase entrega algo utilizável e testável.

| Fase | Escopo | Critério de aceite |
|---|---|---|
| **0** | Scaffolding: TS estrito, Vite+React, Hono, `shared/schemas.ts`, JsonStore, CI | `npm run dev` sobe web+api; typecheck/lint/test verdes |
| **1** | Auth: JWT + `tokenVersion`, bcrypt, login, reset de senha, `ProtectedRoute`, papéis | login funciona; trocar senha invalida tokens antigos |
| **2** | Modelo de curso: curso/módulo/aula/avaliação + CRUD admin + editor com drag & drop | admin cria curso completo |
| **3** | Consumo pelo aluno: layout de aprendizagem, progresso, conclusão de aula, anotações | aluno percorre um curso do início ao fim |
| **4** | Matrícula, drip, pré-requisitos, certificados com validação pública | certificado emitido e validável por código |
| **5** | Comercial: produtos, pedidos, cupons, um gateway real + webhook + fatura | compra ponta a ponta em modo teste |
| **6** | Site público SSR + projeções + JSON-LD + sitemap/robots/llms.txt | Rich Results Test passa em curso e post |
| **7** | E-mail: provider + templates + notificações + preferências + unsubscribe | e-mail transacional chegando |
| **8** | IA: abstração de provider + tutor com cotas + config por módulo no admin | tutor responde respeitando escopo e cota |
| **9** | Analytics, retenção/evasão, gamificação, leaderboard | score de risco calculado por worker |
| **10** | Observabilidade: auditoria, erros, logs, health, backups, rate limit | painéis populados |
| **11** | Conformidade: export de dados, exclusão de conta, termos/privacidade | fluxo LGPD completo |
| **12** | Extras conforme necessidade: importação, webhooks outbound, sessões ao vivo, mensageria, API pública, A/B testing | — |

Migrar de JsonStore para Postgres pode acontecer **em qualquer ponto**, entidade
por entidade, sem parar o produto — é para isso que serve o padrão do §4.

---

## 19. Variáveis de ambiente (mínimo)

| Var | Obrigatória | Papel |
|---|---|---|
| `DATABASE_URL` | não | ativa o Postgres; sem ela, JsonStore |
| `JWT_SECRET` | sim em prod | assinatura HS256 |
| `AI_KEY_ENCRYPTION_SECRET` | sim em prod | 32 bytes hex; master key AES-GCM |
| `ALLOWED_ORIGINS` | sim em prod | CORS |
| `SERVE_STATIC` | modo VPS | caminho do build para servir junto com a API |
| `PORT` | não | porta do servidor |

Credenciais de providers (IA, pagamento, e-mail, mensageria) **não ficam em env** —
são cadastradas pelo admin e guardadas criptografadas no banco.

---

*Documento gerado a partir da leitura do código-fonte de uma plataforma em produção.
Onde houver divergência entre este documento e o código do projeto de destino,
o código do destino é a verdade — este arquivo é o mapa.*
