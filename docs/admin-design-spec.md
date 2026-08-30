# AVA PCO — Admin: tokens e telas, exatamente como estão

> Extraído do código em 30/ago/2026: `tailwind.config.js`, `src/styles/theme.css`,
> `src/app/layouts/AdminLayout.tsx`, `src/app/components/Sidebar.tsx` e
> `Topbar.tsx`. Valores convertidos de classes Tailwind para CSS concreto, para
> poder ser replicado sem depender do Tailwind.

---

## 0. Uma divergência a resolver antes de desenhar

O laranja está diferente nas duas metades do produto:

| Onde | Valor | Origem |
| --- | --- | --- |
| Site público | `#ff914d` | changelog de design, aplicado em 30/ago |
| Admin e área do aluno | `#FE9002` | `tailwind.config.js`, desde o início |

São laranjas visivelmente distintos — o primeiro é mais salmão, o segundo mais
âmbar. **Escolha um** e ele passa a valer nos dois lados. Recomendo `#ff914d`,
que é o oficial do changelog mais recente.

---

## 1. Tokens de cor

### Marca

```css
--pco-blue:        #0097b2;   /* ação primária, links, foco */
--pco-cyan:        #0cc0df;   /* apoio, fim do degradê */
--pco-cyan-light:  #5ce1e6;
--pco-orange:      #fe9002;   /* ver a divergência acima */
--pco-deep:        #063b49;   /* títulos, texto forte */
--pco-graphite:    #101828;
```

Estados do azul, usados nos botões (não são tokens, estão embutidos):

```css
azul normal   #0097b2
azul hover    #007a92
azul ativo    #006578
laranja hover #e07e00
```

### Superfícies e texto — tema claro

```css
--surface-white: #ffffff;   /* cartões, barra superior, barra lateral */
--surface-off:   #f8fcfd;   /* fundo da página */
--surface-gray:  #eef5f7;   /* bordas, divisores, fundo de hover */

--ink-base:   #101828;   /* texto principal */
--ink-muted:  #475467;   /* texto secundário, itens de menu inativos */
--ink-subtle: #98a2b3;   /* rótulos, placeholders, ícones inativos */
```

### Tema escuro — `html[data-theme="dark"]`

**Só os neutros mudam.** Azul, ciano, laranja e as cores de estado ficam
idênticas, porque têm contraste suficiente nos dois fundos.

```css
--surface-white: #0f1f25;
--surface-off:   #0a1418;
--surface-gray:  #1c2a30;

--ink-base:   #e5edf0;
--ink-muted:  #9aa9ae;
--ink-subtle: #6b7c82;
```

Sombra do cartão no escuro: `0 1px 3px rgba(0,0,0,.4)`.

### Estado

```css
--status-success: #16a34a;
--status-danger:  #d92d20;
--status-warning: #f59e0b;
--status-gold:    #d6a84f;
```

---

## 2. Forma, sombra e movimento

```css
/* Raios (customizados, não os padrão do Tailwind) */
--radius-xl:  14px;   /* botões, campos, itens de menu */
--radius-2xl: 20px;   /* cartões */
--radius-3xl: 28px;

/* Sombras */
--shadow-soft: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
--shadow-card: 0 4px 16px rgba(6,59,73,.06), 0 1px 2px rgba(16,24,40,.04);
--shadow-lift: 0 12px 32px rgba(6,59,73,.10), 0 2px 6px rgba(16,24,40,.06);

/* Curva de aceleração usada em tudo */
--ease-smooth: cubic-bezier(0.22, 0.61, 0.36, 1);
```

Durações: 150 ms em campos e itens de menu, 200 ms em cartões e botões.

---

## 3. Tipografia

Família: `Inter`, com reserva `ui-sans-serif, system-ui, -apple-system,
'Segoe UI', Roboto, sans-serif`. Renderização com `antialiased` e
`optimizeLegibility`.

| Uso | Tamanho | Peso | Cor |
| --- | --- | --- | --- |
| Título de página (`h1`) | 24px | 700 | `--pco-deep` |
| Título de seção | 24px | 600, `letter-spacing:-.02em` | `--pco-deep` |
| Subtítulo de seção | 14px | 400 | `--ink-muted` |
| Corpo | 14px | 400 | `--ink-base` |
| Rótulo de indicador | 11px, caixa alta, `letter-spacing:.05em` | 400 | `--ink-muted` |
| Número de indicador | 24px | 700 | varia por natureza |
| Item de menu | 14px | 500 | `--ink-muted` |
| Título de grupo no menu | 10px, caixa alta | 600 | `--ink-subtle` |

Seleção de texto: fundo `rgba(0,151,178,.18)`, texto `--pco-deep`.

Barra de rolagem: 10px, polegar `#d0d5dd` com raio 8px e borda de 2px na cor do
fundo; ao passar o mouse, polegar em `--pco-blue`.

---

## 4. Componentes, com os valores concretos

### Botão — base comum

```
display: inline-flex; align-items:center; justify-content:center; gap:8px;
border-radius: 14px;
padding: 10px 16px;
font-size: 14px; font-weight: 500;
transition: all 200ms var(--ease-smooth);
foco: anel de 2px em --pco-blue, com deslocamento de 2px sobre --surface-off
desabilitado: opacidade .5, cursor bloqueado
```

| Variante | Fundo | Texto | Borda | Hover |
| --- | --- | --- | --- | --- |
| **Primário** | `--pco-blue` | branco | — | `#007a92` (ativo `#006578`) |
| **Secundário** | branco | `--pco-deep` | `--surface-gray` | borda e texto viram `--pco-blue` |
| **Fantasma** | transparente | `--ink-muted` | — | fundo `--surface-gray`, texto `--pco-deep` |
| **Destaque** | `--pco-orange` | branco | — | `#e07e00` |

### Cartão

```
fundo: branco (--surface-white)
borda: 1px sólida --surface-gray
raio: 20px
sombra: --shadow-card
padding: 24px
transição de sombra: 200ms
variante com elevação no hover: --shadow-lift
```

### Campo de formulário

```
largura: 100%
raio: 14px
borda: 1px sólida --surface-gray
fundo: branco
padding: 10px 16px
texto: 14px, --ink-base
placeholder: --ink-subtle
foco: borda --pco-blue + anel de 2px rgba(0,151,178,.20)
transição: 150ms
```

### Selo (badge)

```
inline-flex, gap 4px, raio 999px, padding 2px 10px, 12px, peso 500
```

A cor vem do estado que ele representa (sucesso, perigo, alerta), sempre com
fundo claro da mesma matiz e texto na cor cheia.

---

## 5. A moldura do admin

```
┌──────────────┬──────────────────────────────────────────────┐
│              │  Barra superior — 64px, fixa no topo         │
│  Barra       ├──────────────────────────────────────────────┤
│  lateral     │                                              │
│  256px       │  Conteúdo                                    │
│  (72px       │  largura máx. 1400px, centralizado           │
│  recolhida)  │  padding 16px (desktop 32px) / 24px vertical │
│              │                                              │
│              ├──────────────────────────────────────────────┤
│              │  Rodapé                                      │
└──────────────┴──────────────────────────────────────────────┘
```

Acima de tudo, quando aplicável: **faixa de ambiente** (avisa que não é
produção) e **faixa de personificação** (avisa que um admin está vendo como
aluno). Ambas ocupam a largura inteira, acima da moldura.

### Barra lateral

- Largura **256px**; recolhida, **72px**. Transição de largura em 200 ms.
- Fundo branco, borda direita 1px `--surface-gray`.
- **Só aparece a partir de 1024px.** Abaixo disso, vira menu deslizante.
- **Topo com o degradê da marca**: `linear-gradient(to right, #063b49, #0097b2, #0cc0df)`,
  com a logomarca em branco. Padding 20px/16px (recolhida: 8px/12px, centralizada).
  Isso é deliberado: antes o painel abria com cabeçalho branco e um logotipo
  diferente do que o visitante acabara de ver, e a passagem do site para o
  painel parecia troca de produto.
- Grupos separados por um filete de 1px `rgba(238,245,247,.7)`, com título em
  10px caixa alta.

**Item de menu:**

| Estado | Fundo | Texto | Ícone | Extra |
| --- | --- | --- | --- | --- |
| Normal | — | `--ink-muted` | `--ink-subtle` | |
| Hover | `--surface-gray` | `--pco-deep` | `--pco-blue` | |
| **Ativo** | `rgba(0,151,178,.10)` | `--pco-deep` | `--pco-blue` | ponto de 6px em `--pco-blue` à direita |

Forma do item: raio 14px, padding 8px 12px, gap 12px, 14px peso 500.
Recolhida, um filete vertical de 24px×2px em `--pco-blue` marca o item ativo, à
esquerda, e o rótulo aparece em 10px sob o ícone, em até duas linhas.

**Ícones:** biblioteca `lucide-react`, tamanho **18px**, espessura de traço
**1.75**.

### Barra superior

```
altura 64px, fixa no topo (z-index 30)
fundo: rgba(255,255,255,.85) com desfoque de fundo
borda inferior 1px --surface-gray
padding lateral 16px (desktop 32px), itens com gap 12px
```

Contém: botão de menu (só abaixo de 1024px), **campo de busca** com largura
máxima de 576px (oculto abaixo de 768px), e à direita os controles de conta,
tema e notificações.

O resultado da busca abre logo abaixo, como cartão com `--shadow-lift`, altura
máxima 420px e rolagem própria; cada resultado tem ícone em `--pco-blue`,
título em 14px peso 600 `--pco-deep`, descrição em 12px `--ink-muted` e um
rótulo de tipo em 10px caixa alta `--ink-subtle`.

### Paleta de comandos e atalhos

Existe uma **paleta de busca** aberta por atalho de teclado, e um **modal de
atalhos** com a lista. O modal usa: fundo `rgba(6,59,73,.5)` com desfoque,
cartão de largura máxima 448px, altura máxima 80% da tela, cabeçalho fixo com
borda inferior.

---

## 6. Padrões que se repetem nas telas

### Cabeçalho de página

Linha com `align-items: flex-end`, `justify-content: space-between`, quebra em
telas pequenas. À esquerda o `h1` (24px, peso 700, `--pco-deep`, muitas vezes
com um ícone ao lado, gap 8px). À direita, botões secundários em 12px.

### Faixa de indicadores

Grade de 4 colunas a partir de 640px, gap 12px. Cada indicador é um cartão com:
rótulo em 11px caixa alta `--ink-muted`, e número em 24px peso 700 logo abaixo,
colorido pela natureza do dado — `--status-success` para receita, `--pco-cyan`
para volume, `--pco-orange` para pendências, `--pco-deep` para totais.

### Barra de filtros

Cartão com padding 12px, itens em linha com gap 12px e quebra. Dentro: campo de
busca ocupando o espaço livre (largura mínima 200px, 14px) e seletores.

### Tabela

Cabeçalho em 11px caixa alta `--ink-muted`. Linhas divididas por 1px
`--surface-gray`, com hover em `--surface-off`. Células com padding 12px,
alinhamento superior. Em telas estreitas, rolagem horizontal no próprio
contêiner — a página nunca rola de lado.

### Estados

Cada listagem precisa de três: **vazio** (explica o que apareceria ali e o que
fazer), **carregando** e **erro** (diz o que houve e como resolver, sem pedir
desculpa).

---

## 7. As telas, agrupadas como o menu as agrupa

### Painel — 6 telas

`/admin/dashboard` visão geral · `/admin/setup` checklist de configuração ·
`/admin/saude` saúde do sistema · `/admin/atividade` atividade recente ·
`/admin/experiments` testes A/B · `/admin/alertas` central de alertas

### Acadêmico — 15 telas

`/admin/cursos` lista · `/admin/cursos/:id` editor de curso ·
`/admin/cursos/:id/preview` prévia · `/admin/cursos/:id/questoes` banco de
questões · `/admin/cursos/:id/analytics` desempenho do curso ·
`/admin/cursos/:id/alunos` alunos do curso · `/admin/trilhas` trilhas de estudo ·
`/admin/modulos` · `/admin/aulas` · `/admin/transcricoes` ·
`/admin/alunos` e `/admin/alunos/:id` · `/admin/convites` convites de acesso ·
`/admin/certificados` · `/admin/conquistas` · `/admin/leaderboard`

### Conteúdo — 7 telas

`/admin/biblioteca` · `/admin/news` · `/admin/podcasts` ·
`/admin/sessoes-ao-vivo` · `/admin/zoom` configuração do Zoom ·
`/admin/analise-supervisao` profissionais, serviços e faixas de preço ·
`/admin/mentorias`

### Vendas — 6 telas

`/admin/pedidos` · `/admin/produtos` · `/admin/cupons` ·
`/admin/gateways` seis meios de pagamento · `/admin/vendas` análise ·
`/admin/wishlist` lista de desejos

### Comunicação — 8 telas

`/admin/email` provedores e configuração · `/admin/email/templates` ·
`/admin/email/weekly-report` · `/admin/progresso-aluno` ·
`/admin/mensageria` WhatsApp e SMS · `/admin/broadcasts` · `/admin/digest` ·
`/admin/notificacoes` · `/admin/webhooks` · `/admin/reengajamento-auto`

### Inteligência — 8 telas

`/admin/ias` provedores de IA · `/admin/tutor` · `/admin/tutor-chat` auditoria
das conversas · `/admin/plano-retomada-ia` · `/admin/evasao` previsão ·
`/admin/retencao` · `/admin/metricas` · `/admin/jobs` rotinas de fundo

### Sistema — 20 telas

`/admin/usuarios` e `/admin/usuarios/:id` · `/admin/usuarios/import` ·
`/admin/papeis` · `/admin/sessoes` · `/admin/api-tokens` ·
`/admin/auditoria` · `/admin/erros` · `/admin/logs` · `/admin/rate-limits` ·
`/admin/imports` (mais assistente CSV, assistente de API, agendamentos,
histórico e detalhe de execução) · `/admin/backups` · `/admin/backup` ·
`/admin/login-modelos` · `/admin/login-customizacao` · `/admin/configuracoes` ·
`/admin/moderacao` · `/admin/lgpd-exclusoes` · `/admin/suporte` ·
`/admin/sobre` · `/admin/onboarding`

---

## 8. O que precisa ser respeitado

1. **Acessibilidade já implementada**: link "Pular para o conteúdo" visível ao
   receber foco, `aria-label` na navegação, anel de foco visível em tudo que é
   interativo. Não perder isso no redesenho.
2. **Tema escuro é obrigatório** e funciona hoje trocando só os neutros. Manter
   essa estratégia poupa metade do trabalho.
3. **Densidade.** É um painel operado, não lido: o resumo vem antes do detalhe,
   e o estado precisa ser legível de relance — cor sozinha não basta, use
   também forma (selo, faixa, ícone).
4. **Números com a base.** Percentual sem denominador não permite desconfiar. E
   onde não houve medição, mostrar travessão, nunca zero.
5. **Largura máxima de 1400px** no conteúdo. Tabelas largas rolam dentro do
   próprio contêiner.
