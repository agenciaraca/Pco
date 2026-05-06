# Cookbook de webhooks

Receitas práticas pra integrar o AVA PCO com serviços externos via webhooks.
Para a referência técnica geral (HMAC, retry, eventos), veja [webhooks.md](./webhooks.md).

---

## Índice rápido

1. [Slack — notificação de venda no canal](#receita-1-slack)
2. [Discord — alerta de novo aluno](#receita-2-discord)
3. [Zapier — adicionar aluno em planilha Google Sheets](#receita-3-zapier-google-sheets)
4. [n8n self-hosted — disparar Mailchimp em conclusão de curso](#receita-4-n8n-mailchimp)
5. [Make / Integromat — sincronizar pedido com CRM](#receita-5-make-crm)
6. [Pipedream — auto-postar nota de conclusão no Notion](#receita-6-pipedream-notion)
7. [Endpoint genérico próprio — verificar HMAC](#receita-7-endpoint-genérico)

---

## Eventos disponíveis

| Evento | Quando dispara | Payload típico |
|---|---|---|
| `order.paid` | Order muda pra status=paid | `{orderId, userId, productId, amountCents, ...}` |
| `order.canceled` | Order muda pra canceled | `{orderId, userId, ...}` |
| `order.refunded` | Refund concluído | `{orderId, refundedCents, ...}` |
| `enrollment.created` | Aluno matriculado em curso | `{userId, courseId, ...}` |
| `user.created` | Novo cadastro de aluno | `{userId, email, name, ...}` |
| `course.completed` | Aluno completou 100% das aulas | `{userId, courseId, ...}` |
| `lesson.completed` | Aluno marcou aula como concluída | `{userId, lessonId, courseId, ...}` |

Todos os payloads são embrulhados em:

```json
{
  "event": "order.paid",
  "data": { ... },
  "deliveryId": "del-abc123",
  "ts": "2026-05-06T14:00:00.000Z"
}
```

---

## Receita 1: Slack

**Use caso:** Postar mensagem em #vendas toda vez que um pedido for pago.

1. No Slack, vá em https://api.slack.com/apps → **Create New App** → **From scratch**.
2. Escolha o workspace e nome (ex.: "AVA PCO Webhooks").
3. **Incoming Webhooks** → **Activate Incoming Webhooks** → **Add New Webhook to Workspace**.
4. Selecione o canal (ex.: `#vendas`) → **Allow**.
5. Copie o URL: `https://hooks.slack.com/services/T.../B.../xxxx`.
6. No AVA PCO: `/admin/webhooks` → **Novo webhook** → escolha preset **Slack**.
7. Cole o URL no campo apropriado e selecione `order.paid` como evento.
8. **Salvar** → **Testar endpoint** pra confirmar.

A mensagem chega no Slack formatada com nome do produto + valor + e-mail do cliente.

---

## Receita 2: Discord

**Use caso:** Alerta no canal #ops quando novo aluno se cadastra.

1. No Discord, **Configurações do canal** → **Integrações** → **Webhooks** → **Novo Webhook**.
2. Dê um nome (ex.: "AVA PCO bot") e copie o URL.
3. No AVA PCO: preset **Discord** → cole URL → evento `user.created`.

A mensagem aparece no canal com avatar do bot e formato markdown.

---

## Receita 3: Zapier — Google Sheets

**Use caso:** Toda matrícula vira uma linha em planilha Google Sheets.

1. No Zapier: **Create Zap**.
2. **Trigger:** "Webhooks by Zapier" → "Catch Hook" → **Continue** → copie o URL gerado.
3. No AVA PCO: preset **Zapier** → cole URL → evento `enrollment.created`.
4. **Testar endpoint** pra Zapier capturar o exemplo de payload.
5. Volte ao Zapier → **Test Trigger** → deve aparecer o payload do AVA.
6. **Action:** "Google Sheets" → "Create Spreadsheet Row".
7. Mapeie campos:
   - Email → `data.userEmail`
   - Curso → `data.courseId`
   - Data → `ts`
8. **Publish Zap**.

Pronto. Toda matrícula nova vira linha automaticamente.

---

## Receita 4: n8n self-hosted — Mailchimp

**Use caso:** Quando aluno completa um curso, adiciona-o em audience do Mailchimp pra campanha pós-curso.

1. No n8n: **Workflows** → **New** → adicione nó **Webhook** (HTTP method: POST).
2. **Save** → o nó vira "Active". Copie o **Production URL** (não o Test URL).
3. No AVA PCO: preset **n8n** → cole URL → evento `course.completed`.
4. No n8n, adicione nó **Mailchimp** → **Add or Update Subscriber**.
5. Configure:
   - List/Audience: a sua audience
   - Email: `={{ $json.body.data.userEmail }}`
   - Tags: `["course-completed", "{{ $json.body.data.courseId }}"]`
6. **Activate workflow**.

---

## Receita 5: Make (Integromat) — CRM

**Use caso:** Sincronizar pedidos pagos com pipeline do CRM (HubSpot/Pipedrive).

1. No Make: **Scenarios** → **+** → busque por **Webhooks**.
2. **Custom webhook** → **Add** → **Save**.
3. Make gera um URL `https://hook.eu1.make.com/...`. Copie.
4. No AVA PCO: preset **Make** → cole URL → eventos `order.paid` e `order.refunded`.
5. **Run once** no Make pra capturar o payload de exemplo.
6. **Testar endpoint** no AVA → Make recebe e mostra estrutura.
7. Adicione módulo do seu CRM (ex.: HubSpot **Create Deal**) e mapeie:
   - Deal Name: `data.productSnapshot.name`
   - Amount: `data.amountCents / 100`
   - Email contato: `data.userEmail`

---

## Receita 6: Pipedream — Notion

**Use caso:** Cada certificado emitido vira página em database Notion (registro pedagógico).

1. No Pipedream: **New Workflow** → **HTTP / Webhook** trigger.
2. Copie o URL gerado.
3. No AVA PCO: preset **Pipedream** → cole URL → evento `course.completed`.
4. No Pipedream, adicione step **Notion** → **Create Page in Database**.
5. Configure database ID e mapeie propriedades:
   - Aluno: `steps.trigger.event.body.data.userEmail`
   - Curso: `steps.trigger.event.body.data.courseId`
   - Data conclusão: `steps.trigger.event.body.ts`
6. **Deploy**.

---

## Receita 7: Endpoint genérico

Se você tem um servidor próprio, use o preset **Genérico**. O AVA assina cada payload com HMAC SHA-256:

```http
POST /seu-endpoint HTTP/1.1
Content-Type: application/json
User-Agent: AVA-PCO-Webhook/1.0
X-AVA-PCO-Event: order.paid
X-AVA-PCO-Delivery: del-abc123
X-AVA-PCO-Signature: t=1714...,v1=4d8a...

{"event":"order.paid","data":{...},"deliveryId":"del-abc123","ts":"..."}
```

Verificação no Node:

```ts
import crypto from 'node:crypto';

function verifyWebhook(rawBody: string, sigHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => kv.split('=')),
  );
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Anti-replay: só aceita se ts está dentro de 5 min
  const ageMs = Date.now() - Number(ts) * 1000;
  if (ageMs < 0 || ageMs > 5 * 60_000) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

**Importante:** o `secret` está em `/admin/webhooks` → editar endpoint → copiar antes de salvar (não é exibido depois). Use timingSafeEqual pra evitar timing attacks.

---

## Troubleshooting

### Webhook fica "retrying"

- Endpoint está respondendo HTTP != 2xx. Veja o histórico de entregas em `/admin/webhooks/:id/deliveries`.
- AVA tenta 5x com backoff: 1m, 5m, 30m, 2h.

### Slack/Discord não recebem

- O channelType está correto? `slack` formata como Block Kit, `discord` como embed. `generic` envia raw JSON que esses serviços não entendem.
- O preset pré-configura tudo — se mudou pra `generic` manualmente, volte pra `slack`/`discord`.

### Como testar localmente

- Use [webhook.site](https://webhook.site) ou [requestbin.com](https://requestbin.com) pra inspecionar o payload sem precisar de servidor.
- Cole o URL do bin no AVA → **Testar endpoint** → veja chegando em real-time.

### Como rotacionar secret

- `/admin/webhooks/:id` → **Editar** → preencher novo secret → **Salvar**.
- Coordene com o consumidor antes pra evitar gap de minutos.

---

## Limites e quotas

- **120 req/min** por endpoint (rate limit interno antes de enviar).
- **5 retries máximo** por delivery, depois marca como `failed`.
- **Body máximo aceito**: 1 MB (truncado em logs).

---

## Próximas adições no roadmap

- Webhook outbox event filter (só dispara se condição match no payload).
- Replay manual de delivery falha pelo admin UI.
- Webhook test events sintéticos (forge `order.paid` fake pra testar fluxo sem comprar).
