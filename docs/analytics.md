# Analytics

Métricas operacionais e de aprendizagem do AVA. Tudo on-demand, sem warehouse externo.

## Watch time (heartbeat)

`server/repositories/watch-time.ts` agrega segundos por `(userId, lessonId)`.

```ts
// frontend (LMSLesson)
useLessonWatchHeartbeat({ lessonId, courseId, enabled: isEnrolled });
```

Manda `POST /me/lessons/:id/watch { courseId, deltaSeconds: 30 }` a cada 30s **só quando**:
- aluno matriculado
- aba visível (`document.hidden === false`)

Cap de segurança no servidor:
- por chunk: `min(delta, 60)`
- total: `min(total, lessonDuration*1.5 || 4h)`

## Per-course analytics

`GET /admin/courses/:id/analytics`:

```json
{
  "course": { "id", "title", "totalLessons", "totalModules" },
  "enrollment": {
    "total": 120,
    "notStarted": 30,
    "inProgress": 70,
    "completed": 20,
    "avgCompletionPct": 45
  },
  "watchTime": {
    "courseId", "totalSeconds", "uniqueLearners",
    "byLesson": [{ lessonId, totalSeconds, viewers }]
  },
  "rating": {
    "courseId", "count", "avg",
    "distribution": { "1": 0, "2": 1, "3": 2, "4": 8, "5": 10 }
  }
}
```

UI: `/admin/cursos/:id/analytics` — cards (matriculados / completion% / horas / nota) + barras de distribuição + tabela de tempo por aula.

## Per-student analytics

`GET /admin/students/:id/analytics`:

```json
{
  "student": { "id", "name", "email", "status", "createdAt", "lastAccessAt" },
  "enrollment": {
    "total": 3,
    "totalLessonsCompleted": 28,
    "courses": [
      { "courseId", "title", "totalLessons", "completedLessons", "completionPct" }
    ]
  },
  "watchTime": { "totalSeconds", "lessonsTouched" },
  "engagement": {
    "streak": { "current", "longest", "lastActiveDay" },
    "reviewsWritten": 1,
    "achievementsEarned": 4,
    "achievementIds": [...]
  }
}
```

UI: aba "Analytics" em `/admin/alunos/:id`.

## Health snapshot

`server/health/dashboard.ts` agrega 9 sinais:

- Storage backend (Postgres / JSON)
- Gateways de pagamento ativos
- E-mail config (provider + último teste)
- Envios de e-mail 24h
- Webhooks ativos
- Entregas webhook 1h (sucesso vs falha)
- AI configs habilitadas
- Erros 5xx 24h
- Disco ocupado em `data/`

UI: `/admin/saude` com traffic-light geral + cards individuais. Refresh 60s.

## Activity feed

`server/activity/feed.ts` agrega eventos cross-entity em uma timeline única:

| Fonte | Tipo |
|---|---|
| Audit log | `audit` |
| E-mail logs | `email_sent` / `email_failed` |
| Webhook deliveries | `webhook_success` / `webhook_failed` |
| Reengagement sends | `reengagement` |
| Order events | `order_paid` / `order_refunded` / `order_canceled` |

Endpoint:

```
GET /admin/activity?kinds=order_paid,reengagement&q=user@x.com&since=...&until=...&limit=300
```

UI: `/admin/atividade` com chips de filtro coloridos por tipo + busca textual.

## Rate-limit telemetry

`server/rate-limit.ts` mantém ring buffer (10k):

```ts
RateLimitHit { ts, ip, path, method, blocked }
```

`summarize(windowMs)`:

```ts
{
  totalHits, blockedCount, windowMs,
  topIps: [{ ip, count, blocked }],
  topPaths: [{ path, count, blocked }],
  recentBlocks: [{ ts, ip, path, method }]  // últimos 50
}
```

UI: `/admin/rate-limits` com janelas 1h/6h/24h/7d, gráfico de barras inline (largura proporcional ao max), tabela de blocks recentes.

## Audit by day

`server/audit/log.ts:auditByDay(days)` retorna histograma diário `{ day, ok, error, total }`. Usado em dashboards e gráficos.

## Stats endpoints existentes

| Endpoint | Para |
|---|---|
| `/admin/stats/completions?days=30` | Conclusões de aula por dia |
| `/admin/stats/tutor-usage?days=30` | Uso do Tutor IA |
| `/admin/stats/errors?days=7` | Crashes 5xx por dia |

## Workflow recomendado p/ análise externa

1. Cria API token com escopo `stats:read,orders:read` em `/admin/api-tokens`
2. Conecta seu BI (Looker, Power BI, Metabase) via REST connector
3. URL base: `https://.../api/v1/stats/summary` ou `/v1/orders?...`
4. Refresh agendado lá

Para análise mais profunda (data scientist), pode-se exportar via:
- `/admin/users/export.csv`
- `/admin/orders/export.csv`
- `/admin/courses/export.csv`
- `/admin/imports/jobs/:id/export?format=json`

## Tests

Lógica de agregação é puro Map+filter — não tem tests dedicados ainda. Eventual sprint pode adicionar test cobrindo `aggregateLesson`, `aggregateCourse`, `streakInfo`.
