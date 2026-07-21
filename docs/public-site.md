# Site público (LMS → LMS + commerce)

Front público SSR (marketing/vendas/blog) que leva ao login/checkout e ao AVA
logado. Renderizado no servidor pelo Hono (`hono/html`), **não** por Next.js —
processo único, aditivo, sem novo build. Baseado no handoff de design
`design pagina publicas pco/`.

## Isolamento perfeito público × restrito (requisito central)

Três planos **fisicamente separados**:

| Plano | Auth | Onde | Dados |
|---|---|---|---|
| **Público** | nenhuma | `server/public/*` (SSR Hono) | só via projeção (whitelist) |
| **Aluno** | JWT | SPA React (`/app/*` após migração de namespace) | repos completos |
| **Admin** | JWT + role | SPA `/admin/*` | repos completos |

Regras invioláveis:

1. **Nenhuma página pública recebe row cru do banco.** Tudo passa por
   `server/public/projections.ts` — um whitelist explícito. Campo novo no modelo
   só vaza se for adicionado de propósito a uma projeção. Impossível expor PII de
   aluno, matrícula, custo interno ou rascunho.
2. **Gate de visibilidade de curso**: `active !== false` **E** produto
   `kind='course'` ativo apontando pra ele. Mesmo critério do sitemap.
3. **Router público montado antes do fallback do SPA** (`server/dev.ts`), sem
   middleware de auth. As rotas restritas mantêm `requireAuth`/`requireAdmin`.
4. **CSP `script-src 'self'`** respeitada: nada de `<script>` inline; o JS do
   site é servido como asset same-origin (`/_pub/site.js`).

## Módulos (`server/public/`)

| Arquivo | Papel |
|---|---|
| `config.ts` | ORG + AUTHOR (E-E-A-T) — conteúdo público, editável |
| `projections.ts` | **camada de isolamento** — whitelist de campos públicos |
| `jsonld.ts` | construtores JSON-LD (grafo `@id`: org↔autor↔curso) |
| `styles.ts` | tokens CSS do design (inline, zero webfont) |
| `client.ts` | JS progressivo (tema, carrinho, accordion) — asset same-origin |
| `layout.ts` | shell `<head>` SEO/GEO/CWV + header/footer |
| `router.ts` | rotas públicas |

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

| Sprint | Escopo | Colisão? | Status |
|---|---|---|---|
| **1** | Fundação + isolamento + `/sobre` `/autor` `/contato` | não | ✅ feito |
| 2 | Blog `/blog` + `/blog/:slug` (de `news.json`) | não | ⏳ |
| 3 | Namespace: app logado → `/app/*`; público `/cursos` + `/curso/:slug` (JSON-LD Course) + campos editáveis novos | **sim** | ⏳ |
| 4 | Home `/` SSR; Landing atual vira `/nosso-ava`; `/carrinho` | sim (`/`) | ⏳ |
| 5 | Checkout externo: visitante → gateway hospedado → cria conta → `grantAccessForOrder` | — | ⏳ |
| 6 | SEO files (`llms.txt`, sitemap dinâmico novo), editor admin dos campos públicos | — | ⏳ |

Campos editáveis novos do curso (extensão **aditiva** do `updateCourseSchema`):
`badge, tagline, tldr, forWhom, faqs, curriculum, level, language, monthsMin/Max`.
Já existem e são reusados: `learningOutcomes, instructorName/Bio/PhotoUrl,
description, slug, coverImageUrl, totalHours, certificateAvailable, tags`.
