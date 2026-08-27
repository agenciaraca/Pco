# Segurança

## Onde mora a credencial (AUTH_STORE)

O login tem dois backends com a mesma interface:

| `AUTH_STORE` | Persistência | Quando usar |
|---|---|---|
| ausente (padrão) | `data/users.json`, modo 0600 | dev local, e qualquer ambiente sem Postgres |
| `db` | colunas de credencial da tabela `users` | produção — **ligado em 19/ago/2026** |

Até essa data, credencial e aluno viviam em bases separadas e nada as
sincronizava: quem entrava por um caminho que escrevia só no banco — a carga da
migração, o sincronizador da loja — aparecia no admin com matrícula e não
conseguia fazer login. Foram 63 pessoas assim, 24 delas com progresso real.

Ordem para virar (e para voltar):

```bash
DATABASE_URL=... npx tsx scripts/migrate_logins_to_db.ts          # ensaio
DATABASE_URL=... npx tsx scripts/migrate_logins_to_db.ts --apply
AUTH_STORE=db no .env  →  pm2 restart ava-pco --update-env
DATABASE_URL=... AUTH_STORE=db npx tsx scripts/verify_auth_backend.ts
npx tsx scripts/smoke_login.ts --preparar  →  restart  →  SENHA=... --testar
```

Para reverter: **remova a variável e reinicie**. O `data/users.json` continua
onde estava, congelado no estado da virada — por isso ele não foi apagado.

Duas coisas que valem saber:

- A aplicação lê a lista de contas para a memória **no boot**. Conta criada por
  outro processo (script, SQL direto) só existe para quem está servindo depois de
  um restart. Vale para os dois backends.
- No modo banco, `scripts/audit_login_vs_db.ts` perde o sentido: ele compara o
  JSON com a tabela, e a tabela passou a ser a única fonte. O check
  `alunos-sem-login` do painel de saúde continua valendo.

## Visão geral

| Recurso | Onde |
|---|---|
| Autenticação JWT HS256 + tokenVersion | `server/auth/jwt.ts`, `middleware.ts` |
| Senhas bcrypt 11 rounds | `server/auth/users-store.ts` |
| Reset de senha com token TTL 30min | `server/auth/password-reset.ts` |
| 2FA TOTP RFC 6238 + backup codes | `server/auth/totp.ts` |
| API tokens públicos read-only | `server/auth/api-tokens.ts` |
| Rate limiting + telemetria | `server/rate-limit.ts` |
| AES-GCM 256 para credenciais | `server/db/encryption.ts` |
| Two-step destructive delete | `server/http/confirm.ts` |
| HMAC-SHA256 webhooks | `server/webhooks/signer.ts` |
| CSP + HSTS + nosniff via secureHeaders | `server/app.ts` |
| Audit log de mutações sensíveis | `server/audit/log.ts` |
| Sessions inspector + force logout | `/admin/sessoes` |

## 2FA TOTP

`server/auth/totp.ts` — implementação pura, sem dependência:

- HMAC-SHA1, step 30s, 6 dígitos, janela ±1
- Compatível com Google Authenticator, Authy, 1Password, etc
- Backup codes: 10 códigos formato `XXXX-XXXX` (8 chars base32 + traço), armazenados como SHA-256

### Setup flow

```
POST /auth/me/totp/setup
  → genSecret + buildOtpauthUri
  → store secretEncrypted (totpEnabled=false)
  → retorna { secret, uri }

POST /auth/me/totp/enable { code }
  → verifyTotp(secret, code)
  → genBackupCodes(10), hashBackupCode each
  → store totpBackupCodes + totpEnabled=true
  → bumpTokenVersion (invalida sessions antigas)
  → retorna { backupCodes } (ÚNICA vez que o usuário vê em claro)
```

### Login flow com 2FA

```
POST /auth/login { email, password }
  → se totpEnabled: signToken({ totp: 'pending' }, 600) → { totpRequired: true, ticket }
  → senão: signToken normal → { user, token }

POST /auth/login/totp { ticket, code }
  → verify ticket (claims.totp === 'pending')
  → tenta TOTP code (6 dig); senão tenta backup code (consume)
  → assina token final → { user, token }
```

### Disable + regen

```
POST /auth/me/totp/disable { code }            // exige código TOTP atual
POST /auth/me/totp/backup-codes/regenerate { code }  // mesma exigência
```

UI: card em `/perfil` mostra QR-key (manual), 6-digit input, lista de backup codes só após enable.

## API tokens públicos

`server/auth/api-tokens.ts` — tokens read-only para integrações externas (BI, Zapier, n8n):

```ts
ApiToken {
  id, name, secretHash (sha256),
  prefix: 'pcok_xxxxxxxx',  // visível na UI
  scopes: ApiTokenScope[],
  createdBy, createdAt, expiresAt?,
  lastUsedAt, usageCount, active
}

ApiTokenScope =
  | 'stats:read' | 'students:read'
  | 'orders:read' | 'courses:read'
  | 'all:read'
```

Middleware `requireApiToken(scope?)` valida `Authorization: Bearer pcok_...`. Hash SHA-256 do plain é comparado com `secretHash`. Verifica `active`, `expiresAt`, escopo.

Endpoints disponíveis em [api-public.md](./api-public.md).

UI em `/admin/api-tokens` mostra segredo em claro UMA vez na criação; depois só prefixo.

## Rate limiting

`server/rate-limit.ts` middleware reusável:

```ts
app.post('/auth/login', rateLimit({ windowMs: 60_000, max: 5 }), handler);
```

Bucket por `ip:path`. Quando bucket excede `max`, retorna 429 com `Retry-After`.

### Telemetria

Toda chamada (passe ou bloqueie) gera um `RateLimitHit` em ring buffer (10k):

```ts
{ ts, ip, path, method, blocked }
```

`summarize(windowMs)` retorna top IPs, top paths, recentBlocks.

UI: `/admin/rate-limits` com janelas 1h/6h/24h/7d, gráfico de barras inline e tabela de blocks.

## Two-step destructive delete

`server/http/confirm.ts`:

```ts
const provided = readConfirmHeader(c);  // X-Confirm-Name
if (!confirmMatches(provided, target.email)) {
  return jsonError(c, 428, 'CONFIRM_REQUIRED', '...');
}
```

`confirmMatches` é case-insensitive e ignora espaços extras.

Aplicado em:
- `DELETE /admin/users/:id` → header deve bater com email
- `DELETE /admin/products/:id` → header deve bater com nome

Cliente (`AdminUsuarios`, `AdminProducts`) usa `prompt()` pedindo o texto exato.

Estender para outros recursos: importe `readConfirmHeader, confirmMatches` e adicione 4 linhas no handler.

## Sessions inspector

`/admin/sessoes`:

- `GET /admin/sessions` lista users com `lastLoginAt`, `tokenVersion`, `totpEnabled`, `hasLikelyActiveSession` (login nos últimos 30d + active)
- `POST /admin/users/:id/force-logout` → `bumpTokenVersion(id)` → invalida tokens

UI tem filtro "só sessões prováveis ativas", busca, e botão por usuário.

Extra: bulk action `forceLogout` em `/admin/users/bulk` para múltiplos de uma vez.

## CSP + Headers

`app.ts` aplica `secureHeaders()` global:

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: blob: https:
font-src 'self' https://fonts.gstatic.com data:
connect-src 'self' https:
frame-ancestors 'none'
HSTS: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Audit log

`server/audit/log.ts` cap 5000 entries em `data/audit-log.json`:

```ts
{ id, ts, actorId, actorEmail, actorRole, action,
  targetType, targetId, ip, userAgent, meta?, status }
```

Captura mutações sensíveis (config changes, user CRUD, etc). Visível em `/admin/auditoria` ou via activity feed.

## Errors store

`server/errors/store.ts` captura crashes 5xx + client errors em `data/errors.json` (com cap). UI em `/admin/erros`.

## Variáveis de ambiente críticas

| Var | Descrição |
|---|---|
| `JWT_SECRET` | Mínimo 32 chars. Sem isso, sessões caem ao restart. |
| `AI_KEY_ENCRYPTION_SECRET` | 64 hex (32 bytes). Sem isso, criptografia cai pra `dev:` mode. |

## Tests

- `test/totp.test.ts` — round-trip, drift, formato backup codes
- `test/encryption.test.ts` — round-trip AES-GCM, IV random, tampering detection
- `test/auth.test.tsx` — fluxos React de login/logout
- `test/http-confirm.test.ts` — two-step delete normalização


## Rota `/admin/*` de leitura também exige token (27/ago/2026)

**Cinco rotas de leitura sob `/admin/` não exigiam autenticação nenhuma.** A
pior era `GET /api/admin/students`: devolvia nome, e-mail, progresso, último
acesso e score de risco de **todos** os alunos para quem simplesmente pedisse a
URL. Em produção são cerca de duas mil pessoas. As outras quatro:
`/admin/students/:id`, `/admin/students/:id/stats`,
`/admin/ai/configurations` e `/admin/ai/configurations/:id`.

**A causa é sutil e vai se repetir se ninguém vigiar.** `attachUser` roda em
`app.use('*')` e coloca o usuário no contexto quando há token — mas não exige.
Quem lê o código rápido vê um middleware global de autenticação onde existe só
um de conveniência. Quem exige é `requireAuth`, e ele é rota a rota.

Já havia um teste de guarda (`admin-routes-guard`), mas ele cobre uma
**amostra** de rotas de escrita — e foi exatamente uma amostra que deixou estas
cinco passarem por meses.

`test/admin-rotas-sem-auth.test.ts` percorre as rotas que o app de fato
registrou (`app.routes`) e cobra 401 em cada uma. Duas proteções contra o teste
virar decoração:

- exige encontrar mais de 100 rotas, para que uma mudança na forma de
  `app.routes` não faça o laço passar sobre uma lista vazia;
- foi verificado removendo a proteção de uma rota e confirmando que a suíte
  fica vermelha.

Rota nova sem `requireAuth` agora cai na suíte, não em produção.


## Mais três rotas que respondiam a qualquer um (27/ago/2026)

Fora de `/admin/`, na mesma varredura:

| Rota | O que saía | Por que importa |
| --- | --- | --- |
| `GET /retention/risks` | nome, score, motivos e último acesso de cada aluno | pior que a lista de matrícula: é um **juízo sobre pessoas nomeadas** |
| `POST /ai/tutor` | resposta do Tutor Virtual | recurso pago; e sem usuário no contexto a cota caía no id do aluno-**semente**, então um anônimo gastava a cota mensal de uma conta real |
| `GET /courses/:id/forum/threads` e `GET /forum/threads/:id` | discussão do curso, com nome de aluno | escrever já exigia token; **ler não exigia nada** |

Nenhuma tela mudou de comportamento: as quatro que consomem `retention/risks`
são de coordenação, e o fórum e o tutor já mandavam token.

## O inventário de rotas públicas

`test/rotas-publicas-inventario.test.ts` guarda a lista do que responde sem
token **como decisão escrita**, cada item com o motivo. O teste percorre as
rotas registradas e falha se alguma fora da lista responder algo diferente de
401.

O efeito prático: tornar uma rota pública passa a exigir escrevê-la ali com uma
justificativa — que é exatamente o momento em que alguém pergunta "isso pode
mesmo sair sem login?". Um segundo caso cobra que o motivo não seja uma palavra
solta.
