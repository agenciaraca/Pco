# Handoff: Páginas públicas do AVA PCO (site institucional + comércio + blog)

## Overview
Este pacote contém o **conjunto de páginas públicas** do projeto AVA PCO (Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online): site institucional, catálogo e páginas de curso, carrinho + checkout (protótipo), blog + artigos, e páginas de Sobre, Autor e Contato. O objetivo é implementá-las no projeto do AVA como o **front público** (marketing/vendas/conteúdo), que leva o usuário ao login/checkout e ao AVA (área logada).

A linguagem visual é a mesma do AVA: acento único **petróleo**, neutros frios, tipografia sans-serif bold, eyebrows em pílula, cards com sombra sutil, tema claro **e** escuro. Todas as decisões de cor/raio/sombra são **tokens CSS** — rebrandar = trocar apenas o trio `--accent / --accent-ink / --accent-soft`.

## About the Design Files
Os arquivos `.dc.html` deste bundle são **referências de design feitas em HTML** (protótipos que mostram aparência e comportamento pretendidos) — **não** código de produção para copiar direto. Eles usam um runtime de componentes próprio (tags `x-dc`, `sc-for`, `dc-import` e um `support.js`). **Não porte esse runtime.** A tarefa é **recriar esses designs no ambiente do projeto AVA**, usando seus padrões e bibliotecas (ex.: Next.js/React + Tailwind, ou o que já existir), transformando:
- cada `.dc.html` em uma **rota/página** e seus blocos em **componentes**;
- os arrays da classe `Component` (em `<script data-dc-script>`) em **dados/CMS** ou props;
- os templates `sc-for`/`sc-if` em `map`/condicional do framework;
- `dc-import name="SiteHeader/SiteFooter"` em **layout compartilhado** (header/footer).

Se ainda não houver front definido, use a stack que melhor casa com o AVA (recomendado: **Next.js App Router + TypeScript + Tailwind**, por causa de SEO/SSR e do JSON-LD).

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento, estados e responsividade são finais. Recrie a UI fielmente usando as bibliotecas/design system do codebase. Os tokens abaixo são a fonte da verdade — prefira ligá-los ao tema existente do AVA em vez de hardcodar hex.

---

## Arquitetura / Rotas

| Rota sugerida | Arquivo de referência | Tipo | Observações |
|---|---|---|---|
| `/` | `Home.dc.html` | estática | Home institucional; hero sobreposto (header transparente→sólido) |
| `/cursos` | `Cursos.dc.html` | estática | Catálogo (lista de cursos) |
| `/curso/[slug]` | `Curso.dc.html` | dinâmica | Página de curso; lê `?slug=`; JSON-LD Course+FAQ+Breadcrumb |
| `/carrinho` | `Carrinho.dc.html` | estática | Carrinho (noindex) |
| `/checkout` | `Checkout.dc.html` | estática | Checkout protótipo (noindex,nofollow) — **plugar gateway** |
| `/blog` | `Blog.dc.html` | estática | Listagem de artigos |
| `/blog/[slug]` | `Post.dc.html` | dinâmica | Artigo; lê `?slug=`; JSON-LD BlogPosting+FAQ+Breadcrumb |
| `/sobre` | `Sobre.dc.html` | estática | Institucional |
| `/autor` | `Autor.dc.html` | dinâmica leve | Perfil do responsável técnico; JSON-LD Person |
| `/contato` | `Contato.dc.html` | estática | Form (protótipo) + canais; JSON-LD ContactPage |
| — | `AVA.dc.html` | **referência de estilo** | NÃO é página pública; é o mock que define a linguagem visual. Use como guia. |

Componentes compartilhados: `SiteHeader.dc.html` (variantes `solid` e `onhero`, badge de carrinho reativo) e `SiteFooter.dc.html`.

Dados centrais: `data/site.js` (ORG, AUTHOR, COURSES, POSTS + helpers) — vira sua **camada de dados/CMS**. Carrinho: `data/cart.js` (localStorage + eventos) — substituir por estado real (Zustand/Context) + persistência.

---

## Design Tokens (fonte da verdade)

Definidos em `:root`, com override em `:root[data-theme="dark"]` e `@media (prefers-color-scheme: dark)`. Estilize **sempre via token**.

### Claro (default)
```
--paper:#f3f4f1;   --surface:#fbfcfa;  --surface-2:#eaece6;  --raise:#ffffff;
--ink:#1b1e22;     --ink-soft:#575c62; --ink-faint:#868c92;
--line:#dcdfd8;    --line-soft:#e8eae4;
--accent:#0f6e66;  --accent-ink:#0c5651;  --accent-soft:#dcebe8;  --on-accent:#ffffff;
--brand-deep:#0b3b37;  --on-deep:#eef3f1;   /* seções escuras estáveis nos 2 temas */
--orange:#e6852f;  --orange-soft:#f6ede1;   /* categoria/CTA de destaque (NÃO é cor de marca) */
--good:#2f7d4f; --good-bg:#e0efe4; --good-line:#bcdcc6;
--warn:#9a6a12; --warn-bg:#f5ead1; --warn-line:#e5d09a;
--crit:#b0422f; --crit-bg:#f6e2dc; --crit-line:#e8bfb3;
--radius:14px;
--shadow:0 1px 2px rgba(20,25,30,.04), 0 4px 16px rgba(20,25,30,.05);
```

### Escuro
```
--paper:#101216;   --surface:#181b20;  --surface-2:#20242a;  --raise:#1e2228;
--ink:#e9ebe6;     --ink-soft:#9ea4aa; --ink-faint:#6e747b;
--line:#2b2f36;    --line-soft:#242830;
--accent:#52bcb0;  --accent-ink:#7fd2c8;  --accent-soft:#16302d;  --on-accent:#0c1f1d;
--brand-deep:#0a2f2c;  --on-deep:#eef3f1;  --orange:#e2954a; --orange-soft:#2a2113;
--good:#5cbd83; --good-bg:#16281d; --good-line:#274a34;
--shadow:0 1px 2px rgba(0,0,0,.3), 0 6px 20px rgba(0,0,0,.28);
```

### Princípios (invioláveis)
1. **Um acento só** (petróleo). Rebrand = trocar só `--accent/--accent-ink/--accent-soft`.
2. **Semânticos** (`--good/--warn/--crit`) são **estado**, nunca cor de marca. Laranja idem (só categoria/destaque).
3. Neutros têm viés frio — nunca cinza puro.
4. Claro e escuro com o mesmo cuidado; tudo via token.
5. Espaçamento por flex/grid + `gap`; cantos `--radius`; sombra `--shadow`.
6. Marcadores numéricos (01/02/03) só quando há sequência real.

## Typography
- **Família única:** `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (corpo e títulos).
- **Títulos** (`h1,h2,h3`): `font-weight:800; letter-spacing:-0.02em`. Tamanhos fluidos: H1 `clamp(34px,4.8vw,58px)`, H2 seção `clamp(24px,3vw,34px)`.
- **Corpo:** 15–18px, `line-height` 1.55–1.7, cor `--ink-soft`.
- **Números/KPIs:** peso 800, `font-variant-numeric: tabular-nums`.
- **Eyebrow (pílula):** `inline-flex; gap:7px; font-size:12.5px; font-weight:600; color:var(--ink-soft); background:var(--surface-2); border:1px solid var(--line); padding:6px 13px; border-radius:999px`.

## Componentes-base
- **Card:** `background:var(--raise); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow)`. Padding 22–32px.
- **Botão primário:** `background:var(--accent); color:var(--on-accent); border-radius:999px; padding:14–17px 26–34px; font-weight:700`.
- **Botão secundário/outline:** `border:1.5px solid var(--line); color:var(--ink); background:transparent/var(--raise)`.
- **Seção escura de marca** (hero, CTA, footer): `background:var(--brand-deep)` com texto branco/`--on-deep` (estável nos 2 temas; NÃO tokenizar o texto branco interno).
- **Hero:** gradiente `linear-gradient(118deg,#0a3f3a,#0f6e66 52%,#1f9e93)` no AVA; nas páginas de conteúdo, hero petróleo/`--brand-deep` sobre foto.
- Larguras: container `max-width:1120–1280px; padding:0 24–28px`.
- Responsivo: quebra em ~900px (grids 2col→1col, 4/3 cards→2) e ~560px (→1col). Nav vira menu hambúrguer em ≤900px.

---

## Páginas (resumo por tela)

### `/` Home (`Home.dc.html`)
Header `onhero` (transparente sobre o hero, fica sólido ao rolar; troca cor de logo/links/badge). Hero full-bleed com foto + overlay, badge, H1, subtítulo, 2 CTAs (primário accent + WhatsApp), prova social (4,7/5 + selo RNTP). Seções: frase-manifesto + 4 tiles verticais; barra de estatísticas (contadores animados via IntersectionObserver) sobre `--brand-deep`; **grade de 3 cursos** (card com faixa colorida, preço, "Ver curso" + "Adicionar" ao carrinho, com toast); "Por que a PCO" (6 cards); teaser do blog (3 posts); CTA final `--brand-deep`; footer; botão flutuante de WhatsApp.

### `/cursos` Catálogo (`Cursos.dc.html`)
Breadcrumb + eyebrow pílula + H1. Lista de cursos em linhas (imagem + título + resumo + chips de specs + preço + "Ver curso"/"Adicionar"). Bloco "não sabe por onde começar" com WhatsApp. Toast ao adicionar. BreadcrumbList JSON-LD.

### `/curso/[slug]` Curso (`Curso.dc.html`)
Lê `slug` da URL. Hero `--brand-deep` (badge, título, tagline, chips). Layout 2 colunas: conteúdo (TL;DR, sobre, para quem/o que desenvolve, ementa numerada por módulo, FAQ accordion, disclaimer YMYL) + **card de matrícula sticky** (preço, "Matricular-se agora" → checkout, "Adicionar ao carrinho", perks, garantia 7 dias). **Injeta JSON-LD** Course + FAQPage + BreadcrumbList e `<title>`/meta dinâmicos. Estado 404 se slug inválido.

### `/carrinho` (`Carrinho.dc.html`)
Estado vazio (ilustração + CTA) e estado com itens: linhas com quantidade (±), remover, subtotal por item; resumo sticky (subtotal/total + "Ir para o checkout"). Reage a mudanças do carrinho (evento). noindex.

### `/checkout` (`Checkout.dc.html`)
Lê o carrinho. Form (nome, e-mail, WhatsApp, CPF), seletor de pagamento (Cartão/Pix/Boleto com UIs distintas), **consentimento LGPD**, resumo sticky. **`finish()` é o ponto de integração do gateway** (Mercado Pago/Pagar.me/Stripe/Hotmart/Eduzz): validar → criar sessão/preferência no backend → redirecionar. Hoje simula sucesso, limpa o carrinho e mostra confirmação com nº de pedido. noindex,nofollow.

### `/blog` (`Blog.dc.html`)
Hero editorial + post em destaque (2 col) + grade de posts. Blog JSON-LD. CTA para cursos.

### `/blog/[slug]` Post (`Post.dc.html`)
Lê `slug`. Cabeçalho (categoria, H1, dek, autor + data + tempo de leitura), imagem, TL;DR, corpo renderizado por blocos (`p`/`h2`/`quote`/`ul`), tags, **box de autor** (link para /autor), FAQ accordion, disclaimer YMYL (com CVV 188), "continue lendo". **Injeta JSON-LD** BlogPosting + BreadcrumbList (+ FAQPage) e meta dinâmicos. 3 artigos reais em `data/site.js`.

### `/sobre` (`Sobre.dc.html`)
Missão, números, "como ensinamos", valores (6), bloco RNTP, CTA para /autor. AboutPage JSON-LD.

### `/autor` (`Autor.dc.html`)
Perfil do responsável técnico (foto, credenciais, `sameAs`), bio, artigos do autor. **Person JSON-LD** — sinal central de E-E-A-T (YMYL). ⚠️ Perfil é **placeholder**: substituir por dados reais (nome, foto, credenciais, LinkedIn/Lattes).

### `/contato` (`Contato.dc.html`)
Form (nome, e-mail, assunto, mensagem, LGPD) — protótipo, ligar a backend/serviço de e-mail. Canais (WhatsApp, e-mail, endereço, horário). ContactPage JSON-LD.

---

## Interações & Comportamento
- **Header:** `onhero` (Home) transparente→sólido em `scrollY>~40–60`, trocando cores de logo/links/badge; demais páginas `solid` fixo com espaçador que reserva a altura.
- **Carrinho:** `add/remove/setQty/clear`; badge no header reativo (evento `pco-cart-change` + `storage` entre abas); **persistência em localStorage** (chave `pco_cart`). Toast "Adicionado ao carrinho" ~2,6s.
- **Contadores** de estatística animam ao entrar na viewport (IntersectionObserver, easing cúbico).
- **Accordions** de FAQ (abre/fecha via `max-height`).
- **Checkout/Contato:** validação simples + estado de sucesso.
- **Tema:** automático por `prefers-color-scheme`; toggle manual com `document.documentElement.dataset.theme = 'dark' | 'light'`.
- **Responsivo:** ver breakpoints acima.

## State Management (ao reimplementar)
- **Carrinho:** store global (Zustand/Context) `{ items:[{slug,title,price,qty}] }` + persistência (localStorage/cookie); derive `count`/`total`.
- **Tema:** classe/atributo em `<html>` + preferência do SO.
- **Curso/Post por slug:** buscar do CMS/dados no server (SSR/SSG) — melhor que query param para SEO real (use rotas `[slug]`).
- **Checkout:** estado do form + método + consentimento; resposta do gateway.

## SEO / E-E-A-T / GEO (manter na reimplementação)
- **JSON-LD por tipo de página** (Organization, WebSite, EducationalOrganization, Course+CourseInstance, BlogPosting, Person, ContactPage, AboutPage, FAQPage, BreadcrumbList). Nos templates dinâmicos hoje é injetado via JS; ao migrar para Next, **emitir no server** (metadata + script JSON-LD).
- **Meta/OG/canonical/title por rota**; `robots` `noindex` em carrinho/checkout.
- **Autor como entidade** com credenciais e `sameAs` (E-E-A-T YMYL — saúde mental).
- **TL;DR** em cursos e posts (answer-first, para GEO/IA).
- **Disclaimers YMYL** ("formação livre; não substitui graduação"; CVV 188).
- Arquivos incluídos: `robots.txt`, `sitemap.xml`, `llms.txt` — regenerar a partir das rotas reais/domínio de produção.
- Conteúdo é **YMYL**: manter honestidade, fontes e limites; não prometer atuação/ranking.

## Assets
- **Logo:** `uploads/cropped-cropped-Logo-PsicanaliseClinicaOnline-e1617998616179-1.png` (incluído em `assets/`). Header usa `filter:brightness(0) invert(1)` quando sobre o hero.
- **Imagens:** as áreas com classe `.ph` (gradiente petróleo listrado) e textos `[ foto: … ]` são **placeholders** — substituir por fotos reais (hero, sobre, avatares, capas de post/curso).
- **Ícones:** SVGs inline estilo lucide (traço 2). Trocar pela biblioteca de ícones do codebase (lucide-react etc.). No AVA alguns ícones de card são glifos unicode — substituir por SVGs reais.
- **Fontes:** system-ui (nativa). Se quiser fonte de marca, definir 1 família e manter os pesos/tracking.

## Dados a preencher (pendências do cliente)
- **Preços/parcelas** dos cursos (em `data/site.js`).
- **Autor real** (nome, foto, credenciais, links) — /autor.
- **Gateway de pagamento** + **serviço de e-mail** do formulário.
- **Fotos reais** no lugar dos placeholders.
- **Domínio de produção** em canonicals/sitemap/JSON-LD.

## Files (nesta pasta)
- `pages/` — todos os `.dc.html` (referências de design), incl. `AVA.dc.html` (só guia de estilo).
- `data/site.js`, `data/cart.js` — dados e lógica de carrinho de referência.
- `seo/robots.txt`, `seo/sitemap.xml`, `seo/llms.txt`.
- `assets/` — logo.
- `support.js` **não** é incluído (runtime do protótipo — não portar).
