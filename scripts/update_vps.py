#!/usr/bin/env python3
"""Update rápido: git pull + build + restart no VPS."""
import os, sys, time
from pathlib import Path
import paramiko

host = os.environ['HOST']
user = os.environ['USER_NAME']
pkey = paramiko.Ed25519Key.from_private_key_file(os.environ['KEY_PATH'])
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)

def run(cmd, check=True, timeout=600):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    if out.strip(): print(out.rstrip())
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    if check and rc != 0:
        sys.exit(f"Failed: {cmd}")
    return out

nvm = 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'

print("[*] Pulling latest...")
run('cd ~/ava-pco && git fetch --all && git reset --hard origin/main 2>&1 | tail -5')

print("[*] npm install (caso novas deps)...")
run(f'bash -lc \'{nvm} && cd ~/ava-pco && npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -5\'')

print("[*] npm run build...")
run(f'bash -lc \'{nvm} && cd ~/ava-pco && npm run build 2>&1 | tail -5\'', timeout=600)

print("[*] Restart serviço (systemd --user OR pkill+nohup)...")
out = run('systemctl --user restart ava-pco.service 2>&1 || true', check=False)
if 'Failed' in out or 'not loaded' in out:
    print("[*] systemd --user falhou, usando pkill+nohup...")
    run("pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False)
    time.sleep(1)
    run('nohup ~/ava-pco/start.sh > ~/ava-pco/app.log 2>&1 &', check=False)

time.sleep(3)
print("[*] Health check...")
run('curl -s -m 5 http://127.0.0.1:3035/api/health || tail -30 ~/ava-pco/app.log', check=False)
c.close()
print("[+] Done.")
