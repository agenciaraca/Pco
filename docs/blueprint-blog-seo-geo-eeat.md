# Blueprint: Área de Blog/Conteúdo "referência para Buscas e IA" (SEO + GEO + E-E-A-T + LLM)

> **Para que serve este documento**
> Este é o **mapa completo** da área de blog que construímos na Academia Enlevo — uma área de
> conteúdo desenhada para ser **a melhor referência possível para mecanismos de busca (Google) e
> para IAs generativas (ChatGPT, Gemini/AI Overviews, Perplexity, Claude)**.
>
> Use-o em **outro projeto** que já tem uma área de blog "crua" e precisa chegar a esse nível.
> O fluxo é: **(1) auditar o que o projeto-alvo já tem → (2) comparar com a meta → (3) implementar
> por fases**, seguindo a arquitetura e o código de referência aqui descritos.
>
> Tudo aqui é **agnóstico de domínio**. Onde aparece "psicanálise / Academia Enlevo" é só o nicho
> do projeto de origem — troque pelo nicho do projeto-alvo. A engenharia (modelo de dados, JSON-LD,
> roteamento de IA, prompts, sitemaps, scores) é reaproveitável em qualquer tema.

**Stack de referência:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL ·
TipTap (editor) · Zod · AES-256-GCM (credenciais de provedores).
Se o projeto-alvo usa outra stack, os **conceitos** (campos do modelo, formato do JSON-LD, prompts,
features de IA, estrutura de sitemap) valem igual; só a implementação muda.

---

## 0. Filosofia em uma frase

> Conteúdo bem escrito **não basta**. Para ser citado por buscas e IA, cada artigo precisa carregar,
> desde o banco de dados, **sinais explícitos de quem escreveu (E-E-A-T), do que afirma (fatos
> verificáveis + fontes reais), de como responde (TL;DR/resposta direta), e de como está estruturado
> (JSON-LD, FAQ, índice, headings)**. Isso é decisão de **arquitetura**, barata no build e cara de
> retrofitar depois.

Os 4 eixos que perseguimos, e que viram **scores objetivos** no admin:

| Eixo | O que é | Como o LLM/Google usa |
|------|---------|------------------------|
| **SEO** | Otimização clássica (keyword, title, meta, slug, headings, links) | Ranking orgânico |
| **GEO** (Generative Engine Optimization) | Ser **recuperado e citado** por IA generativa | Featured snippets, AI Overviews, citações em ChatGPT/Perplexity |
| **E-E-A-T** | Experience, Expertise, Authoritativeness, Trustworthiness | Confiança (crítico em YMYL — saúde, dinheiro, direito) |
| **LLM** | Conteúdo "extraível": definições claras, fatos verificáveis, estrutura semântica | Facilidade de citação literal pela IA |

---

## 1. Como auditar o projeto-alvo (diagnóstico)

Antes de codar, rode este diagnóstico no projeto-alvo e preencha a coluna "Tem hoje?". Isso vira o
gap entre **o que existe** e **a meta** (seção 2).

### 1.1 Modelo de dados (o mais importante)
- [ ] Existe modelo de **artigo** com `slug` único, `status` (draft/published), `publishedAt`, `updatedAt`?
- [ ] Tem campos de **SEO**: `seoTitle`, `seoDescription`, `featuredImage`?
- [ ] Tem **categoria** e **tags** (com slugs)?
- [ ] Existe uma **entidade de Autor credenciado SEPARADA do usuário do sistema**? (campo crítico de E-E-A-T)
- [ ] O autor tem `bio`, `jobTitle`, `credentials`, `knowsAbout`, `sameAs`, `photo`?
- [ ] O artigo tem campos de **GEO/E-E-A-T**: `directAnswer` (TL;DR), `reviewedBy`, `lastReviewedAt`, `isYmyl`, `sources`?
- [ ] Tem um campo flexível `metadata` (JSON) para keyword/FAQ/citations sem migração a cada ideia nova?

### 1.2 Admin / edição
- [ ] CRUD de artigos com listagem (busca, filtro por status/categoria, paginação)?
- [ ] Editor **rich text** (HTML estruturado com H2/H3, listas, citações, imagens com alt)?
- [ ] CRUD de **autores** e de **categorias/tags**?
- [ ] Algum **score de qualidade** (SEO/GEO/EEAT) visível durante a edição?

### 1.3 IA
- [ ] Geração de artigo com IA? "Melhorar/Expandir/Resumir"? Geração de imagem? Busca de fontes reais?
- [ ] Existe **roteamento de provedor por feature** (escolher OpenAI vs Anthropic vs… por tarefa)?
- [ ] Credenciais de IA **criptografadas** no banco (não em `.env` solto)?
- [ ] **Telemetria** de uso/custo de IA?

### 1.4 Público / SEO técnico
- [ ] Página de listagem do blog + página de artigo individual?
- [ ] **Página pública de autor** (`/autores/[slug]`)?
- [ ] **JSON-LD** (`Article` + `Person` do autor + `FAQPage`)?
- [ ] `generateMetadata` por artigo (title, description, canonical, OpenGraph type=article)?
- [ ] **Sitemap** segmentado incluindo posts + **robots.txt**?
- [ ] Verificação de domínio (Google/Bing) e Consent Mode?

> **Regra de ouro do diagnóstico:** se faltar a **entidade Author credenciada**, o `directAnswer`,
> ou o **JSON-LD com Person/`hasCredential`**, o projeto-alvo está "longe" — são exatamente os
> sinais que separam um blog comum de uma referência para IA/YMYL.

---

## 2. Onde queremos chegar (estado-meta)

A meta é reproduzir os 7 pilares abaixo. Cada um está detalhado na seção 4 com código de referência.

1. **Modelo de dados com E-E-A-T/GEO embutido** — `Article` carrega autoria credenciada, revisor,
   resposta direta, fontes, flag YMYL e `metadata` flexível. `Author` é uma entidade pública com
   credenciais, expertise e perfis verificáveis.
2. **Admin com editor + scores ao vivo** — editor rico (TipTap) com painel lateral mostrando
   **SEO/GEO/EEAT/LLM (0–100)** calculados por checks objetivos, mais ações de IA inline.
3. **Geração e otimização por IA, roteável** — gerar artigo completo, melhorar/expandir/resumir,
   gerar imagem (com estilo de marca), **buscar fontes reais na web**, e otimizar contra os checks —
   tudo com **provedor escolhido por feature** e custo/uso medidos.
4. **Autoria credenciada pública** — página `/autores/[slug]` + `Person` JSON-LD com
   `hasCredential`, `knowsAbout`, `sameAs`, `@id` estável.
5. **JSON-LD único e robusto** — um builder central emite `Article` (com `author`, `reviewedBy`,
   `dateModified`, `description = directAnswer`) + `FAQPage`, reutilizado por todos os temas.
6. **Metadata + SEO técnico completos** — `generateMetadata` por página, canonical, OpenGraph
   `article`, sitemaps segmentados, robots, verificações de domínio.
7. **GEO/LLM por construção** — TL;DR como isca de citação, FAQ schema, índice navegável (TOC com
   âncoras), definições claras, fatos verificáveis e fontes reais citadas.

---

## 3. Arquitetura de referência (mapa de arquivos)

Estrutura que implementamos. Adapte os caminhos ao projeto-alvo (aqui usamos `src/`).

```
src/
├── app/
│   ├── (public)/
│   │   ├── blog/
│   │   │   ├── page.tsx                      # listagem (busca + filtro categoria)
│   │   │   ├── layout.tsx                    # metadata estática base
│   │   │   └── [slug]/
│   │   │       ├── page.tsx                  # artigo: hero, conteúdo, tags, relacionados, CTA, JSON-LD
│   │   │       └── layout.tsx                # generateMetadata() async por artigo
│   │   └── autores/[slug]/page.tsx           # página pública do autor + Person JSON-LD
│   ├── admin/
│   │   ├── blog-cms/
│   │   │   ├── page.tsx                      # listagem admin (abas Artigos/Categorias/Tags)
│   │   │   ├── novo/page.tsx                 # novo artigo
│   │   │   ├── [id]/page.tsx                 # editar artigo
│   │   │   └── criar-ia/page.tsx            # wizard "Criar com IA"
│   │   ├── categorias/  (page + _form)       # CRUD categorias
│   │   ├── autores/     (page + _form)       # CRUD autores credenciados
│   │   └── ia/page.tsx                       # Central de IA (uso, custos, roteamento, estilo de imagem)
│   ├── api/
│   │   ├── admin/
│   │   │   ├── articles/ (route + [id] + categories + tags)
│   │   │   ├── authors/  (route + [id])
│   │   │   ├── categories/(route + [id] + reorder)
│   │   │   ├── upload/route.ts               # upload de imagem (R2/disco)
│   │   │   └── ai/                           # ⭐ todas as features de IA
│   │   │       ├── routing/route.ts          # GET/PUT roteamento por feature
│   │   │       ├── generate-article/route.ts # geração completa
│   │   │       ├── improve-text/route.ts     # improve | expand | summarize
│   │   │       ├── optimize/route.ts         # "Melhorar com IA" (sugestões vs checks)
│   │   │       ├── find-sources/route.ts     # busca de fontes REAIS na web
│   │   │       ├── generate-image/route.ts   # imagem (capa/corpo) com estilo de marca
│   │   │       ├── image-style/route.ts      # preset de estilo de imagem
│   │   │       └── usage/route.ts            # telemetria de uso/custo
│   │   └── articles/ (route + [slug])        # leitura pública (PUBLISHED)
│   ├── sitemap.xml/route.ts                  # índice de sitemaps
│   ├── sitemap-posts.xml/route.ts            # posts publicados
│   └── robots.ts
├── services/
│   ├── article.service.ts                    # list/get/create/update/delete/publish
│   ├── author.service.ts                     # list/get/getAuthorPublic/create/update/delete
│   └── category.service.ts
├── components/admin/
│   ├── article-editor.tsx                    # editor + sidebar de scores + ações de IA
│   └── block-editor.tsx                      # wrapper TipTap
├── lib/
│   ├── article-jsonld.ts                     # ⭐ builder único de JSON-LD
│   ├── blog-image-style.ts                   # estilo padrão das imagens
│   ├── seo/sitemap.ts                        # rotas estáticas + entradas dinâmicas
│   └── integrations/
│       ├── registry.ts                       # registry "TYPE::provider" + decrypt + init
│       ├── encryption.ts                     # AES-256-GCM
│       └── ai/                               # types.ts + anthropic.ts + openai.ts + ...
└── prisma/schema.prisma                      # Article, Author, ArticleCategory, Tag, AiUsageLog, ...
```

---

## 4. Os 7 pilares em detalhe (com código de referência)

### Pilar 1 — Modelo de dados com E-E-A-T/GEO embutido

O coração do sistema. **Estes campos são o que torna o conteúdo "citável".** Schema Prisma de referência:

```prisma
enum ArticleStatus { DRAFT PUBLISHED }

model Article {
  id                String        @id @default(cuid())
  title             String
  slug              String        @unique
  content           String        @db.Text   // HTML estruturado (H2/H3, índice, etc.)
  excerpt           String?       @db.Text

  // Autoria do SISTEMA (quem operou) vs autoria CREDENCIADA (quem assina, E-E-A-T)
  authorId          String                    // FK -> User (operador)
  authorProfileId   String?                   // FK -> Author (entidade pública credenciada)
  reviewedById      String?                   // FK -> Author (revisor YMYL / fact-check)

  articleCategoryId String?
  status            ArticleStatus @default(DRAFT)
  publishedAt       DateTime?
  viewCount         Int           @default(0)

  // SEO
  seoTitle          String?
  seoDescription    String?
  featuredImage     String?

  // GEO / E-E-A-T / YMYL
  directAnswer      String?       @db.Text     // TL;DR — "isca" de citação para IA (2-4 frases)
  sources           Json?                       // [{ title?, url }]
  lastReviewedAt    DateTime?
  isYmyl            Boolean       @default(false)

  // Flexível (sem migração a cada ideia): keyword, secondaryKeywords, faqItems,
  // citations, customJsonLd, verifiableFacts, readingTime, wordCount, etc.
  metadata          Json?

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  author        User             @relation(fields: [authorId], references: [id])
  authorProfile Author?          @relation("ArticleAuthorProfile", fields: [authorProfileId], references: [id])
  reviewedBy    Author?          @relation("ArticleReviewer", fields: [reviewedById], references: [id])
  category      ArticleCategory? @relation(fields: [articleCategoryId], references: [id])
  tags          ArticleTag[]

  @@map("articles")
}

/// Autor/Person credenciado (entidade pública de autoria).
/// Alimenta o JSON-LD Person (hasCredential + sameAs + knowsAbout) — keystone de E-E-A-T em YMYL.
model Author {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique               // URL /autores/[slug]
  bio         String?  @db.Text              // biografia credenciada (3ª pessoa)
  jobTitle    String?                         // ex.: "Psicanalista clínico"
  credentials Json?                           // [{ category: "license"|"degree"|"certification", name }]
  knowsAbout  String[]                        // tópicos de autoridade (Person.knowsAbout)
  sameAs      String[]                        // perfis verificáveis (LinkedIn, registro) (Person.sameAs)
  photo       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  articles Article[] @relation("ArticleAuthorProfile")
  reviewed Article[] @relation("ArticleReviewer")

  @@map("authors")
}

model ArticleCategory {
  id           String    @id @default(cuid())
  name         String
  slug         String    @unique
  description  String?
  articleCount Int       @default(0)          // denormalizado
  articles     Article[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@map("article_categories")
}

model Tag {
  id       String       @id @default(cuid())
  name     String       @unique
  slug     String       @unique
  articles ArticleTag[]
  createdAt DateTime    @default(now())
  @@map("tags")
}

model ArticleTag {
  articleId String
  tagId     String
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([articleId, tagId])
  @@map("article_tags")
}
```

> **Decisão de arquitetura nº 1 (não pule):** separe **User** (operador do sistema) de **Author**
> (entidade pública credenciada). É o que permite assinar um artigo com um especialista real, gerar
> `Person` JSON-LD com `hasCredential`, e ter uma página `/autores/[slug]` que o Google trata como
> "autor credenciado". Sem isso, não há E-E-A-T de verdade.

> **Decisão nº 2:** mantenha um `metadata Json?`. Ideias novas (FAQ, citations, customJsonLd,
> verifiableFacts, readingTime…) entram sem migração. Promova a coluna real só o que precisa ser
> filtrado/indexado (ex.: `isYmyl`).

**Campos que vivem hoje em `metadata` (JSON):** `focusKeyword`, `secondaryKeywords`, `canonicalUrl`,
`schemaType`, `citations`, `customJsonLd`, `faqItems`, `authorQualification`, `reviewDate`,
`reviewer`, `citedSources`, `verifiedBadge`, `citability`, `clearDefinitions`, `verifiableFacts`,
`readingTime`, `wordCount`.

---

### Pilar 2 — Admin: editor + scores ao vivo

Tela de edição (`components/admin/article-editor.tsx`) organizada em seções:

- **Básico:** título (auto-slug), slug, categoria, tags (multi-select), autor, imagem destacada (upload), excerpt.
- **Conteúdo:** editor TipTap (`block-editor.tsx`) — H1/H2/H3, listas, links, imagens (com alt), citações, alinhamento, undo/redo. Ações IA: **Melhorar / Expandir / Resumir**.
- **SEO:** seoTitle (contador 50–60), meta description (150–160), focus keyword, secondary keywords, canonical.
- **GEO:** citations, FAQ (pergunta+resposta dinâmicas), custom JSON-LD, botão **Buscar fontes**.
- **E-E-A-T:** author profile (select de `Author`), reviewed by, **direct answer (TL;DR)**, qualification, review date, cited sources (URLs), checkbox **isYmyl**, verified badge.
- **LLM:** checkboxes citability / clear definitions + textarea verifiable facts.

**Sidebar de scores (0–100)** — calculados **no cliente** por checks objetivos (sem IA), dando
feedback instantâneo. Pesos de referência que usamos:

```
SEO  (checks): keyword no título · keyword no 1º parágrafo · keyword na meta ·
               seoTitle 50-60 · meta 150-160 · >300 palavras · alt nas imagens ·
               links internos · slug com keyword · H2/H3 · densidade 1-3%
GEO  (25/25/25/25): citations · structured data (FAQ/JSON-LD) · FAQ presente · >1000 palavras
EEAT (20/20/20/15/15/10): author profile · qualification · cited sources ·
                          data de publicação · data de revisão · reviewer
LLM  (25/25/25/25): definições claras · fatos verificáveis · headings · >500 palavras
```

> Os **mesmos checks** alimentam o `failing[]` enviado ao endpoint `/api/admin/ai/optimize`
> ("Melhorar com IA"), que devolve sugestões **só para o que está falhando**. É o loop
> escrever → medir → corrigir, todo dentro do editor.

CRUD de **categorias** e **autores** seguem o padrão de `page.tsx` (listagem) + `_form.tsx`
(formulário). O form de autor coleta exatamente os campos que viram `Person` JSON-LD:
nome, slug, jobTitle, foto (upload), bio, knowsAbout (um por linha), sameAs (um por linha) e
credentials (dropdown categoria + nome, dinâmico).

---

### Pilar 3 — IA: geração + otimização, roteável por feature

Todas as rotas em `src/app/api/admin/ai/`, protegidas por `requireAuth(["SUPERADMIN","ADMIN","EDITOR"])`.

#### 3.1 Roteamento por feature (o truque que dá flexibilidade)

Config persistida em `PlatformSettings` chave `ai.routing` (JSON). Cada feature escolhe um provider.
Default de referência:

```json
{
  "blog": "anthropic",                  // gerar/melhorar/otimizar texto
  "product": "anthropic",
  "crm": "anthropic",
  "chat": "openai",
  "commercial-analysis": "anthropic",
  "blog-image": "openai",               // requer provider.generateImage()
  "blog-sources": "openai"              // requer provider.searchSources() (web search)
}
```

Resolução: rota lê `ai.routing[feature]` → busca `IntegrationConfig` (`type=AI_PROVIDER`,
`provider=nome`, `enabled=true`) → `registry.getProvider()` **descriptografa** credenciais
(AES-256-GCM) e inicializa a instância. Trocar de OpenAI p/ Anthropic numa feature é **mudar 1 select** no admin.

#### 3.2 As features

| Rota | Função | Provider (default) | Saída-chave |
|------|--------|--------------------|-------------|
| `generate-article` | Artigo completo a partir de tema/keywords/tom/tamanho | `blog` (anthropic) | title, content (HTML c/ índice), excerpt, seoTitle, seoDescription, **directAnswer**, tags, focusKeyword, citations, **faqItems**, authorQualification, citedSources, **verifiableFacts** |
| `improve-text` | `improve` / `expand` / `summarize` | `blog` | HTML processado |
| `optimize` | "Melhorar com IA": recebe checks falhando, devolve sugestões | `blog` | `{ analysis, suggestions: { seoTitle?, content?, faqItems?, toc?, … } }` |
| `find-sources` | **Fontes reais via web search** (não inventa URL) | `blog-sources` (openai) | `{ sources: [{title,url}] }` |
| `generate-image` | Capa/corpo com estilo de marca; salva no storage | `blog-image` (openai) | `{ url, alt, storage }` |
| `image-style` | GET/PUT do preset de estilo | — | `{ style }` |
| `usage` | Telemetria (calls, tokens, custo, sucesso) agrupável | — | totals + grouped |

**Wizard "Criar com IA"** (`admin/blog-cms/criar-ia/page.tsx`) encadeia tudo: gera artigo → (opcional)
busca fontes → (opcional) gera capa → (opcional) gera figura no corpo → cria rascunho com `metadata`
→ redireciona para o editor já preenchido.

#### 3.3 Interface de provider (plugável)

```ts
interface IAIProvider extends IBaseProvider {
  generateChat(messages, options?): Promise<{ text; usage? }>;
  generateText(prompt, options?): Promise<{ text; usage? }>;
  generateImage?(prompt, options?): Promise<{ b64?; url?; mimeType? }>;   // opcional
  searchSources?(query, options?): Promise<{ sources: {title;url}[]; summary? }>; // opcional
}
```

Implementados: Anthropic, OpenAI (texto+imagem+web), Google AI, Groq, Mistral, Cohere, HuggingFace,
Replicate. Cada um chama `registerProvider("AI_PROVIDER", nome, Classe)` no próprio módulo.

#### 3.4 Telemetria

Toda chamada loga em `AiUsageLog` (provider, model, feature, tokens, `estimatedCostUsd`, durationMs,
success). A Central de IA (`/admin/ia`) mostra custo por dia/feature/provider/usuário.

```prisma
model AiUsageLog {
  id String @id @default(cuid())
  userId String?
  provider String        // "anthropic" | "openai" | ...
  model String
  feature String         // "blog" | "blog-image" | ...
  promptTokens Int @default(0)
  completionTokens Int @default(0)
  totalTokens Int @default(0)
  estimatedCostUsd Decimal @default(0) @db.Decimal(10,6)
  durationMs Int @default(0)
  success Boolean @default(true)
  errorMessage String? @db.Text
  metadata Json?
  createdAt DateTime @default(now())
  @@map("ai_usage_logs")
}
```

---

### Pilar 4 — Autoria credenciada pública

Página `/autores/[slug]` (server component) renderiza: foto, nome, jobTitle, bio, **credenciais**
(lista com ✓, cada uma vira `EducationalOccupationalCredential`), **expertise** (`knowsAbout`),
**links externos** (`sameAs`) e os **artigos publicados** do autor. E injeta o `Person` JSON-LD
inline (server-side). `generateMetadata` define title/description/canonical do autor.

Service que alimenta a página:

```ts
export async function getAuthorPublic(slug: string) {
  return prisma.author.findUnique({
    where: { slug },
    include: {
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { id: true, title: true, slug: true, excerpt: true, featuredImage: true, publishedAt: true, category: true },
      },
    },
  });
}
```

---

### Pilar 5 — JSON-LD único e robusto

**Um builder central** (`src/lib/article-jsonld.ts`) usado por todos os temas. Emite:

1. **`Article`** com `headline`, `description = directAnswer || excerpt || seoDescription` (TL;DR como
   descrição!), `image`, `inLanguage`, `datePublished`, **`dateModified`**, `mainEntityOfPage`,
   `keywords`, `author` (Person credenciado ou nome simples), `publisher` (Organization + logo) e,
   quando houver, **`reviewedBy`** + `lastReviewedAt`.
2. **`Person`** do autor: `@id` **estável** (`{SITE}/autores/{slug}#person`), `url`, `jobTitle`,
   `description` (bio), `image`, `knowsAbout`, `sameAs` e **`hasCredential[]`**.
3. **`FAQPage`** separado, quando `metadata.faq` existe.

Código de referência (essencial — copie a forma):

```ts
const SITE = "https://SEU-DOMINIO.com.br";

function personNode(a) {
  const node = { "@type": "Person", "@id": `${SITE}/autores/${a.slug}#person`, name: a.name, url: `${SITE}/autores/${a.slug}` };
  if (a.jobTitle) node.jobTitle = a.jobTitle;
  if (a.bio) node.description = a.bio;
  if (a.photo) node.image = a.photo.startsWith("http") ? a.photo : `${SITE}${a.photo}`;
  if (a.knowsAbout?.length) node.knowsAbout = a.knowsAbout;
  if (a.sameAs?.length) node.sameAs = a.sameAs;
  const creds = (a.credentials || []).filter(c => c?.name);
  if (creds.length) node.hasCredential = creds.map(c => ({
    "@type": "EducationalOccupationalCredential",
    credentialCategory: c.category || "certification",
    name: c.name,
  }));
  return node;
}

export function buildArticleJsonLd(article) {
  const url = `${SITE}/blog/${article.slug}`;
  const keywords = article.metadata?.keyword
    ? [article.metadata.keyword, ...(article.metadata.secondaryKeywords || [])].join(", ")
    : undefined;
  const author = article.authorProfile
    ? personNode(article.authorProfile)
    : { "@type": "Person", name: article.author?.name || "SEU SITE" };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.directAnswer || article.excerpt || article.seoDescription || "",
    image: article.featuredImage ? [article.featuredImage] : undefined,
    inLanguage: "pt-BR",
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords,
    author,
    publisher: { "@type": "Organization", name: "SEU SITE", url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/logo.png` } },
  };
  if (article.reviewedBy) {
    articleSchema.reviewedBy = personNode(article.reviewedBy);
    if (article.lastReviewedAt) articleSchema.lastReviewedAt = article.lastReviewedAt;
  }

  const schemas = [articleSchema];
  const faq = article.metadata?.faq;
  if (Array.isArray(faq) && faq.length) {
    schemas.push({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map(f => ({ "@type": "Question", name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer } })) });
  }
  return schemas;
}
```

> **Por que isto importa para IA:** `description = directAnswer` entrega a resposta pronta para o
> snippet/citação. `@id` estável do `Person` conecta o autor entre páginas (o Google monta a entidade).
> `hasCredential` + `sameAs` são os sinais de confiança YMYL. `reviewedBy`/`dateModified` sinalizam
> fact-check e atualidade — LLMs preferem citar conteúdo "atualizado em…".

Melhorias que valem adicionar (não tínhamos 100%): **`BreadcrumbList`** (`/blog > [slug]`) e um
**RSS feed do blog** (`/feed/blog.xml`).

---

### Pilar 6 — Metadata + SEO técnico

- **Root `layout.tsx`:** `metadataBase`, `title.template = "%s | Marca"`, description, keywords,
  OpenGraph default (website, locale pt_BR, og-image 1200×630), twitter `summary_large_image`,
  `robots {index,follow}`.
- **`blog/[slug]/layout.tsx` → `generateMetadata` async:** title = `seoTitle || title`,
  description = `seoDescription || excerpt(160) || fallback`, **canonical** `/blog/[slug]`,
  OpenGraph `type:"article"` com `publishedTime`, `authors`, `images`.
- **`autores/[slug]` → `generateMetadata`:** title/description do autor + canonical.
- **Sitemaps segmentados:** `/sitemap.xml` (índice) → `sitemap-pages.xml`, `sitemap-posts.xml`,
  `sitemap-products.xml`. Posts = artigos `PUBLISHED` com `lastModified = updatedAt`. `/blog` listado
  com `priority 0.8, changeFrequency daily`.
- **`robots.ts`:** allow `/`, disallow `/admin/`, `/api/admin/`, `/login`, `/checkout`, `/obrigado`;
  aponta o sitemap.
- **Verificações de domínio** (Google/Bing/Pinterest/Facebook) + **Consent Mode v2** antes das tags Google.

Exemplo do `generateMetadata` do artigo:

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const a = await prisma.article.findUnique({ where: { slug }, select: {
    title:true, slug:true, excerpt:true, seoTitle:true, seoDescription:true,
    featuredImage:true, publishedAt:true,
    author:{select:{name:true}}, authorProfile:{select:{name:true}} } });
  if (!a) return { title: "Artigo" };
  const title = a.seoTitle || a.title;
  const description = a.seoDescription || a.excerpt?.slice(0,160) || `${a.title} — Blog.`;
  return {
    title, description,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: { title, description, type: "article",
      publishedTime: a.publishedAt?.toISOString(),
      authors: [a.authorProfile?.name || a.author?.name || "Marca"],
      images: a.featuredImage ? [{ url: a.featuredImage }] : undefined },
  };
}
```

---

### Pilar 7 — GEO/LLM por construção

O que faz a IA **citar** o conteúdo (vai além do SEO):

1. **TL;DR / directAnswer** — 2–4 frases autossuficientes que respondem a dúvida central. Vira a
   `description` do JSON-LD e a "isca" de citação.
2. **Índice navegável (TOC)** — o conteúdo começa com `<h2 id="indice">Índice</h2>` + `<ul>` de
   âncoras; cada seção tem `<h2 id="sX">`. (A geração por IA já produz isso — ver prompt abaixo.)
3. **FAQ schema** — `faqItems` → `FAQPage` JSON-LD (alvo de "People also ask" e respostas de IA).
4. **Fatos verificáveis** + **fontes reais citadas** — `verifiableFacts` e `find-sources` (URLs reais
   via web search, nunca inventadas).
5. **Estrutura semântica** — H2/H3 hierárquicos, `<strong>`/`<em>`, `<blockquote>`, `<img alt>`,
   HTML semântico (`<article>`, `<main>`).
6. **Autoria + revisão + atualidade** — `Person` credenciado, `reviewedBy`, `dateModified`.

#### Prompts de referência (a parte difícil de acertar)

**Geração de artigo (system):**
```
Você é um redator especialista em [NICHO], criando conteúdo para [MARCA].
Regras críticas:
- Sempre em [IDIOMA]; linguagem conforme tom/estilo selecionados.
- TAMANHO OBRIGATÓRIO: o "content" deve ter NO MÍNIMO {wordTarget} palavras — artigo completo,
  aprofundado, com muitas seções H2 e subseções H3. Nunca resuma nem entregue menos.
- ÍNDICE clicável: comece com <h2 id="indice">Índice</h2> + <ul><li><a href="#sX">…</a></li>…
  Cada <h2> de seção deve ter id único correspondente.
- HTML puro (não markdown): <h2>,<h3>,<p>,<ul>/<ol>,<strong>,<em>,<blockquote>.
- Definições claras de termos técnicos; cite autoridades relevantes do nicho.
- Otimize para SEO, GEO, E-E-A-T e citabilidade por LLMs.
- Responda SOMENTE JSON válido (sem markdown), com as chaves:
  title, content, excerpt, seoTitle, seoDescription, directAnswer, suggestedTags,
  focusKeyword, secondaryKeywords, citations, faqItems[{question,answer}],
  authorQualification, citedSources[], verifiableFacts.
- directAnswer = resposta direta de 2-4 frases (40-60 palavras), texto puro, autossuficiente (isca p/ IA).
```
`max_tokens ≈ min(16000, wordTarget*4 + 3000)`.

**Otimização (system) — "Melhorar com IA":**
```
Você é um editor SEO/GEO/E-E-A-T especialista em [NICHO]. Escreve em [IDIOMA], conteúdo em HTML.
Melhora artigos para passarem em checks objetivos SEM inventar fatos nem fontes.
Recebe a lista de CHECKS QUE ESTÃO FALHANDO e os dados atuais; responde APENAS JSON:
{ "analysis": "2-4 frases", "suggestions": { ...só as chaves que vai melhorar... } }
Para citações/fatos, proponha só o que o conteúdo sustenta (ou marque como "a verificar").
```
`temperature 0.4`.

**Busca de fontes (query):**
```
Encontre fontes confiáveis, atuais e CITÁVEIS sobre: "{assunto}".
[Se YMYL] priorize órgãos oficiais (.gov), universidades (.edu), periódicos revisados por pares e
entidades profissionais. Liste apenas fontes REAIS e verificáveis com links. NÃO invente URLs.
```

**Estilo de imagem (preset, concatenado a cada prompt):**
```
Ilustração editorial sóbria e elegante sobre [TEMA]. Paleta [CORES DA MARCA].
Estilo conceitual/simbólico (não literal), iluminação suave. Composição limpa p/ capa de blog.
Sem texto, sem letras, sem logotipos, sem marcas d'água, sem rostos reconhecíveis.
```

---

## 5. Plano de implementação por fases (no projeto-alvo)

Implemente nesta ordem — cada fase entrega valor e desbloqueia a próxima.

### Fase 0 — Fundação de dados (1 PR)
- Adicionar/ajustar modelos `Article`, `Author`, `ArticleCategory`, `Tag`, `ArticleTag`, `AiUsageLog`.
- Campos não-negociáveis: `Author` separado de `User`; `directAnswer`, `reviewedById`,
  `lastReviewedAt`, `isYmyl`, `sources`, `metadata` no `Article`.
- Migração **aditiva** (não destrutiva). Se já existe artigo, só adicione colunas opcionais.

### Fase 1 — SEO técnico público (alto ROI, baixo custo)
- `buildArticleJsonLd` central + injeção na página do artigo.
- `generateMetadata` por artigo (canonical, OpenGraph article).
- Sitemap segmentado com posts + `robots.txt` + verificações de domínio.
- **Aqui o conteúdo que já existe passa a indexar muito melhor — sem reescrever nada.**

### Fase 2 — Autoria credenciada (E-E-A-T)
- CRUD de `Author` no admin (form com bio/jobTitle/credentials/knowsAbout/sameAs/photo).
- Página pública `/autores/[slug]` + `Person` JSON-LD com `hasCredential`.
- Atribuir autor credenciado (`authorProfileId`) e revisor (`reviewedById`) aos artigos.

### Fase 3 — Editor + scores
- Editor rico (TipTap ou o que o projeto já usa) com seções SEO/GEO/E-E-A-T/LLM.
- Sidebar de **scores ao vivo** (checks objetivos no cliente).

### Fase 4 — IA roteável
- `registry` + `encryption` + interface `IAIProvider` + ao menos 2 providers (ex.: OpenAI + Anthropic).
- `ai.routing` em settings + Central de IA com telemetria (`AiUsageLog`).
- Rotas: `generate-article`, `improve-text`, `optimize`, `find-sources`, `generate-image`.
- Wizard "Criar com IA".

### Fase 5 — Polimento GEO/LLM
- TOC com âncoras, FAQ schema, `verifiableFacts`, fontes reais, `BreadcrumbList`, RSS do blog.
- Glossário/definições (`<dfn>`) se fizer sentido no nicho.

---

## 6. Checklist final de aceite ("é referência para IA?")

- [ ] Cada artigo emite `Article` JSON-LD com `author` (Person), `dateModified`, `description` = TL;DR.
- [ ] Autores têm página pública e `Person` com `hasCredential` + `sameAs` + `knowsAbout`.
- [ ] Artigos YMYL têm `reviewedBy` + `lastReviewedAt` e `isYmyl=true`.
- [ ] `directAnswer` (TL;DR) preenchido e FAQ → `FAQPage`.
- [ ] Conteúdo com índice (âncoras), H2/H3, definições, fatos verificáveis, fontes **reais**.
- [ ] `generateMetadata` com canonical + OpenGraph `article` em todo artigo.
- [ ] Sitemap inclui posts (PUBLISHED) com `lastModified`; robots aponta o sitemap.
- [ ] Scores SEO/GEO/EEAT/LLM visíveis no editor e "Melhorar com IA" corrige o que falha.
- [ ] IA roteável por feature, credenciais criptografadas, custo medido por feature.
- [ ] (Bônus) `BreadcrumbList` + RSS do blog.

---

## 7. Resumo de arquivos para copiar/portar primeiro

Prioridade para acelerar o projeto-alvo (do mais reaproveitável ao mais específico):

1. `lib/article-jsonld.ts` — **copie quase como está** (troque SITE/marca/logo).
2. `prisma/schema.prisma` — modelos `Article` + `Author` + categoria/tag + `AiUsageLog`.
3. `lib/integrations/` (`registry.ts`, `encryption.ts`, `ai/types.ts`, `ai/openai.ts`, `ai/anthropic.ts`).
4. `app/api/admin/ai/*` — rotas de IA (ajuste prompts ao nicho).
5. `lib/seo/sitemap.ts` + `app/sitemap*.xml/route.ts` + `app/robots.ts`.
6. `app/(public)/blog/**` + `app/(public)/autores/[slug]/page.tsx` (adapte ao layout/tema do alvo).
7. `components/admin/article-editor.tsx` + `block-editor.tsx` (o maior esforço de adaptação).

> Os prompts e o "estilo de imagem" são **específicos do nicho** — reescreva-os para o domínio do
> projeto-alvo (a engenharia em volta é idêntica).
</content>
</invoke>
