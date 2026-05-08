#!/usr/bin/env python3
"""Restart-only do AVA PCO no VPS — não faz git pull/build, só restart limpo."""
import os, sys, time
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
c.connect(
    host, port=port, username=user, password=password,
    look_for_keys=False, allow_agent=False, timeout=15
)


def run(cmd, check=True, timeout=30):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    print(f"$ {cmd[:140]}{'...' if len(cmd)>140 else ''}")
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(f"[stderr] {err.rstrip()}")
    if check and rc != 0:
        sys.exit(f"Failed (rc={rc}): {cmd}")
    return out


print("[*] Pre-state...")
run("ps aux | grep -E 'node|tsx' | grep -v grep | head -5", check=False)

print("[*] Killing existing processes...")
run("pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False)
run("pkill -f 'node.*server/dev' 2>/dev/null || true", check=False)
run("pkill -f 'ava-pco' 2>/dev/null || true", check=False)
time.sleep(2)

print("[*] Checking start.sh / package.json scripts...")
run("ls -la ~/ava-pco/start.sh 2>/dev/null || echo 'no start.sh'", check=False)
run("grep -E '\"(start|dev|prod|serve)\":' ~/ava-pco/package.json | head -10", check=False)

print("[*] Starting via nohup setsid (tsx direto)...")
# Usa setsid + nohup + redirect stdin para detach total.
# IMPORTANTE: carrega .env (JWT_SECRET, AI_KEY_ENCRYPTION_SECRET, INITIAL_*_PASSWORD).
start = (
    'bash -lc \'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && cd ~/ava-pco && '
    'set -a && . ./.env && set +a && '
    'setsid nohup env PORT=3035 SERVE_STATIC=./dist HOST=0.0.0.0 '
    'npx tsx server/dev.ts '
    '>> ~/ava-pco/app.log 2>&1 < /dev/null &\' && echo dispatched'
)
si, so, se = c.exec_command(start)
time.sleep(2)
try:
    so.channel.close()
except Exception:
    pass

print("[*] Aguardando 5s para o processo subir...")
time.sleep(5)

print("[*] Pós-state...")
run("ps aux | grep -E 'node|tsx' | grep -v grep | head -5", check=False)
run("ss -tlnp 2>/dev/null | grep 3035 || netstat -tln 2>/dev/null | grep 3035", check=False)

print("[*] Health check via curl localhost:3035...")
run("curl -s -m 5 http://127.0.0.1:3035/api/health || echo 'health failed'", check=False)
run("curl -s -m 5 -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:3035/", check=False)

print("[*] Últimas linhas do app.log:")
run("tail -20 ~/ava-pco/app.log 2>/dev/null || echo 'no app.log'", check=False)

c.close()
print("[+] Done.")
