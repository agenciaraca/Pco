# AVA PCO

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

### 2. Database com Neon + Drizzle

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

1. Crie banco em https://console.neon.tech/
2. Adicione no `.env`:
   ```
   DATABASE_URL=postgres://user:pass@host/db?sslmode=require
   ```
3. Crie `server/db/schema.ts` com tipos Drizzle (espelhando
   `src/app/types/schema.ts`)
4. Substitua imports de `seed.ts` em `server/app.ts` por queries Drizzle

### 3. Tutor Virtual com Claude

Já implementado em `server/app.ts` com fallback mock.

1. Crie key em https://console.anthropic.com/
2. Adicione no `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-6
   ```

A chave **nunca** é exposta ao cliente — sempre via proxy server-side.

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
