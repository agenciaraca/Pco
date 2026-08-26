# Roadmap — estado em 21/ago/2026

Produção em `13f2549`. 180 arquivos de teste, 1.714 testes, zero falhas.

> **25/ago/2026** — o projeto passou para outra máquina. Ambiente reconferido:
> typecheck, os 1.714 testes e o hash do bundle de produção batem; prod está no
> `main`, sem deploy pendente. O que mudou de ambiente, e as três pendências
> que a troca abriu, estão em `docs/SESSAO-2026-08-25-troca-de-maquina.md`.
> A frente de dev segue a mesma: Sprint 2, agendamento de sessão.
>
> **26/ago/2026** — jornada longa em modo autônomo, 15 commits. Ondas 7 e 8
> fechadas no essencial: agendamento, pagamento, remarcação, avisos e lembretes
> de sessão; aviso de vencimento de acesso; pedidos, cupons e banco de questões
> no banco; autoria institucional. **188 arquivos de teste, 1.784 testes, zero
> falhas.** O que sobrou depende do dono ou de acesso a produção — o relato
> está em `docs/SESSAO-2026-08-26-sprint-autonomo.md`.
>
> Na segunda metade do dia o trabalho virou outra coisa: três varreduras atrás
> de interface que afirma o que o sistema não faz. Cinco telas com dados
> inventados, vinte e cinco botões sem ação e alguns campos que não guardavam a
> escolha — incluindo o "lembrar de mim" do login, que nunca lembrou de nada. E
> a suíte E2E, que estava verde porque metade nunca rodou: 26/26 agora, e o job
> passa a bloquear o merge.
>
> ⚠️ **Nada disso foi para produção.** 25 commits esperando deploy, travado pela
> falta da chave SSH nesta máquina.

Painel visual (Artifact, mesma URL sempre):
https://claude.ai/code/artifact/f548e6f4-0775-4965-acb9-cefea684412c

Legenda: ✅ feito · ◐ em aberto · ○ não iniciada · ◆ depende do dono

## Onda 7 — Devolver ao aluno o que ele já comprou

- ✅ Coluna `lessons.content` + carga de 522 aulas (2,93 mi de caracteres).
  Ver `docs/migration-wp-ld.md` e o comentário em `scripts/restaurar_conteudo_aulas.ts`.
- ◐ **Durações reais das aulas.** Todas gravadas como 15 min — placeholder do
  import. Não afeta a carga horária declarada do curso, mas distorce as métricas
  de estudo que o aluno vê.
  **Ferramenta pronta** (26/ago/2026): `scripts/resolver_duracoes_aulas.ts` lê o
  `videoUrl` que o scraper já grava e busca a duração no provedor — Vimeo pelo
  oEmbed público, sem chave; YouTube só com `YOUTUBE_API_KEY`, e sem ela as
  aulas do YouTube são contadas como não resolvidas em vez de fingir que
  terminou. **Nunca inventa duração**: aula sem vídeo, ou com vídeo que o
  provedor não responde, fica como está.
  **Falta rodar onde os dados existem.** Na base local nenhuma aula tem
  `videoUrl` (são 190 aulas de semente, não as 522 importadas), então o script
  foi testado nas partes puras e roda relatando zero — o problema mora em
  produção.

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
- ✅ Lembrete "sua sessão é amanhã" (26/ago/2026). Worker de 15 min, faixas de
  24h e 1h, uma vez cada. Quem agenda em cima da hora recebe só o de 1h — a
  faixa folgada é queimada junto. `session-reminders` em `/admin/jobs`.

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
- ✅ **Pedidos no banco** (26/ago/2026). Tabela `payment_orders` + migration
  0011, no molde de `courses.ts`: lê do banco, cai no JSON quando a tabela está
  vazia, caminho JSON preservado. `POST /admin/payments/orders/migrar`
  (superadmin, idempotente, não apaga a origem) leva o que está no JSON para a
  tabela — existe como rota porque quem precisa disso não tem shell.
- ✅ **Cupons e banco de questões no banco** (26/ago/2026). Tabelas
  `payment_coupons` e `question_bank` (migration 0012), mesmo molde: lê do
  banco, cai no JSON com a tabela vazia. O incremento de uso do cupom passou a
  ser feito no próprio SQL — ler-somar-gravar perderia um uso quando duas
  compras acontecessem juntas, e o limite de usos existe para ser respeitado
  exatamente aí.

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
- ✅ **Autoria institucional nos dados estruturados** (26/ago/2026). `AUTHOR`
  agora é `null` por padrão: a PCO assina como organização, e o molde de pessoa
  — "Dra. [Nome do Responsável Técnico]" com credenciais inventadas anexadas —
  saiu do arquivo. O tipo virou `AuthorConfig | null`, então o compilador cobra
  o tratamento em cada uso, e não só a nossa memória. Se um dia houver
  responsável técnico nomeado, preencher `AUTHOR` com pessoa real faz a autoria
  por pessoa voltar sozinha.

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
