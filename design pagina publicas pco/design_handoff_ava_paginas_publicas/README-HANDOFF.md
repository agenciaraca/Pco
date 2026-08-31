# HANDOFF COMPLETO — Design AVA PCO (um sistema, duas metades)

Resposta ao inventário `PCO-paginas-para-design.md` (30/ago/2026), na ordem pedida na seção 8. Formato: HTML/CSS estático de referência — você faz a transposição para `server/public/` (SSR) e `src/app/` (React/Tailwind).

> Os arquivos `.dc.html` são protótipos navegáveis (usam um runtime próprio — tags `sc-for`/`dc-import` + `support.js`). **Não portar o runtime**: recriar o markup/estilo. Todo valor visual vem de `tokens.css`.

---

## 1. Tokens (fonte única) → `tokens.css`

Custom properties completas, claro + escuro (`[data-theme="dark"]` e `prefers-color-scheme`), com base mínima (`body`, `a`, headings, `::selection`).

Mapeamento sugerido:
- **server/public/styles.ts**: embutir `tokens.css` no `<head>` (é pequeno; não quebra Core Web Vitals — zero webfont, `--font-sans` é system-ui).
- **tailwind.config.js**: `colors: { paper: 'var(--paper)', ink: 'var(--ink)', accent: 'var(--accent)', … }`, `borderRadius: { DEFAULT: 'var(--radius)', sm: 'var(--radius-sm)', lg: 'var(--radius-lg)' }`, `boxShadow: { DEFAULT: 'var(--shadow)', lg: 'var(--shadow-lg)' }`. A app passa a ler os mesmos nomes; o dark mode vem de graça pelos tokens (usar `darkMode: ['selector', '[data-theme="dark"]']` + fallback media).
- **Fonte**: as DUAS metades em `var(--font-sans)` (system-ui). Aposentar a Inter da app — é isso que costura a fronteira do login sem custo de CWV.

Regras invioláveis dos tokens: um acento (ciano) manda; laranja é detalhe + CTA de compra; semânticos são estado; degradês sempre principal→escuro (`--grad-brand`, `--grad-cta`).

## 2. Header e footer definitivos (um par)

- **`pages/SiteHeader.dc.html`** — logo, nav, carrinho com badge (laranja), CTA "Matricular-se" (degradê laranja), hambúrguer ≤900px. Variantes: `solid` (padrão) e `onhero` (transparente → sólida ao rolar, só na Home). **Na app logada**, o mesmo header trocando nav pública por: alternador de tema, sino de notificações e avatar/menu do usuário — ver topo de `pages/Dashboard.dc.html`. Mesma altura (~62px), mesma marca, mesmos raios.
- **`pages/SiteFooter.dc.html`** — degradê da marca, pincel invertido no topo, 3 colunas centralizadas (contatos+endereços / selo RNTP / política de privacidade verbatim), barra de copyright. Único para as duas metades (na app pode ficar mais curto nas telas de leitura — manter ao menos a barra de copyright + links legais).

## 3. Os três layouts

| Layout | Referência | Anatomia |
| --- | --- | --- |
| **Site público** | `pages/Home.dc.html` (e demais públicas) | Header fixo + seções full-bleed com divisor "pincel" + footer 3 colunas. Container 1120–1280px, padding lateral 24–28px |
| **Área do aluno** | `pages/Dashboard.dc.html` | Header do app (sticky) + sidebar fixa 240px (itens com estado ativo em `--accent-soft`) + conteúdo em cards. Colapsa ≤980px (sidebar some → menu) |
| **Leitor de aula** | `pages/Aula.dc.html` | Header compacto (breadcrumb + progresso do curso) + nav do curso 300px à esquerda (módulos/aulas com estados: concluída ✓, atual ▶, bloqueada 🔒) + coluna de leitura máx. 68ch, player 16:9 com botão "Modo Foco", navegação anterior/próxima no rodapé da aula |

## 4. Biblioteca de componentes → `pages/Componentes.dc.html`

Página viva com todos os estados (normal/hover/foco/desabilitado/carregando/vazio/erro), com botão de alternar tema para conferir o escuro:
- Botão: 4 variantes (CTA laranja, primário ciano, outline, ghost) + WhatsApp; estados incl. spinner
- Campo: label acima, foco com anel `--accent-soft`, erro com mensagem (nunca só cor), desabilitado
- Cartão, selo (marca vs. semântico), abas
- Avisos: **âmbar de formação livre (obrigatório em curso/artigo, visível)**, sucesso, erro
- Tabela (tabular-nums; sem medição = travessão) + paginação
- Estados de página: vazio (orienta ação), carregando (skeleton), erro (com saída)
- Modal e padrão de chat do Tutor Virtual (IA à esquerda `--surface-2`, aluno à direita `--accent`, disclaimer fixo)

## 5. Páginas em ordem de impacto

| Rota | Referência | Status |
| --- | --- | --- |
| `/` | `pages/Home.dc.html` | pronta (hero com foto tênue 16% sob degradê, pincel, números com contador) |
| `/formacao/:slug` | `pages/Curso.dc.html` | pronta, com conteúdo real verbatim do curso de Psicanálise Clínica (highlights, seções longas com par de CTAs, jornada, regulamento, aviso) |
| `/checkout` | `pages/Checkout.dc.html` | pronta (protótipo; `finish()` = ponto do gateway) |
| `/login` | `pages/Login.dc.html` | **nova** — fronteira sem salto: painel esquerdo no degradê da marca (mesma foto tênue do hero), form à direita, Google/Microsoft, "lembrar de mim", bloco para quem não tem compra |
| `/dashboard` | `pages/Dashboard.dc.html` | **nova** — próxima ação recomendada (card com régua no degradê), progresso com base explícita ("14 de 60 aulas · 23%"), avisos, atalhos |
| `/curso/:id/aula/:lessonId` | `pages/Aula.dc.html` | **nova** — leitor completo (ver layout 3) |

Demais públicas prontas: `Cursos` (→ `/formacoes`), `Carrinho`, `Blog`, `Post`, `Sobre`, `Contato`, `Autor`. `AVA.dc.html` = página-manifesto de estilo (referência, não rota).

### Páginas ainda sem referência dedicada (derivar dos componentes + layouts)
`/esqueci-senha`, `/redefinir-senha` (variações do Login) · `/onboarding` (cards passo a passo do Dashboard) · `/catalogo`, `/comparar`, previews (layout aluno + cards de curso) · `/verificar/:code` (card central sério: selo RNTP + estado bom/ruim dos avisos) · `/termos`, `/privacidade` (coluna de leitura 68ch do leitor) · 404 (estado de erro da biblioteca) · Jornada, Tutor, Certificados etc.: usar os padrões do Dashboard/chat/tabela. Admin (~80 telas): fora do escopo, herda tokens + componentes.

## 6. Regras de conteúdo respeitadas no design (seção 7 do inventário)

1. Aviso de formação livre: componente âmbar visível — presente em Curso, Post e Aula.
2. Análise e supervisão: nenhum desenho a coloca como requisito (no site público é bloco "opcional, contratado separadamente").
3. Autoria institucional: posts assinados pela organização; página `/autor` só com responsável nomeado (perfil atual é placeholder marcado).
4. Números com base: padrão aplicado (Dashboard "14 de 60 aulas · 23%"; tabela usa travessão sem medição).
5. Preço por titulação: não desenhado ainda — na tela de agendamento, o preço deve aparecer junto ao PROFISSIONAL (card com titulação + valor), nunca no serviço.

## 7. Extras já decididos

- **Divisor "pincel"**: 3 camadas (.3/.5/1), SVG em `CHANGELOG-design.md` §5; fill = cor da seção seguinte; invertido no topo do footer.
- **WhatsApp**: botões `#25D366` com ícone SVG oficial.
- **Mascote** (`assets/mascote-*.png`, 4 poses): sem uso definido; se entrar, nunca na Jornada (público adulto — decisão registrada no inventário).
- **SEO/E-E-A-T**: JSON-LD por tipo, TL;DR, sitemap/robots/llms.txt — ver `seo/` e `README.md` (handoff anterior, ainda válido).

## Estrutura do pacote

```
handoff/
├── README-HANDOFF.md          ← este arquivo (comece aqui)
├── README.md                  ← handoff original do site público (rotas, dados, SEO)
├── CHANGELOG-design.md        ← delta de design (pincel, cores, CTAs, rodapé, bugfixes)
├── tokens.css                 ← FONTE ÚNICA de tokens
├── pages/                     ← todas as referências .dc.html (públicas + Login/Dashboard/Aula/Componentes)
├── data/site.js, data/cart.js ← dados de referência (cursos com conteúdo verbatim)
├── seo/robots.txt, sitemap.xml, llms.txt
└── assets/                    ← logo + mascote (4 poses) + foto do hero
```
