# Playbook de Replicação — Área de Publicações (Blog/CMS + Autores + IA + SEO/GEO/E-E-A-T)

> **Para quem é este documento:** uma IA (ou dev) que vai **clonar a área de Publicações**
> da Academia Enlevo em **outro projeto Next.js**, com (quase) todos os recursos: CMS de
> artigos, editor rico com *scores* ao vivo, autoria credenciada, geração e otimização por
> IA roteável, JSON-LD E-E-A-T/GEO e renderização pública pronta para busca e citação por LLMs.
>
> **Como usar com cuidado (regra de ouro):** este playbook descreve a arquitetura e os
> contratos reais, mas **antes de copiar qualquer arquivo, ABRA o arquivo-fonte e leia-o**.
> Os caminhos estão todos listados. Trate este MD como o mapa; o código-fonte é a verdade.
> Há ainda um documento irmão, **`docs/blueprint-blog-seo-geo-eeat.md`** (7 pilares + plano
> por fases, agnóstico de domínio) — use-o para o detalhe profundo de SEO/GEO. Este playbook
> é o **inventário completo + ordem de reconstrução** da área inteira.

---

## 0. O que é a área e a filosofia

A área de Publicações trata **conteúdo como dado estruturado**, não como texto solto. Cada
artigo carrega — além do corpo HTML — os sinais que fazem o Google ranquear (**SEO**) e os
LLMs (ChatGPT, Gemini/AI Overviews, Perplexity, Claude) **recuperarem e citarem** o conteúdo
(**GEO**): resposta direta (TL;DR), FAQ, fontes reais, autoria credenciada (E-E-A-T) e JSON-LD.

Três superfícies:
1. **Admin** (`/admin/blog-cms`, `/admin/autores`): criar/editar artigos, autores, categorias, tags.
2. **IA** (`/api/admin/ai/*`): gerar artigo, melhorar/expandir/resumir, buscar fontes, gerar imagem, otimizar por score — tudo **roteável por provedor**.
3. **Público** (`/blog`, `/blog/[slug]`, `/autores/[slug]`): renderização + JSON-LD + metadata + sitemap.

**Stack assumida no projeto-alvo:** Next.js 15 (App Router), Prisma + PostgreSQL, TipTap
(editor), e um sistema de integrações com criptografia de credenciais. Se o alvo não tiver
o registry de integrações, a Seção 4 mostra o mínimo a portar.

---

## 1. Inventário completo de arquivos (o mapa real)

> Caminhos relativos à raiz do projeto Academia Enlevo (`C:\ia\dev\ae`). Replique a mesma
> estrutura no alvo (ajustando o domínio/nicho).

### 1.1 Dados
- `prisma/schema.prisma` — models **Article, Author, ArticleCategory, Tag, ArticleTag** + enum **ArticleStatus** + **AiUsageLog** (telemetria). Veja Seção 3.

### 1.2 Admin (UI)
- `src/app/admin/blog-cms/page.tsx` — listagem (busca, filtro categoria/status, paginação, KPIs, abas Artigos/Categorias/Tags/Páginas).
- `src/app/admin/blog-cms/novo/page.tsx` — criar artigo (usa o `ArticleEditor`).
- `src/app/admin/blog-cms/[id]/page.tsx` — editar artigo.
- `src/app/admin/blog-cms/criar-ia/page.tsx` — **wizard "Criar com IA"** (orquestra as rotas de IA → cria rascunho → abre editor).
- `src/components/admin/article-editor.tsx` — **editor completo**: form em seções (Básico/SEO/GEO/E-E-A-T/LLM), sidebar com **scores ao vivo** (SEO/GEO/E-E-A-T/LLM), painel "Melhorar com IA", ações inline.
- `src/components/admin/block-editor.tsx` — **wrapper do TipTap** (extensões + toolbar + bubble menu). Salva **HTML**.
- `src/app/admin/autores/` — CRUD de autores credenciados (confirme os arquivos exatos ao portar).

### 1.3 API — conteúdo (admin, com auth)
- `src/app/api/admin/articles/route.ts` — `GET` (listar paginado), `POST` (criar).
- `src/app/api/admin/articles/[id]/route.ts` — `GET`/`PUT`/`DELETE`.
- `src/app/api/admin/articles/categories/route.ts` — `GET`/`POST` categorias.
- `src/app/api/admin/articles/tags/route.ts` — `GET`/`POST` tags.
- `src/app/api/admin/authors/route.ts` — `GET`/`POST` autores.
- `src/app/api/admin/authors/[id]/route.ts` — `GET`/`PUT`/`DELETE`.

### 1.4 API — conteúdo (público, sem auth, só PUBLISHED)
- `src/app/api/articles/route.ts` — lista publicados (`?limit=&category=`).
- `src/app/api/articles/[slug]/route.ts` — detalhe publicado + incrementa `viewCount`.

### 1.5 API — IA (admin) — `src/app/api/admin/ai/*`
- `routing/route.ts` — `GET`/`PUT` do mapa de roteamento `ai.routing` (qual provedor por feature).
- `generate-article/route.ts` — gera artigo completo (JSON estruturado). **Prompt na Seção 5.1.**
- `improve-text/route.ts` — `improve` | `expand` | `summarize`.
- `find-sources/route.ts` — fontes reais e citáveis (exige provider com `searchSources`).
- `generate-image/route.ts` — capa/figura (exige provider com `generateImage`), salva via `saveMedia`.
- `image-style/route.ts` — `GET`/`PUT` do preset de estilo visual.
- `optimize/route.ts` — recebe os *checks* que falharam e devolve sugestões.
- `usage/route.ts` — telemetria agregada (lê `AiUsageLog`).
- (irmãos não-blog, úteis de referência: `generate-product-content`, `crm-assist`, `commercial-analysis`.)

### 1.6 Libs de apoio
- `src/lib/article-jsonld.ts` — **builder único de JSON-LD** (Article + Person credenciado + FAQPage). **Citado integralmente na Seção 7.**
- `src/lib/blog-image-style.ts` — `DEFAULT_IMAGE_STYLE` (prompt-base das imagens).
- `src/lib/integrations/` — registry de provedores + `encryption.ts` (AES-256-GCM) + `ai/*` (8 provedores) + `types.ts` (interface `IAIProvider`).
- `src/lib/media-store.ts` — `saveMedia()` (R2 ou disco) usado pela geração de imagem.
- `src/services/article.service.ts` e `src/services/author.service.ts` — regra de negócio (CRUD, parse de metadata, relações).

### 1.7 Público (renderização)
- `src/app/(public)/blog/page.tsx` + `layout.tsx` — listagem.
- `src/app/(public)/blog/[slug]/page.tsx` + `layout.tsx` — artigo (injeta JSON-LD, gera metadata, TOC, relacionados).
- `src/app/(public)/autores/[slug]/page.tsx` — página do autor (Person JSON-LD).
- `src/app/sitemap.ts` / rota de sitemap e `robots` — inclua os posts PUBLISHED (confirme no alvo).

### 1.8 Documentação irmã
- `docs/blueprint-blog-seo-geo-eeat.md` — os **7 pilares** com código de referência e **plano por fases**. Leia junto.

---

## 2. Dependências (package.json)

```jsonc
// Editor
"@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit",
"@tiptap/extension-underline", "@tiptap/extension-text-align",
"@tiptap/extension-link", "@tiptap/extension-image",
"@tiptap/extension-placeholder", "@tiptap/extension-highlight",
"@tiptap/extension-color", "@tiptap/extension-text-style",
"@tiptap/extension-bubble-menu",
// Infra
"@prisma/client", "prisma", "zod", "lucide-react",
"next", "react", "react-dom"
```
As chaves de criptografia e SDKs de IA são chamadas via `fetch` nos providers (não exigem SDK
por provedor), exceto onde o provider específico precisar — confira cada `ai/*.ts`.

---

## 3. Modelo de dados (Prisma) — copie isto primeiro

> **Cuidado:** este é o coração. O resto monta em cima. Cole no `schema.prisma` do alvo,
> rode `prisma generate` + `prisma db push`. Ajuste `User` (o `authorId` referencia o usuário
> de login — mantenha a relação inversa em `User`).

```prisma
enum ArticleStatus {
  DRAFT
  PUBLISHED
}

model Article {
  id                String        @id @default(cuid())
  title             String
  slug              String        @unique
  content           String        @db.Text          // HTML puro (não markdown)
  excerpt           String?       @db.Text
  authorId          String                           // User que operou no admin
  articleCategoryId String?
  status            ArticleStatus @default(DRAFT)
  publishedAt       DateTime?
  viewCount         Int           @default(0)
  seoTitle          String?
  seoDescription    String?
  featuredImage     String?
  metadata          Json?                            // { faq[], keyword, secondaryKeywords[], citations, ... }
  // E-E-A-T / GEO
  authorProfileId   String?                          // entidade Author credenciada (assina o artigo)
  reviewedById      String?                          // revisor YMYL credenciado
  directAnswer      String?       @db.Text           // TL;DR (isca de citação p/ IA)
  sources           Json?                            // [{ title?, url }]
  lastReviewedAt    DateTime?
  isYmyl            Boolean       @default(false)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  author        User             @relation(fields: [authorId], references: [id])
  authorProfile Author?          @relation("ArticleAuthorProfile", fields: [authorProfileId], references: [id])
  reviewedBy    Author?          @relation("ArticleReviewer", fields: [reviewedById], references: [id])
  category      ArticleCategory? @relation(fields: [articleCategoryId], references: [id])
  tags          ArticleTag[]

  @@map("articles")
}

/// Autor/Person credenciado — entidade PÚBLICA, separada do User de login.
/// Alimenta o JSON-LD Person (hasCredential + sameAs): keystone de E-E-A-T em YMYL.
model Author {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  bio         String?  @db.Text
  jobTitle    String?
  credentials Json?    // [{ category: "license"|"degree"|"certification", name }]
  knowsAbout  String[] // tópicos de autoridade → Person.knowsAbout
  sameAs      String[] // perfis externos verificáveis → Person.sameAs
  photo       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  articles Article[] @relation("ArticleAuthorProfile")
  reviewed Article[] @relation("ArticleReviewer")

  @@map("authors")
}

model ArticleCategory {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?
  articleCount Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  articles     Article[]
  @@map("article_categories")
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())
  articles  ArticleTag[]
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

model AiUsageLog {
  id               String   @id @default(cuid())
  userId           String?
  provider         String
  model            String
  feature          String   // "blog", "blog-image", "blog-sources", "improve-text", ...
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  estimatedCostUsd Decimal? @db.Decimal(10, 6)
  durationMs       Int?
  success          Boolean  @default(true)
  errorMessage     String?
  metadata         Json?
  createdAt        DateTime @default(now())
  @@map("ai_usage_logs")
}
```

**Decisões de design a respeitar:**
- `Author` ≠ `User`. O `User` é quem loga; o `Author` é a **entidade pública credenciada** que
  assina o conteúdo e tem `/autores/[slug]`. Não funda os dois — separá-los é o que torna o
  E-E-A-T verdadeiro e o JSON-LD `Person` rico.
- `directAnswer` vira a `description` do Article JSON-LD (Seção 7). É a frase que o LLM cita.
- `metadata` é o saco flexível (FAQ, keywords, citations, schemaType, etc.) — evita 15 colunas.
- `content` é **HTML** (gerado e editado), nunca markdown.

---

## 4. Sistema de IA roteável (registry + providers + routing)

A geração não fala com um SDK fixo. Cada **feature** ("blog", "blog-image", "blog-sources", …)
aponta para um **provedor** via `PlatformSettings` key `ai.routing`. A rota resolve o provedor,
descriptografa as credenciais e chama a interface comum.

### 4.1 Interface comum — `src/lib/integrations/ai/types.ts`
```ts
export interface IAIProvider extends IBaseProvider {
  generateText(prompt, options?): Promise<{ text; usage? }>;
  generateChat(messages: {role:"system"|"user"|"assistant"; content:string}[], options?)
    : Promise<{ text; usage? }>;
  generateImage?(prompt, options?): Promise<{ b64?; url?; mimeType? }>;   // opcional
  searchSources?(query, options?): Promise<{ sources:{title;url}[]; summary? }>; // opcional
}
// options: { model?, maxTokens?, temperature? }
```
Providers em `src/lib/integrations/ai/`: **anthropic, openai, google-ai, groq, mistral, cohere,
huggingface, replicate**. Nem todos implementam `generateImage`/`searchSources` (a rota valida e
devolve erro amigável se faltar — ex.: trocar para OpenAI no Roteamento).

### 4.2 Registry + criptografia
- `registry.ts` — `registerProvider("AI_PROVIDER", "anthropic", Classe)` no load; `getProvider(type, name, credsCriptografadas)` descriptografa e `initialize()`. Chave: `"TIPO::nome"`.
- `encryption.ts` — AES-256-GCM (`ENCRYPTION_KEY`, 64-hex). Credenciais ficam cifradas em `IntegrationConfig`.

### 4.3 Padrão de resolução por feature (copie em cada rota de IA)
```ts
async function getBlogProvider(): Promise<IAIProvider> {
  const row = await prisma.platformSettings.findUnique({ where: { key: "ai.routing" } });
  let providerName = "anthropic";
  if (row) { try { providerName = JSON.parse(row.value).blog || "anthropic"; } catch {} }
  const config = await prisma.integrationConfig.findFirst({
    where: { type: "AI_PROVIDER", provider: providerName, enabled: true },
  });
  if (!config) throw new Error(`Provedor "${providerName}" não configurado.`);
  return getProvider<IAIProvider>("AI_PROVIDER", providerName, config.credentialsEncrypted);
}
```
Defaults do `routing/route.ts`: `{ blog:"anthropic", "blog-image":"openai", "blog-sources":"openai", product:"anthropic", crm:"anthropic" }`.

> **Se o projeto-alvo não tem o registry de integrações:** porte `registry.ts`, `encryption.ts`,
> `types.ts` e ao menos um provider (`anthropic.ts` + `openai.ts`). É o mínimo viável.

---

## 5. Rotas de IA — contratos e prompts

> **Cuidado:** os prompts são o "molho secreto". Leia cada rota no fonte antes de copiar.
> Todas exigem `requireAuth(["SUPERADMIN","ADMIN","EDITOR"])` e logam em `AiUsageLog`.

### 5.1 `generate-article` (o principal) — prompt real
- **POST** `{ topic, keywords?, tone?, length?, style? }`
  - `tone`: educacional | clinico | divulgacao | academico
  - `style`: narrativo | objetivo | guia | storytelling | jornalistico
  - `length`: curto(500) | medio(1000) | longo(2000) | extenso(3000) palavras
- **maxTokens** = `min(16000, wordTarget*4 + 3000)`; **temperature** 0.7.
- O **system prompt** exige (resumo do real — veja `generate-article/route.ts` para o texto exato):
  - PT-BR; tamanho mínimo obrigatório de palavras; **índice clicável** (`<h2 id="indice">` + `<ul>` com âncoras; cada seção `<h2 id="sN">`); só **HTML** (sem markdown); definições, citações de autores, `<blockquote>`.
  - **Responder EXCLUSIVAMENTE JSON válido** (sem code blocks) com:
    ```json
    { "title","content","excerpt","seoTitle","seoDescription",
      "directAnswer","suggestedTags":[],"focusKeyword","secondaryKeywords",
      "citations","faqItems":[{"question","answer"}],
      "authorQualification","citedSources":[],"verifiableFacts" }
    ```
  - 3–5 `faqItems`, ≥2 citações/fontes.
- A rota faz parse tolerante (remove ```` ```json ```` se vier) e devolve os campos com defaults.

### 5.2 `improve-text`
- **POST** `{ text, action: "improve"|"expand"|"summarize", targetWords? }`. Provider feature "blog".
  - `improve` → reescreve (HTML); `expand` → ~2× ou atinge `targetWords` (HTML); `summarize` → 2-3 frases, 120-160 chars, **texto puro**.
- Retorna `{ result, usage }`. temperature 0.5.

### 5.3 `find-sources`
- **POST** `{ title?, keyword?, topic? }`. Feature "blog-sources" (default OpenAI). Exige `searchSources`.
- Prompt pede fontes **reais e citáveis** ("NÃO invente"; se YMYL, priorizar .gov/.edu/periódicos). Retorna `{ sources:[{title,url}], summary?, count }`.

### 5.4 `generate-image`
- **POST** `{ prompt, alt, size? }`. Feature "blog-image". Exige `generateImage`.
- Prompt final = `DEFAULT_IMAGE_STYLE` (de `blog-image-style.ts`) + "\n\nAssunto: {prompt}". Salva via `saveMedia(buffer, "blog/{uuid}.png", mime)` → `{ url, alt, storage }`.

### 5.5 `optimize`, `image-style`, `usage`, `routing`
- `optimize` — recebe o conteúdo + lista de *checks* que falharam (do editor) e devolve sugestões campo-a-campo. **Leia o fonte** para o formato exato de `suggestions`.
- `image-style` — `GET`/`PUT` do preset (PlatformSettings).
- `usage` — agrega `AiUsageLog` (por dia/feature/provider/usuário).
- `routing` — `GET`/`PUT` do `ai.routing`.

---

## 6. Editor admin + scores ao vivo

`src/components/admin/article-editor.tsx` é o componente central. Reproduza:

- **Form em seções colapsáveis:** Básico (title/slug/categoria/tags/featuredImage/excerpt) ·
  Conteúdo (editor TipTap + botões IA inline "Melhorar/Expandir/Resumir") · SEO (seoTitle 50-60,
  seoDescription 150-160, focus/secondary keywords, canonical, schemaType) · GEO (citations,
  custom JSON-LD, FAQ dinâmica com "Buscar fontes reais") · E-E-A-T (authorProfile, reviewedBy,
  **directAnswer/TL;DR**, review date, cited sources, isYmyl, verified badge) · LLM (citability,
  clear definitions, verifiable facts).
- **Sidebar com 4 scores 0-100 (gauges SVG), calculados no cliente (sem IA):**
  - **SEO:** keyword no título/meta, seoTitle 50-60, meta 150-160, >300 palavras, `alt` nas imagens, links internos, slug com keyword, presença de H2/H3, densidade 1-3%.
  - **GEO:** citations, structured data (JSON-LD presente), FAQ presente, >1000 palavras.
  - **E-E-A-T:** authorProfile vinculado, qualificação, cited sources, data de publicação, data de revisão, revisor.
  - **LLM:** definições claras, fatos verificáveis, headings, >500 palavras.
- **Painel "Melhorar com IA":** envia os *checks* que falharam para `optimize` e exibe sugestões aplicáveis.
- **TipTap (`block-editor.tsx`):** StarterKit + Underline, TextAlign, Link, Image, Placeholder,
  Highlight, Color/TextStyle, BubbleMenu. Toolbar com H1-H3, listas, link, imagem, alinhamento.
  **Salva HTML** (string), que vai para `Article.content`.

> **Cuidado:** a lógica exata dos scores (pesos e *thresholds*) está no componente. Copie-a
> verbatim e só depois ajuste pesos. É o que dá o feedback "verde" que guia o redator.

---

## 7. Renderização pública + JSON-LD (E-E-A-T/GEO)

### 7.1 Builder de JSON-LD — `src/lib/article-jsonld.ts` (copie integralmente)
Emite `[Article, FAQPage?]`. Pontos a manter:
- `Person` com **`@id` estável** (`{SITE}/autores/{slug}#person`), `jobTitle`, `description`(bio),
  `image`, `knowsAbout[]`, `sameAs[]`, **`hasCredential[]`** (`EducationalOccupationalCredential`).
- `Article.description` = **`directAnswer` || excerpt || seoDescription** (a isca de citação).
- `inLanguage: "pt-BR"`, `datePublished`, `dateModified` (= updatedAt || publishedAt),
  `mainEntityOfPage`, `keywords`, `author` (Person credenciado ou nome simples), `publisher` (Organization + logo).
- `reviewedBy` (Person) + `lastReviewedAt` quando houver revisor (sinal forte para YMYL).
- `FAQPage` separado quando `metadata.faq` existe.

```ts
// assinatura
export function buildArticleJsonLd(article: ArticleForJsonLd): object[]  // [articleSchema, faqPageSchema?]
export function personNode(a: JsonLdAuthor): Record<string, unknown>
```
**Troque a constante `SITE` e o `publisher` (nome/logo da Organization) para a marca do alvo.**

### 7.2 Página do artigo — `src/app/(public)/blog/[slug]/page.tsx` (+ `layout.tsx`)
- Busca `GET /api/articles/{slug}` (só PUBLISHED; incrementa `viewCount`).
- Injeta `buildArticleJsonLd(article)` em `<script type="application/ld+json">` (server-side, no `layout.tsx`/`generateMetadata`).
- `generateMetadata`: `title = seoTitle||title`, `description = seoDescription||excerpt`, `canonical=/blog/{slug}`, OpenGraph `type:"article"` (publishedTime, authors, image).
- Renderiza: hero (featuredImage), título, **meta de confiança visível ao leitor** (autor credenciado, data de publicação, data de revisão, revisor se YMYL), conteúdo HTML, **TOC** (gerado dos H2/H3), tags, relacionados.

### 7.3 Página do autor — `src/app/(public)/autores/[slug]/page.tsx`
- Foto, nome, jobTitle, bio, credenciais (com ✓), expertise (`knowsAbout`), links externos (`sameAs`), artigos do autor.
- JSON-LD `Person` (mesmo `@id` do `personNode`).

### 7.4 SEO técnico
- `sitemap` inclui posts PUBLISHED (com `lastModified`).
- `robots`: `allow /`, `disallow /admin`, `/api/admin`, `/checkout`.
- Garanta `slug` único e canonical correto.

---

## 8. Fluxos integrados (ponta a ponta)

**Criar com IA** (`/admin/blog-cms/criar-ia`):
```
tema+keywords+tom+estilo+tamanho+autor+revisor+flags
  → POST ai/generate-article          → {title,content,excerpt,seo*,directAnswer,faqItems,focusKeyword,...}
  → (se flag) POST ai/find-sources    → {sources[]}
  → (se flag) POST ai/generate-image  → {url}  (capa)
  → (se flag) POST ai/generate-image  → {url}  (figura inline, antes da 3ª H2)
  → POST /api/admin/articles          → cria DRAFT com metadata preenchido
  → router.push(/admin/blog-cms/{id}) → abre editor para revisão
```
**Otimizar** (no editor): scores no cliente → "Melhorar com IA" → `ai/optimize` → aplica sugestões.
**Publicar:** `PUT /api/admin/articles/{id}` (vincula authorProfile/reviewedBy, isYmyl) → status `PUBLISHED`, `publishedAt=now()` → aparece em `/blog`, JSON-LD na página, entra no sitemap.

---

## 9. Ordem de reconstrução no projeto-alvo (fases)

> Espelha o plano do `blueprint-blog-seo-geo-eeat.md`, com a área inteira.

- **Fase 0 — Dados (1 PR):** cole os models da Seção 3, `prisma generate` + `db push`. Ajuste `User`. *Aceite:* tabelas criadas, relações OK.
- **Fase 1 — Público + SEO técnico (alto ROI):** API pública (`/api/articles`, `/api/articles/[slug]`), páginas `/blog` e `/blog/[slug]`, `buildArticleJsonLd`, `generateMetadata`, sitemap/robots. *Aceite:* artigo seed renderiza com JSON-LD válido (teste no Rich Results).
- **Fase 2 — Autoria credenciada (E-E-A-T):** model `Author` + CRUD admin + página `/autores/[slug]` + `personNode` no JSON-LD. *Aceite:* `Person` com `hasCredential`/`sameAs` no artigo.
- **Fase 3 — Editor + scores:** `article-editor.tsx` + `block-editor.tsx` (TipTap) + scores ao vivo + CRUD admin completo. *Aceite:* criar/editar/publicar pelo painel; scores reagem.
- **Fase 4 — IA roteável:** registry + encryption + ≥2 providers + rotas `routing`, `generate-article`, `improve-text`, `find-sources`, `generate-image`, `optimize`, `usage` + wizard `criar-ia`. *Aceite:* gerar artigo do zero e abrir no editor.
- **Fase 5 — Polimento GEO/LLM:** `directAnswer`, FAQ → FAQPage, fontes reais, isYmyl, `lastReviewedAt`, preset de imagem. *Aceite:* checklist da Seção 11.

---

## 10. Adaptação de domínio (de "psicanálise" para qualquer nicho)

Pontos onde o nicho está *hardcoded* — troque todos:
- **`generate-article/route.ts`**: system prompt ("redator especialista em psicanálise…", autores citados Freud/Lacan…). Reescreva para o nicho do alvo.
- **`blog-image-style.ts`**: `DEFAULT_IMAGE_STYLE` (paleta roxo/amarelo Enlevo, temática). Ajuste à marca.
- **`article-jsonld.ts`**: `SITE` + `publisher` (nome/logo da Organization).
- **Páginas públicas**: textos de hero ("Blog & Artigos", "Ideias. Clínica."), cores/tema.
- **Categorias/tags seed**: troque pelo vocabulário do nicho.
- **`isYmyl`**: continua válido para qualquer nicho de saúde/dinheiro/direito; em nichos não-YMYL, o revisor é opcional.

> **Cuidado:** não deixe nenhuma menção a "Academia Enlevo", "psicanálise" ou Freud/Lacan
> vazar para o projeto-alvo. Faça um `grep -ri "enlevo\|psicanál\|freud\|lacan"` ao final.

---

## 11. Checklist de aceite ("a área virou referência para busca e IA?")

- [ ] Modelos criados; `Author` separado de `User`.
- [ ] Artigo publicado renderiza `<script type="application/ld+json">` com **Article** válido (Rich Results Test passa).
- [ ] `Person` do autor traz `hasCredential`, `knowsAbout`, `sameAs`, `@id` estável.
- [ ] `directAnswer` aparece como `description` do Article (isca de citação).
- [ ] FAQ vira **FAQPage** no JSON-LD quando presente.
- [ ] `reviewedBy` + `lastReviewedAt` presentes em conteúdo YMYL.
- [ ] `generateMetadata` com title/description/canonical/OpenGraph corretos.
- [ ] Sitemap inclui posts PUBLISHED; robots bloqueia /admin e /api/admin.
- [ ] Editor calcula os 4 scores e o "Melhorar com IA" funciona.
- [ ] Wizard "Criar com IA" gera artigo completo, busca fontes e gera imagem.
- [ ] Roteamento de IA por feature funciona (trocar provider em PlatformSettings reflete).
- [ ] Telemetria em `AiUsageLog` registra cada chamada.
- [ ] `grep` do nicho antigo não retorna nada.

---

## 12. Arquivos para portar primeiro (prioridade)

1. `prisma/schema.prisma` (models da Seção 3).
2. `src/lib/article-jsonld.ts` (troque SITE/publisher).
3. `src/lib/integrations/{registry,encryption,types}.ts` + `ai/anthropic.ts` + `ai/openai.ts`.
4. `src/app/api/articles/*` + páginas públicas `/blog` e `/blog/[slug]`.
5. `src/services/{article,author}.service.ts` + `src/app/api/admin/{articles,authors}/*`.
6. `src/components/admin/{article-editor,block-editor}.tsx`.
7. `src/app/api/admin/ai/*` + `src/app/admin/blog-cms/criar-ia/page.tsx`.
8. `src/lib/blog-image-style.ts` + `media-store.ts`.

Leia também `docs/blueprint-blog-seo-geo-eeat.md` para o detalhe de cada pilar.

---

*Gerado a partir do código-fonte real da Academia Enlevo em 2026-06-20. Trate os caminhos como
fonte da verdade: abra cada arquivo antes de copiar.*
