#!/usr/bin/env bash
# Instala os crons do Google Ads no user crontab (sem sudo):
#   - Conversões offline: todo dia às 05:00 UTC (~02:00 BRT) — a janela de
#     90 dias fica sempre coberta, e rodar de madrugada evita concorrer com
#     tráfego de pico.
#   - Customer Match: dia 1 de cada mês às 05:20 UTC — depois das conversões
#     do dia, sem pressa nenhuma (a lista de público não é sensível a hora).
#
# Mesmo padrão de `install_cron.sh`: tag própria, idempotente (roda de novo
# sem duplicar linha), sem sudo.

set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/ava-pco}"
LOG_DIR="${LOG_DIR:-$HOME/ava-pco/logs}"
mkdir -p "$LOG_DIR"

CRON_TAG="# ava-pco-google-ads-cron"

NEW_CRON=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true)

NEW_CRON+=$(cat <<EOF


# ===== Google Ads (Customer Match + Conversões Offline) ===== $CRON_TAG
0 5 * * * cd $REPO_DIR && npx tsx scripts/run_google_ads_offline_conversions.ts >> $LOG_DIR/google-ads-offline-conversions.log 2>&1 $CRON_TAG
20 5 1 * * cd $REPO_DIR && npx tsx scripts/run_google_ads_customer_match.ts >> $LOG_DIR/google-ads-customer-match.log 2>&1 $CRON_TAG
EOF
)

echo "$NEW_CRON" | crontab -
echo "[+] crontab instalado:"
crontab -l | grep -A 3 "Google Ads"
