# 1º de setembro de 2026, fim de tarde — a matrícula passa a seguir o pedido

Continuação de `SESSAO-2026-09-01-pedidos-crud.md`, escrito depois de um
reinício de máquina. Aquele doc dizia "não houve deploy"; tinha razão no
instante em que foi escrito e deixou de ter minutos depois — o deploy
automático subiu sozinho. Produção, `origin/main` e local estavam no mesmo
commit quando esta sessão começou.

## O que estava aberto de verdade

Não era commit nem deploy: era **verificação**. `npm run lint` e `npm run test`
tinham sido interrompidos pelo reboot, e o CRUD de pedidos já estava no ar sem
eles. Rodados agora, um de cada vez: **0 erros de lint** (520 warnings,
pré-existentes) e **215 arquivos / 1982 testes passando**. Os 8 "errors" que
aparecem no fim da suíte são timeouts de worker do vitest quando a máquina
satura — falha do ambiente, não do código, exatamente como o doc anterior
avisou.

## O que a verificação encontrou

A regra de matrícula que o dono fixou nesta mesma manhã virou código em
`server/access/situacao-matricula.ts` — com testes, comentários e o CDC citado.
**E não era chamada por ninguém.** Só o script de importação histórica usava.
Todo o caminho de runtime passava por fora dela.

Quatro consequências, todas no ar:

1. **Lançamento manual pago não matriculava.** `POST /admin/orders` tem em si o
   comentário "lançamento manual costuma nascer já pago" — e nunca chamava
   `grantAccessForOrder`. A tela de cadastro pedida com urgência criava pedido
   pago que não dava acesso a nada.
2. **Mudar o status pelo admin não mexia no acesso.** Nem `PUT /admin/orders/:id`
   nem `PUT /admin/orders/:id/status`. Estornar deixava o aluno estudando.
3. **`unenrollFromCourse` não tinha caminho de banco.** Só escrevia no JSON de
   semente, que não é fonte de verdade desde 19/ago/2026. Em produção ela
   retornava `void` sem tocar em nada — então o botão de estorno do gateway
   mandava o e-mail dizendo "o acesso ao conteúdo foi removido" e não removia.
   Desmatricular pelo admin tinha o mesmo destino.
4. **Estorno vindo do gateway por webhook** só emitia webhook de saída. O acesso
   ficava de pé.

## O que passou a existir

`aplicarSituacaoDoPedido(order, statusAnterior)` em `server/app.ts` — **um lugar
só** onde status de pedido vira situação de matrícula. Chamada por: criação e
edição no admin, mudança de status, webhook do gateway (pago e não-pago) e o
worker de sondagem da Sandra.

Três decisões que valem lembrar antes de mexer:

- **Cancela, não apaga.** `revokeAccessForOrder` passou a marcar `cancelada` em
  vez de desmatricular. O portão (`guard.ts`) já fechava em cima de `cancelada`
  e ainda diz por que fechou; apagar perdia data de compra e progresso, e quem
  foi estornado costuma voltar.
- **A situação final não sai deste pedido, sai de todos.** Quem comprou, foi
  estornado e comprou de novo tem dois pedidos vivos para o mesmo curso —
  `situacaoDeVarios` faz a mais forte vencer. Olhar só para o pedido da vez
  trancaria quem pagou duas vezes e foi estornado uma. É também o que impede um
  pedido novo em aberto de suspender o acesso já pago.
- **Reativar é explícito.** `enrollInCourse` usa `onConflictDoNothing`, então
  matricular de novo não mexia numa linha `cancelada`: a pessoa pagava outra vez
  e continuava sem acesso. Agora o caminho `ativa` grava a situação depois de
  matricular.

`setEnrollmentStatus` foi para `server/repositories/students.ts`, com os dois
backends. `unenrollFromCourse` ganhou o caminho de banco que faltava e continua
existindo para o desmatricular do admin, onde tirar mesmo é a intenção.

## A armadilha que o ensaio pegou

`scripts/reconciliar_situacao_matriculas.ts` audita o passivo: compara a
situação gravada em cada matrícula com o que os pedidos dizem. Seco por padrão.

A primeira versão usava `paidAt` como prova de que um pedido cancelado chegou a
ser pago. Contra produção, ela quis **cancelar cinco matrículas legítimas**. O
motivo: a importação da loja gravou `paidAt` igual à data do pedido em *todos*
os pedidos, inclusive nos boletos cancelados que ninguém pagou. As cinco
matrículas vieram do LMS, não daqueles pedidos.

A prova passou a ser **um evento `paid` no histórico do pedido**, que só existe
quando o pagamento aconteceu. Com o critério certo, o ensaio contra produção dá
**0 divergências** — 1845 pedidos, 2583 matrículas. Não há passivo a aplicar; o
script fica como auditoria.

`test/matricula-segue-o-pedido.test.ts` cobra os oito casos, e um deles é
exatamente este: pedido importado com `paidAt` de mentira não derruba matrícula
legítima.

## O que continua aberto

- **Vimeo, e é o primeiro item.** 105 aulas não tocam de
  `psicanaliseclinica.online` porque a lista de domínios autoriza só
  `portalpco.online`. Não é código: é o painel da conta "Psicanálise Digital".
- **`sync_wc_delta.ts` ainda não foi aplicado com `--commit`** — 18 pedidos
  pagos desde 06/jul, 4 contas e 4 matrículas a criar.
- **222 contas com presença no portal e sem ficha** — `auditar_contas_sem_ficha.ts --db`
  fecha a questão.
- **Durações de aula** seguem todas em 15 min (placeholder do import), e
  resolvê-las depende da Vimeo autorizar o domínio.
