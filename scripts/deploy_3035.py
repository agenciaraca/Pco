#!/usr/bin/env python3
"""Deploy AVA PCO em VPS multi-tenant CloudPanel: app full-stack na porta 3035."""
from __future__ import annotations
import os
import sys
import time
from pathlib import Path
import paramiko


def run(c: paramiko.SSHClient, cmd: str, check: bool = True, hide: bool = False, timeout: int | None = None) -> tuple[int, str, str]:
    if not hide:
        short = cmd if len(cmd) < 130 else cmd[:127] + '...'
        print(f"$ {short}")
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    if not hide:
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print(f"[stderr] {err.rstrip()}")
    if check and rc != 0:
        raise RuntimeError(f"command failed (rc={rc}): {cmd}")
    return rc, out, err


def main() -> int:
    host = os.environ["HOST"]
    user = os.environ["USER_NAME"]
    keyfile = Path(os.environ["KEY_PATH"]).expanduser()
    repo_url = os.environ.get("REPO_URL", "https://github.com/agenciaraca/Pco.git")
    port = os.environ.get("APP_PORT", "3035")
    domain = os.environ.get("DOMAIN", "ava.psicanaliseclinica.online")

    print(f"[*] {user}@{host} via chave SSH...")
    pkey = paramiko.Ed25519Key.from_private_key_file(str(keyfile))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)

    # 1. nvm
    rc, _, _ = run(c, "test -d ~/.nvm", check=False, hide=True)
    if rc != 0:
        print("[*] Instalando nvm...")
        run(c, "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>&1 | tail -5")

    nvm = 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'

    # 2. Node 20
    print("[*] Garantindo Node 20...")
    run(c, f'bash -lc \'{nvm} && nvm install 20 >/dev/null 2>&1; nvm alias default 20 >/dev/null 2>&1; node --version && npm --version\'')

    # 3. Repo em ~/ava-pco (não usa htdocs pq é symlink read-only para nginx)
    print("[*] Sincronizando repo em ~/ava-pco...")
    rc, _, _ = run(c, "test -d ~/ava-pco/.git", check=False, hide=True)
    if rc != 0:
        run(c, f"git clone {repo_url} ~/ava-pco 2>&1 | tail -5")
    else:
        run(c, "cd ~/ava-pco && git fetch --all && git reset --hard origin/main 2>&1 | tail -5")

    # 4. .env
    print("[*] Configurando .env...")
    env_content = f"""NODE_ENV=production
PORT={port}
HOST=0.0.0.0
SERVE_STATIC=./dist
ALLOWED_ORIGINS=https://{domain}
"""
    run(c, f'cat > ~/ava-pco/.env <<\'PCOEOF\'\n{env_content}PCOEOF\nchmod 600 ~/ava-pco/.env')

    # 5. npm install + build (com --legacy-peer-deps por conta de eslint/types)
    print("[*] npm install (legacy-peer-deps)...")
    run(c, f'bash -lc \'{nvm} && cd ~/ava-pco && npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -15\'', timeout=900)

    print("[*] npm run build...")
    run(c, f'bash -lc \'{nvm} && cd ~/ava-pco && npm run build 2>&1 | tail -10\'', timeout=600)

    # 6. Para qualquer instância antiga
    print("[*] Encerrando instância antiga (se existir)...")
    run(c, "pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False, hide=True)
    run(c, "pkill -f 'node.*ava-pco' 2>/dev/null || true", check=False, hide=True)
    time.sleep(1)

    # 7. Cria startup script com env carregado
    print("[*] Criando wrapper de start...")
    startup = f"""#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd ~/ava-pco
set -a
source .env
set +a
exec ./node_modules/.bin/tsx server/dev.ts
"""
    run(c, f'cat > ~/ava-pco/start.sh <<\'PCOEOF\'\n{startup}PCOEOF\nchmod +x ~/ava-pco/start.sh')

    # 8. Inicia com nohup, redireciona logs
    print("[*] Iniciando app na porta 3035...")
    run(c, "rm -f ~/ava-pco/app.log && nohup ~/ava-pco/start.sh > ~/ava-pco/app.log 2>&1 &", check=False)
    time.sleep(4)

    # 9. Verifica status
    rc, out, _ = run(c, "pgrep -af 'tsx.*server/dev.ts' | head -3", check=False)
    if not out.strip():
        print("[!] Processo não iniciou — log:")
        run(c, "cat ~/ava-pco/app.log | tail -50", check=False)
        c.close()
        return 1

    rc, out, _ = run(c, f"curl -s -m 5 http://127.0.0.1:{port}/api/health", check=False)
    if "ok" in out:
        print(f"[+] /api/health responde: {out.strip()}")
    else:
        print(f"[!] API não respondeu na porta {port}")
        run(c, "tail -50 ~/ava-pco/app.log", check=False)

    rc, out, _ = run(c, f"curl -s -m 5 -o /dev/null -w 'HTTP %{{http_code}} | %{{size_download}} bytes\\n' http://127.0.0.1:{port}/", check=False)
    print(f"[+] Frontend (/) -> {out.strip()}")

    # 10. Configurar restart automático via systemd USER (não precisa sudo)
    print("[*] Configurando systemd --user para restart automático...")
    unit = f"""[Unit]
Description=AVA PCO (full-stack)
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/ava-pco
ExecStart=%h/ava-pco/start.sh
Restart=always
RestartSec=5
StandardOutput=append:%h/ava-pco/app.log
StandardError=append:%h/ava-pco/app.log

[Install]
WantedBy=default.target
"""
    run(c, f'mkdir -p ~/.config/systemd/user && cat > ~/.config/systemd/user/ava-pco.service <<\'PCOEOF\'\n{unit}PCOEOF')
    rc, out, err = run(c, "systemctl --user daemon-reload && loginctl enable-linger $(whoami) 2>&1 || true", check=False)
    rc, out, err = run(c, "systemctl --user enable --now ava-pco.service 2>&1", check=False)
    print(out, err)

    c.close()

    print()
    print("=" * 60)
    print(f"DEPLOY ATIVO em port {port}.")
    print("=" * 60)
    print(f"  Internal: http://127.0.0.1:{port} (no servidor)")
    print(f"  Public:   https://{domain} (via nginx do CloudPanel)")
    print()
    print("Para ver logs ao vivo:")
    print(f"  ssh -i ~/.ssh/avapco_id_ed25519 {user}@{host} 'tail -f ~/ava-pco/app.log'")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[FATAL] {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
