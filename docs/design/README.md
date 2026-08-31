# Design — a fonte, e por que ela mora aqui

O desenho do site **não nasce neste repositório**. Ele vive num projeto do
Claude Design, criado e aprovado pelo dono:

> **Inspiração Loyalist College** —
> https://claude.ai/design/p/b11d34a1-b413-4714-8973-9a7fbb67620d

São 17 artboards (`.dc.html`) mais `tokens.css`, `data/site.js` e um
`README-HANDOFF.md`. É de lá que sai o que o produto deve parecer.

## Por que existe uma cópia aqui

Porque a sessão de 30/ago/2026 aplicou **só o resumo** (`CHANGELOG-design.md`) e
o handoff completo nunca chegou ao repositório. O resultado: a página do curso
em produção não era a que o dono tinha escolhido, e a sessão seguinte começou a
refazê-la a partir do código existente — que era justamente o que devia ser
substituído. O dono precisou interromper e mandar recuperar a informação.

Uma URL num documento não sobrevive a uma troca de sessão. Um arquivo no
repositório, sim.

## O que está copiado

| Arquivo | O que é |
| --- | --- |
| `README-HANDOFF.md` | O mapa. **Comece por ele** — tokens, header/footer, os 3 layouts, biblioteca de componentes e as páginas por ordem de impacto |
| `CHANGELOG-design.md` | O delta de design (cores, pincel, CTAs, rodapé, conteúdo do curso, bugfixes) |
| `pages/Curso.dc.html` | A página do curso — transposta em 30/ago/2026 |
| `pages/Cursos.dc.html` | A lista de formações — transposta em 30/ago/2026 |
| `pages/Checkout.dc.html` | O checkout — transposto em 30/ago/2026, **sem** os campos de cartão |
| `pages/Home.dc.html` | A página inicial — transposta em 30/ago/2026 |
| `pages/Login.dc.html` | O login (React, não SSR) — só os blocos que faltavam |
| `data/site.js` | Dados de referência, com o **conteúdo verbatim** do curso de Psicanálise Clínica |

## Como usar

Os `.dc.html` usam um runtime próprio (`sc-for`, `dc-import`, `support.js`). O
README do handoff é explícito: **não portar o runtime** — recriar markup e
estilo. Foi o que se fez na página do curso: o protótipo escreve tudo em `style`
inline, e aqui virou classe em `server/public/styles.ts`.

Três coisas do protótipo **não** atravessam, e isso é regra, não detalhe:

- **Preço.** `site.js` traz `price: 1497` como dado de maquete. O preço do
  produto sai de `/admin/produtos`, sempre. Gravar o número do protótipo
  criaria uma oferta que ninguém decidiu — e oferta obriga o fornecedor
  (CDC, art. 30).
- **Contagem de estrutura.** O protótipo diz "12 módulos · 60 aulas · 560
  horas". Esses números se contam do curso real, não se declaram. A página lê
  `modules` / `lessons` / `totalHours` do próprio curso.
- **Número sem medição.** O protótipo propõe "+1000 alunos formados" e "96% de
  satisfação". Não existe pesquisa de satisfação neste sistema, e "formados" se
  conta por certificado emitido. `numerosDoSite()` mede o que dá para medir e
  omite o resto — número em página de venda é afirmação de resultado, e
  afirmação de resultado tem dono (CDC, art. 37).

E mais duas que valem por página:

- **Campos de cartão no checkout.** O protótipo desenha número, validade e CVV,
  e se anuncia como "ambiente de demonstração". O checkout real é hospedado: o
  pagamento acontece na página do provedor. Copiar os campos criaria escopo de
  PCI que o projeto não tem.
- **"Adicionar ao carrinho".** Não existe página de carrinho neste site, só o
  contador no topo. Onde o protótipo põe essa ação, o produto manda para o
  checkout — ou não mostra botão nenhum.

O que atravessa é texto: `scripts/conteudo/psicanalise-clinica.json`, aplicado
por `scripts/aplicar_conteudo_curso.ts` (seco por padrão, `--commit` grava).

## O que falta transpor

Do handoff, ainda não vieram para o produto: `Dashboard`, `Aula`,
`Componentes`, `SiteFooter`, `Sobre`, `Contato`, `Carrinho`, `Blog`, `Post`,
`Autor` — e o `tokens.css` como fonte única (hoje os tokens estão duplicados
entre `server/public/styles.ts` e `tailwind.config.js`).

Duas decisões continuam com o dono, e por isso não foram tomadas aqui:

- **O cabeçalho.** O protótipo usa cabeçalho **branco** com a logomarca; o site
  usa o degradê da marca, decisão tomada em 30/ago. Os dois não valem ao mesmo
  tempo.
- **O carrinho.** Ou existe página de carrinho, ou a ação sai do desenho. Hoje
  há contador no topo e nenhuma página.

Para baixar mais arquivos: abrir o projeto, **All project files**, passar o
mouse na linha, `...` → Download.
