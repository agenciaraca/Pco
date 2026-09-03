# Site público (LMS → LMS + commerce)

Front público SSR (marketing/vendas/blog) que leva ao login/checkout e ao AVA
logado. Renderizado no servidor pelo Hono (`hono/html`), **não** por Next.js —
processo único, aditivo, sem novo build. Baseado no handoff de design
`design pagina publicas pco/`.

## Isolamento perfeito público × restrito (requisito central)

Três planos **fisicamente separados**:

| Plano       | Auth       | Onde                                            | Dados                       |
| ----------- | ---------- | ----------------------------------------------- | --------------------------- |
| **Público** | nenhuma    | `server/public/*` (SSR Hono)                    | só via projeção (whitelist) |
| **Aluno**   | JWT        | SPA React (`/app/*` após migração de namespace) | repos completos             |
| **Admin**   | JWT + role | SPA `/admin/*`                                  | repos completos             |

Regras invioláveis:

1. **Nenhuma página pública recebe row cru do banco.** Tudo passa por
   `server/public/projections.ts` — um whitelist explícito. Campo novo no modelo
   só vaza se for adicionado de propósito a uma projeção. Impossível expor PII de
   aluno, matrícula, custo interno ou rascunho.
2. **Gate de visibilidade de curso**: `isPubliclyListed()` em `projections.ts`,
   e **só ele**. Ver a seção abaixo. (Este item já afirmou que um produto ativo
   era obrigatório para o curso aparecer — nunca foi verdade no código.)
3. **Router público montado antes do fallback do SPA** (`server/dev.ts`), sem
   middleware de auth. As rotas restritas mantêm `requireAuth`/`requireAdmin`.
4. **CSP `script-src 'self'`** respeitada: nada de `<script>` inline; o JS do
   site é servido como asset same-origin (`/_pub/site.js`).

## Visibilidade: `active` e `publicListed` são coisas diferentes

| Flag           | Governa                                                                                    | Onde se edita                           |
| -------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `active`       | o **aluno matriculado** consegue abrir o curso no LMS                                      | aba Geral → "Despublicar curso"         |
| `publicListed` | o curso aparece **para quem não é aluno** (catálogo, página de venda, sitemap, `llms.txt`) | aba Página pública → "Divulgar no site" |

`publicListed` ausente vale `true` — a flag é aditiva e nenhum curso existente
mudou de comportamento quando ela entrou.

Até 16/ago/2026 existia só `active`, e as duas coisas eram a mesma: tirar um
curso da vitrine cortava o acesso de quem já tinha comprado. O caso que forçou a
separação foi o treinamento **interno** de equipe, listado publicamente, com 19
matrículas ativas — não havia como despublicar sem derrubar as 19.

Todo caminho público passa por `isPubliclyListed()`. Se você adicionar um novo
caminho que exponha curso a visitante anônimo, use essa função — não repita
`c.active !== false`, que é justamente o erro que a função existe para evitar.

## `/curso/:id` e `/formacao/:slug` NÃO são a mesma coisa

- `/formacao/<slug>` — página pública de venda, SSR, visitante anônimo.
- `/curso/<id>` — rota do **SPA do aluno logado**, e recebe **id**, não slug.

Trocar uma pela outra **não dá erro visível**: o catch-all do SPA devolve 200
com o shell vazio, então um crawler registra soft-404 e um visitante é mandado
ao login. Foi o que aconteceu com `Course.url`/`Offer.url` do JSON-LD e com os
"cursos relacionados" do blog (corrigido em `ea4959d`).

Use os helpers: `publicCourseUrl()` em `server/public/jsonld.ts` no servidor,
`src/app/lib/publicUrls.ts` no frontend. E rota SSR nunca se linka com
`<Link to>` — só `<a href>`, senão cai no NotFound do SPA.

## Responsável técnico: enquanto for placeholder, o site omite

`AUTHOR` em `config.ts` nunca foi preenchido com uma pessoa real.
`AUTHOR_IS_PLACEHOLDER` detecta o `[...]` no nome e, enquanto for `true`:

- `/autor` devolve 404 e sai do `sitemap.xml` e do `llms.txt`;
- somem o link do rodapé, o CTA do `/sobre` e os links das assinaturas do blog;
- `Course.hasCourseInstance` sai **sem** `instructor` (em vez de um `@id`
  pendurado apontando para um nó que nenhuma página define);
- post sem autor nomeado tem a autoria atribuída à organização.

O motivo é de conteúdo, não de código: publicar "Dra. [Nome do Responsável
Técnico]" **com credenciais e biografia anexadas** em material de saúde mental
atribui formação a uma pessoa que não existe — pior do que não ter autor.

Preencher `AUTHOR` com nome, foto e `sameAs` verificáveis desliga tudo isso
sozinho. **Enquanto não for preenchido, o site opera sem o sinal de E-E-A-T mais
pesado que existe para conteúdo YMYL.**

## Módulos (`server/public/`)

| Arquivo          | Papel                                                          |
| ---------------- | -------------------------------------------------------------- |
| `config.ts`      | ORG + AUTHOR (E-E-A-T) — conteúdo público, editável            |
| `projections.ts` | **camada de isolamento** — whitelist de campos públicos        |
| `jsonld.ts`      | construtores JSON-LD (grafo `@id`: org↔autor↔curso)            |
| `styles.ts`      | tokens CSS do design (inline, zero webfont)                    |
| `client.ts`      | JS progressivo (tema, carrinho, accordion) — asset same-origin |
| `layout.ts`      | shell `<head>` SEO/GEO/CWV + header/footer                     |
| `router.ts`      | rotas públicas                                                 |

## SEO / GEO / E-E-A-T assados no build

- **JSON-LD por tipo de página** emitido no server (Organization+EducationalOrg,
  WebSite, Person, Course+CourseInstance+Offer, FAQPage, BreadcrumbList,
  About/ContactPage) — grafo conectado por `@id`.
- **Autor como entidade** (`Person` com `hasCredential` + `sameAs`) — sinal
  central de E-E-A-T em conteúdo YMYL (saúde mental).
- **TL;DR / answer-first** em cursos e posts (extração por LLM/GEO).
- **Disclaimers YMYL** (formação livre; CVV 188).
- **CWV/PageSpeed**: CSS crítico inline, system-ui (sem webfont/CLS), JS com
  `defer`, canonical/robots/OG por rota, imagens com dimensão explícita.
- `robots.txt` / `sitemap.xml` / `llms.txt` regenerados das rotas reais.

## Roadmap de sprints

| Sprint | Escopo                                                                                                         | Colisão?  | Status   |
| ------ | -------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| **1**  | Fundação + isolamento + `/sobre` `/autor` `/contato`                                                           | não       | ✅ feito |
| 2      | Blog `/blog` + `/blog/:slug` (de `news.json`)                                                                  | não       | ⏳       |
| 3      | Namespace: app logado → `/app/*`; público `/cursos` + `/curso/:slug` (JSON-LD Course) + campos editáveis novos | **sim**   | ⏳       |
| 4      | Home `/` SSR; Landing atual vira `/nosso-ava`; `/carrinho`                                                     | sim (`/`) | ⏳       |
| 5      | Checkout externo: visitante → gateway hospedado → cria conta → `grantAccessForOrder`                           | —         | ⏳       |
| 6      | SEO files (`llms.txt`, sitemap dinâmico novo), editor admin dos campos públicos                                | —         | ⏳       |

Campos editáveis novos do curso (extensão **aditiva** do `updateCourseSchema`):
`badge, tagline, tldr, forWhom, faqs, curriculum, level, language, monthsMin/Max`.
Já existem e são reusados: `learningOutcomes, instructorName/Bio/PhotoUrl,
description, slug, coverImageUrl, totalHours, certificateAvailable, tags`.


## O portão da vitrine agora é um só — `shared/visibilidade.ts`

`isPubliclyListed()` nasceu em `server/public/projections.ts` com um comentário
dizendo ser o "ÚNICO portão de visibilidade pública de curso", por onde todo
caminho que expõe curso a visitante anônimo passaria. Valia para o site SSR
(`/formacoes`, `/formacao/:slug`, sitemap, llms.txt, cursos relacionados) e para
`/public/checkout`.

**Não valia para o SPA.** `/catalogo` filtrava por outro critério — "existe
produto ativo apontando para este curso" — e `/comparar` resolvia qualquer id
que viesse na URL. Um curso marcado `publicListed: false` sumia do site
público, tinha a compra barrada no checkout, e continuava na prateleira do
`/catalogo`: quem clicasse era mandado para um checkout que responde 404, e a
escola pensaria ter tirado o curso de venda.

A função mudou de casa para `shared/visibilidade.ts`, onde servidor e navegador
leem o mesmo código. `projections.ts` reexporta — import antigo segue
funcionando. `test/visibilidade-curso.test.ts` compara as duas referências para
que ninguém reescreva a regra em vez de importá-la.

**`/api/courses` NÃO devolve tudo.** A resposta depende de quem pergunta, desde
2/set/2026:

| quem | quais cursos | com `videoUrl`? |
| --- | --- | --- |
| anônimo | só os publicamente listados | não |
| aluno | os listados **+ aqueles em que tem matrícula** | não |
| admin | todos | sim |

> **Este parágrafo dizia o contrário até 3/set/2026** — "continua devolvendo
> tudo, e deve" — e continuou dizendo por um dia inteiro depois de a regra por
> persona entrar. Documentação que contradiz um conserto de vazamento não é doc
> desatualizada: é instrução para desfazê-lo. Foi a mesma lição do `AGENTS.md`
> que mandava rodar o script de restart errado.
>
> O que a frase antiga acertava, e vale manter: `publicListed: false` tira da
> vitrine **preservando** o acesso de quem já comprou. É por isso que matrícula
> entra na conta da tabela acima — "Como ser um Super Aluno Online" é
> `publicListed: false` e tem 655 alunos legítimos. O que ela errava era supor
> que filtrar na prateleira bastava: um `curl` sem token não passa por
> prateleira nenhuma, e baixava o curso interno de operadores com as URLs de
> vídeo dentro.

A mesma regra vale para `GET /courses/:id` (404, não 403 — 403 confirmaria que o
curso existe) e, desde 3/set/2026, para as três rotas públicas de aula:
`/lessons/:id/preview`, `/lessons/:id/transcript` e `/lessons/:id/transcript.:format`.
Essas três decidiam **só** por `lesson.isPreview` e nunca olhavam o curso pai —
marcar uma aula do curso interno como demonstração entregava título, duração,
`videoUrl` e a transcrição inteira a quem não estava logado. Hoje todas passam
por `requisitantePodeVerCurso`, em `server/app.ts`.

`test/curso-interno-nao-vaza.test.ts` cobra isso **por persona**, não por rota:
o defeito nunca foi uma rota errada, era a mesma rota respondendo igual para
quem tem direitos diferentes.
