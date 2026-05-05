# Arquitetura geral

## Princípios

1. **Aditivo, não destrutivo** — todo módulo novo se pluga sem alterar contratos públicos existentes.
2. **TypeScript estrito + Zod** — tipos compartilhados client/server via `shared/schemas.ts`.
3. **JsonStore por padrão, DB opcional** — código de repos checa `getDb()`; sem Postgres, cai pro JSON local.
4. **Credenciais sempre criptografadas** — AES-GCM 256 com master key derivada de `AI_KEY_ENCRYPTION_SECRET`.
5. **Pure functions onde der** — engine de matrícula, formatadores, transforms são puros e testáveis.

## Camadas

```
┌────────────────────────────────────────────────┐
│  React (Vite) ─ páginas /admin e /aluno        │
│  └─ TanStack Query → src/app/data/api.ts       │
└─────────────────────┬──────────────────────────┘
                      │ HTTP (Bearer JWT)
┌─────────────────────▼──────────────────────────┐
│  Hono basePath /api  (server/app.ts)           │
│  ├─ secureHeaders (CSP, HSTS, no-sniff)        │
│  ├─ CORS por env ALLOWED_ORIGINS               │
│  ├─ rateLimit() em rotas sensíveis             │
│  ├─ requireAuth(role?) middleware              │
│  └─ requireApiToken(scope?) middleware         │
└──────┬──────────────────┬──────────────────────┘
       │                  │
   ┌───▼───────┐    ┌─────▼──────────┐
   │ JsonStore │    │ Drizzle (PG)   │
   │ data/*.json│   │ opcional       │
   └────────────┘   └────────────────┘
```

## JsonStore

`server/db/json-store.ts` implementa store genérico:

```ts
const store = new JsonStore<MyType>('arquivo.json', () => seedDefault);

await store.getAll();
await store.findOne(predicate);
await store.filter(predicate);
await store.unshift(item);
await store.update(predicate, mutator);
await store.modify(arrayMutator);
await store.setAll(arr);
```

Cada `JsonStore` cria um lock de escrita interno (queue) — escritas concorrentes são serializadas.

## Auth

**JWT HS256** com payload `{ sub, email, role, tv, iat, exp }`. `tv` é o `tokenVersion` do user — qualquer change-password ou logout-all-devices bumpa o `tv` e invalida tokens antigos no middleware.

```ts
// server/auth/jwt.ts
signToken({ sub, email, role, tv })          // 7d default
signToken({ sub, email, role, tv, totp: 'pending' }, 600)  // ticket 10min
verifyToken(jwt) → JwtPayload | null
```

**API tokens públicos** (`server/auth/api-tokens.ts`) são paralelos ao JWT — formato `pcok_xxxxxx`, hash SHA-256 armazenado, escopos read-only. Ver [security.md](./security.md) e [api-public.md](./api-public.md).

## Criptografia

`server/db/encryption.ts`:

- `encryptApiKey(plain) → "<iv>.<ct>.<tag>"` (base64)
- `decryptApiKey(payload) → plain`
- Em dev sem `AI_KEY_ENCRYPTION_SECRET`, usa prefixo `dev:` + base64 (não-seguro, marcado pra detectar)

Usado em: gateways de pagamento, configs de e-mail, secret HMAC de webhooks, conexões de import, app passwords WP/WC, secret TOTP.

## Workers em background

Lançados em `server/dev.ts` após o servidor subir:

```ts
import('./webhooks/dispatcher').then(m => m.startWorker(30_000));    // 30s
import('./reengagement/worker').then(m => m.startWorker(86_400_000)); // 24h
```

Cada worker expõe `getStatus()` que aparece em `/admin/jobs`.

## Validação

`shared/schemas.ts` define **todos** os schemas Zod usados client+server. Convenção:

- `createXSchema` para POST
- `updateXSchema` é geralmente `createXSchema.partial()`
- Tipos derivados via `z.infer`

Validação no servidor sempre via `validate(schema, body)` ou `parsed.safeParse(body)`.

## Observabilidade

- **Audit log** (`server/audit/log.ts`): últimas 5000 mutações sensíveis em `data/audit-log.json`
- **Errors store** (`server/errors/store.ts`): crashes 5xx em `data/errors.json`
- **Log buffer** (`server/monitoring/log-buffer.ts`): ring de 5000 linhas console.* in-memory
- **Health snapshot** (`server/health/dashboard.ts`): status agregado via `/admin/saude`
- **Activity feed** (`server/activity/feed.ts`): timeline cross-entity
- **Sentry** (front e back): errors automáticos quando `SENTRY_DSN` env presente

## Gitignore para runtime data

Arquivos `data/*.json` que contêm hashes de senha, secrets, audit log, etc são gitignored. Apenas seeds explícitos sobem.
