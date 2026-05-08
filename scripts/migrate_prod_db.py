#!/usr/bin/env python3
"""Aplica migrations Drizzle no banco de producao.

Comportamento:
  1. Verifica se DATABASE_URL esta no ~/ava-pco/.env.
  2. Se ausente: instrui owner como criar Neon e adicionar a env.
  3. Se presente: roda `npx tsx server/db/migrate.ts` no servidor.
  4. Reporta status final via /api/health (db: connected vs fallback).
"""
import os
import sys
import paramiko

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

host = os.environ['HOST']
user = os.environ['USER_NAME']
port = int(os.environ.get('PORT', '22'))
password = os.environ['SSH_PASSWORD']

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, port=port, username=user, password=password,
          look_for_keys=False, allow_agent=False, timeout=15)


def run(cmd, check=False, timeout=60):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    if out.strip(): print(out.rstrip())
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    print()
    if check and rc != 0:
        sys.exit(f"FAIL (rc={rc}): {cmd}")
    return out, rc


print("=" * 60)
print("[1] Verificando DATABASE_URL no .env de prod")
print("=" * 60)
env_out, _ = run("grep '^DATABASE_URL=' ~/ava-pco/.env 2>/dev/null || echo MISSING")
if 'MISSING' in env_out or not env_out.strip().startswith('DATABASE_URL='):
    print()
    print("=" * 60)
    print("DATABASE_URL ausente. Para configurar:")
    print("=" * 60)
    print("""
    1. Crie projeto Neon em https://console.neon.tech (free tier basta)
    2. Copie a connection string (formato: postgres://USER:PASS@HOST/db?sslmode=require)
    3. SSH no servidor: ssh avapco@177.7.35.13
    4. echo 'DATABASE_URL=postgres://...' >> ~/ava-pco/.env
    5. chmod 600 ~/ava-pco/.env
    6. Re-rode este script.
    """)
    c.close()
    sys.exit(0)

print("DATABASE_URL presente. Prosseguindo com migration.")
print()

print("=" * 60)
print("[2] Rodando npm run db:migrate")
print("=" * 60)
out, rc = run(
    'bash -lc \'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && '
    'cd ~/ava-pco && set -a && . ./.env && set +a && '
    'npm run db:migrate 2>&1\'',
    timeout=300,
)
if rc != 0:
    print(f"Migration falhou com rc={rc}. Veja stderr acima.")
    c.close()
    sys.exit(rc)

print("=" * 60)
print("[3] Restart limpo + health check")
print("=" * 60)
import time
run("pkill -f 'tsx server/dev.ts' 2>/dev/null || true")
time.sleep(2)
si, so, se = c.exec_command(
    'bash -lc \'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && cd ~/ava-pco && '
    'set -a && . ./.env && set +a && '
    'setsid nohup env PORT=3035 SERVE_STATIC=./dist HOST=0.0.0.0 '
    'npx tsx server/dev.ts >> ~/ava-pco/app.log 2>&1 < /dev/null &\' && echo dispatched'
)
time.sleep(6)
run("curl -s -m 5 http://127.0.0.1:3035/api/health")

c.close()
print("[+] Done. Verifique se health responde db: connected.")
