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
