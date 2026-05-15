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
PORTAL_PCO_APP_PASSWORD=ibYs vril 09iY AhkB 8LSm rnvV

PSICANALISE_URL=https://psicanaliseclinica.online
PSICANALISE_USER=claude
PSICANALISE_APP_PASSWORD=PWb1 SIuK 8KZT hng3 eaK5 QTTF
```

Ambos os usuários `claude` têm role `administrator`. As app passwords foram
expostas em chat — **devem ser rotacionadas após a migração**
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

- ✅ Discovery + inventário completos
- ⏳ Fase 2 (coleta) — não iniciada
- Última atividade: 2026-05-15
- Próxima ação: implementar `scripts/migrate_wp_to_ava.ts` ou criar
  conexão via UI `/admin/imports/conexoes` e usar o job runner existente.

## Decisão pendente

Antes de seguir, alinhar com o owner:

1. **Importa tudo de uma vez ou em fases por curso?** Recomendação: tudo
   de uma vez (são 785 alunos, volume baixo).
2. **Sobrescreve usuários existentes no AVA?** Recomendação: `conflictStrategy='update'`
   por email (já é o default).
3. **Importa orders cancelled/failed/pending?** Recomendação: sim, para
   ter histórico completo de tentativas (já temos `status` na tabela).
4. **Importa apenas alunos com progressão > 0 ou todos os 785?** Recomendação:
   todos, mas marcar `status='inactive'` quem nunca logou.
