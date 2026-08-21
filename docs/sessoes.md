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

| id | Faixa | Valor |
|---|---|---|
| `escola` | Profissional da escola | R$ 80,00 |
| `mestrado` | Nível de mestre | R$ 140,00 |
| `doutorado` | Nível de doutorado | R$ 450,00 |

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

| Rota | Quem | O que faz |
|---|---|---|
| `GET /sessions/services` | público | serviços oferecidos |
| `GET /sessions/professionals` | público | todos, com titulação e preço |
| `GET /sessions/price-tiers` | público | as faixas de preço |
| `GET /sessions/available?serviceId=` | público | quem pode atender agora |
| `GET /sessions/policy` | público | aviso + base legal |
| `POST/PUT/DELETE /admin/sessions/services[/:id]` | admin | CRUD de serviços |
| `POST/PUT/DELETE /admin/sessions/professionals[/:id]` | admin | CRUD de profissionais |
| `PUT /admin/sessions/price-tiers/:id` | admin | edita uma faixa |
| `POST /admin/sessions/price-tiers/seed` | admin | cria as três faixas (idempotente) |

Tela: `/admin/analise-supervisao`.

## O que ainda não existe

- **Agendamento que persiste.** A tela do aluno (`AnaliseSupervisao.tsx`) monta a
  marcação em estado local e não salva: não há rota de agendamento no servidor.
  É a maior lacuna.
- Pagamento da sessão — reaproveitar o checkout que já existe para cursos.
- Confirmação, remarcação e cancelamento. As abas Agenda e Agendamentos ainda são
  maquete.
- Nenhum profissional cadastrado. Sem cadastro, não há com quem agendar.
