#!/usr/bin/env python3
"""Configura segredos faltantes em producao (read-modify-write seguro).

Comportamento:
  1. Le ~/ava-pco/.env existente.
  2. Para cada secret faltando, gera valor (32 bytes hex via openssl)
     e faz APPEND ao arquivo (nao remove/sobrescreve nada).
  3. Mostra config final mascarada.
  4. Restart limpo via setsid + nohup tsx server/dev.ts.
  5. Health check.

Variaveis controladas:
  AI_KEY_ENCRYPTION_SECRET — sempre adicionada se ausente.
  JWT_SECRET — adicionada se ausente (preserva valor atual).

Variaveis opcionais via env local:
  EXTRA_SENTRY_DSN — se setado, append SENTRY_DSN.
  EXTRA_PUBLIC_ORIGIN — append PUBLIC_ORIGIN (URL da app).
"""
import os
import sys
import time
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
extra_sentry = os.environ.get('EXTRA_SENTRY_DSN')
extra_origin = os.environ.get('EXTRA_PUBLIC_ORIGIN')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, port=port, username=user, password=password,
          look_for_keys=False, allow_agent=False, timeout=15)


def run(cmd, check=True, timeout=30, hide=False):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if not hide:
        print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
        if out.strip(): print(out.rstrip())
        if err.strip(): print(f"[stderr] {err.rstrip()}")
        print()
    if check and rc != 0:
        sys.exit(f"FAIL (rc={rc}): {cmd}")
    return out


print("=" * 60)
print("[1] Lendo .env atual + identificando segredos faltantes")
print("=" * 60)
env_content = run("cat ~/ava-pco/.env 2>/dev/null || echo ''", hide=True)
existing_keys = set()
for line in env_content.split('\n'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    if '=' in line:
        existing_keys.add(line.split('=', 1)[0])

print(f"Chaves existentes: {sorted(existing_keys)}")
print()

needed = {}
if 'AI_KEY_ENCRYPTION_SECRET' not in existing_keys:
    needed['AI_KEY_ENCRYPTION_SECRET'] = run("openssl rand -hex 32", hide=True).strip()
if 'JWT_SECRET' not in existing_keys:
    needed['JWT_SECRET'] = run("openssl rand -hex 32", hide=True).strip()
if extra_sentry and 'SENTRY_DSN' not in existing_keys:
    needed['SENTRY_DSN'] = extra_sentry
if extra_origin and 'PUBLIC_ORIGIN' not in existing_keys:
    needed['PUBLIC_ORIGIN'] = extra_origin

if not needed:
    print("Nada a adicionar — todos os secrets ja configurados.")
    print("Saindo.")
    c.close()
    sys.exit(0)

print(f"Secrets a adicionar: {sorted(needed.keys())}")
print()

print("=" * 60)
print("[2] Append ao .env (preserva existentes + permissao 600)")
print("=" * 60)
appendix = '\n# --- adicionado em ' + time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) + ' ---\n'
for k, v in needed.items():
    appendix += f"{k}={v}\n"

# Backup .env antes
run("cp -p ~/ava-pco/.env ~/ava-pco/.env.bak.$(date -u +%Y%m%dT%H%M%SZ) 2>/dev/null || true")

# Append
sftp = c.open_sftp()
with sftp.open('/tmp/env-append', 'w') as f:
    f.write(appendix)
sftp.close()
run("cat /tmp/env-append >> ~/ava-pco/.env && rm -f /tmp/env-append")
run("chmod 600 ~/ava-pco/.env")

print("=" * 60)
print("[3] .env final (mascarado)")
print("=" * 60)
run(
    "awk -F= '{key=$1; rest=$0; sub(/^[^=]*=/, \"\", rest); "
    "if (length(rest)>10) rest=substr(rest,1,4)\"...\"substr(rest,length(rest)-2); "
    "if (rest==\"\") rest=\"(empty)\"; print key\"=\"rest}' ~/ava-pco/.env"
)

print("=" * 60)
print("[4] Restart limpo")
print("=" * 60)
run("pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False)
run("pkill -f 'node.*server/dev' 2>/dev/null || true", check=False)
time.sleep(2)
start = (
    'bash -lc \'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && cd ~/ava-pco && '
    'set -a && . ./.env && set +a && '
    'setsid nohup env PORT=3035 SERVE_STATIC=./dist HOST=0.0.0.0 '
    'JWT_SECRET="$JWT_SECRET" AI_KEY_ENCRYPTION_SECRET="$AI_KEY_ENCRYPTION_SECRET" '
    'INITIAL_SUPERADMIN_PASSWORD="$INITIAL_SUPERADMIN_PASSWORD" '
    'INITIAL_ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD" '
    'INITIAL_STUDENT_PASSWORD="$INITIAL_STUDENT_PASSWORD" '
    'NODE_ENV=production '
    'ALLOWED_ORIGINS="$ALLOWED_ORIGINS" '
    'SENTRY_DSN="$SENTRY_DSN" PUBLIC_ORIGIN="$PUBLIC_ORIGIN" '
    'npx tsx server/dev.ts '
    '>> ~/ava-pco/app.log 2>&1 < /dev/null &\' && echo dispatched'
)
si, so, se = c.exec_command(start)
time.sleep(2)
try:
    so.channel.close()
except Exception:
    pass

print("Aguardando 6s para o processo subir...")
time.sleep(6)

print("=" * 60)
print("[5] Health check")
print("=" * 60)
run("ps aux | grep -E 'node|tsx' | grep -v grep | head -3", check=False)
run("ss -tlnp 2>/dev/null | grep 3035 || netstat -tln 2>/dev/null | grep 3035", check=False)
run("curl -s -m 5 http://127.0.0.1:3035/api/health || echo '(health failed)'", check=False)
run("tail -10 ~/ava-pco/app.log 2>/dev/null", check=False)

c.close()
print("[+] Done.")
