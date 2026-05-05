# AVA PCO — Documentação técnica

AVA PCO (Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online) é uma plataforma full-stack TypeScript que combina LMS, gateway de pagamentos, importador de dados e ferramentas de operação administrativa.

## Stack

- **Backend**: Hono v4 + Node 20, TypeScript estrito
- **Frontend**: React 18 + Vite + TanStack Query + React Router (lazy) + Tailwind
- **Storage**: `JsonStore<T>` em `data/*.json` por padrão; Drizzle ORM (Postgres) opcional via env
- **Validação**: Zod 4 em `shared/schemas.ts` (compartilhado client/server)
- **Auth**: JWT HS256 + `tokenVersion` + middleware `attachUser`/`requireAuth`
- **Criptografia**: AES-GCM 256 (`server/db/encryption.ts`) para credenciais e secrets
- **Tests**: Vitest, 131 testes em 15 arquivos

## Estrutura de pastas

```
server/
  app.ts              # buildApp(): monta todas as rotas Hono
  dev.ts              # entry-point: serve estáticos + /api + workers
  auth/               # JWT, users-store, TOTP, API tokens
  payments/           # gateways, products, orders, providers (Stripe/Asaas/...)
  imports/            # WP/LD/WC importer (CSV + API)
  notifications/      # e-mail (Resend/SendGrid/Postmark/mock) + broadcasts + prefs
  webhooks/           # outbound (HMAC + Slack/Discord)
  reengagement/       # worker diário de inativos
  achievements/       # badges automáticos
  reviews/            # ratings de curso
  discussions/        # comentários por aula
  live-sessions/      # Zoom/Meet
  saved-searches/     # filtros salvos por admin
  admin/              # notes-store, bulk endpoints
  audit/              # log de mutações sensíveis
  monitoring/         # log buffer, sentry helpers
  health/             # snapshot agregado
  activity/           # feed cross-entity
  search/             # busca admin global
  errors/             # crash log
  http/               # helpers (confirm header)
  export/             # CSV builder
  settings/           # backup/restore de configs
  rate-limit.ts       # middleware com telemetria
  repositories/       # courses, students, progress, watch-time, etc

src/app/
  pages/              # rotas
  pages/admin/        # painel admin
  components/         # UI compartilhada
  data/api.ts         # cliente HTTP tipado
  data/hooks.ts       # TanStack Query wrappers
  auth/AuthContext.tsx
  layouts/

shared/
  schemas.ts          # Zod schemas

test/                 # Vitest suites
docs/                 # este diretório
data/                 # runtime (gitignored salvo seeds)
public/               # static (manifest, sw.js, offline.html, ícones)
```

## Módulos documentados

| Módulo | Documento |
|---|---|
| Arquitetura geral | [architecture.md](./architecture.md) |
| Pagamentos (gateways, refund, cupons) | [payments.md](./payments.md) |
| Importador WP/LD/WC | [imports.md](./imports.md) |
| E-mail (transacional + broadcasts) | [email.md](./email.md) |
| Webhooks de saída + Slack/Discord | [webhooks.md](./webhooks.md) |
| Segurança (2FA, API tokens, sessões) | [security.md](./security.md) |
| Operações admin (bulk, search, jobs) | [admin-ops.md](./admin-ops.md) |
| Engajamento (achievements, streak) | [engagement.md](./engagement.md) |
| Live sessions (Zoom/Meet) | [live-sessions.md](./live-sessions.md) |
| Analytics (course/student/health) | [analytics.md](./analytics.md) |
| API pública v1 | [api-public.md](./api-public.md) |

## Roadmap completo (entregue + backlog)

Veja [`/ROADMAP.md`](../ROADMAP.md) na raiz do repo.

## Como rodar

```bash
npm install
npm run dev          # servidor em http://localhost:3001 + Vite dev
npm run typecheck    # tsc -b --noEmit
npm test             # vitest run
npm run build        # build produção (dist/)
```

### Variáveis de ambiente principais

| Var | Para | Obrigatório? |
|---|---|---|
| `JWT_SECRET` | Sign de tokens (mín 32 chars) | Sim em prod |
| `AI_KEY_ENCRYPTION_SECRET` | AES-GCM master key (64 hex) | Sim em prod |
| `DATA_DIR` | Dir de JSON stores | Default `./data` |
| `PUBLIC_ORIGIN` | URL pública para links em e-mails | Default `https://ava.psicanaliseclinica.online` |
| `SERVE_STATIC` | Path do build pra servir static | Opcional (modo full-stack) |
| `ALLOWED_ORIGINS` | CSV de origins CORS | Default `http://localhost:5173` |
| `PORT` | Porta HTTP | Default `3001` |

### Deploy

`scripts/update_vps.py` faz `git fetch + reset + npm ci + build + restart` via SSH. Requer `HOST`, `PORT`, `USER_NAME`, `KEY_PATH` no ambiente.
