# Importador WP/LD/WC

Módulo isolado para importar dados de WordPress + LearnDash + WooCommerce. Suporta CSV ou conexão API. Tudo aditivo — não altera fluxos existentes.

## Visão geral

```
ImportConnection (encrypted creds)
      │
      ▼
collectFromApi() ──► rowsByEntity per entity
      │                          │
   (ou CSV)                      ▼
                       runDryRun / runReal
                                 │
                  ┌──────────────┼─────────────┐
                  ▼              ▼             ▼
            normalizers      validators     adapters
              (rows →        (errors)       (persiste
            Normalized*)                   via repos)
                                                │
                                         enrollment-engine
                                         (start/expiration)
                                                │
                                          refs-store
                                       (idempotência)
```

## Entidades

```
student | course | module | lesson | product | order | enrollment | progress
```

Tipos normalizados em `server/imports/types.ts` (`NormalizedStudent`, etc).

## CSV

### Templates

`server/imports/schemas/csv-templates.ts` — 8 entidades, cada uma com:

```ts
{ entity, filename, fields: [{ name, label, required, example, description }] }
```

Geração via `generateCsvTemplate(entity)` → string com BOM UTF-8 + cabeçalho + linha de exemplo + linha em branco.

### Parser

`server/imports/connectors/csv.ts` — RFC 4180-ish, sem deps:

- Auto-detect separador `,` ou `;` no header
- BOM UTF-8 stripado em `parseCsvBuffer`
- Aspas duplas escapam, `""` = aspa literal
- Multi-line dentro de aspas funciona
- CRLF/LF/CR

### Pipeline

```
row (Record<string,string>)
  → mapping (source→target + transforms + required check)
  → normalizers (NormalizedStudent, etc)
  → validators (errors com field+message)
  → adapter (upsert via repo do AVA)
```

## API (WordPress + LearnDash + WooCommerce)

`server/imports/connectors/wp.ts` — `/wp-json/wp/v2/users` (Application Password)
`server/imports/connectors/ld.ts` — `/wp-json/ldlms/v2/sfwd-courses|sfwd-lessons` + cursos→users
`server/imports/connectors/wc.ts` — `/wp-json/wc/v3/products|orders` (consumer_key/secret)
`server/imports/connectors/orchestrator.ts` — `collectFromApi()` agrega entidades

### ConnectionStore

```ts
ImportConnection {
  id, name, kind: 'wp_ld_wc', siteUrl,
  wpUsername, wpAppPasswordEncrypted,
  wcConsumerKeyEncrypted, wcConsumerSecretEncrypted,
  lastTestedAt, lastTestStatus, lastTestMessage
}
```

Botão "Testar" chama `pingWp()` e `pingWc()` em paralelo.

## Mapping + Transforms

`server/imports/pipeline/mapping.ts`:

```ts
MappingFieldConfig { source, target, required?, transforms?, default? }
applyMapping(row, config) → mappedRow
```

`server/imports/pipeline/transforms.ts` — 14 transforms reusáveis:

```
trim, lowercase, uppercase, titlecase
parse_date, parse_datetime
parse_money (BR: R$ 1.234,56 / US: 1,234.56 / 199.90)
parse_boolean (true/yes/sim/1/false/no/0)
parse_int, parse_float
split_pipe, split_comma, split_semicolon
strip_html, sanitize_html
extract_video_url
normalize_phone, normalize_document
default_if_empty
```

E mapa pronto `DEFAULT_WC_STATUS_MAP`:

```
completed → active
processing|pending|on-hold → pending
cancelled|refunded|failed → cancelled
```

## Enrollment engine

`server/imports/pipeline/enrollment-engine.ts` decide datas de matrícula com base em regras configuráveis:

### startRule

| Valor | Significa |
|---|---|
| `paid_date` | order.paidDate ?? completedDate ?? orderDate ?? now |
| `completed_date` | order.completedDate ?? paidDate ?? orderDate ?? now |
| `order_date` | order.orderDate ?? now |
| `imported` | enrollment.enrollmentStartDate ?? now |
| `now` | new Date() |

### expirationRule

| Valor | Significa |
|---|---|
| `lifetime` | null |
| `course_fixed_end` | course.accessExpiresAt |
| `explicit` | enrollment.enrollmentExpirationDate |
| `start_plus_duration` | startDate + duration days |
| `order_plus_duration` | orderDate + duration days |
| `paid_plus_duration` | paidDate ?? completedDate + duration |
| `completed_plus_duration` | completedDate + duration |

`duration` é resolvido por: `enrollment.accessDurationDays > course.accessDurationDays > defaultAccessDurationDays`.

## Idempotência

`server/imports/refs-store.ts` mantém tabela `external_references`:

```ts
{ sourceType, externalEntityType, externalId, internalEntityType, internalId, jobId }
```

Reimport não duplica: o adapter procura por `(source, entityType, externalId)` antes de criar. Se existir, aplica `conflictStrategy`:

| Strategy | Comportamento |
|---|---|
| `ignore` | pula |
| `update` (default) | atualiza campos seguros |
| `merge` | combina (prefere não-vazio) |
| `error` | reporta erro |

## Dry-run vs real

`runDryRun(rowsByEntity, jobId)`:
- Roda mapping + validators + normalizers
- NÃO chama adapters
- Atualiza stats: `read/valid/invalid/errors`
- Logs `errorsLog` (até 1000)

`runReal(rowsByEntity, jobId, source, enrollmentRules)`:
- Mesmo pipeline, mas chama adapters
- Persiste em `usersStore`, `productsRepo`, `studentsRepo` (enroll), refs-store
- Stats incluem `created/updated/ignored`
- Order de processamento: `course → student → product → order → enrollment → progress → module → lesson`

## Histórico

`server/imports/job-store.ts` persiste cada job com status, perEntity stats, errorsLog (1000), notes (500), createdRefs.

`server/imports/reports.ts`:
- `exportJobAsCsv(jobId)` — relatório completo
- `exportJobAsJson(jobId)` — incluindo external-refs criadas
- `listJobsFiltered(filter)` com filtros (status, source, mode, dryRun, datas, q)

## Rollback

`server/imports/rollback.ts`:

- Remove todas as `external_references` do job (job criou, job derruba)
- Desativa products criados pelo job
- NÃO deleta students, enrollments, orders (mantém histórico)
- Marca job.status = `rolled_back`
- Append nota `[rollback] ...`

`previewRollback(jobId)` retorna o que SERIA removido sem executar.

## Endpoints

| Verbo | Path | O que faz |
|---|---|---|
| GET | `/admin/imports/templates` | Lista 8 templates |
| GET | `/admin/imports/templates/:entity` | Download CSV |
| GET | `/admin/imports/jobs` | Lista filtrada |
| GET | `/admin/imports/jobs/:id` | Detalhe |
| GET | `/admin/imports/jobs/:id/export` | `?format=csv\|json` |
| GET | `/admin/imports/jobs/:id/rollback/preview` | Preview |
| POST | `/admin/imports/jobs/:id/rollback` | Executa |
| POST | `/admin/imports/dry-run/csv` | Multipart `file_<entity>` |
| POST | `/admin/imports/run/csv` | Multipart + enrollment rules |
| GET | `/admin/imports/connections` | Lista conexões API |
| POST | `/admin/imports/connections` | Cria (encripta) |
| PUT/DELETE | `/admin/imports/connections/:id` | Atualiza/remove |
| POST | `/admin/imports/connections/:id/test` | Ping WP+WC |
| POST | `/admin/imports/run/api` | Body: `{connectionId, entities, dryRun, enrollment}` |

## UI admin

- `/admin/imports` — dashboard com cards (CSV / API), templates, jobs recentes
- `/admin/imports/wizard` — upload CSV multi-entidade + regras de matrícula
- `/admin/imports/wizard-api` — CRUD conexões + checkboxes de entidades
- `/admin/imports/history` — listagem com filtros (status/source/mode/dryRun/data/q)
- `/admin/imports/jobs/:id` — KPIs, perEntity, logs, errors, export, rollback

## Tests

`test/csv-parser.test.ts`, `test/transforms.test.ts`, `test/enrollment-engine.test.ts` cobrem o miolo (~30 testes).
