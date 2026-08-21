# Deploy — AVA PCO

Guia passo-a-passo para subir e atualizar a produção. O AVA PCO roda como processo Node em VPS Linux com tsx (sem build server-side; usa runtime Node 20+).

## Stack de produção

| Componente | Tecnologia |
|---|---|
| Runtime | Node 20+ via nvm |
| Servidor HTTP | Hono via `tsx server/dev.ts` |
| Build front | Vite (saída em `dist/`) |
| Static + API | Hono serve `dist/` + roteia `/api/*` |
| Persistência | JsonStore (default em `data/*.json`) |
| Postgres | Via `DATABASE_URL` — produção em **DivZ** (`db.divz.com.br`); driver node-postgres (pg) |
| Process supervisor | **pm2** (`ecosystem.config.cjs`); boot via cron `@reboot pm2 resurrect` |

## Pré-requisitos no VPS

- Linux (testado em Ubuntu/Debian)
- Acesso SSH (porta 22) com senha ou chave
- Node 20+ instalado via nvm em `~/.nvm`
- git, curl, npm
- Permissão pra escrever em `~/ava-pco/`

## Estrutura no servidor

```
~/ava-pco/
├── server/                # código backend (tsx runtime)
├── src/                   # código frontend
├── dist/                  # build do Vite (gerado por npm run build)
├── data/                  # persistência JsonStore (criado em runtime)
│   ├── users.json
│   ├── orders.json
│   ├── audit-log.json
│   └── ... (~30 arquivos)
├── data/backups/          # snapshots tar.gz (gerados pelo backup-worker)
├── app.log                # stdout/stderr do processo
├── package.json
├── .env                   # NÃO commitado, configurado manualmente
└── node_modules/
```

## Variáveis de ambiente em produção

Copie `.env.example` para `~/ava-pco/.env` e preencha. As **obrigatórias** em produção:

```bash
# Origens CORS permitidas (separadas por vírgula)
ALLOWED_ORIGINS=https://ava.psicanaliseclinica.online

# Master key 32 bytes hex pra criptografar credenciais (AES-GCM 256)
# Gerar: openssl rand -hex 32
AI_KEY_ENCRYPTION_SECRET=<64-hex-chars>

# JWT secret (32+ chars). Sem isso, gera aleatório por processo (sessões caem ao reiniciar)
# Gerar: openssl rand -hex 32
JWT_SECRET=<64-hex-chars>

# Senhas iniciais dos seeds (apenas no primeiro boot, depois pode remover)
INITIAL_SUPERADMIN_PASSWORD=<senha-forte>
INITIAL_ADMIN_PASSWORD=<senha-forte>
INITIAL_STUDENT_PASSWORD=<senha-forte>
```

Opcionais:

```bash
# Postgres remoto (default: in-memory + JsonStore)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Rate limit per API token (default 60/min)
API_TOKEN_RATE_LIMIT=120

# Diretório de dados (default: ./data)
DATA_DIR=/var/lib/ava-pco/data
```

## Primeiro deploy (do zero)

No VPS:

```bash
# 1. Clonar repo
cd ~
git clone https://github.com/agenciaraca/Pco.git ava-pco
cd ava-pco

# 2. Instalar Node via nvm (se não tiver)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20

# 3. Configurar .env (ver seção acima)
cp .env.example .env
nano .env

# 4. Instalar dependências
npm install --legacy-peer-deps --no-audit --no-fund

# 5. Build do frontend
npm run build

# 6. Iniciar (detached, sobrevive ao logout)
setsid nohup bash -c '
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
  cd ~/ava-pco && npx tsx server/dev.ts
' </dev/null > app.log 2>&1 &

# 7. Aguardar boot e checar health
sleep 3
curl -s http://127.0.0.1:3035/api/health
# Esperado: {"ok":true,"ts":...,"db":"fallback"}
```

A partir do segundo boot, os seeds já existem — `INITIAL_*` viram irrelevantes.

## Migrations em produção (histórico baselineado em 2026-08-16)

Até 16/ago/2026 o DivZ **não tinha a tabela `__drizzle_migrations`** — o schema
havia sido criado por `db:push` ou à mão, e `npm run db:migrate` contra produção
teria tentado aplicar a `0000` (CREATE TABLE de tudo).

**Isso foi resolvido.** O histórico foi baselineado: `drizzle.__drizzle_migrations`
existe e tem as três migrations (`0000`, `0001`, `0002`) registradas com o hash
sha256 do arquivo `.sql` e o `when` do `meta/_journal.json` — os mesmos valores
que o drizzle calcularia. A partir daqui `db:migrate` é seguro e aplica só o que
for novo.

Se você gerar uma migration nova e quiser baselinear outra base do zero, os
hashes saem de:

```bash
node -e "const fs=require('fs'),c=require('crypto');
const j=JSON.parse(fs.readFileSync('server/db/migrations/meta/_journal.json','utf8'));
for(const e of j.entries){const q=fs.readFileSync('server/db/migrations/'+e.tag+'.sql').toString();
console.log(c.createHash('sha256').update(q).digest('hex'), e.when, e.tag);}"
```

### Quem pode rodar DDL

O role da aplicação (`pco_lms_app`) **não é dono das tabelas** — DDL exige
`pco_lms_owner`. O caminho que funciona é o **MCP do DivZ** (`run_sql` no projeto
`pco-lms`), que já conecta como owner. A senha de owner que estava em
`.env.bak.pre-app-role` no servidor não vale mais; não perca tempo com ela.

### Migration 0002 — aplicada em 2026-08-16

```sql
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "meta" jsonb;
ALTER TYPE "public"."ai_module" ADD VALUE IF NOT EXISTS 'question_generation';
```

**Exige restart da app depois do DDL.** `server/repositories/courses.ts` guarda a
detecção da coluna ausente (42703, embrulhado pelo drizzle em `cause`) numa flag
de módulo `metaColumnAvailable`; uma vez `false`, ela só volta a `true` com um
processo novo. Sem o restart a aba "Página pública" continua salvando sem
persistir, mesmo com a coluna já existindo.

## Atualização (deploy contínuo)

> **Servidor atual: `195.200.0.253` (`srv539124`), app sob PM2 como `ava-pco`.**
> O IP `177.7.35.13` citado adiante nesta página está morto — a app migrou e a
> porta 22 do host antigo não responde. Os scripts Python de deploy ainda apontam
> pro endereço antigo; use o caminho por SSH abaixo até serem revisados.
>
> **O deploy automático não chega aqui.** Medido em 21/ago/2026: o workflow
> conecta em `srv1621737`, que tem uma cópia do repo e nenhum processo PM2 —
> por isso o `git pull` e o `npm run build` passavam e só o `pm2 restart`
> falhava. Até que `VPS_HOST` e `VPS_PASSWORD` sejam trocados (juntos: a senha
> guardada é a do host errado), **todo deploy é manual, pelo comando abaixo**.

```bash
# 1. Local: garante que main está atualizado
git push origin main

# 2. Deploy completo (pull + install + build + restart PM2)
ssh vps 'sudo -u avapco -i bash -c "cd ~/ava-pco \
  && git checkout -- package-lock.json && git fetch --all -q \
  && git reset --hard origin/main \
  && npm install --legacy-peer-deps --no-audit --no-fund \
  && npm run build && pm2 restart ava-pco --update-env"'

# 3. Verificação
ssh vps 'sudo -u avapco -i curl -s http://127.0.0.1:3035/api/health'
curl -s https://ava.psicanaliseclinica.online/login | grep -o 'assets/index-[^"]*\.js'
```

O passo 3 importa: `/api/health` devolve 200 mesmo servindo código velho. A única
confirmação real de que o deploy subiu é o hash do bundle bater com o `dist/` local.

### Caminho histórico (host antigo, mantido como referência)

O script `update_vps_pwd.py`:
1. Conecta via SSH
2. `git fetch && git reset --hard origin/main`
3. `npm install --legacy-peer-deps`
4. `npm run build`
5. Tenta `systemctl --user restart ava-pco.service` (não existe → fallback)
6. `pkill -f 'tsx server/dev.ts'`
7. Inicia processo novo via setsid + nohup
8. Health check em http://127.0.0.1:3035/api/health

Se só precisar reiniciar (sem rebuild), use `restart_vps.py`:

```bash
HOST=... USER_NAME=avapco PORT=22 SSH_PASSWORD='...' python scripts/restart_vps.py
```

## Backup e restore

### Backup automático

Worker em background snapshot diário em `data/backups/snap-YYYY-MM-DD.tar.gz`. Mantém os últimos 30 dias.

### Backup manual

```bash
cd ~/ava-pco
tar czf data/backups/manual-$(date +%Y%m%d-%H%M).tar.gz data/*.json
```

### Restore

1. Pare o processo: `pkill -f 'tsx server/dev.ts'`
2. Extraia: `tar xzf data/backups/snap-AAAA-MM-DD.tar.gz -C ~/ava-pco/`
3. Reinicie pelo deploy script ou `setsid nohup ... &`

### Backup remoto (recomendado, não-implementado)

Atualmente backups ficam só no VPS. Para DR completo, configure cron pra copiar `data/backups/*.tar.gz` para S3 ou outro VPS:

```bash
# Exemplo cron (não automatizado pelo AVA)
0 4 * * * aws s3 sync ~/ava-pco/data/backups/ s3://ava-pco-backup/$(hostname)/
```

## Health checks

```bash
# 1. Endpoint de saúde
curl http://127.0.0.1:3035/api/health
# {"ok":true,"ts":...,"uptimeSec":12345,"memMB":150,"db":"fallback"}

# 2. Processo rodando?
ps aux | grep -E 'tsx server/dev|node.*server' | grep -v grep

# 3. Porta aberta?
ss -tlnp | grep 3035

# 4. Logs recentes
tail -50 ~/ava-pco/app.log

# 5. Espaço em disco
du -sh ~/ava-pco/data/

# 6. Última atualização git
cd ~/ava-pco && git log --oneline -1
```

## Troubleshooting

### "Failed to restart ava-pco.service: Unit not found"

Esperado. Não usamos systemd. O fallback do script (pkill + setsid + nohup) já cuida.

### Processo não sobe após deploy

```bash
# Veja erro
tail -100 ~/ava-pco/app.log

# Variáveis de ambiente carregadas?
ssh ... 'cat ~/ava-pco/.env | head -5'

# Permissão na pasta data?
ssh ... 'ls -la ~/ava-pco/data/'
```

### Health retorna 401 "rest_forbidden_context" no importer

Não é o servidor — é o WordPress de origem. Use o **diagnose tool** em `/admin/imports`:
1. Clica no 🔬 ao lado de "Testar conexão"
2. Modal mostra status de `/wp-json`, `/users/me` (role atual), `/users?context=edit`
3. Se `/users?context=edit` retornar 401: plugin de segurança (Wordfence, Limit Login Attempts) está bloqueando — desativar ou usar Application Password de admin

### Sessões caem ao reiniciar

`JWT_SECRET` não está fixo no `.env`. Sem ele, o servidor gera secret aleatório por processo. Defina:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> ~/ava-pco/.env
```

E reinicie.

### `data/users.json` corrompido

```bash
# Restaurar do último backup
cd ~/ava-pco
ls -t data/backups/ | head -3
tar xzf data/backups/snap-YYYY-MM-DD.tar.gz -C .
```

### Build falhou (Vite OOM)

VPS com pouca RAM (<2GB) pode quebrar no `npm run build`. Aumente swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Porta 3035 já em uso

```bash
ss -tlnp | grep 3035
# Mata o processo conflitante
pkill -f 'tsx server/dev.ts'
```

## Rollback rápido

Se um deploy quebrou produção:

```bash
# No VPS:
cd ~/ava-pco
git log --oneline -5    # encontre o commit estável anterior
git reset --hard <commit-anterior>
npm install --legacy-peer-deps
npm run build
pkill -f 'tsx server/dev.ts'
setsid nohup bash -c '
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
  cd ~/ava-pco && npx tsx server/dev.ts
' </dev/null > app.log 2>&1 &
```

## Monitoramento contínuo (recomendações)

- **Uptime monitor externo** (UptimeRobot, BetterUptime) batendo `/api/health` a cada 5min
- **Sentry** server-side se `SENTRY_DSN` setado
- **Cron de backup remoto** (S3 sync diário)
- **Log rotation**: `app.log` cresce indefinidamente; configure logrotate ou trunque manualmente

## Limites e capacidade

| Recurso | Limite atual |
|---|---|
| Tokens API | sem limite (default 60 reqs/min por token) |
| Audit log | 5000 entries (truncamento FIFO) |
| Errors log | 2000 entries |
| Webhook deliveries | 5000 entries |
| Tutor history | 200 turnos/user |
| API token rate limit | 60 reqs/min (env `API_TOKEN_RATE_LIMIT`) |
| Geral rate limit | 120 reqs/min por IP |

## Segurança

- **Nunca** commite `.env` ou `data/*.json` (já está em `.gitignore`)
- Permissão `0600` em `data/users.json` (aplicada automaticamente pelo store)
- Credenciais (gateways, e-mail, webhooks, importer) sempre criptografadas com `AI_KEY_ENCRYPTION_SECRET`
- 2FA admin ativado força `tokenVersion` bump no enable/disable
- API tokens armazenados como SHA-256 hash; o segredo claro só é mostrado na criação

## Pontos-chave que mudam em produção vs dev

| Aspecto | Dev | Produção |
|---|---|---|
| `JWT_SECRET` | Pode ser ausente (fallback aleatório) | **Obrigatório** (sessões caem ao reiniciar) |
| `AI_KEY_ENCRYPTION_SECRET` | Pode ser ausente (modo `dev:`) | **Obrigatório** (criptografia real) |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Domínio público |
| `INITIAL_*_PASSWORD` | Auto-geradas e logadas | **Obrigatórias** se primeira instalação |
| Build | `npm run dev` (Vite HMR) | `npm run build` + `npx tsx server/dev.ts` |
| Process | terminal interativo | setsid + nohup + `app.log` |
