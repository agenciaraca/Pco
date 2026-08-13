# E-mail transacional + Broadcasts

## Providers

`server/notifications/providers/registry.ts`:

| Provider | Implementação | Auth |
|---|---|---|
| `mock` | só loga, retorna fake id | — |
| `resend` | POST https://api.resend.com/emails | Bearer API key |
| `sendgrid` | POST /v3/mail/send | Bearer API key |
| `postmark` | POST /email + ServerToken | X-Postmark-Server-Token |
| `smtp` | NOT_IMPLEMENTED (use os REST acima) | — |

Todos implementam `EmailProviderImpl { send, ping? }`.

## Configuração

`server/notifications/config-store.ts`:

```ts
EmailConfig {
  id, provider, enabled,
  fromEmail, fromName, replyToEmail,
  apiKeyEncrypted,
  smtpHost?, smtpPort?, smtpUser?, smtpPasswordEncrypted?, smtpSecure?,
  lastTestedAt, lastTestStatus, lastTestMessage
}
```

`getActiveConfig()` retorna a primeira `enabled` (prefere não-mock).

## Sender

`server/notifications/sender.ts`:

```ts
sendEmail(input, opts?)        // lança em erro
sendSafe(input, opts?)         // nunca lança, retorna { ok, error?, result? }
sendWithConfig(config, input)  // força config específico
pingConfig(configId)           // chama provider.ping()
```

Tudo loga em `data/email-logs.json` via `log-store.ts` (cap 1000).

## Templates

`server/notifications/templates.ts` — funções puras retornando `{ subject, html, text }`:

| Template | Variáveis |
|---|---|
| `renderPasswordReset` | userName, resetUrl, expiresInMinutes |
| `renderOrderPaid` | userName, productName, amountFormatted, orderUrl |
| `renderCourseEnrolled` | userName, courseTitle, courseUrl, expiresAt |
| `renderWelcome` | userName, loginUrl, tempPassword? |

`previewTemplate(name)` retorna versão com dados de exemplo (admin UI).

Layout HTML branded (cabeçalho com logo + cores AVA + footer). Para broadcasts, footer recebe link de unsubscribe automaticamente.

## Hooks de envio (transacional)

| Evento | Onde |
|---|---|
| Reset de senha | `POST /auth/forgot-password` → `renderPasswordReset` |
| Pagamento confirmado | webhook payment paid → `renderOrderPaid` |
| Reembolso | `POST /admin/orders/:id/refund` → e-mail simples |

Sempre via `sendSafe()` — falha de e-mail não bloqueia o fluxo principal.

## Broadcasts (campanhas em massa)

`server/notifications/broadcasts.ts`:

### Audiências

```ts
'all' | 'students_active' | 'students_inactive' (X dias) |
'admins' | 'enrolled_in_course' | 'no_enrollment'
```

`resolveAudience(audience, opts)` retorna `Array<{id, email, name?}>` filtrando por `notificationPrefs.blockedFromBroadcasts()` (opt-out).

### Disparo

```
POST /admin/email/broadcasts { subject, html, audience, courseId?, inactivityDays? }
  → resolveAudience() (já remove opt-outs)
  → cria Broadcast(status=pending)
  → runBroadcast() em background:
      • injeta footer com unsubscribe link (JWT scope=unsubscribe TTL 1 ano)
      • for-each: sendSafe + pause 100ms
      • update sent/failed a cada 25
      • status=completed
```

### Histórico

`/admin/broadcasts` mostra status, sent/total, failed por campanha. Polling a cada 5s.

## Reengagement automático

`server/reengagement/worker.ts` roda 1x/dia (configurável):

```ts
ReengagementConfig {
  enabled,
  inactivityDays,    // default 14
  cooldownDays,      // default 14 (não envia 2x no mesmo período)
  onlyEnrolled,      // só alunos com curso
  subject, bodyHtml, // template com {{name}}, {{lastAccess}}, {{loginUrl}}
}
```

Honra `notificationPrefs.blockedFromReengagement()`. Cooldown checa `lastSentForUser(userId)`.

UI em `/admin/reengajamento-auto` com dry-run e disparo manual.

## Notification preferences (opt-out)

`server/notifications/prefs-store.ts`:

```ts
NotificationPrefs {
  userId,
  receiveBroadcasts: bool (default true),
  receiveReengagement: bool (default true)
}
```

Aluno controla em `/perfil` (seção "Preferências de e-mail").

E-mails essenciais (reset senha, order paid, welcome) **sempre** vão — só opt-outs aplicam-se a campanhas e reengajamento.

## Unsubscribe link público

```
GET /api/unsubscribe?token=<JWT>
```

Token: scope=`unsubscribe`, sub=userId, TTL 1 ano. Se válido, seta `receiveBroadcasts=false` e renderiza HTML estática de confirmação. Não exige login (token já identifica).

## Endpoints

| Verbo | Path | O que faz |
|---|---|---|
| GET | `/admin/email/configs` | Lista (sem secrets) |
| POST/PUT/DELETE | `/admin/email/configs[/:id]` | CRUD |
| POST | `/admin/email/configs/:id/test` | ping() |
| POST | `/admin/email/configs/:id/send-test` | Envia e-mail de teste |
| GET | `/admin/email/logs` | Histórico de envios |
| GET | `/admin/email/templates` | Lista names |
| GET | `/admin/email/templates/:name/preview` | Preview HTML |
| GET | `/admin/email/broadcasts` | Lista campanhas |
| POST | `/admin/email/broadcasts/preview` | Conta destinatários |
| POST | `/admin/email/broadcasts` | Dispara em background |
| GET | `/admin/reengagement/config` | Config |
| PUT | `/admin/reengagement/config` | Atualiza |
| GET | `/admin/reengagement/sent` | Log de envios |
| POST | `/admin/reengagement/run` | `?dryRun=true\|false` |
| GET | `/me/notification-prefs` | Aluno lê |
| PUT | `/me/notification-prefs` | Aluno atualiza |
| GET | `/api/unsubscribe?token=...` | Página pública de opt-out |
| GET | `/admin/email/student-progress` | Config do e-mail semanal de progresso |
| PUT | `/admin/email/student-progress` | Atualiza (enabled, dayOfWeekUtc, hourUtc) |
| GET | `/admin/email/student-progress/status` | `lastRunAt` + `lastResult` do worker |

## E-mail semanal de progresso do aluno

Worker `notifications/student-progress-email` (tick de 1h, dispara uma vez na
janela `dayOfWeekUtc`/`hourUtc`). Para cada aluno **ativo** que não optou por sair
do reengajamento e tem ao menos um curso com progresso, envia um resumo pessoal:
aulas da semana, total acumulado, streak e % por curso.

Default é `enabled: false`. Config em `data/student-progress-email-config.json`
(JsonStore). Auditado como `student_progress_email.config`.

## UI

- `/admin/email` — configs CRUD, templates preview, send test, log
- `/admin/broadcasts` — editor + histórico
- `/admin/reengajamento-auto` — config + dry-run + log
- `/admin/progresso-aluno` — e-mail semanal de progresso: liga/desliga, dia+hora
  UTC (com equivalente BRT) e última execução
