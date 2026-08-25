# Roadmap — estado em 21/ago/2026

Produção em `13f2549`. 180 arquivos de teste, 1.714 testes, zero falhas.

> **25/ago/2026** — o projeto passou para outra máquina. Ambiente reconferido:
> typecheck, os 1.714 testes e o hash do bundle de produção batem; prod está no
> `main`, sem deploy pendente. O que mudou de ambiente, e as três pendências
> que a troca abriu, estão em `docs/SESSAO-2026-08-25-troca-de-maquina.md`.
> A frente de dev segue a mesma: Sprint 2, agendamento de sessão.

Painel visual (Artifact, mesma URL sempre):
https://claude.ai/code/artifact/f548e6f4-0775-4965-acb9-cefea684412c

Legenda: ✅ feito · ◐ em aberto · ○ não iniciada · ◆ depende do dono

## Onda 7 — Devolver ao aluno o que ele já comprou

- ✅ Coluna `lessons.content` + carga de 522 aulas (2,93 mi de caracteres).
  Ver `docs/migration-wp-ld.md` e o comentário em `scripts/restaurar_conteudo_aulas.ts`.
- ○ **Durações reais das aulas.** Todas gravadas como 15 min — placeholder do
  import. Não afeta a carga horária declarada do curso, mas distorce as métricas
  de estudo que o aluno vê.
- ○ **E-mail de aviso de vencimento.** Não existe. Padrão da casa é um worker
  (`startWorker` + `getStatus()`), não cron externo. Precisa estar pronto **antes**
  de os prazos serem declarados, ou a primeira leva de vencidos descobre pela
  porta fechada.

## Onda 8 — Sessões: da gestão ao agendamento

- ✅ Serviços, profissionais e valores por titulação. Ver `docs/sessoes.md`.
- ✅ Regra de venda casada no código, com testes.
- ◆ Cadastrar os profissionais reais (zero hoje).
- ○ **Agendamento que persiste** — não há rota no servidor; a tela do aluno é
  estado local. Maior lacuna desta onda.
- ○ Pagamento da sessão (reaproveita o checkout de cursos).
- ○ Confirmação, remarcação e cancelamento.

## Onda 9 — O que a migração deixou para trás

- ◐ **990 de 1.605 contas têm login e nenhuma matrícula.** Podem ser clientes só
  da loja ou matrículas perdidas na migração. Ninguém foi convidado ainda, então
  não há dano — mas é preciso saber qual dos dois é antes do disparo.
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

| Sprint | Frente | Trava |
|---|---|---|
| 1 | Conteúdo de volta | — (✅ concluído) |
| 2 | Agendar e pagar sessão | — |
| 3 | Prazos e convites | decisão do dono |
| 4 | PCO 2.0 no ar | a grade real |

## O que só o dono destrava

1. A grade real do curso.
2. `accessMonths` por curso — nenhum dos 15 declara, ninguém vence.
   Ver `docs/prazo-de-acesso.md`.
3. `VPS_HOST` + `VPS_PASSWORD` no GitHub.
4. Disparar os 507 convites (Brevo grátis: 300/dia; a tela mostra a cota).
5. Cadastrar profissionais em `/admin/analise-supervisao`.
6. Rotacionar a senha do DivZ.
7. Revisão jurídica (módulo 17 e RNTP).
