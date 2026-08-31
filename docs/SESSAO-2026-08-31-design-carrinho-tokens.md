# 31 de agosto de 2026 — o desenho escolhido, o carrinho e os tokens

> **Ponto exato de retomada.** Local e `origin/main` em `6699a4c`. Nada
> pendente de commit nem de push. **Produção continua em `4c7c1dc`** — nada
> desta sessão foi publicado, por decisão do dono.
>
> 216 arquivos de teste, **1975 testes**, zero falhas. Lint sem erros. Build passa.

---

## A correção que abriu a sessão

Comecei refazendo a página do curso a partir do código existente. O dono
interrompeu:

> *"a página que vc deixou de curso não foi a que te falei e escolhi... recupere
> a informação e confira... nem a do curso de psicanalise"*

Ele estava certo. **A referência de design nunca esteve no repositório**: vive
num projeto do Claude Design que ele criou e aprovou —
[Inspiração Loyalist College](https://claude.ai/design/p/b11d34a1-b413-4714-8973-9a7fbb67620d).
A sessão de 30/ago aplicou só o resumo (`CHANGELOG-design.md`); o handoff
completo — 17 artboards, `tokens.css`, `data/site.js`, `README-HANDOFF.md` —
nunca chegou.

**Está resolvido:** nove artboards e o `tokens.css` estão versionados em
`docs/design/`. Comece por `docs/design/README.md`. URL em documento não
sobrevive a uma troca de sessão; arquivo no repositório, sim.

---

## O que foi transposto do protótipo

| Página | Rota | Observação |
| --- | --- | --- |
| `Curso.dc.html` | `/formacao/:slug` | Resumo rápido, "para quem é" ao lado de "o que você desenvolve", ementa numerada, destaques, 6 seções longas com par de CTAs, jornada, FAQ, letra miúda |
| `Cursos.dc.html` | `/formacoes` | Deixou de ser grade de cartões; virou linhas largas |
| `Checkout.dc.html` | `/checkout` | Estrutura e resumo fixo — **sem** os campos de cartão |
| `Home.dc.html` | `/` | Afirmação com ladrilhos e os seis cartões de "por que escolher" |
| `Carrinho.dc.html` | `/carrinho` | **Novo** — o cabeçalho já linkava para cá, e era 404 |
| `Login.dc.html` | `/login` | Só os blocos que faltavam (ver abaixo) |

O estilo saiu do `style` inline do protótipo e virou classe em
`server/public/styles.ts` — era o que a etapa 4 do plano pedia.

### O que do protótipo **não** atravessa (é regra, não detalhe)

1. **Preço.** `site.js` traz `price: 1497` como maquete. O valor vem sempre do
   produto ativo. Sem produto, a caixa mantém o formato e diz a verdade.
2. **Contagem de módulos/aulas/horas.** O protótipo declara "12 · 60 · 560"; a
   página conta do curso real.
3. **Número sem medição.** "+1000 alunos formados", "96% de satisfação",
   "4,7/5". Ver a seção de números abaixo.
4. **Campos de cartão no checkout.** O nosso é hospedado — o pagamento acontece
   na página do provedor. Copiar criaria escopo de PCI que o projeto não tem.
5. **Seletor de quantidade no carrinho.** Curso não se compra em dobro, e o
   servidor colapsa duplicata. Um `+` que deixasse marcar 3 e cobrasse 1 seria
   tela que mente.

---

## Os defeitos que apareceram no caminho

### 1. O botão de comprar devolvia o comprador para a lista

**"Matricular-se" apontava para `/catalogo`**, que virou 301 para `/formacoes`
no mesmo dia 30/ago. Quem decidia comprar voltava para o catálogo de onde tinha
acabado de vir. E o `/checkout` — que funciona e conversa com
`POST /public/checkout` — **não tinha um único link apontando para ele em todo o
produto**.

O diagnóstico de que "o site não fecha venda" era creditado só à falta de preço.
Havia esta segunda causa, que sobreviveria ao cadastro dos preços.

### 2. Seis links do SPA apontavam para rotas que respondem 301

Um deles na tela de login. Dentro do SPA o React Router atende `/catalogo` e
`/landing` sem passar pelo servidor, então o clique "funcionava" — e levava à
tela antiga, que era o que a fusão de rotas queria acabar.

### 3. O menu principal era 404 em instalação limpa

O cabeçalho tem uma porta direta para o carro-chefe (decisão do dono), com o
slug escrito à mão. Ele dizia `curso-de-psicanalise-clinica-online`; o seed do
repositório dizia `psicanalise-clinica`. Conferido contra produção:

```
curso-de-psicanalise-clinica-online  ->  200
psicanalise-clinica                  ->  404
```

Em produção funciona; em qualquer instalação limpa, não. O seed passou a
acompanhar produção.

### 4. A home e o `/sobre` afirmavam números que ninguém mediu

A limpeza de 27/ago foi feita só no `/ava-pco`; o site SSR ficou para trás. A
home publicava "4,7/5" e "1000+ alunos formados", e o `/sobre` dizia
**"3 formações"** — o catálogo tem dezesseis.

`numerosDoSite()` agora mede: avaliação a partir das avaliações reais e
**sempre com a base**, "formados" por certificado emitido, anos calculados da
fundação, catálogo contado. Satisfação não entra — não existe pesquisa de
satisfação neste sistema. Cada célula some quando não há o que medir; numa
página de venda, zero é pior do que ausência.

### 5. A letra mudava na fronteira do login

O site é system-ui com zero webfont; o AVA carregava Inter do Google Fonts. As
duas metades agora leem a mesma pilha, e sai um request de terceiro do caminho
crítico de toda tela do aluno.

---

## O carrinho

O desenho pede carrinho, e o dono confirmou: **vai haver carrinho.**

**A decisão que valia pensar antes de codar:** o pedido tem UM produto
(`productId` é coluna, não tabela de itens). Um carrinho de três cursos não cabe
ali. As saídas óbvias eram ruins — mexer na tabela do dinheiro (migração, risco)
ou criar um pedido por item (três cobranças).

Nenhuma foi preciso: já existia `kind: 'bundle'`, e `grantAccessForOrder` já
matricula em todos os cursos de um pacote a partir de `metadata.courseIds`. O
servidor materializa um pacote com os cursos escolhidos e cobra uma vez. O
estorno já era simétrico. **Caminho existente e testado, sem tocar no esquema.**

O pacote nasce `active: false` e marcado `adhoc` — não é oferta, é o registro do
que aquela pessoa comprou. Produto inativo não entra em `listActive()`.

**O preço nunca vem do cliente.** O carrinho mora no localStorage, então o que o
navegador diz sobre valor é palpite — e pode ser malicioso. O corpo escolhe
QUAIS cursos; quanto custam é somado no servidor. Há teste mandando
`priceCents: 1` junto e conferindo que o pedido saiu pelo valor certo.

---

## Os tokens

`docs/design/tokens.css` é a fonte declarada. Os dois consumidores foram
alinhados a ela por **valor**, não por `var()` em runtime: as classes usam
modificador de opacidade em massa (`bg-status-success/10` 75 vezes) e o Tailwind
não sabe aplicar `/10` sobre um `var()` com hex. Quem sustenta a unificação é
`test/tokens-unicos.test.ts`.

O laranja divergente — item 8 do handoff, aberto havia meses — acabou:
`#FE9002` virou `#ff914d`. Neutros e semânticos saíram dos padrões do Tailwind
para os do desenho. **Isso mudou a cor de todas as telas do aluno e do admin**,
com aprovação do dono.

---

## Decisões do dono nesta sessão

- **O cabeçalho fica no degradê da marca.** O branco do protótipo não vale.
- **Vai haver carrinho.**
- **Unificar os tokens**, mesmo mudando a cor do admin.
- **Publicar só no GitHub**, sem deploy.
- Promoção do curso: vigência **01/09/2026 a 30/09/2026**.

---

## O que continua aberto

### Só o dono destrava

1. **Preço dos cursos** — segue sendo o que trava a receita. `/admin/produtos`.
2. **Certificado de `old.psicanaliseclinica.online`** — a loja segue fora do ar.
3. **Cobrança do GitHub** — a conta segue travada. O push de hoje disparou o
   workflow de deploy e ele **não executou**: *"The job was not started because
   your account is locked due to a billing issue."* Enquanto isso, deploy é
   manual — e foi por isso que nada foi publicado.
4. **Três parágrafos de LGPD** do rodapé.
5. **Descrições dos cursos** — dois com lixo do scraper, quatro repetindo o
   título.

### Próximo passo técnico

**Transpor `Dashboard.dc.html` e `Aula.dc.html`** — as duas telas de dentro do
AVA. São React com Tailwind (outra metade do código, não SSR). Os dois artboards
estão em `docs/design/pages/`, e `Componentes.dc.html` serve de referência de
estados (normal, foco, desabilitado, carregando, vazio, erro).

Depois: `SiteHeader`, `SiteFooter`, `Sobre`, `Contato`, `Blog`, `Post`, `Autor`.

### Para aplicar o conteúdo do curso em produção

O conteúdo verbatim está em `scripts/conteudo/psicanalise-clinica.json`, mas
**o slug do curso em produção é outro**:

```bash
npx tsx scripts/aplicar_conteudo_curso.ts psicanalise-clinica \
  --curso curso-de-psicanalise-clinica-online          # ensaio
npx tsx scripts/aplicar_conteudo_curso.ts psicanalise-clinica \
  --curso curso-de-psicanalise-clinica-online --commit # grava
```

Contra produção, exporte antes o `DATABASE_URL` do banco certo.

---

## Como retomar

```bash
cd C:\ia\dev\pco
git log --oneline -1        # deve ser 6699a4c
npm run test                # 216 arquivos, 1975 testes
```

Leia `docs/design/README.md` antes de mexer em qualquer tela pública — é lá que
está o mapa do que já foi transposto, o que falta, e o que do protótipo nunca
atravessa.
