# AGENTS.md

**A fonte é o [`CLAUDE.md`](./CLAUDE.md). Leia aquele arquivo.**

Este aqui era uma cópia dele, e cópia envelhece. Em 2/set/2026 tinha 195 linhas
contra 642, e o que estava congelado não era detalhe:

- Mandava, com todas as letras, rodar `scripts/restart_vps.py` quando o usuário
  pedisse "atualize a produção". Esse script é anterior ao PM2: sobe a app por
  fora dele e deixa produção disputando a porta 3035. Hoje ele **recusa** rodar,
  e o caminho é `bash scripts/deploy_producao.sh`.
- Passava o host `177.7.35.13`, morto desde a migração para `195.200.0.253`, com
  autenticação por senha, que deixou de existir em 30/ago/2026.
- Dizia que o job de E2E do CI tem `continue-on-error: true`. Não tem — a trava
  foi removida em 26/ago/2026, e o E2E bloqueia merge desde então.

Uma instrução errada num arquivo escrito para agente não é documentação
desatualizada: é uma ordem que alguém executa. Por isso este arquivo passou a
apontar em vez de repetir.

## O essencial, para quem chegou aqui primeiro

- **Raiz do repo:** `H:\ia\dev\pco\`.
- **Verificação:** `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run build`. E2E: `E2E_FRESH=1 npm run e2e`.
- **Deploy:** `bash scripts/deploy_producao.sh`. Migração de banco é passo
  separado e **vem antes**.
- **Onde o trabalho parou:** a seção "Onde o trabalho parou" do `CLAUDE.md`
  aponta o handoff vivo em `docs/`.

Todo o resto — arquitetura, autenticação, pagamentos, importação, as armadilhas
que já custaram caro — está no `CLAUDE.md`, e é lá que se atualiza.
