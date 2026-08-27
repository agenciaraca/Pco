# Analytics

Métricas operacionais e de aprendizagem do AVA. Tudo on-demand, sem warehouse externo.

## Tráfego do site — medição própria

**Desde 27/ago/2026.** Antes disso, `/admin/metricas` era três quartos ficção:
origem do tráfego, páginas mais acessadas, dispositivos, SEO técnico e as
"recomendações" eram constantes escritas à mão dentro do `.tsx`, e a série vinha
da semente. Um admin podia olhar "52% de tráfego orgânico" e decidir investir em
SEO com base em nada.

Agora o próprio servidor mede. Não há Google Analytics, não há cookie e não há
IP guardado.

### Como funciona

| Peça | Onde | O quê |
| --- | --- | --- |
| Beacon | `src/app/analytics/beacon.ts` | `POST /analytics/hit` a cada página aberta, via `sendBeacon` |
| Coletor | `server/analytics/collector.ts` | Sessões em memória (TTL 30 min) + agregação por dia |
| Persistência | `server/analytics/traffic-store.ts` | `analytics_daily` (DB) ou `data/analytics-daily.json` |
| Relatório | `server/analytics/relatorio.ts` | `GET /admin/analytics/trafego?range=` |

O sinal carrega **cinco campos e nada mais**: caminho, referrer (só na primeira
página), `utm_medium`, se caiu no 404, e o LCP que o navegador mediu. O
`sessionId` é gerado no `sessionStorage` da aba, vive na memória do processo e
**nunca é gravado** — o que vai ao disco é contador por dia.

### O que é medido, e como

- **Visitantes** = sessões iniciadas. **Pageviews** = páginas abertas.
- **Rejeição**: toda sessão nasce como rejeição; a segunda página desfaz —
  no total do dia e na página de entrada.
- **Tempo**: soma dos intervalos entre páginas da mesma sessão. Quem vê uma
  página só contribui com zero, o que é honesto: não há como saber.
- **Origem**: classificada na primeira página. `utm_medium` vence o referrer.
  Referrer do próprio domínio não é origem nova.
- **Dispositivo**: user-agent, no servidor. O UA não é gravado.
- **LCP**: histograma de 25 faixas de 250 ms, o que permite p75 sem guardar
  amostra. `null` — não zero — quando não houve amostra.
- **404**: rotas em que o SPA caiu no `NotFound` (rota com `id: 'not-found'`).

### O que NÃO é medido, e por quê

Posição em busca, volume de pesquisa, CTR, páginas indexadas e score de SEO
dependem do **Google Search Console**, que depende de credencial do dono.
`GET /metrics/seo/keywords` devolve `[]` e a tela lista essas lacunas em vez de
estimá-las. `fonteDasMetricas()` continua sendo o ponto único que muda no dia em
que a credencial chegar.

### Três decisões que parecem detalhe e não são

1. **`/admin/*` não é contado.** Medir a navegação de quem administra inflaria
   justamente o número que o administrador olha.
2. **Bot conhecido é descartado**, e requisição sem user-agent também. Sem isso,
   o primeiro rastreador devolveria a tela ao mesmo lugar de antes.
3. **`null` nunca vira zero.** Zero diz "medi e não houve"; travessão diz "não
   medi". Confundir os dois foi o defeito original desta tela.

**Do Not Track não é respeitado, deliberadamente.** DNT pede para não ser
rastreado *entre sites*; aqui o dado nasce e morre no domínio, é contador
agregado e nada aponta para uma pessoa. Honrar o cabeçalho devolveria ao admin
uma subcontagem silenciosa. Se algo aqui um dia identificar visitante, essa
decisão cai junto.

### Limites conhecidos

- **Vercel**: a tabela de sessões vive na memória do processo. No VPS é exata;
  em Functions, pageviews continuam certas e sessão/rejeição/tempo viram
  subestimativa — a mesma nota que já vale para os workers.
- **Escrita agrupada** a cada 5 s. `SIGTERM`/`SIGINT` fazem `flush()` antes de
  sair (`server/dev.ts`), então restart não perde contagem.
- **Cardinalidade**: no máximo 400 caminhos distintos por dia; o excedente cai
  em `(outras)`. Ids viram `:id`, mas slug com hífen é preservado — a regra
  exige dígito no sufixo justamente para não engolir `/pagina-inexistente`.

## Retenção pedagógica — `/admin/retencao`

**Desde 27/ago/2026.** Antes disso a tela era *inteiramente* fabricada: quatro
KPIs em string fixa, uma curva de coorte com três cursos que nem são os do
catálogo, e — o pior — um gráfico que pegava o **nome real** do curso e colava
em cima um número de uma lista `[64, 52, 71]`. Rótulo verdadeiro com valor
inventado passa por conferência; é mais perigoso do que ficção assumida.

`GET /admin/analytics/retencao` (`server/analytics/retencao.ts`) calcula sobre
registros que já existiam: `admin-students`, `watch-time` e o histórico de
envios do reengajamento (`reengagement-sent.json`, que já era persistido).

### A regra do denominador

**Nenhum percentual sai sem a base que o gerou** — o tipo `Medida` é
`{ pct: number | null; base: number }`, e a tela mostra os dois. Um "58%"
sozinho não deixa ninguém desconfiar; "58% de 10.205 matrículas" num sistema
com 785 alunos denuncia sozinho o problema de dados da migração
(`docs/migration-wp-ld.md`) em vez de escondê-lo atrás de uma porcentagem
redonda.

### Curva de coorte: censura à direita

Na semana N só entram matrículas com **pelo menos N semanas de idade**. Sem
isso, quem entrou ontem apareceria como "abandonou na semana 12" e a curva
despencaria por artefato de cálculo. `basePorCurso` acompanha cada ponto, e
curso sem ninguém elegível devolve `null` — a linha some do gráfico em vez de
virar uma reta em zero.

As janelas (idade × sobrevivência) são resolvidas **uma vez**, fora do laço de
semanas: 13 cursos × ~2000 alunos × 9 semanas com `includes` e `Date.parse`
dentro seria timeout.

### Impacto do reengajamento

Um envio só ganha o crédito do retorno se o acesso caiu na janela **entre ele e
o envio seguinte** ao mesmo aluno. Sem essa regra, quem recebeu três e-mails e
voltou depois do terceiro daria crédito aos três, e a taxa viraria 100% por
construção.

### O que continua sem medição

- **Ritmo em horas/semana**: `watch-time` guarda só o total acumulado por aula,
  sem série temporal — não há como recortar por semana.
- **Coorte com precisão por curso**: `lastAccessAt` é do aluno, não por curso;
  quem estuda dois aparece ativo nos dois.

Ambos aparecem na tela, na seção "O que esta tela não mede", com o motivo.

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
