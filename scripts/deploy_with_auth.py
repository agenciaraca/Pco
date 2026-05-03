#!/usr/bin/env python3
"""Deploy do AVA com auth real: pull, build, .env com senhas iniciais, restart."""
from __future__ import annotations
import os, sys, time
from pathlib import Path
import paramiko


def run(c, cmd, check=True, timeout=600, hide=False):
    if not hide:
        print(f"$ {cmd[:130]}{'...' if len(cmd) > 130 else ''}")
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if not hide:
        if out.strip(): print(out.rstrip())
        if err.strip(): print(f"[stderr] {err.rstrip()}")
    if check and rc != 0:
        raise RuntimeError(f"failed (rc={rc}): {cmd}")
    return rc, out, err


def main():
    host = os.environ['HOST']
    user = os.environ['USER_NAME']
    pkey = paramiko.Ed25519Key.from_private_key_file(os.environ['KEY_PATH'])
    super_pwd = os.environ['INITIAL_SUPERADMIN_PASSWORD']
    admin_pwd = os.environ['INITIAL_ADMIN_PASSWORD']
    student_pwd = os.environ['INITIAL_STUDENT_PASSWORD']
    jwt_secret = os.environ.get('JWT_SECRET') or os.urandom(32).hex()

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)

    nvm = 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'

    print("[*] Pull + build...")
    run(c, 'cd ~/ava-pco && git fetch --all && git reset --hard origin/main 2>&1 | tail -5')
    run(c, f'bash -lc \'{nvm} && cd ~/ava-pco && npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -5\'', timeout=900)
    run(c, f'bash -lc \'{nvm} && cd ~/ava-pco && npm run build 2>&1 | tail -5\'', timeout=600)

    print("[*] Atualizando .env (senhas iniciais + JWT_SECRET)...")
    env_content = f"""NODE_ENV=production
PORT=3035
HOST=0.0.0.0
SERVE_STATIC=./dist
ALLOWED_ORIGINS=https://ava.psicanaliseclinica.online
JWT_SECRET={jwt_secret}
INITIAL_SUPERADMIN_PASSWORD={super_pwd}
INITIAL_ADMIN_PASSWORD={admin_pwd}
INITIAL_STUDENT_PASSWORD={student_pwd}
"""
    # Escreve .env via heredoc
    run(c, f'cat > ~/ava-pco/.env <<\'PCOEOF\'\n{env_content}PCOEOF\nchmod 600 ~/ava-pco/.env')

    # Remove data/users.json se existir, para forçar re-seed com as novas senhas
    print("[*] Limpando data/users.json para re-seed (se existia)...")
    run(c, 'rm -f ~/ava-pco/data/users.json && ls ~/ava-pco/data/ 2>/dev/null || true', check=False)

    # Restart
    print("[*] Encerrando instância antiga e reiniciando...")
    run(c, "pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False, hide=True)
    time.sleep(1)
    run(c, 'nohup ~/ava-pco/start.sh > ~/ava-pco/app.log 2>&1 &', check=False)
    time.sleep(4)

    # Health
    rc, out, _ = run(c, 'curl -s -m 5 http://127.0.0.1:3035/api/health', check=False)
    print(f"[+] Health: {out.strip()}")

    # Verifica login com superadmin
    print("[*] Testando login do superadmin...")
    test_cmd = (
        'curl -s -m 5 -X POST http://127.0.0.1:3035/api/auth/login '
        '-H "content-type: application/json" '
        f'-d \'{{"email":"superadmin@pco.local","password":"{super_pwd}"}}\''
    )
    rc, out, _ = run(c, test_cmd, check=False)
    if '"token"' in out and '"role":"superadmin"' in out:
        print("[+] Login superadmin OK")
    else:
        print(f"[!] Login falhou: {out}")
        run(c, "tail -40 ~/ava-pco/app.log", check=False)

    c.close()
    print("\n=== Deploy concluído ===")


if __name__ == '__main__':
    main()
