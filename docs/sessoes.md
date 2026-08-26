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

Coberto por `test/sessoes-agendamento.test.ts` (11 testes).

## O que ainda não existe

- **Pagamento da sessão** — reaproveitar o checkout que já existe para cursos.
  O seam está pronto: basta mover o status de `pending_payment` para
  `confirmed` quando o gateway responder.
- **Remarcação.** Hoje o caminho é cancelar e agendar de novo.
- **Agenda com janelas.** O bloqueio atual é por início exato: duas sessões de
  50 min começando com 10 min de diferença não colidem, e deveriam.
- **Aviso por e-mail.** O agendamento diz que o link chega por e-mail; quem
  envia hoje é o admin, à mão, pelo campo de link da reunião.
- Nenhum profissional cadastrado. Sem cadastro, não há com quem agendar.
