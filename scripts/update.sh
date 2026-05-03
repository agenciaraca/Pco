#!/usr/bin/env bash
# Atualização rápida do AVA PCO em produção. Rode após cada push no main.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ava-pco}"

cd "$APP_DIR"
git pull --ff-only
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm ci --no-audit --no-fund
npm run build
npm run db:migrate || true
sudo systemctl restart ava-pco-api
echo "✓ atualizado e reiniciado em $(date)"
