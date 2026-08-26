# Roadmap — estado em 21/ago/2026

Produção em `13f2549`. 180 arquivos de teste, 1.714 testes, zero falhas.

> **25/ago/2026** — o projeto passou para outra máquina. Ambiente reconferido:
> typecheck, os 1.714 testes e o hash do bundle de produção batem; prod está no
> `main`, sem deploy pendente. O que mudou de ambiente, e as três pendências
> que a troca abriu, estão em `docs/SESSAO-2026-08-25-troca-de-maquina.md`.
> A frente de dev segue a mesma: Sprint 2, agendamento de sessão.
>
> **26/ago/2026** — Sprint 2 entregue no essencial: agendamento persiste,
> cancelamento existe, e as sete correções da revisão de código do módulo de
> sessões foram aplicadas. 181 arquivos de teste, 1.725 testes, zero falhas.
> O pagamento entrou no mesmo dia: a onda 8 fecha no essencial, restando
> remarcação, agenda com janelas e o aviso por e-mail.

Painel visual (Artifact, mesma URL sempre):
https://claude.ai/code/artifact/f548e6f4-0775-4965-acb9-cefea684412c

Legenda: ✅ feito · ◐ em aberto · ○ não iniciada · ◆ depende do dono

## Onda 7 — Devolver ao aluno o que ele já comprou

- ✅ Coluna `lessons.content` + carga de 522 aulas (2,93 mi de caracteres).
  Ver `docs/migration-wp-ld.md` e o comentário em `scripts/restaurar_conteudo_aulas.ts`.
- ○ **Durações reais das aulas.** Todas gravadas como 15 min — placeholder do
  import. Não afeta a carga horária declarada do curso, mas distorce as métricas
  de estudo que o aluno vê.
- ✅ **E-mail de aviso de vencimento** (26/ago/2026).
  `server/access/expiry-worker.ts`, worker diário, visível em `/admin/jobs` como
  `access-expiry`. Faixas de 30, 7 e 1 dia, mais o aviso de vencido; um aviso
  por faixa, nunca repetido. Hoje varre 1.120 matrículas e não acha nenhuma com
  prazo — estreia calado, como deve. **Rode
  `POST /admin/jobs/access-expiry/run?dryRun=true` antes de declarar qualquer
  `accessMonths`:** ele mostra quem receberia aviso sem enviar nada.

## Onda 8 — Sessões: da gestão ao agendamento

- ✅ Serviços, profissionais e valores por titulação. Ver `docs/sessoes.md`.
- ✅ Regra de venda casada no código, com testes.
- ◆ Cadastrar os profissionais reais (zero hoje).
- ✅ **Agendamento que persiste** (26/ago/2026). `POST /sessions/bookings` grava,
  a tela do aluno deixou de encenar e o painel do admin deixou de mostrar três
  agendamentos fictícios. Preço e nomes são copiados no ato; profissional sem
  serviço ou sem faixa não é oferecido; rota pública não devolve mais e-mail.
  11 testes em `test/sessoes-agendamento.test.ts`. Ver `docs/sessoes.md`.
- ✅ Cancelamento — pelo dono ou pelo admin, com motivo, liberando o horário.
- ✅ **Pagamento da sessão** (26/ago/2026). `POST /sessions/bookings/:id/checkout`
  reusa gateways, provider e pedidos dos cursos, mas tira o preço do
  agendamento — sessão não tem preço por serviço, tem por titulação de quem
  atende. Webhook `paid` confirma; estorno volta para `pending_payment`.
- ✅ Remarcação e conflito por intervalo (26/ago/2026). O bloqueio era por
  início exato — 14:00 e 14:10 não colidiam numa sessão de 50 min, e dois
  alunos marcavam em cima um do outro. Agora é sobreposição de intervalo, com
  `[início, fim)`: encostar não é sobrepor.
- ✅ Avisos ao aluno (26/ago/2026). Reservada, confirmada, cancelada e
  remarcada: notificação no ambiente **e** e-mail. O texto só promete o que
  existe — confirmação sem link não inventa endereço. Falha de envio não
  derruba a operação. `server/sessions/avisos.ts`.
- ○ Lembrete "sua sessão é amanhã" — o único aviso que ainda falta.

## Onda 9 — O que a migração deixou para trás

- ◐ **~990 contas com login e nenhuma matrícula: em boa parte respondido**
  (26/ago/2026). `scripts/auditar_contas_sem_ficha.ts` responde pela origem, que
  a correção v3 passou a prefixar. Na base local: 989 sem ficha, das quais
  **763 (77%) só existem na loja** — nunca foram alunas, explicação benigna — e
  **222 (22%) têm presença no portal/LMS**, que é onde mora a dúvida.
  **Zero matrículas órfãs**: nenhuma referência de matrícula aponta para conta
  sem ficha, o que afasta a hipótese de a migração ter perdido matrícula.
  Falta rodar contra produção e sobre uma base **com progresso carregado** — na
  local não há progresso, então "ninguém estudou" seria conclusão sem prova.
  Progresso sem ficha é a evidência definitiva, e o script já a procura.
- ◐ Delta da loja: 16 pedidos, 15 pessoas sem conta.
  `scripts/sync_wc_delta.ts` pronto e ensaiado contra produção; falta aplicar.
- ○ Pedidos, banco de questões e cupons vivem em `data/*.json`, sem tabela.

## Onda 10 — PCO 2.0 (página de vendas)

Travada em dois pontos, ambos do dono:

- ◆ **A grade real do curso** — decide se o caminho "formação" é construir do
  zero ou apenas transpor. Bloqueia a onda inteira.
- ◆ Decisão: curso de fundamentos × formação.
- ○ Seção "quem constrói o curso" (substitui a de professores: a PCO tem equipe
  de pedagogos, psicanalistas, redatores e editores — não docente de vitrine).
- ○ Currículo, SEO, dados estruturados e checkout.

## Onda 11 — Risco e higiene

- ◆ **Trocar `VPS_HOST` e `VPS_PASSWORD`** — o deploy automático conecta em
  `srv1621737`, não em produção. Enquanto não trocar os dois juntos, todo deploy
  é manual. Ver `docs/deploy.md`.
- ◆ Rotacionar a senha do banco (pendente desde a virada de servidor).
- ◆ Revisão jurídica: o módulo 17 se chama "Regulamentação da Profissão de
  Psicanalista e Terapeuta" enquanto o FAQ afirma que classificação na CBO não é
  regulamentação; e a natureza e os limites da RNTP precisam de conferência
  documental.
- ○ Autoria institucional nos dados estruturados — com autoria por equipe, o
  autor passa a ser a organização e o `AUTHOR` de molde some pela raiz. Ver
  `server/public/config.ts`.

## Sprints propostos

| Sprint | Frente                 | Trava                |
| ------ | ---------------------- | -------------------- |
| 1      | Conteúdo de volta      | — (✅ concluído)     |
| 2      | Agendar e pagar sessão | agendar ✅ · pagar ○ |
| 3      | Prazos e convites      | decisão do dono      |
| 4      | PCO 2.0 no ar          | a grade real         |

## O que só o dono destrava

1. A grade real do curso.
2. `accessMonths` por curso — nenhum dos 15 declara, ninguém vence.
   Ver `docs/prazo-de-acesso.md`.
3. `VPS_HOST` + `VPS_PASSWORD` no GitHub.
4. Disparar os 507 convites (Brevo grátis: 300/dia; a tela mostra a cota).
5. Cadastrar profissionais em `/admin/analise-supervisao`.
6. Rotacionar a senha do DivZ.
7. Revisão jurídica (módulo 17 e RNTP).
