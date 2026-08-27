# Operações administrativas

Conjunto de ferramentas para o admin operar o AVA com eficiência: bulk actions, busca global, jobs, logs, atividade, backup, etc.

## Setup checklist (`/admin/setup`)

Mostra status de 8 itens críticos com link rápido pra resolver cada um:

| Item | Verificado em |
|---|---|
| Configurações instituição | `app-settings.json` (sempre OK, default existe) |
| E-mail config (não-mock) | `email-configs` enabled e provider != mock |
| Gateway ativo | `payment-gateways` algum active |
| Produtos cadastrados | `products` algum active |
| Catálogo de cursos | `courses` length > 0 |
| Senha admin trocada | `tokenVersion > 0` |
| Mais de 1 usuário | `users` length > 1 |
| 2FA do admin atual | `totpEnabled === true` |

Endpoint `GET /admin/setup/status` retorna `{ total, ok, progressPct, items[] }`.

## Bulk actions de usuários

`POST /admin/users/bulk` aceita ids[] + action:

| Action | O que faz | Extras |
|---|---|---|
| `activate` | seta active=true | — |
| `deactivate` | seta active=false (bumpa tv) | — |
| `delete` | deleteUser | — |
| `unenroll` | unenrollFromCourse | `courseId` |
| `sendEmail` | sendSafe per user | `subject, html, text?` |
| `forceLogout` | bumpTokenVersion | — |

UI: `AdminUsuarios.tsx` ganhou checkboxes + barra de ação contextual quando há seleção.

## Search global (Ctrl+K)

`server/search/admin-search.ts` varre cursos/módulos/aulas/biblioteca/news/podcasts/users/orders/products. Endpoint `GET /admin/search?q=`.

Componente `AdminSearchPalette` (montado no `AdminLayout`):
- Atalho `Cmd/Ctrl+K`
- Navegação por `↑/↓/Enter`
- Badges coloridos por tipo
- Limite 30 resultados

## Saved searches

Filtros persistidos por owner+scope.

```ts
SavedSearchScope =
  | 'students' | 'orders' | 'imports'
  | 'activity' | 'rate-limits' | 'logs' | 'broadcasts'
```

Componente reusável `<SavedSearchesBar scope={...} currentFilters={...} onApply={fn} />` exibe chips, salvar atual e remover.

Plugado em `AdminOrders` (filter status + search). Para adicionar a outras páginas: passa `currentFilters` (objeto serializável) e implementa `onApply`.

Endpoints:

```
GET /admin/saved-searches?scope=...
POST /admin/saved-searches { scope, name, filters }
PUT/DELETE /admin/saved-searches/:id
```

## Jobs / workers

`/admin/jobs` mostra status dos workers ativos:

| Job | Intervalo | Função |
|---|---|---|
| `webhooks` | 30s | Processa pendentes/retrying |
| `reengagement` | 24h | Detecta inativos e dispara e-mails |

Cada um expõe `getStatus()` retornando `{ name, enabled, intervalMs, lastRunAt, totalTicks, ... }`.

```
POST /admin/jobs/:name/run                  # tick imediato
POST /admin/jobs/reengagement/run?dryRun=true   # dry-run
```

## Logs do servidor

`server/monitoring/log-buffer.ts` instala captura de console.log/warn/error/info/debug em ring de 5000 linhas (in-memory).

```
GET /admin/logs?level=error&q=foo&limit=500
```

UI `/admin/logs` com auto-refresh 5s, filtro por nível e busca.

## Rate-limit dashboard

`/admin/rate-limits` mostra top IPs, top paths, blocks recentes (429). Janelas: 1h/6h/24h/7d. Refresh 10s.

## Activity feed

`server/activity/feed.ts` agrega:
- Audit log
- E-mail logs (sent/failed)
- Webhook deliveries (success/failed)
- Reengagement sends
- Order events (paid/refunded/canceled)

Endpoint `GET /admin/activity?kinds=...&q=...&since=...&until=...&limit=...`.

UI `/admin/atividade` com chips de filtro por tipo + busca textual + timeline visual.

## Health check

`server/health/dashboard.ts` agrega:
- Storage backend (Postgres ou JSON)
- Gateways ativos
- E-mail config + envios 24h
- Webhooks ativos + entregas 1h
- AI configs habilitadas
- Erros 5xx (24h)
- Disco ocupado em `data/`

Overall traffic-light: ok (todos OK), warn (algum warn), error (algum error).

UI `/admin/saude` com cards e refresh 60s.

## Backup/Restore de configs

`/admin/backup`:

- **Export**: `GET /admin/settings/backup` → JSON v1 com `gateways, products, coupons, email-configs, webhook-endpoints, reengagement-config, login-config, app-settings, ai-configs, import-connections, api-tokens`. **Não inclui** users/orders/audit.
- **Restore**: `POST /admin/settings/restore` com payload JSON + `dryRun?: boolean`. Whitelist explícita; arquivos não permitidos são ignorados.

Credenciais já estão criptografadas com a master key — backup sem master key não decripta.

## CSV exports

Helper genérico `server/export/csv.ts` (RFC 4180 + BOM UTF-8 para Excel BR):

| Recurso | Endpoint |
|---|---|
| Usuários | `GET /admin/users/export.csv` |
| Pedidos | `GET /admin/orders/export.csv` |
| Cursos | `GET /admin/courses/export.csv` |
| Audit log | `GET /admin/audit-log.csv` |

UI tem botões "Exportar CSV" nas listas correspondentes.

## Course duplicate

`POST /admin/courses/:id/duplicate` clona um curso completo (módulos + aulas + assessment) gerando novos IDs e slug `<orig>-copia-<rand>`. Funciona em modo JSON; em modo DB lança 501.

UI: ícone Copy na lista de cursos.

## Course preview

`/admin/cursos/:id/preview` renderiza experiência do aluno (read-only, sem afetar progresso). Banner laranja "MODO PREVIEW".

## Per-course analytics

`GET /admin/courses/:id/analytics` retorna:
- enrollment (total + completion% médio + distribuição started/inProgress/completed)
- watchTime aggregateCourse
- rating summary (avg + count + distribuição estrelas)

UI `/admin/cursos/:id/analytics` com cards e tabela de tempo por aula.

## Per-student analytics

`GET /admin/students/:id/analytics` retorna por aluno:
- enrollment (total + completion% por curso)
- watchTime total + lessons tocadas
- streak (current + longest)
- reviews escritas + achievements

UI: aba "Analytics" em `/admin/alunos/:id`.

## Discussão por aula

`server/discussions/store.ts` — comentários por lessonId com 1 nível de resposta. Aluno matriculado posta; admin sempre posta. Admin pode pin/hide/delete.

UI: componente `LessonComments` inline na `LMSLesson`.

## Notas internas por aluno

`server/admin/notes-store.ts` — notas privadas (não-visíveis ao aluno) com pin/edit/delete. Endpoints `GET/POST/PUT/DELETE /admin/students/:id/notes[/:noteId]`.

UI: aba "Notas" em `/admin/alunos/:id`.


## Integrações — `GET /admin/integracoes`

**Desde 27/ago/2026.** A aba "Integrações" de `/admin/configuracoes` mostrava
cinco nomes com o selo "não conectado" escrito à mão no `.tsx`, mais a frase
"Atualmente nenhum provedor terceiro está conectado".

Mentia nos dois sentidos: dizia "Stripe: não conectado" com um gateway Stripe
ativo processando pagamento, e "Mailgun/SES: não conectado" com provedor de
e-mail configurado e testado. E listava Google Calendar, que não existe no
código.

`server/health/integracoes.ts` apura cada linha a partir de registro. **Três
estados**, e a diferença entre os dois últimos é o que a lista antiga não sabia
dizer:

| Estado | Significa |
| --- | --- |
| `conectado` | Há configuração ativa e utilizável |
| `disponivel` | O código existe, falta configurar (com link para onde) |
| `inexistente` | Não há integração no sistema — não adianta procurar |

Duas regras de classificação que evitam repetir o defeito:

- **Gateway `mock` ativo não é "conectado".** Ele existe para testar sem
  cobrar; marcá-lo como integração ativa esconderia que nenhum dinheiro entra.
  O mesmo vale para o provedor de e-mail `mock`.
- **Configuração de IA ativa sem chave não é "conectado".** A semente cria
  configurações marcadas como ativas sem credencial; contá-las diria que a IA
  está no ar quando a primeira chamada falharia.
