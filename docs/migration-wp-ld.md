# Migração WP/LD/WC → ava.psicanaliseclinica.online

Inventário e plano de migração descobertos em 2026-05-14/15 a partir dos
dois sites WordPress de origem. Este doc é o ponto de continuidade — releia
no início de cada sessão de trabalho na migração.

## Arquitetura dos sites de origem

Os dois sites têm papéis diferentes — não duplicam dados:

| Site                          | Papel              | Stack relevante                                  |
| ----------------------------- | ------------------ | ------------------------------------------------ |
| **portalpco.online**          | LMS (estudo)       | LearnDash 4.x (`ldlms/v1` + `ldlms/v2`), Uncanny Owl Pro, AutomatorWP, ActiveCampaign, MWAI |
| **psicanaliseclinica.online** | Loja + funil + CRM | WooCommerce 8.x (`wc/v3`), Funnel Kit, Mailchimp, ActiveCampaign, **endpoint MCP habilitado** |

`portalpco` **não tem WooCommerce**. `psicanaliseclinica` **não tem LearnDash**.
Os usuários são distintos em cada site (IDs diferentes); a junção entre eles
**é pelo email** (`wp_users.user_email`).

### Slugs LearnDash (PT-BR)

`portalpco.online` customizou os slugs REST. Os connectors em
`server/imports/connectors/ld.ts` precisam descobri-los dinamicamente OU
usar este mapa:

| Slug padrão LD     | Slug em portalpco.online        |
| ------------------ | ------------------------------- |
| `sfwd-courses`     | `cursos`                        |
| `sfwd-lessons`     | `aulas`                         |
| `sfwd-topic`       | `topicos`                       |
| `sfwd-quiz`        | `teste`                         |
| `sfwd-question`    | `sfwd-question` (não mudou)     |
| `groups`           | `groups` (não mudou)            |
| `courses/{id}/users` | `cursos/{id}/usuarios`        |
| `courses/{id}/steps` | `cursos/{id}/passo`           |
| `groups/{id}/courses` | `groups/{id}/nossos-cursos`  |

Endpoints de progressão e de cursos-do-usuário mantiveram os slugs originais:
`users/{id}/course-progress`, `users/{id}/courses`, `users/{id}/quiz-progress`,
`users/{id}/groups`.

## Inventário (snapshot 2026-05-14)

### portalpco.online (LMS)

| Entidade       | Total | Endpoint                                |
| -------------- | ----- | --------------------------------------- |
| Usuários WP    | 785   | `/wp/v2/users?context=edit`             |
| Cursos LD      | 6     | `/ldlms/v2/cursos?context=edit`         |
| Aulas LD       | 212   | `/ldlms/v2/aulas?context=edit`          |
| Tópicos LD     | 654   | `/ldlms/v2/topicos?context=edit`        |
| Quizzes        | 0     | `/ldlms/v2/teste?context=edit`          |
| Questões       | 112   | `/ldlms/v2/sfwd-question?context=edit`  |
| Grupos         | 0     | `/ldlms/v2/groups?context=edit`         |
| Assignments    | 0     | `/ldlms/v2/sfwd-assignment?context=edit`|
| Essays         | 0     | `/ldlms/v2/sfwd-essays?context=edit`    |
| Posts (blog)   | 20    | `/wp/v2/posts?context=edit`             |
| Pages          | 20    | `/wp/v2/pages?context=edit`             |

**Cursos (todos `publish`):**

| ID    | Título                                       |
| ----- | -------------------------------------------- |
| 8748  | Hipnoterapia                                 |
| 8887  | Como ser um Super Aluno Online               |
| 12245 | Curso de Terapia Familiar Sistêmica          |
| 13256 | Curso de Psicologia Analítica Jungiana       |
| 14839 | Curso de Psicanálise Clínica Online (master) |
| 14958 | Treinamento PCO                              |

Matrículas: o curso 14839 tem todos os 785 usuários matriculados
(provavelmente matrícula automática no signup). Os outros cursos precisam
ser verificados curso a curso via `GET /ldlms/v2/cursos/{id}/usuarios`.

Progressão de aluno (exemplo confirmado, user 1482):

```
course=14839 (Psicanalise)  status=in-progress  steps= 4/165  started=2026-01-08
course= 8887 (Super Aluno)  status=in-progress  steps= 4/20   started=2026-01-08
```

Campos disponíveis em `/users/{id}/course-progress`:
`course`, `last_step`, `steps_total`, `steps_completed`, `date_started`,
`date_completed`, `progress_status` (`not-started` | `in-progress` | `completed`).

### psicanaliseclinica.online (Loja)

| Entidade       | Total | Endpoint                                |
| -------------- | ----- | --------------------------------------- |
| Usuários WP    | 1775  | `/wp/v2/users?context=edit`             |
| WC customers   | 1775  | `/wc/v3/customers?role=all`             |
| WC produtos    | 5     | `/wc/v3/products?status=any`            |
| WC orders      | 1775  | `/wc/v3/orders?status=any`              |
| WC cupons      | 1     | `/wc/v3/coupons?status=any`             |
| WC assinaturas | n/a   | (plugin não instalado — 404)            |
| Posts (blog)   | 57    | `/wp/v2/posts?context=edit`             |
| Pages          | 10    | `/wp/v2/pages?context=edit`             |

**Produtos (todos `publish`):**

| ID    | Nome                                 | Preço     | Vendas |
| ----- | ------------------------------------ | --------- | ------ |
| 8034  | Curso de Psicanálise Clínica Online  | R$ 1198.60| 1622   |
| 8109  | Certificado Impresso + Taxas         | R$ 55     | 136    |
| 8258  | Curso de Hipnoterapia Clínica        | R$ 599.40 | 78     |
| 13464 | Terapia Familiar Sistêmica           | R$ 1198.60| 7      |
| 21184 | Extensão 6 meses                     | R$ 399    | 2      |

**Distribuição de pedidos** (total 1775):

```
completed   1112  (62.6%)
cancelled    292  (16.4%)
failed        18
refunded      35
pending       17
processing     0
```

### MCP endpoint

- `portalpco.online`: **não tem** namespace `mcp` listado
- `psicanaliseclinica.online`: `mcp/mcp-adapter-default-server` ativo
  (`POST`/`GET`/`DELETE`)

O endpoint MCP só está configurado no site da loja. Para a migração de dados
**puxar pelo WP REST v2 + LD v2 direto é mais simples e confiável**, porque
todas as entidades que precisamos estão expostas. MCP fica como opção futura
se quisermos um canal estruturado bidirecional.

## Credenciais

**NÃO commitadas neste repo.** Ficam em `Pco/.env.import` (gitignored).
Formato:

```
PORTAL_PCO_URL=https://portalpco.online
PORTAL_PCO_USER=claude
PORTAL_PCO_APP_PASSWORD=<segredo — em .env.import local, não comitar>

PSICANALISE_URL=https://psicanaliseclinica.online
PSICANALISE_USER=claude
PSICANALISE_APP_PASSWORD=<segredo — em .env.import local, não comitar>
```

Ambos os usuários `claude` têm role `administrator`. As app passwords e
a senha SSH foram expostas em commits anteriores deste repo (público) —
**devem ser rotacionadas após o projeto finalizar**
(`/wp-admin/profile.php` → Application Passwords → Revoke + gerar novas).

## Mapeamento WP → AVA

### Estratégia geral

1. Puxar **base completa do portal** (785 users + 6 cursos + 212 aulas +
   654 tópicos + 112 questões + progressão por aluno + matrículas).
2. Puxar **base comercial da loja** (1775 customers + 5 produtos + 1775
   orders + 1 cupom).
3. Fazer **match por email** entre `wp_users` do portal e `customers` da
   loja para unificar identidade do aluno no AVA.
4. Persistir em **JsonStore** (modo atual de produção — `DATABASE_URL`
   ainda não provisionado). Quando o Drizzle for ativado, os adapters já
   vão escrever no Postgres sem mudança no fluxo.

### Mapping por entidade

| WP/LD/WC                 | AVA (entidade)                           |
| ------------------------ | ---------------------------------------- |
| `wp_users` (portal)      | `students` (id, email, name, registered) |
| `wc_customers`           | `students` (merge por email) + `orders.customer` |
| `sfwd-courses` (cursos)  | `courses`                                |
| `sfwd-lessons` (aulas)   | `lessons` (parent → módulo virtual)      |
| `sfwd-topic` (topicos)   | `lessons` (sub-aula) **ou** `modules` se a aula virar grupo |
| `sfwd-question`          | `question-bank` (sprint 503)             |
| `cursos/{id}/usuarios`   | `enrollments`                            |
| `users/{id}/course-progress` | `progress`                           |
| `wc_products`            | `payment-products` (já existe a tabela)  |
| `wc_orders`              | `orders` + `payments` (gateway=imported) |

LD não tem o conceito explícito de "módulo" — aulas têm `parent` que pode
apontar para um curso direto. No AVA, módulos são opcionais. Decisão:

- Se um curso tem aulas com `menu_order` agrupando, criar módulos virtuais.
- Caso contrário, importar aulas direto sob o curso (módulo único "Conteúdo").

## Plano de execução

### Fase 1 — Discovery (✅ feito)

- Mapear namespaces
- Provar acesso autenticado
- Contar entidades
- Validar slugs PT-BR
- Validar progressão real exposta

### Fase 2 — Coleta (próximo passo)

Criar `scripts/migrate_wp_to_ava.ts` (TS, roda via `tsx`):

1. Lê creds de `Pco/.env.import`.
2. Instancia duas `ImportConnection` em memória:
   - `portalpco`: tipo `wp+ld`, baseUrl, creds, slugs customizados
3. Roda `collectFromApi(portalpco, { entities: ['student','course','lesson','topic','question','enrollment','progress'] })`
4. Roda `collectFromApi(psi, { entities: ['student','product','order'] })`
5. Merge por email: alunos do portal recebem `orders` dos clientes da loja
   com mesmo email.
6. Grava raw em `data/migration/<timestamp>/raw/*.json` (gitignored).
7. Roda `runDryRun` em cima dos rows coletados — confirma validação.
8. Output: relatório de quantos rows válidos/inválidos por entidade.

### Fase 3 — Aplicação (após dry-run limpar)

- `runReal({ source: 'migration-2026-05', enrollmentRules: { startRule: 'now', expirationRule: 'never', skipValidationErrors: true } })`
- Adapters fazem upsert: `student.matchKeys=['email']`, `course.matchKeys=['external_course_id']`, etc.
- Job rastreado em `import-jobs.json` (já existe na infra).

### Fase 4 — Validação pós-import

- `/admin/imports/jobs/:id/report` — checar created/updated/errors
- `/admin/usuarios` — spotcheck dos 785 alunos do portal
- `/admin/cursos/14839/analytics` — bater contagem de matriculas e progressão
- `/admin/vendas` — bater receita das 1112 orders completed

### Fase 5 — Rollback (se preciso)

`server/imports/rollback.ts` já existe — best-effort por `refs-store`.

## LD slug discovery — TODO

O connector `ld.ts` precisa fazer discovery automático do `routes` em
`/wp-json/ldlms/v2`, mapeando slug-em-PT → entidade-padrão. Quando
implementado, conectar a sites com slugs em outras línguas vira plug-and-play.

Pseudocode:

```ts
async function discoverLdSlugs(c: ImportConnection): Promise<LdSlugMap> {
  const res = await getJson(`${c.siteUrl}/wp-json/ldlms/v2`, creds);
  const routes = Object.keys(res.routes);
  // Heuristic: o slug certo é o único route que tem POST + suporta /(?P<id>[\d]+)
  // e cujo path "parece" um post type (sem `users/`, `groups/`, `progress-status` etc).
  return {
    courses: pickSlugMatching(routes, 'cursos|courses|sfwd-courses'),
    lessons: pickSlugMatching(routes, 'aulas|lessons|sfwd-lessons'),
    topics:  pickSlugMatching(routes, 'topicos|topics|sfwd-topic'),
    quiz:    pickSlugMatching(routes, 'teste|quiz|sfwd-quiz'),
    // ...
  };
}
```

## Riscos conhecidos

1. **Volume:** 785 × 6 cursos = potenciais 4710 registros de progressão
   só do portal. Paginação no LD às vezes é instável — usar `per_page=100`
   e fallback `per_page=20` em retry.
2. **Match por email:** se um aluno tem emails diferentes nos dois sites
   (raríssimo mas possível em compras antigas), ele vai duplicar. Estratégia:
   após import, página `/admin/usuarios/duplicates` com merge manual.
3. **Conteúdo embarcado (Elementor):** as aulas têm shortcodes Elementor
   no `content.rendered`. Decisão: importar como HTML raw, exibir no LMS
   sem reprocessar. Funciona porque os assets (imagens, vídeos) já estão
   nas URLs absolutas do WP.
4. **Cursos do portal vs produtos da loja:** os cursos do portal não têm
   relação 1:1 com produtos da loja (ex.: produto 8034 "Psicanálise" vende
   acesso ao curso 14839 do portal). Esse mapping cross-site precisa ser
   feito manualmente — não está no WP. Sugestão: tabela
   `data/migration/product-to-course-map.json` editável.

## Estado atual da sessão (handoff)

- ✅ Fase 1 — Discovery + inventário (slugs PT-BR mapeados)
- ✅ Fase 2 — Coleta: `npx tsx scripts/migrate_wp_to_ava.ts --collect-only`
- ✅ Fase 3 — Aplicação: 8128 entidades criadas, 928 alunos mergeados por email
- ✅ Fase 4 — Re-apply idempotente: 0 created / 10.137 updated / 0 erros
- ⏳ Fase 5 — Lessons (212) ainda `ignored` (sem adapter). Próximo passo
  pra ter conteúdo do curso navegável no LMS — mas estrutura já está em
  `external-references.json` consultável.

## Resultado da migração

Última execução: **2026-05-15** com dump em
`data/migration/2026-05-15T12-18-43-769Z/` (raw + report.json — gitignored).

**Coletado:**
- portalpco: 7560 rows (785 students, 6 courses, 212 lessons, 654 topics,
  112 questions, 4710 enrollments, 1081 progress entries)
- psi: 3555 rows (1775 customers, 5 products, 1775 orders)

**Persistido (em `data/*.json`, gitignored):**

| Arquivo                       | Conteúdo                                     |
| ----------------------------- | -------------------------------------------- |
| `users.json`                  | 1641 (3 seed + 1638 importados)              |
| `admin-students.json`         | 793 alunos (785 portal + 8 seed)             |
| `external-references.json`    | 8547 refs (4710 enroll + 2051 student + 1775 order + 6 course + 5 product) |
| `payment-products.json`       | 5 produtos WC                                |
| `lesson-progress.json`        | (vazio — progress agregado vive em admin-students.progressByCourse) |
| `import-connections.json`     | 2 conexões com creds criptografadas AES-GCM  |
| `import-jobs.json`            | 3 jobs registrados                           |

**Distribuição de progresso (em produção, vivo):**

- 523 alunos com progresso > 0%
- 679 registros não-zero
- Média 39.7%
- Top: curso 14839 (Psicanálise Master) com 357 alunos engajados / média 39.3%

**14 warnings (orders abandonadas sem email):** rows 696, 750, 752, 755, 769,
824, 913, 914, 946, 1005, 1023, 1041, 1067, 1085 — todos pedidos
pending/failed sem checkout completo. Persistidos como warnings via
`skipValidationErrors: true`.

## Como re-executar

```bash
cd Pco
# Carrega .env.import (creds gitignored) e roda end-to-end
npx tsx scripts/migrate_wp_to_ava.ts --collect-only          # só baixa raw (~12 min)
npx tsx scripts/migrate_wp_to_ava.ts --dry-run --from-raw=data/migration/<TS>  # valida (~15s)
npx tsx scripts/migrate_wp_to_ava.ts --apply --from-raw=data/migration/<TS>    # persiste (~10 min)
```

Flags suportadas:
- `--collect-only` — só baixa raw em `data/migration/<ts>/raw/portal.json` e `psi.json`
- `--dry-run` — valida sem persistir
- `--apply` — persiste real (idempotente)
- `--from-raw=<dir>` — reusa raw existente (pula coleta)
- `--verbose` — debug

## TODO futuro

- **Rotacionar app passwords** dos dois sites depois que decidir que está
  pronto. Comando para o owner: `/wp-admin/profile.php` → Application
  Passwords → Revoke.
- **Duração real das aulas:** hoje as 213 aulas LD recebem 15min default no
  `courses.json` (LD não expõe duração direto). Se quiser duração real,
  parsear `<video>` no `content_html` ou abrir cada aula no LD e ler meta.
- **Cursos "draft":** 7 dos 13 cursos LD estão como `draft` no portal
  (Autismo, Neuropsicologia, Suicídio etc.). Foram importados como ativos
  no AVA — se o owner não quiser eles visíveis, marcar via UI ou criar
  field `published` na importação.

## Versão final (2026-05-15, sprint v2)

Após adicionar `status=any` no connector LD (`fetchLdCourses`,
`fetchLdLessons`, `fetchLdTopics`) pra incluir cursos draft + script
`scripts/import_lessons_and_map_products.ts` que monta `courses.json`
estruturado:

| Métrica | Antes (v1) | Agora (v2) |
|---|---|---|
| Cursos | 6 publicados | **13 (publish + draft)** |
| Lessons importadas | — | **213 distribuídas em courses.json** |
| Enrollments | 4710 | **10.205** |
| courses.json total | 3 seed | **16 (13 LD + 3 seed)** |
| Produtos com refId | 0 | **3 linkados** (8034→14839, 8258→8748, 13464→12245) |

Validado em produção: `GET /api/courses` retorna os 16 cursos via login
do superadmin (`admin@psicanaliseclinica.online`).

## Bugs críticos descobertos pós-deploy v2 (2026-05-15 22h)

Análise dos dados em produção revelou 3 bugs sérios. **Re-coleta v3 em
curso** com fixes aplicados ao código mas dados em produção ainda no
estado bugado v2 — aguardando re-aplicar.

### Bug #1: enrollments fantasma (cada aluno em todos os cursos)

`GET /wp-json/ldlms/v2/cursos/{id}/usuarios` retorna **todos os usuários
do site** quando o user da Application Password é admin, **não** apenas
os matriculados nesse curso.

Sintoma: cada um dos 785 alunos do portal apareceu matriculado em todos
os 13 cursos (10.205 enrollments errados — só ~1500 são reais).

Comprovação:
```bash
# user 1482 tem só 2 cursos reais
curl .../ldlms/v2/users/1482/courses?context=edit → 2 cursos
curl .../ldlms/v2/users/1482/course-progress     → 2 entries
# mas o endpoint inverso retorna todos:
curl .../ldlms/v2/cursos/14839/usuarios → 785 (todos, não só os matriculados)
```

**Fix em `server/imports/connectors/ld.ts:fetchLdEnrollments`:** iterar
os 785 users e chamar `/users/{id}/courses` em vez de iterar os cursos.
Mais lento (~25 min em vez de ~5 min) mas exato.

### Bug #2: colisão de external_user_id entre portal e psi

509 dos 785/1775 user IDs colidem entre os dois sites (números WP
independentes — `1125` é Adriana no portal e `fixyou94` (spam) no psi).
O `refsStore.find('learndash', 'student', '1125')` retornava sempre o
mesmo internalId, fundindo dois users diferentes num só.

Sintoma: 333 users sumiram (esperados 1972 únicos, criados 1639) +
nomes spam SEO em ~436 alunos legítimos do portal.

**Fix em `scripts/migrate_wp_to_ava.ts`:** novo `prefixUserIds(result,
prefix)` aplicado antes do merge, gerando IDs como `portal:1125` /
`psi:1125`. Refs ficam isoladas por origem.

### Bug #3: SEO spam injection no WP

Bots encheram `display_name` de 436 customers do PSI com texto tipo
`"www.rabotaaa11.blogspot.com - SBERBANK 842211 RUB"`. Emails russos
descartáveis (`@mail.ru`, `@bk.ru`, `@inbox.ru`, gmails genéricos).

**Fix em `scripts/migrate_wp_to_ava.ts`:** novo `filterSpam(result)`
com 8 patterns (blogspot.com, RUB, BAM, SBERBANK, TINKOFF, PABOTA,
www.*.blog/info/biz). Filtra também enrollments/progress/orders que
apontam pros users spam.

### Estado em produção (ainda v2 buggy)

- `users.json`: 1641 (1638 importados, 333 faltando, ~436 com nomes spam)
- `admin-students.json`: 793 com 10.205 enrollments **errados** (cada um
  em todos os 13 cursos)
- `external-references.json`: 14.049 entries com colisões

### Plano de recuperação v3 (em curso)

1. ✅ Patch connector LD (`fetchLdEnrollments` via `/users/{id}/courses`)
2. ✅ Patch migrate script (`prefixUserIds` + `filterSpam`)
3. ✅ Script `scripts/reset_imported_data.ts` (mantém só seeds + admin@psicanaliseclinica.online)
4. ✅ Reset local executado (1638 users → 4, 793 alunos → 8)
5. ⏳ **Re-coletar (em background, ~30 min)** — gerando raw v3
6. ⏳ Re-aplicar do raw v3 (~15 min)
7. ⏳ Re-rodar `import_lessons_and_map_products`
8. ⏳ Sync para VPS + restart
9. ⏳ Importar secundários (112 questões, 77 posts, 1 cupom)

## Como continuar de onde paramos (atualizado 17/ago/2026)

> As instruções antigas desta seção mandavam aplicar o import e depois rodar
> `python scripts/sync_data_to_vps.py`. **Isso não funciona mais**: produção lê
> do Postgres (DivZ) desde 03/jul/2026, e copiar `data/*.json` para o VPS não
> muda nada no ar. O script agora aborta sozinho explicando isso.

### O que já está feito em produção

- Carga v3 aplicada (07/jul): 1590 users, 601 students, 1109 matrículas.
- Datas reais de matrícula (17/ago): de 1 data única para 409 distintas,
  fev/2021 a jul/2026. Antes, todas carregavam a data do import.
- Prazo de acesso por curso existe no schema (`courses.meta.accessMonths` +
  `enrollments.expires_at`), mas **nenhum curso declarou meses**, então nada
  expira até o dono definir.

### A origem encolheu — leia antes de recarregar

O WordPress do portal **deletou 160 pessoas** entre julho e agosto (52
desistentes, 35 inadimplentes, 7 reembolsados, 6 inativos, 14 alunos ativos).
Elas continuam em produção com 256 matrículas, 97 com progresso real.

Por isso **a fonte de verdade da recarga é o dump de 07/jul**
(`data/migration/2026-07-07T05-43-54-830Z/`), não a coleta ao vivo — só o dump
ainda tem essas pessoas. E por isso o loader deixou de fazer wipe-and-reload.

### Sequência atual

```bash
# 1. (se for re-coletar) o connector já traz a data real da matrícula
npx tsx scripts/migrate_wp_to_ava.ts --collect-only

# 2. corrigir datas de matrícula a partir de um dump já existente
npx tsx scripts/backfill_enrollment_dates.ts --from-raw=data/migration/<ts> --apply

# 3. backup de produção ANTES de qualquer escrita
DATABASE_URL=<divz> npx tsx scripts/backup_divz_students.ts

# 4. ensaio (transação com ROLLBACK, só conta) e depois a aplicação
DATABASE_URL=<divz> npx tsx scripts/load_v3_to_divz.ts
DATABASE_URL=<divz> npx tsx scripts/load_v3_to_divz.ts --commit

# 5. vendas novas da loja, que não passam pelo LearnDash
DATABASE_URL=<divz> npx tsx scripts/sync_wc_delta.ts --commit
```

O loader casa por **e-mail** (os ids locais mudam a cada import), faz upsert,
nunca regride progresso, e marca como inativo quem não veio na fonte em vez de
apagar — `--purge-missing` para o comportamento destrutivo, explicitamente.

### Pendências de importação

- 112 questões LD → não há tabela `question_bank` no Postgres
- 1 cupom WC → não há tabela `coupons` no Postgres
- Pedidos/produtos WC → não há tabela `orders` no Postgres
- 77 posts WP → **já estão** em `news_articles`

Os três primeiros precisam de decisão: criar as tabelas e migrar, ou assumir que
ficam fora da v1. Importar para JSON hoje é importar para lugar nenhum.

### Credenciais

- WP Application Passwords (portal + psi): `.env.import` (gitignored)
- Servidor: atalho `vps` (root, chave `enlevo_vps195`) → `195.200.0.253`;
  comandos da app via `sudo -u avapco -i`. O host `177.7.35.13` está morto.
- `DATABASE_URL` do DivZ: no `.env` do VPS. **Pendente de rotação** — passou por
  chat em julho.

## Contas com login e sem ficha de aluno — de onde vieram

`scripts/auditar_contas_sem_ficha.ts` (só lê) responde a pergunta que trava o
disparo dos convites. A distinção importa dos dois lados: cliente da loja
convidado para o AVA recebe acesso a um ambiente onde não tem nada; aluno com
matrícula perdida convidado sem a matrícula de volta conclui que perdeu o que
pagou.

O método usa a origem prefixada que a correção v3 introduziu (`psi:` = loja,
`portal:` = LMS) e cruza com três perguntas: de onde a conta veio, existe
referência de matrícula sem ficha, e existe progresso de aula sem ficha.

Medido na base local em 26/ago/2026:

| | contas | |
|---|---|---|
| com login | 1.590 | |
| com ficha de aluno | 615 | |
| **sem ficha** | **989** | |
| — só da loja (`psi:`) | 763 (77,1%) | nunca foram alunas |
| — com presença no portal (`portal:`) | 222 (22,4%) | é aqui que mora a dúvida |
| — matrículas órfãs | **0** | nenhuma matrícula perdeu a ficha |

Zero matrículas órfãs é o achado que mais pesa: **nenhuma referência de
matrícula aponta para conta sem ficha**, o que afasta a hipótese de a migração
ter perdido matrícula dessas pessoas.

**O que ainda falta, e por que não dá para fechar aqui:** a evidência
definitiva seria progresso de aula sem ficha — quem estudou e ficou sem
matrícula. A base local não tem nenhum registro de progresso, então o script
responde `INCONCLUSIVO` em vez de "ninguém estudou". Rodar contra produção, ou
sobre um dump com progresso, fecha a questão.
