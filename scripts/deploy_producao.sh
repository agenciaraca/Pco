#!/usr/bin/env bash
#
# Deploy do AVA PCO em produção — 195.200.0.253, usuário `avapco`, PM2 `ava-pco`.
#
# Roda a partir da máquina local, via `ssh vps` (o atalho aponta para o usuário
# avapco; ver ~/.ssh/config). Substitui o bloco de `sudo -u avapco -i bash -c`
# do CLAUDE.md, que era necessário quando só a chave de root existia.
#
# ## O que ele faz de diferente de um `git pull && npm run build`
#
# 1. **Confere onde está pisando.** Se o PM2 `ava-pco` não existir neste host,
#    para antes de tocar em qualquer coisa. O deploy automático do GitHub
#    apontava para o servidor errado e ninguém percebia porque `git pull` e
#    `npm run build` passavam — só o `pm2 restart` falhava, no fim.
# 2. **Guarda o hash do bundle antes e depois.** `/api/health` responde 200 com
#    código velho; o que prova que o deploy subiu é o bundle ter mudado.
# 3. **Faz backup do `data/` antes.** São arquivos que não voltam.
# 4. **Confere a saúde depois** e devolve código de saída diferente de zero se
#    a app não responder — para não declarar sucesso sobre um processo morto.
#
# Uso:  bash scripts/deploy_producao.sh
#
set -euo pipefail

APP_DIR="\$HOME/ava-pco"
PM2_NAME="ava-pco"
PORTA=3035

echo "==> 1/6  Verificando que este é mesmo o servidor da aplicação"
ssh vps bash -lc "'
  set -e
  if ! pm2 describe ${PM2_NAME} > /dev/null 2>&1; then
    echo \"ERRO: não há processo PM2 \\\"${PM2_NAME}\\\" em \$(hostname).\" >&2
    echo \"Este não é o servidor de produção — abortando antes de mexer em nada.\" >&2
    exit 2
  fi
  echo \"    host: \$(hostname)  |  app: ${APP_DIR}\"
'"

echo "==> 2/6  Hash do bundle ANTES (é isto que prova que o deploy subiu)"
ANTES=$(ssh vps bash -lc "'grep -o \"assets/index-[^\\\"]*\\.js\" ${APP_DIR}/dist/index.html 2>/dev/null | head -1'" || echo "sem-dist")
echo "    $ANTES"

echo "==> 3/6  Backup do data/ (arquivos que não voltam)"
ssh vps bash -lc "'
  set -e
  cd ${APP_DIR}
  CARIMBO=\$(date +%Y%m%d-%H%M%S)
  mkdir -p ~/backups-deploy
  if [ -d data ]; then
    tar czf ~/backups-deploy/data-\${CARIMBO}.tar.gz data
    echo \"    ~/backups-deploy/data-\${CARIMBO}.tar.gz (\$(du -h ~/backups-deploy/data-\${CARIMBO}.tar.gz | cut -f1))\"
  else
    echo \"    (sem data/ — nada a salvar)\"
  fi
  ls -1t ~/backups-deploy/data-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --
'"

echo "==> 4/6  Atualizando o código e construindo"
ssh vps bash -lc "'
  set -e
  cd ${APP_DIR}
  # package-lock.json modificado aborta o pull — daí o checkout antes.
  git checkout -- package-lock.json 2>/dev/null || true
  git fetch --all -q
  git reset --hard origin/main
  echo \"    commit: \$(git log --oneline -1)\"
  # **Devolve a configuração de produção que o reset acabou de reverter.**
  #
  # Quatro arquivos de `data/` sao versionados de proposito, como padrao de
  # instalacao nova: nome da escola e contato (settings), texto da tela de
  # login, e o horario dos dois relatorios por e-mail. Sao tambem, todos,
  # editaveis em tela — e `git reset --hard` reverte arquivo versionado.
  #
  # Sem esta restauracao, tudo que o admin ajustou em /admin/settings volta ao
  # padrao no deploy seguinte, sem erro e sem aviso: a tela salva, responde
  # 200, e o valor sobrevive ate o proximo deploy. E a mesma classe do campo
  # sem coluna, agora com o deploy no papel de quem apaga.
  #
  # O tarball e o mais recente de ~/backups-deploy, feito no passo 3 minutos
  # atras. **Nao da para usar \$CARIMBO aqui**: o passo 3 roda noutra sessao
  # SSH, e a variavel nao atravessa — a primeira versao desta correcao usava,
  # e teria falhado em silencio, que e exatamente o defeito que ela conserta.
  ULTIMO=\$(ls -1t ~/backups-deploy/data-*.tar.gz 2>/dev/null | head -1)
  if [ -n \"\$ULTIMO\" ]; then
    for f in settings login-config admin-weekly-config student-progress-email-config; do
      if tar xzf \"\$ULTIMO\" -C . data/\$f.json 2>/dev/null; then
        echo \"    restaurado de producao: data/\$f.json\"
      fi
    done
  else
    echo \"    AVISO: nenhum backup em ~/backups-deploy — a configuracao de\"
    echo \"    producao NAO foi restaurada e voltou ao padrao do repositorio.\"
  fi
  npm install --legacy-peer-deps --no-audit --no-fund
  npm run build
'"

echo "==> 5/6  Reiniciando"
ssh vps bash -lc "'pm2 restart ${PM2_NAME} --update-env && sleep 4 && pm2 describe ${PM2_NAME} | grep -E \"status|restarts\" | head -3'"

echo "==> 6/6  Verificação"
DEPOIS=$(ssh vps bash -lc "'grep -o \"assets/index-[^\\\"]*\\.js\" ${APP_DIR}/dist/index.html | head -1'")
SAUDE=$(ssh vps bash -lc "'curl -sS --max-time 15 http://127.0.0.1:${PORTA}/api/health'" || echo "")

echo "    bundle antes:  $ANTES"
echo "    bundle depois: $DEPOIS"
echo "    health:        $SAUDE"

if [ -z "$SAUDE" ] || ! printf '%s' "$SAUDE" | grep -q '"ok":true'; then
  echo "FALHOU: a aplicação não respondeu saudável depois do restart." >&2
  ssh vps bash -lc "'pm2 logs ${PM2_NAME} --lines 40 --nostream'" >&2 || true
  exit 1
fi

if [ "$ANTES" = "$DEPOIS" ] && [ "$ANTES" != "sem-dist" ]; then
  echo "ATENÇÃO: o bundle não mudou. Ou não havia nada novo, ou o build não pegou." >&2
fi

echo "OK — deploy concluído e a aplicação respondeu saudável."
