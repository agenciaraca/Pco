# Webhooks de saída

Sistema de outbound webhooks com retry exponencial, formatos múltiplos (genérico/Slack/Discord) e assinatura HMAC-SHA256.

## Modelo

`server/webhooks/types.ts`:

```ts
WebhookEndpoint {
  id, name, url, enabled,
  events: WebhookEventType[],
  channelType: 'generic' | 'slack' | 'discord',  // default generic
  secretEncrypted?: string,    // HMAC secret (só usado em generic)
  headersEncrypted?: string,   // JSON com headers extras
  lastSuccessAt, lastFailureAt, lastErrorMessage
}

WebhookDelivery {
  id, endpointId, event, payload,
  status: 'pending' | 'success' | 'failed' | 'retrying',
  attempts, nextAttemptAt,
  lastResponseStatus, lastResponseBody, lastError
}
```

## Eventos disponíveis

```
order.paid | order.canceled | order.refunded |
enrollment.created | user.created |
course.completed | lesson.completed
```

(Veja `ALL_WEBHOOK_EVENTS` em `types.ts`.)

## Disparo

`server/webhooks/dispatcher.ts`:

```ts
emit(event, payload)
  → para cada endpoint enabled inscrito no evento:
       deliveries.create({...})
  → tickWorker() (não bloqueia)
```

`emit()` é chamado em `app.ts` no webhook de pagamento (`order.paid|canceled|refunded`) e na refund route. Para os outros eventos, basta chamar onde fizer sentido.

## Worker

`startWorker(intervalMs = 30_000)` em `dev.ts` roda `tickWorker()` a cada 30s:

```
pendentes = deliveries.pending()  // status pending|retrying com nextAttemptAt vencido
for (d of pendentes) deliverOne(d)
```

`deliverOne()`:

1. Busca endpoint, decripta secret/headers
2. `renderBody(endpoint, delivery, ts)` formata por channelType
3. POST com timeout 15s, headers:
   - `Content-Type: application/json`
   - `User-Agent: AVA-PCO-Webhook/1.0`
   - `X-AVA-PCO-Event: <event>`
   - `X-AVA-PCO-Delivery: <deliveryId>`
   - `X-AVA-PCO-Signature: t=<unix>,v1=<hex>` (só no generic com secret)
4. Status 2xx → `success`. Caso contrário → `scheduleRetryOrFail()`.

## Retry exponencial

```ts
RETRY_DELAYS_MS = [
  60_000,           // 1 min
  5 * 60_000,       // 5 min
  30 * 60_000,      // 30 min
  2 * 60 * 60_000,  // 2 h
];
MAX_ATTEMPTS = 5
```

Após 5 tentativas: status `failed`. Admin pode forçar retry via UI.

## Formato genérico

```json
{
  "id": "whd-...",
  "event": "order.paid",
  "created": "2024-03-15T10:00:00Z",
  "data": {
    "orderId": "ord-...",
    "userId": "user-...",
    "userEmail": "x@x.com",
    "productName": "Curso Y",
    "amountCents": 49700,
    "currency": "BRL",
    "paidAt": "..."
  }
}
```

Verificação HMAC (Node):

```ts
const sigHeader = req.headers['x-ava-pco-signature'];
const t = sigHeader.match(/t=(\d+)/)[1];
const v1 = sigHeader.match(/v1=([a-f0-9]+)/)[1];
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(`${t}.${rawBody}`)
  .digest('hex');
if (!timingSafeEqual(v1, expected)) throw new Error('invalid signature');
// (opcional) checa que t é recente (<5min)
```

## Formato Slack

`channelType=slack` → não usa HMAC. URL deve ser um Slack incoming webhook (`hooks.slack.com/services/...`).

Payload com `text` (header) + `blocks` (header + section com fields + context com delivery id).

## Formato Discord

`channelType=discord` → URL deve ser um Discord webhook (`discord.com/api/webhooks/...`).

Payload com `embeds[0]` contendo title, description, color (verde paid, laranja refunded, cinza canceled), fields, footer.

## Endpoints admin

| Verbo | Path | O que faz |
|---|---|---|
| GET | `/admin/webhooks/events` | Lista eventos disponíveis |
| GET | `/admin/webhooks/endpoints` | Lista (sem secrets) |
| POST | `/admin/webhooks/endpoints` | Cria com channelType + events |
| PUT/DELETE | `/admin/webhooks/endpoints/:id` | Atualiza/remove |
| POST | `/admin/webhooks/endpoints/:id/test` | testEndpoint() — manda payload de teste |
| GET | `/admin/webhooks/deliveries` | `?endpointId=...&limit=...` |
| POST | `/admin/webhooks/deliveries/:id/retry` | resetForRetry + tickWorker imediato |

## UI

- `/admin/webhooks` — CRUD de endpoints + teste + log de entregas com botão retry

## Tests

`test/webhook-signer.test.ts` cobre HMAC formato + determinismo + verificação manual.
`test/webhook-formatters.test.ts` cobre Slack blocks, Discord embeds, cor por evento.
