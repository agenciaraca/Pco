#!/usr/bin/env bash
# Instala cron jobs do AVA PCO no user crontab (sem sudo):
#   - Backup diário às 03:00 UTC
#   - Health-check ping a cada 5 min (mantém log se cair)

set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/ava-pco}"
LOG_DIR="${LOG_DIR:-$HOME/ava-pco/logs}"
mkdir -p "$LOG_DIR"

CRON_TAG="# ava-pco-cron"

# Pega cron atual (se houver), remove linhas com nossa tag, adiciona novas
NEW_CRON=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true)

NEW_CRON+=$(cat <<EOF


# ===== AVA PCO ===== $CRON_TAG
0 3 * * * bash $REPO_DIR/scripts/backup_data.sh >> $LOG_DIR/backup.log 2>&1 $CRON_TAG
*/5 * * * * curl -s -o /dev/null -m 5 http://127.0.0.1:3035/api/health || (echo "[\$(date)] api down — restarting" >> $LOG_DIR/health.log; nohup $REPO_DIR/start.sh >> $LOG_DIR/auto-restart.log 2>&1 &) $CRON_TAG
EOF
)

echo "$NEW_CRON" | crontab -
echo "[+] crontab instalado:"
crontab -l | grep -A 4 "AVA PCO"
