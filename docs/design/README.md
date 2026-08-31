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
| `pages/Carrinho.dc.html` | O carrinho — transposto em 31/ago/2026, **sem** o seletor de quantidade |
| `pages/Dashboard.dc.html` | A área do aluno (React) — ainda não transposta |
| `pages/Aula.dc.html` | O leitor de aula (React) — ainda não transposto |
| `pages/Componentes.dc.html` | A biblioteca de componentes com estados — referência |
| `tokens.css` | A FONTE ÚNICA de tokens, claro + escuro |
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
- **O seletor de quantidade do carrinho.** O protótipo desenha "− 1 +" em cada
  item, como qualquer loja. Curso não se compra em dobro: comprar duas vezes não
  dá dois acessos, e o servidor colapsa duplicata ao montar o pedido. Um botão
  que deixasse marcar 3 e cobrasse 1 seria tela que mente.

O que atravessa é texto: `scripts/conteudo/psicanalise-clinica.json`, aplicado
por `scripts/aplicar_conteudo_curso.ts` (seco por padrão, `--commit` grava).

## O que falta transpor

Do handoff, ainda não vieram para o produto: `Dashboard` e `Aula` (as duas de
dentro do AVA, em React), `Componentes`, `SiteHeader`, `SiteFooter`, `Sobre`,
`Contato`, `Blog`, `Post`, `Autor`.

O `tokens.css` já está aqui, mas ainda **não** é a fonte única: os tokens
seguem duplicados entre `server/public/styles.ts` e `tailwind.config.js`.
Unificar mexe na cor de todas as telas do admin, que o dono já aprovou como
estão — então é decisão dele, não conserto técnico.

A tipografia, essa sim, já foi unificada: as duas metades em system-ui, sem
webfont (`test/fronteira-do-login.test.ts`).

Duas decisões continuam com o dono, e por isso não foram tomadas aqui:

- ~~**O cabeçalho.**~~ Resolvido em 31/ago: **fica o degradê da marca**. O
  cabeçalho branco do protótipo não vale.
- **Os tokens.** Unificar `tokens.css` como fonte única muda a cor do admin,
  que está aprovado como está.

Para baixar mais arquivos: abrir o projeto, **All project files**, passar o
mouse na linha, `...` → Download.
