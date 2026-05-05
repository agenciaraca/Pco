#!/usr/bin/env python3
"""Update rápido por SENHA SSH: git pull + build + restart no VPS."""
import os, sys, time
import paramiko

# Força UTF-8 no stdout pra não quebrar com chars Unicode do output do Vite
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

def run(cmd, check=True, timeout=600, hide_cmd=False):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if not hide_cmd:
        print(f"$ {cmd[:140]}{'...' if len(cmd)>140 else ''}")
    if out.strip(): print(out.rstrip())
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    if check and rc != 0:
        sys.exit(f"Failed (rc={rc}): {cmd}")
    return out

nvm = 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'

print("[*] whoami / pwd / nvm probe ...")
run('echo "$USER @ $(hostname) :: $(pwd)" && ls -la ~/ava-pco 2>&1 | head -5')
run('test -d ~/.nvm && echo "nvm: ok" || echo "nvm: MISSING"', check=False)

print("[*] Pulling latest...")
run('cd ~/ava-pco && git fetch --all 2>&1 | tail -3 && git reset --hard origin/main 2>&1 | tail -3')

print("[*] npm install ...")
run(f'bash -lc \'{nvm} && cd ~/ava-pco && npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -8\'',
    timeout=900)

print("[*] npm run build ...")
run(f'bash -lc \'{nvm} && cd ~/ava-pco && npm run build 2>&1 | tail -10\'', timeout=600)

print("[*] Restart ...")
out = run('systemctl --user restart ava-pco.service 2>&1', check=False)
if 'Failed' in out or 'not loaded' in out or 'not be found' in out:
    print("[*] systemd --user falhou, tentando pkill + nohup ...")
    run("pkill -f 'tsx server/dev.ts' 2>/dev/null; pkill -f 'node.*server' 2>/dev/null", check=False)
    time.sleep(1)
    if os.path.exists:
        run('test -x ~/ava-pco/start.sh && nohup ~/ava-pco/start.sh > ~/ava-pco/app.log 2>&1 & echo started || echo "no start.sh"',
            check=False)

time.sleep(3)
print("[*] Health check ...")
run(f'curl -s -m 5 http://127.0.0.1:{port if port==3035 else 3035}/api/health || tail -30 ~/ava-pco/app.log',
    check=False)
print("[*] Verificando endpoints novos do importer ...")
run('curl -s -m 5 -o /dev/null -w "imports/connections: HTTP %{http_code}\\n" http://127.0.0.1:3035/api/admin/imports/connections',
    check=False)
c.close()
print("[+] Done.")
