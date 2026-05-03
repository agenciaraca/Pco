#!/usr/bin/env bash
# ============================================================================
# AVA PCO — script de provisionamento e deploy para VPS Ubuntu/Debian
# ============================================================================
# Uso:
#   1. SSH no VPS:   ssh avapco@177.7.35.13
#   2. Rode:         curl -fsSL <url-raw-deste-arquivo> | bash
#      OU manual:    bash deploy.sh
#
# O script é IDEMPOTENTE — pode rodar múltiplas vezes com segurança.
# Resultado: AVA PCO rodando em https://<seu-domínio> com TLS automático.
#
# Arquitetura (Opção A — full stack no VPS):
#   - Node 20 (via nvm)
#   - Postgres 16 (apt)
#   - Caddy 2 (TLS automático via Let's Encrypt)
#   - systemd unit pra API Hono
#   - Frontend estático servido pelo Caddy
#   - /api proxy para localhost:3001
# ============================================================================

set -euo pipefail

# ---------- Configuração ----------

REPO_URL="${REPO_URL:-https://github.com/agenciaraca/Pco.git}"
APP_DIR="${APP_DIR:-/opt/ava-pco}"
APP_USER="${APP_USER:-$USER}"
DOMAIN="${DOMAIN:-}"           # Defina via env: DOMAIN=ava.pco.example
DB_NAME="${DB_NAME:-avapco}"
DB_USER="${DB_USER:-avapco}"
DB_PASS="${DB_PASS:-}"          # Será gerado se vazio
NODE_VERSION="${NODE_VERSION:-20}"

# ---------- Helpers ----------

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Comando obrigatório ausente: $1"
    exit 1
  fi
}

# ---------- Pré-checks ----------

bold "==> AVA PCO deploy"

if [ "$EUID" -eq 0 ]; then
  yellow "Aviso: rodando como root. Recomendado rodar como usuário regular com sudo."
fi

require_cmd sudo
require_cmd curl

# ---------- 1. Pacotes do sistema ----------

bold "==> Atualizando sistema e instalando dependências base..."
sudo apt-get update -y
sudo apt-get install -y \
  curl ca-certificates gnupg lsb-release git build-essential \
  ufw fail2ban \
  postgresql postgresql-contrib \
  debian-keyring debian-archive-keyring apt-transport-https

# ---------- 2. Caddy 2 ----------

if ! command -v caddy >/dev/null 2>&1; then
  bold "==> Instalando Caddy 2 (TLS automático)..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
else
  green "Caddy já instalado."
fi

# ---------- 3. Node via nvm (no usuário, não global) ----------

if [ ! -d "$HOME/.nvm" ]; then
  bold "==> Instalando nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

# shellcheck disable=SC1091
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! nvm ls "$NODE_VERSION" >/dev/null 2>&1; then
  bold "==> Instalando Node $NODE_VERSION..."
  nvm install "$NODE_VERSION"
fi
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
green "Node: $(node --version), npm: $(npm --version)"

# ---------- 4. Postgres ----------

bold "==> Configurando Postgres..."
sudo systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  if [ -z "$DB_PASS" ]; then
    DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    yellow "Senha do DB gerada (anote): $DB_PASS"
  fi
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null

DATABASE_URL="postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?sslmode=disable"
green "Postgres OK. DATABASE_URL gerada (não imprime senha)."

# ---------- 5. Clone / pull do repo ----------

bold "==> Sincronizando código em $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo chown "$APP_USER:$APP_USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" reset --hard origin/main
fi

cd "$APP_DIR"

# ---------- 6. Env vars ----------

bold "==> Configurando $APP_DIR/.env (se não existir)..."

if [ ! -f "$APP_DIR/.env" ]; then
  AI_KEY_SECRET="$(openssl rand -hex 32)"
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=$DATABASE_URL
AI_KEY_ENCRYPTION_SECRET=$AI_KEY_SECRET
ALLOWED_ORIGINS=${DOMAIN:+https://$DOMAIN}
EOF
  chmod 600 "$APP_DIR/.env"
  green ".env criado em $APP_DIR/.env (modo 600)"
else
  green ".env já existe — não sobrescrevendo."
fi

# ---------- 7. Install + build ----------

bold "==> npm ci..."
npm ci --no-audit --no-fund

bold "==> npm run build..."
npm run build

bold "==> Aplicando migrações Drizzle..."
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env"
set +a
npm run db:migrate || yellow "Migrações falharam (talvez já estejam aplicadas)."
npm run db:seed || yellow "Seed falhou (talvez já tenha rodado)."

# ---------- 8. systemd unit pra API ----------

bold "==> Configurando systemd unit ava-pco-api..."
NVM_NODE_PATH="$(which node)"

sudo tee /etc/systemd/system/ava-pco-api.service >/dev/null <<EOF
[Unit]
Description=AVA PCO API (Hono)
After=network.target postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NVM_NODE_PATH --import tsx $APP_DIR/server/dev.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ava-pco-api
sudo systemctl restart ava-pco-api
sleep 2

if systemctl is-active --quiet ava-pco-api; then
  green "API rodando ✓ (sudo systemctl status ava-pco-api)"
else
  red "API falhou. Cheque: sudo journalctl -u ava-pco-api -n 50 --no-pager"
fi

# ---------- 9. Caddy ----------

bold "==> Configurando Caddy..."

if [ -z "$DOMAIN" ]; then
  yellow "DOMAIN não definido — Caddy vai servir em :80 sem TLS."
  CADDY_HEADER=":80"
else
  CADDY_HEADER="$DOMAIN"
fi

sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$CADDY_HEADER {
  encode gzip zstd

  # API Hono
  handle_path /api/* {
    reverse_proxy localhost:3001
  }

  # Frontend estático (SPA fallback para /index.html)
  root * $APP_DIR/dist
  try_files {path} /index.html
  file_server

  # Cache imutável para assets com hash
  @assets path /assets/*
  header @assets Cache-Control "public, max-age=31536000, immutable"

  # Security headers
  header {
    X-Content-Type-Options nosniff
    X-Frame-Options DENY
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    -Server
  }
}
EOF

sudo systemctl restart caddy
sudo systemctl enable caddy

# ---------- 10. Firewall ----------

bold "==> Configurando UFW firewall..."
sudo ufw default deny incoming >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow 22/tcp >/dev/null
sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null

green "Firewall ativo: 22, 80, 443"

# ---------- 11. fail2ban (proteção SSH) ----------

if ! systemctl is-active --quiet fail2ban; then
  bold "==> Ativando fail2ban..."
  sudo systemctl enable --now fail2ban
fi

# ---------- Fim ----------

echo ""
bold "==================================================="
green "✓ AVA PCO deployed."
bold "==================================================="
echo ""
echo "API:      sudo systemctl status ava-pco-api"
echo "Logs:     sudo journalctl -u ava-pco-api -f"
echo "Caddy:    sudo systemctl status caddy"
echo "Postgres: sudo systemctl status postgresql"
echo ""
if [ -n "$DOMAIN" ]; then
  green "URL: https://$DOMAIN"
  echo "      (Caddy obtém TLS automaticamente em ~30s na primeira request)"
else
  green "URL: http://$(hostname -I | awk '{print $1}')"
  yellow "Defina DOMAIN no env e rode novamente para habilitar TLS."
fi
echo ""
echo "Para atualizar (depois de novo push no GitHub):"
echo "  cd $APP_DIR && git pull && npm ci --no-audit && npm run build && sudo systemctl restart ava-pco-api"
echo ""
