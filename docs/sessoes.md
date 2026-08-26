# Análise, supervisão e orientação

Serviços contratados **à parte**, e nunca requisito de curso.

## Por que isso é lei, e não preferência

Condicionar a venda de um curso à contratação de análise ou supervisão é **venda
casada**:

- **CDC (Lei nº 8.078/1990), art. 39, I** — é vedado ao fornecedor "condicionar o
  fornecimento de produto ou de serviço ao fornecimento de outro produto ou
  serviço, bem como, sem justa causa, a limites quantitativos".
- **Lei nº 12.529/2011, art. 36, § 3º, XVIII** — infração à ordem econômica:
  "subordinar a venda de um bem à aquisição de outro ou à utilização de um
  serviço".
- **CDC, art. 51, IV** — cláusula contratual nesse sentido é nula de pleno
  direito.

Por isso a regra mora no código, não só no texto da página:
`server/sessions/regra-opcional.ts` guarda o aviso, a base legal e a lista do que
**nunca** pode ser condicionado (acesso, progresso, conclusão, emissão e
validação de certificado). O servidor expõe em `GET /sessions/policy`, e as telas
leem de lá — a aba de Políticas do admin deixou de ser um campo editável que
alguém pode esvaziar sem querer.

`test/sessoes-opcionais.test.ts` cobra a citação da lei e verifica que
`courseAccessFor` não conhece o módulo de sessões.

## O preço vem de quem atende, não do serviço

Regra definida pelo dono em 21/ago/2026: a mesma sessão de análise custa valores
diferentes conforme a titulação de quem atende. Por isso o preço vive em
`session_price_tiers`, indexado pela titulação — e não em `session_services`.

| id          | Faixa                  | Valor     |
| ----------- | ---------------------- | --------- |
| `escola`    | Profissional da escola | R$ 80,00  |
| `mestrado`  | Nível de mestre        | R$ 140,00 |
| `doutorado` | Nível de doutorado     | R$ 450,00 |

Mudar a faixa muda o valor de todos os profissionais dela de uma vez, que é o
comportamento esperado de uma tabela de preços. O serviço define **o que é e
quanto dura**; a titulação define **quanto custa**.

## `available` não é `active`

`professionals` tem os dois campos, e a diferença importa:

- **`active`** — o profissional faz parte do quadro. Desligar sem apagar, para
  que ele não suma do histórico.
- **`available`** — está aceitando agendamento agora. Agenda cheia é estado do
  dia, não desligamento.

É `available` que decide quem aparece para o aluno (`GET /sessions/available`),
porque ele agenda com quem estiver disponível no momento — não escolhe uma pessoa
e fica esperando ela abrir agenda.

## Rotas

| Rota                                                  | Quem           | O que faz                                     |
| ----------------------------------------------------- | -------------- | --------------------------------------------- |
| `GET /sessions/services`                              | público        | serviços oferecidos                           |
| `GET /sessions/professionals`                         | público        | todos, com titulação e preço                  |
| `GET /sessions/price-tiers`                           | público        | as faixas de preço                            |
| `GET /sessions/available?serviceId=`                  | público        | quem pode atender agora                       |
| `GET /sessions/policy`                                | público        | aviso + base legal                            |
| `POST/PUT/DELETE /admin/sessions/services[/:id]`      | admin          | CRUD de serviços                              |
| `POST/PUT/DELETE /admin/sessions/professionals[/:id]` | admin          | CRUD de profissionais                         |
| `GET /admin/sessions/professionals`                   | admin          | lista completa, **com e-mail**                |
| `PUT /admin/sessions/price-tiers/:id`                 | admin          | edita uma faixa                               |
| `POST /admin/sessions/price-tiers/seed`               | admin          | cria as três faixas (idempotente)             |
| `POST /admin/sessions/services/seed`                  | admin          | materializa o catálogo no banco (idempotente) |
| `POST /sessions/bookings`                             | aluno          | agenda uma sessão                             |
| `GET /sessions/bookings`                              | aluno          | as próprias sessões, só as dele               |
| `POST /sessions/bookings/:id/cancel`                  | aluno ou admin | cancela                                       |
| `GET /admin/sessions/bookings`                        | admin          | todos os agendamentos                         |
| `PUT /admin/sessions/bookings/:id`                    | admin          | status, link da reunião, observações          |

Tela: `/admin/analise-supervisao`.

## O que a rota pública mostra, e o que ela esconde

`/sessions/professionals` e `/sessions/available` não pedem token — qualquer um
na internet lê. Por isso passam por uma projeção que **remove `email` e
`hourlyRate`**. Até 26/ago/2026 devolviam tudo; enquanto havia só dado de
semente ninguém se importou, mas o cadastro dos profissionais reais estava a um
passo de servir e-mails de verdade abertos. Quem gerencia usa
`GET /admin/sessions/professionals`, que devolve o registro inteiro.

## Agendamento

Existe desde 26/ago/2026, em `server/sessions/bookings-repo.ts`.

**O que fica gravado é cópia, não referência.** Nome do serviço, nome de quem
atende e preço são copiados para o agendamento no instante em que ele nasce. O
admin reajusta faixas e renomeia serviços quando quiser; o que foi combinado
com o aluno não muda junto, e profissional que sai da escola continua nomeado no
histórico de quem foi atendido por ele.

**Agendar não é pagar.** O agendamento nasce `pending_payment` quando o serviço
exige pagamento antes da confirmação, e `scheduled` quando a confirmação é
manual. Ligar o checkout é trocar o status — o repositório não precisa mudar.

O que a rota recusa, e por quê:

| Recusa                                               | Código             | Motivo                                                       |
| ---------------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| Profissional inativo ou indisponível                 | `INDISPONIVEL`     | a lista pública já filtra, quem chama a API direto não passa |
| Não atende aquele serviço                            | `NAO_ATENDE`       | idem                                                         |
| Sem faixa de preço ativa                             | `PRECO_INDEFINIDO` | cobrar R$ 0,00 por engano é pior do que recusar              |
| Data no passado                                      | `VALIDATION`       | —                                                            |
| Mesmo profissional, mesmo horário, agendamento de pé | `HORARIO_OCUPADO`  | bloqueio simples até existir agenda com janelas              |
| Cancelar agendamento de outro                        | `FORBIDDEN`        | só o dono ou um admin                                        |

Cancelar não apaga: vira `cancelled` com data e motivo, e o horário volta a
ficar livre. Histórico de quem atendeu quem é registro, não rascunho.

**Conflito é por intervalo, não por instante.** A primeira versão comparava só
o início, e o buraco era grande: sessão dura 50 minutos, então 14:00 e 14:10
passavam como horários distintos e dois alunos marcavam em cima um do outro com
a mesma pessoa — quem descobriria seria o profissional, na hora. A sobreposição
é meio-aberta `[início, fim)`, então 14:00–14:50 e 14:50–15:40 são vizinhas e
não conflito: encostar não é sobrepor.

**Remarcar** (`POST /sessions/bookings/:id/reschedule`) muda só a data. Trocar
de profissional seria outra sessão, porque o preço foi congelado com base em
quem atende. Sessão já paga continua paga — remarcar não devolve para
`pending_payment`, senão o aluno pagaria duas vezes pela mesma hora. Ao mover,
a sessão não conflita consigo mesma.

Coberto por `test/sessoes-agendamento.test.ts` (11 testes).

## Pagamento

`POST /sessions/bookings/:id/checkout` reusa inteiro o maquinário dos cursos —
mesmos gateways, mesmo provider, mesma tabela de pedidos — com uma diferença
que importa: **o preço não vem de uma linha de produto, vem do agendamento**.
Sessão não tem preço fixo por serviço; tem preço por titulação de quem atende,
congelado quando o aluno marcou. Criar um produto para cada combinação de
serviço × faixa seria inventar catálogo para descrever o que o agendamento já
sabe.

O pedido nasce com `kind: 'session_pack'` e `refId` apontando para o
agendamento. Quando o gateway confirma, o webhook chama `grantAccessForOrder`,
que acha o agendamento por esse `refId` e o move para `confirmed`. Estorno faz o
caminho inverso e devolve para `pending_payment` — **não** para cancelada:
desmarcar de vez é decisão de gente, não consequência automática de um estorno.

Duas travas que os testes seguram:

- Chamar o checkout duas vezes devolve **o mesmo pedido** enquanto ele estiver
  `pending` ou `processing`, em vez de empilhar pedidos órfãos.
- Pagamento que chega depois de a sessão ser cancelada **não a ressuscita** —
  só sai de `pending_payment` quem ainda está lá. Isso vira caso de estorno.

Coberto por `test/sessoes-pagamento.test.ts` (6 testes) e conferido ponta a
ponta contra o gateway mock: agendar → checkout → webhook `paid` → `confirmed`.

## Avisos ao aluno

`server/sessions/avisos.ts`. A tela diz, desde sempre, que "a coordenação
confirma e envia o link da reunião" — e até 26/ago/2026 isso dependia de alguém
lembrar de escrever o e-mail à mão: o admin marcava `confirmed`, colava o link,
e nada saía.

Quatro momentos avisam: **reservada**, **confirmada**, **cancelada** e
**remarcada**. Cada um manda **notificação no ambiente e e-mail** — as duas
coisas, porque e-mail pode não chegar e a notificação fica lá para quem entrar.

Dois cuidados que os testes seguram:

- **O texto só promete o que existe.** Confirmação com link entrega o link;
  sem link, diz que ele chega antes do horário, em vez de prometer um endereço
  que ninguém definiu. Reserva com pagamento pendente fala do valor; reserva de
  confirmação manual não menciona pagamento nenhum.
- **Avisar nunca derruba a operação.** Falha de envio é registrada e engolida:
  um provedor de e-mail fora do ar não pode fazer o admin receber 500 ao
  confirmar uma sessão que já está confirmada no banco.

**Lembrete antes da hora** — `server/sessions/lembrete-worker.ts`, tick de 15
minutos (e não diário: a faixa de 1 hora precisa dessa resolução para existir).
Duas faixas, 24h e 1h antes, uma vez cada.

A sutileza que um teste pegou: faltando meia hora, **as duas faixas estão
alcançadas**. Quem agenda em cima da hora não pode receber "sua sessão é
amanhã" — então o worker manda a mais urgente que ainda não saiu e **queima as
demais**, para que a de 24h nunca dispare depois da de 1h.

Só lembra sessão de pé (`confirmed` ou `scheduled`). Sessão aguardando
pagamento não recebe convocação para uma hora que ainda não está garantida;
cancelada, muito menos.

O aviso de confirmação sai também pelo caminho do pagamento — quando o webhook
do gateway aprova, o aluno é avisado na hora. É o pior momento para ficar sem
resposta.

## O que ainda não existe

- Nenhum profissional cadastrado. Sem cadastro, não há com quem agendar.
