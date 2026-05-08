# AVA PCO

[![CI](https://github.com/agenciaraca/Pco/actions/workflows/ci.yml/badge.svg)](https://github.com/agenciaraca/Pco/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-1106%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-71%25-green)
![Sprints](https://img.shields.io/badge/sprints-550%2B-blue)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online.

Frontend SPA + backend serverless TypeScript end-to-end.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 5 · React 18 · TypeScript 5 · Tailwind 3 · React Router 6 |
| Estado/dados | TanStack Query · React Hook Form + Zod |
| Backend | Hono (Vercel Functions / Node) |
| Validação | Zod (schemas compartilhados client + server) |
| Auth | Clerk (env-gated) — mock local fallback |
| DB | Postgres (Neon recomendado) + Drizzle ORM (a plugar) |
| IA | Anthropic Claude (server-side proxy, env-gated) |
| Testes | Vitest + Testing Library + jsdom |
| Lint/Format | ESLint flat config + Prettier |
| Monitoring | Sentry (env-gated) |
| Deploy | Vercel (frontend + functions no mesmo repo) |
| CI | GitHub Actions |

## Rodando localmente

```bash
npm install
cp .env.example .env       # opcional — só se for plugar serviços externos
npm run dev                # roda Vite (5173) + API Hono (3001) em paralelo
```

Outros scripts:

```bash
npm run dev:web      # só o frontend Vite
npm run dev:api      # só a API Hono local (porta 3001)
npm run build        # build de produção
npm run preview      # serve o build
npm run test         # roda Vitest (executável)
npm run test:watch   # Vitest em modo watch
npm run lint         # ESLint
npm run lint:fix     # ESLint + autofix
npm run format       # Prettier write
npm run format:check # Prettier check (CI)
npm run typecheck    # tsc --noEmit
```

## Estrutura

```
Pco/
├── api/                     # Vercel Functions catch-all → buildApp()
├── server/                  # Backend Hono
│   ├── app.ts               # rotas e middlewares
│   ├── http.ts              # helpers (jsonError, validate)
│   ├── rate-limit.ts        # rate limit em memória
│   └── dev.ts               # entrypoint local (porta 3001)
├── shared/
│   └── schemas.ts           # Zod schemas client + server
├── src/
│   ├── main.tsx             # entrypoint, providers, error boundary
│   ├── styles/theme.css
│   ├── vite-env.d.ts
│   └── app/
│       ├── routes.tsx       # roteamento + lazy + protected
│       ├── auth/            # AuthContext + ProtectedRoute
│       ├── data/
│       │   ├── api.ts       # client API → /api/*
│       │   ├── client.ts    # http() com retry, ApiError, auth
│       │   ├── hooks.ts     # TanStack Query hooks tipados
│       │   └── seed.ts      # mock data (será removido com DB real)
│       ├── monitoring/
│       │   └── sentry.ts    # Sentry init env-gated
│       ├── types/schema.ts  # tipos de domínio
│       ├── layouts/         # StudentLayout, AdminLayout, LearningLayout
│       ├── components/      # Sidebar, Topbar, Toast, ErrorBoundary, etc.
│       └── pages/           # rotas aluno + LMS + públicas + admin/*
├── test/                    # Vitest tests
├── .github/workflows/ci.yml # CI: build, test, lint
├── eslint.config.js
├── .prettierrc.json
├── vercel.json              # deploy + security headers
└── vitest.config.ts
```

## Paleta PCO

| Cor | Hex |
|---|---|
| Azul principal | `#0097B2` |
| Ciano | `#0CC0DF` |
| Ciano claro | `#5CE1E6` |
| Laranja destaque | `#FE9002` |
| Azul profundo | `#063B49` |

## Segurança

`vercel.json` já aplica em todas as respostas:

- **CSP** (Content Security Policy) restrito a `'self'` + Google Fonts + Anthropic API
- **HSTS** com 2 anos + preload
- **X-Frame-Options: DENY** (anti-clickjacking)
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** bloqueando câmera, microfone, geolocalização, FLoC

API Hono aplica:

- **secureHeaders()** middleware do Hono
- **CORS** com origens via `ALLOWED_ORIGINS`
- **Rate limit** em memória (120 req/min/IP)
- **Validação** server-side com Zod em todas as mutations

Frontend:

- Tokens em `localStorage` (mover para cookies HttpOnly ao integrar Clerk)
- `ProtectedRoute` com checagem de role
- Senha nunca logada
- Sanitização nativa do React (sem `dangerouslySetInnerHTML`)

## Plugando serviços externos

Toda integração externa é **env-gated**: se a env var não existir, o sistema
usa o fallback mockado. Isso permite rodar localmente sem credencial.

### 1. Auth real com Clerk

```bash
npm install @clerk/clerk-react
```

1. Crie projeto em https://dashboard.clerk.com/
2. Adicione no `.env`:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
3. Em `src/main.tsx`, troque `AuthProvider` por `ClerkProvider`
4. Em `src/app/auth/AuthContext.tsx`, substitua `api.login` por
   `useUser()` + `useAuth()` do Clerk

### 2. Database com Neon + Drizzle (já implementado)

Schema completo, repositórios, criptografia AES-GCM e migrações **já estão
implementados**. Para ativar, basta definir as env vars.

**Passo a passo:**

1. **Crie database no Neon**: https://console.neon.tech → New Project →
   copie a connection string (formato `postgres://USER:PASSWORD@HOST/db?sslmode=require`)

2. **Gere uma master key de criptografia** para chaves de IA:
   ```bash
   openssl rand -hex 32
   ```

3. **Adicione no Vercel** (Settings → Environment Variables) — **NUNCA cole
   no chat ou em commits**:
   ```
   DATABASE_URL=postgres://...
   AI_KEY_ENCRYPTION_SECRET=<output-do-openssl>
   ```
   Em dev local, copie os mesmos valores para `.env`.

4. **Aplique o schema**:
   ```bash
   npm run db:migrate    # cria todas as tabelas
   npm run db:seed       # popula dados iniciais (cursos, alunos demo, etc.)
   ```

5. **Verifique**: `GET /api/health` agora responde `{ db: "connected" }`.

**O que muda quando o DB está plugado:**
- Configurações de IA: persistidas com chaves **criptografadas AES-GCM
  256-bit**. Trocar provider/chave em `/admin/ias` agora persiste entre
  deploys e restarts.
- Tickets de suporte: gravados em DB.
- Cursos/módulos/aulas: lidos do DB (com fallback no seed se a tabela
  estiver vazia, para casos de "DB recém-criado").
- Logs de uso de IA: histórico permanente em `ai_usage_logs` para
  auditoria, billing e enforcement de limites por aluno.

**Sem `DATABASE_URL`** o sistema continua funcionando 100% no fallback
in-memory — útil para dev rápido sem subir Neon.

**Comandos disponíveis:**
```bash
npm run db:generate   # gera SQL de migração após mudar schema
npm run db:migrate    # aplica migrações em remote
npm run db:push       # sincroniza schema sem migration (dev only)
npm run db:studio     # abre UI do Drizzle pra inspecionar dados
npm run db:seed       # popula dados iniciais (idempotente, usa onConflictDoNothing)
```

**Tabelas criadas (17):** users, students, courses, modules, lessons,
assessments, enrollments, news_articles, podcasts, library_items,
certificates, retention_risks, professionals, session_services,
support_tickets, ai_configurations, ai_usage_logs.

**Estratégia de migração para entidades restantes:** o padrão de repositório
está em `server/repositories/*`. Para migrar uma entidade que ainda lê do
seed, basta criar o `<entidade>.ts` seguindo o template de `courses.ts`
(consulta DB primeiro, fallback seed quando vazio).

### 3. IAs do AVA (Tutor, Plano de Retomada, etc.)

**Configuradas pelo admin no próprio sistema, não em env vars.**

O AVA suporta nativamente 6 providers via abstração comum
(`server/ai/providers/`), todos com a mesma interface:

| Provider | Recomendado para | Custo aproximado |
|---|---|---|
| **Anthropic Claude** | Tutor pedagógico, casos sensíveis | $3 / $15 por MTok (Sonnet 4.6) |
| **OpenAI** | Fallback universal | $0.15 / $0.60 (4o mini) |
| **Google Gemini** | Janela enorme (1M+ tokens), tier gratuito | $0.075 / $0.30 (Flash) |
| **Mistral AI** | Multi-idioma, GDPR, sediada na UE | $0.20 / $0.60 (Small) |
| **DeepSeek** | Custo muito baixo, raciocínio forte | $0.27 / $1.10 (V3) |
| **Groq** (Llama 3.3, Mixtral, Gemma) | Velocidade extrema, open weights | $0.59 / $0.79 (70B) |

Como configurar (sem deploy):

1. Acesse `/admin/ias`
2. Clique em **Configurar** no módulo desejado (Tutor Virtual, Plano de
   Retomada, etc.)
3. Selecione provider, modelo e cole a chave de API
4. Clique em **Testar conexão** — o backend faz uma chamada-ping ao provider
5. Salve

A chave fica **apenas no servidor**. O frontend recebe somente a versão
mascarada (ex.: `sk-a••••••••0xyz`). Em produção (com DB), as chaves serão
criptografadas com AES-GCM usando `AI_KEY_ENCRYPTION_SECRET` em env var.

Para trocar de provider, repita o processo no admin — não exige redeploy.

Para adicionar um novo provider, crie `server/ai/providers/<id>.ts`
implementando a interface `AiProvider` e registre em `providers/index.ts`.

### 4. Sentry para erros

```bash
npm install @sentry/react
```

1. Crie projeto em https://sentry.io/
2. Adicione no `.env`:
   ```
   VITE_SENTRY_DSN=https://...@sentry.io/...
   ```
3. Descomente o bloco `Sentry.init` em `src/app/monitoring/sentry.ts`

## Deploy

### Vercel (recomendado)

1. Conecte o repo em https://vercel.com/new
2. Defaults estão corretos via `vercel.json`
3. Adicione as env vars necessárias na aba **Environment Variables**
4. Deploy automático em cada push para `main`

A `api/[[...route]].ts` vira automaticamente uma Vercel Function que roda
o mesmo `buildApp()` usado em dev local.

### Outros hosts

Frontend: build estático em `dist/` com fallback de 404 para `index.html`.

Backend: o `server/app.ts` exporta um `Hono` reusável. Para Cloudflare
Workers, Bun, Node ou Deno basta um adapter diferente:

```ts
// Cloudflare Workers
export default { fetch: buildApp().fetch };

// Bun
Bun.serve({ fetch: buildApp().fetch, port: 3001 });

// Deno
Deno.serve(buildApp().fetch);
```

## CI

`.github/workflows/ci.yml` roda em cada push/PR para `main`:

1. Setup Node 20 com cache npm
2. `npm ci`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test`
6. `npm run build`
7. Sobe `dist/` como artifact (7 dias)

PR não merge se algum step falhar.

## Roadmap próximo

- [ ] Plugar Clerk (auth real)
- [ ] Plugar Neon + Drizzle (substituir seed)
- [ ] Plugar Anthropic (tutor real) — código já pronto, basta env
- [ ] Plugar Sentry — código já pronto, basta env + npm install
- [ ] Migrações Drizzle versionadas
- [ ] Storybook para components
- [ ] E2E com Playwright em rotas críticas
- [ ] PWA + service worker para offline
- [ ] i18n (português/inglês/espanhol) já previsto na spec
