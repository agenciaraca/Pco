#!/usr/bin/env python3
"""Update por SENHA SSH num VPS SEM PM2: git pull + build + restart — legado."""
import os, sys, time
import paramiko

# Força UTF-8 no stdout pra não quebrar com chars Unicode do output do Vite
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# ---------------------------------------------------------------------------
# Este script é anterior ao PM2, e roda por SENHA.
#
# Duas coisas mudaram desde que ele foi escrito e não dá para inferir lendo o
# código: a app em produção é gerenciada pelo PM2 (`ava-pco`), e a senha de SSH
# deixou de existir — o acesso é por chave desde 30/ago/2026. O bloco de subida
# aqui usa `setsid nohup npx tsx`, isto é, sobe um processo POR FORA do PM2:
# ou ele não consegue a porta 3035, ou vence a disputa e deixa o PM2 em laço
# de reinício. Em produção, sem aviso.
#
# O caminho de hoje:
#   restart só:  ssh vps 'pm2 restart ava-pco'
#   deploy:      bash scripts/deploy_producao.sh
#
# Fica aqui porque serve de referência para um host sem PM2. Para rodar assim
# mesmo, passe SEI_O_QUE_FACO=1 — o mesmo portão de sync_data_to_vps.py.
# ---------------------------------------------------------------------------
if not os.environ.get('SEI_O_QUE_FACO'):
    print(__doc__)
    print('RECUSADO: este script sobe a app por fora do PM2, que é quem')
    print('gerencia `ava-pco` em produção — rodar aqui deixa o app em laço')
    print('de reinício disputando a porta 3035.')
    print()
    print("  restart só:  ssh vps 'pm2 restart ava-pco'")
    print('  deploy:      bash scripts/deploy_producao.sh')
    print()
    print('Para rodar assim mesmo (host sem PM2), passe SEI_O_QUE_FACO=1.')
    sys.exit(1)

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
    print("[*] systemd --user falhou, tentando pkill + setsid nohup ...")
    run("pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False)
    run("pkill -f 'node.*server/dev' 2>/dev/null || true", check=False)
    run("pkill -f 'ava-pco' 2>/dev/null || true", check=False)
    time.sleep(2)
    # Detach total — setsid + nohup + redirect stdin pra evitar travar o channel.
    # IMPORTANTE: carrega .env via set -a + dotsource pra que JWT_SECRET,
    # AI_KEY_ENCRYPTION_SECRET, INITIAL_*_PASSWORD etc cheguem ao processo.
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

time.sleep(5)
print("[*] Health check ...")
run(f'curl -s -m 5 http://127.0.0.1:{port if port==3035 else 3035}/api/health || tail -30 ~/ava-pco/app.log',
    check=False)
print("[*] Verificando endpoints novos do importer ...")
run('curl -s -m 5 -o /dev/null -w "imports/connections: HTTP %{http_code}\\n" http://127.0.0.1:3035/api/admin/imports/connections',
    check=False)
c.close()
print("[+] Done.")
