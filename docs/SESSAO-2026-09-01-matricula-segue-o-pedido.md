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

## Segunda parte: o CI estava vermelho, e não era por causa disto

Ao publicar, o histórico mostrou que o **CI do commit anterior já falhava** — só
o job de E2E, e desde antes desta sessão. Deploy passava, CI não; main vermelho
bloqueia PR.

O sintoma era `429 RATE_LIMITED` em cascata. A causa raiz não era o limite:

1. O aluno da suíte (`aluno@pco.local`) nasce de `INITIAL_STUDENT_PASSWORD` —
   existe como **credencial e sem ficha**. O helper o procurava em
   `/admin/students`, onde ele nunca esteve, e lançava sempre. Como a falha não
   fica em cache, cada teste refazia dois logins.
2. Aí sim o limite estourava — e escondia tudo o mais.

A busca passou a ser em `/admin/users`; o id da conta é o que `enrollInCourse`
usa para criar a ficha, que é o caminho de quem compra pelo site.

### E o limite estava mesmo errado

`server/rate-limit.ts` guardava o balde em `ip:path`, e o limitador global
(`app.use('*')`, 120/min) dividia o contador com os de rota. Medido:
`/auth/login`, com `max: 5`, **bloqueava na terceira tentativa**. Em produção
isso significa que quem erra a senha duas vezes fica um minuto fora. Pior:
`/auth/forgot-password` pede 3 por 5 minutos, e o balde criado pelo global tem
`resetAt` de 1 minuto — a janela valia um quinto do previsto.

Corrigido com escopo por instância. Dois testes novos em `test/rate-limit.test.ts`
reproduzem o empilhamento exato do produto.

### E o E2E local rodava contra produção

O `webServer` do Playwright herda o `process.env`, e a máquina de quem
desenvolve tem `.env` com as credenciais reais. `npm run e2e` aqui criava
matrícula e agendamento **no banco da escola**; e `PUBLIC_ORIGIN` fazia o
servidor local devolver 301 para o domínio de produção, travando o Playwright à
espera de um servidor que só redirecionava. `DATABASE_URL` e `PUBLIC_ORIGIN`
agora são fixados em branco no `webServer` — em CI não existem, então lá nada
muda.

Mais duas: `enroll-bulk` responde `alreadyEnrolled` e o helper lia `already`
(concluía "não matriculou ninguém" quando estava tudo certo); e `/catalogo` é
301 para `/formacoes` desde 30/ago, com dois testes ainda cobrando o endereço
antigo.

**Resultado: 26 de 26, sem pulados.** Rode local com `E2E_FRESH=1` — sem ele os
12 testes que dependem de login são pulados em silêncio, que foi como metade da
suíte passou meses sem rodar.

## Terceira parte: o que estava em aberto e foi fechado

**Delta da loja — aplicado.** `scripts/sync_wc_delta.ts --commit`: dos 20
pedidos pagos desde 06/jul, 19 já tinham conta e matrícula; faltava **uma
pessoa**, que agora existe e está matriculada. O doc anterior falava em "4
contas e 4 matrículas" porque foi medido em 30/ago — o número encolheu sozinho.
Conferência: rodar o ensaio de novo devolve `0 criada(s) · 20 já existia(m)`.
A conta nasce sem senha e entra pelo "esqueci minha senha".

**Contas sem ficha — respondido até onde a base permite.** Em produção: 2031
contas, 1613 fichas, **418 sem ficha**. A origem dessas 418 **não tem resposta
com os dados de hoje**, e agora o script diz isso: o `external-references.json`
do servidor é de 16/mai, anterior à recarga v3 de 07/jul, e não conhece nenhum
id atual. Antes ele imprimia `0 (0,0%)`, que se lê "nenhuma veio da loja" — o
mesmo pecado de transformar `null` em zero.

Zero matrículas órfãs. A única conta com progresso de aula e sem ficha é
`admin@psicanaliseclinica.online`: superadmin testando, não aluno que perdeu
matrícula.

**CI verde.** Main estava vermelho desde antes desta sessão, só no job de E2E.
Está verde de novo, com a suíte rodando inteira pela primeira vez.

## O que continua aberto

1. **Vimeo** — 105 aulas não tocam de `psicanaliseclinica.online`. Painel da
   conta "Psicanálise Digital", não código. Segue sendo o primeiro item.
2. **Durações de aula** — todas em 15 min (placeholder do import). Depende do
   item 1: sem o domínio autorizado, o provedor não devolve duração.
3. **Origem das 418 contas sem ficha** — exige um mapa de referências regerado
   pela carga v3. Enquanto não houver, a resposta honesta é "não dá para saber".
4. **160 pessoas apagadas na origem** entre julho e agosto seguem em produção
   com 256 matrículas. Decidir o destino delas é do dono, não do código.

## Quarta parte: os vídeos, e por que a Vimeo levou a culpa

O dono relatou "Este conteúdo está bloqueado. Entre em contato com o
proprietário do site" no player da aula. Essa mensagem é escrita pela Vimeo e se
lê como problema de conta — foi assim que o diagnóstico "é a lista de domínios"
ficou de pé por dias.

Medido, o domínio **estava autorizado**: `player.vimeo.com/video/<id>` responde
**200 com `Referer` do site** e **403 sem ele**; o oEmbed devolve
`domain_status_code: 200` e a duração junto. As duas causas eram nossas:

1. **A CSP não emitia `frame-src`.** A diretiva só existia quando havia tag de
   marketing cadastrada. Sem tag — o caso — caía em `default-src 'self'`, e o
   site bloqueava o próprio player em toda aula, para todo aluno. A política
   saiu do `dev.ts` para `server/public/csp.ts` para poder ser testada.
2. **O `Referer` não chegava.** O site responde com *dois* `Referrer-Policy`: o
   nosso, `strict-origin-when-cross-origin`, e um `same-origin` posto por um
   proxy à frente. O `same-origin` zera o referer para terceiros, e sem referer
   a Vimeo recusa igual a domínio não autorizado. A política **por elemento** no
   iframe vence a do documento, e é o que o embed oficial da Vimeo já traz.
3. **A preview pública nunca funcionou.** Usava `<video src>` para uma URL de
   embed, que devolve página, não mídia. As duas telas passaram a usar
   `src/app/components/VideoAula.tsx`.

Verificado no navegador, em produção: o player carrega com capa, controles e
duração. **A aula toca.**

Como diagnosticar da próxima vez, sem passar dias na conta errada:

```bash
curl -sI -H "Referer: https://psicanaliseclinica.online/" \
  https://player.vimeo.com/video/<id>
```

200 ali significa que a Vimeo está certa e o problema é do nosso lado.

### Duas coisas achadas de passagem

- **Durações:** as aulas com vídeo já têm duração real (2 a 14 min). O
  placeholder de 15 min sobrou nas **363 aulas sem vídeo nenhum**, e o
  resolvedor se recusa a inventar duração para elas — corretamente. De 590
  aulas, 171 têm vídeo.
- **Títulos com entidade HTML:** a lista lateral mostrava
  `A psicoterapia pode dar &#8220;errado&#8221;?`. O WordPress entrega o título
  escapado e a importação gravava assim. Corrigido na entrada
  (`shared/entidades-html.ts`, usado pelo `unwrap()` do conector) e nas 5 linhas
  já gravadas.
