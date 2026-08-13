# Checklist de produção — AVA PCO

Tudo que está pronto no código + o que precisa de credencial/decisão pra ativar.

## 🔴 Bloqueadores pra abrir matrículas pagas

### 1. Email provider

**Status:** código pronto pra 8 providers, **0 configurados** em prod.

Sem isso: reset de senha, welcome, order paid, refund — nenhum email sai.

**Como ativar (5 min):**
1. Criar conta em https://resend.com (3000 emails/mês grátis)
2. Verificar domínio `psicanaliseclinica.online` (SPF + DKIM)
3. Pegar API key em https://resend.com/api-keys
4. Em https://ava.psicanaliseclinica.online/admin/email:
   - Provider: **Resend**
   - API key: `re_xxx...`
   - From: `naoresponda@psicanaliseclinica.online`
   - Marcar `active = true`
5. Clicar "Testar envio" pra confirmar

Alternativas: SendGrid (100/dia grátis), Postmark (100/mês grátis), Brevo (300/dia grátis), AWS SES (62k/mês grátis se ec2).

### 2. Sentry (error tracking server-side)

**Status:** integrado em `server/observability/sentry.ts` + `server/errors/store.ts`. No-op se `SENTRY_DSN` vazio.

**Como ativar (10 min):**
1. Criar projeto em https://sentry.io (5k events/mês grátis)
2. Pegar DSN do projeto (formato `https://xxx@sentry.io/yyy`)
3. SSH no VPS: `echo "SENTRY_DSN=https://xxx@sentry.io/yyy" >> ~/ava-pco/.env`
4. Opcionalmente `SENTRY_RELEASE=$(git rev-parse --short HEAD)`
5. `python scripts/restart_vps.py`

Sem isso: erros ficam só em `data/errors.json` (visível em `/admin/erros`).

### 3. Uptime monitor externo

**Status:** endpoints prontos: `/api/health` (público, sem auth), `/api/ready` (readiness).

**Como ativar (5 min):**
1. Criar conta em https://uptimerobot.com (grátis, 50 monitors)
2. New monitor:
   - URL: `https://ava.psicanaliseclinica.online/api/health`
   - Interval: 5 min
   - Alert contact: seu email/SMS
3. (opcional) Criar segundo monitor pra `https://ava.psicanaliseclinica.online/` (frontend)

### 4. Disco do VPS em 81%

**Status:** nossa app só ocupa 595MB. Os outros 310GB são outras apps no servidor compartilhado.

**Ação:** investigar com o provedor do VPS (Hostgator/cloud) ou pedir aumento de disco. Não é problema nosso, mas se o disco lotar, o app cai junto.

### 5. Teste end-to-end de checkout

**Status:** 2 gateways em modo `live` e ativos. **0 pedidos pagos**.

**Como testar:**
1. Mude um curso pra preço baixo (R$1) temporariamente
2. Faça compra real com seu cartão
3. Confirme: webhook chega? Aluno fica matriculado? Email de confirmação sai?
4. Reverta o preço

---

## 🟠 Preparado pra escala (próximas 1-2 semanas)

### 6. Postgres (DivZ) — ✅ ATIVO

**Status:** produção roda no **DivZ** (`db.divz.com.br:5432/pco-lms`, PG 16.9) desde 2026-07-03. Migrado do Neon (motivo=custo). JSON segue como fallback para entidades ainda não migradas.

**Driver:** node-postgres (`pg`) — TCP padrão. O `DATABASE_URL` fica no `.env` do VPS. Cert self-signed aceito (`rejectUnauthorized:false` em `server/db/client.ts`).

**Trocar de provedor no futuro:** basta trocar `DATABASE_URL` no `.env` e reiniciar (`pm2 restart ava-pco`). O driver `pg` fala com qualquer Postgres TCP. Backup do Neon pré-migração em `backups/neon-2026-07-03.{dump,sql}` (gitignored).

### 7. CDN para uploads (Cloudflare R2)

**Status:** `/uploads/*` servido pelo Node hoje. Cloudflare na frente cacheia automaticamente.

**Pra desacoplar:**
1. Criar bucket R2 em https://dash.cloudflare.com (10GB grátis)
2. Configurar S3-compatible API
3. Adicionar envs no .env do VPS:
   ```
   S3_BUCKET=ava-pco-uploads
   S3_REGION=auto
   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<key>
   S3_SECRET_ACCESS_KEY=<secret>
   ```
4. Adaptar `server/uploads/store.ts` pra usar S3 quando configurado (TODO)

### 8. Backups remotos S3

**Status:** worker já existe em `server/db/backup-s3.ts`. Env-gated.

**Como ativar:** mesmo bucket do CDN acima, ou bucket separado:
```
AWS_S3_BUCKET=ava-pco-backups
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Worker dispara às 04:00 UTC todo dia.

### 9. CI/CD automatizado

**Status:** `.github/workflows/deploy.yml` criado. Trigger: push to main.

**Como ativar:**
1. Em https://github.com/agenciaraca/Pco/settings/secrets/actions, adicionar:
   - `VPS_HOST` = `195.200.0.253` (o antigo `177.7.35.13` está morto — se o secret
     ainda apontar pra ele, o deploy falha com `Connection timed out` a cada push)
   - `VPS_USER` = `avapco`
   - `VPS_PORT` = `22`
   - `VPS_PASSWORD` = senha do user (a mesma que está na nossa memória)
   - `PUBLIC_URL` = `https://ava.psicanaliseclinica.online` (opcional)
2. Próximo push to main vai disparar deploy automático.

---

## 🟡 Pra crescer (quando passar 5k alunos)

### 10. Múltiplas instâncias

Hoje 1 processo Node. Pra escalar:
- Configurar 2-3 instâncias atrás de load balancer (nginx ou Cloudflare LB)
- Mover rate limit de in-memory pra **Redis**
- Configurar **sticky sessions** ou jogar tudo no Redis

### 11. Read replicas Postgres

Quando queries começarem a engargolar:
- Configurar 1 replica read-only no DivZ (ou provedor vigente)
- Adaptar repos pra usar replica em queries pesadas (analytics, reports)

### 12. Mobile app

PWA atual já cobre. Se virar prioridade: React Native ou Capacitor (envelopa o que já existe).

---

## ✅ Já está pronto pra escala

| Área | Status |
|---|---|
| Auth | JWT HS256 + 2FA TOTP + tokenVersion (revogável) |
| Pagamentos | 6 providers + webhook HMAC + refund |
| Email | 8 providers (basta configurar 1) |
| Webhooks | HMAC SHA-256 + retry exponencial |
| Security | CSP / HSTS / X-Frame / Permissions-Policy |
| Rate limit | Middleware in-memory (escala vertical OK até multi-instance) |
| Audit log | Toda mutação sensível |
| Workers | webhooks, reengagement, imports, digest diário/semanal, backups, retention recompute, log rotator |
| Backups | Diário às 04:00 UTC, local + opt-in S3 |
| Healthchecks | `/api/health` (público) + `/api/ready` + `/api/health/full` (admin) |
| Errors | `errors-store` + Sentry server-side opt-in |
| 2FA | TOTP RFC 6238 + backup codes |
| Sessions | Stateless JWT (não precisa cleanup) |
| Impersonation | Audit + bloqueio em 10 ações sensíveis |
| LGPD | Deletion requests + audit |
| Logs | Rotation automática (10MB → keep 4) |
| CDN frontend | Cloudflare na frente, HTTPS terminado |

---

## 🎯 Resumo rápido

**Pra usar hoje** (matrícula real, paga, com aluno logando e usando): completar **5 bloqueadores** acima (~2-3h total se você passar as credenciais).

**Pra escalar pra 10k alunos:** adicionar Postgres + S3 (~1 dia).

**Pra escalar pra 50k+:** Postgres + Redis + multi-instance (~1 semana).
