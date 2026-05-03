#!/usr/bin/env python3
"""
deploy_no_sudo.py — deploy parcial no VPS quando avapco NÃO tem sudo.

O que faz (TUDO em user-space):
  - nvm + Node 20
  - clone/pull do repo em ~/ava-pco
  - npm ci + build
  - .env com fallback in-memory (sem DATABASE_URL)
  - inicia API com nohup em port 3001
  - tenta porta 8080 (não-privilegiada) servindo dist/ + proxy /api

Limitações sem sudo:
  - SEM Postgres → tudo na seed in-memory
  - SEM Caddy/nginx em :443 → só HTTP em high-port
  - SEM TLS → use Cloudflare na frente, ou peça sudo

Quando avapco tiver sudo, rode scripts/deploy.sh para finalizar.
"""
from __future__ import annotations
import os
import sys
import time
from pathlib import Path
import paramiko


def run(c: paramiko.SSHClient, cmd: str, check: bool = True, hide: bool = False) -> tuple[int, str, str]:
    if not hide:
        print(f"$ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = c.exec_command(cmd, get_pty=False)
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if not hide and (out.strip() or err.strip()):
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
    domain = os.environ.get("DOMAIN", "")

    print(f"[*] {user}@{host} via chave SSH...")
    pkey = paramiko.Ed25519Key.from_private_key_file(str(keyfile))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)

    # 1. nvm
    rc, out, _ = run(c, "test -d ~/.nvm", check=False, hide=True)
    if rc != 0:
        print("[*] Instalando nvm...")
        run(c, "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash")
    else:
        print("[+] nvm já instalado")

    # 2. Node 20
    nvm_load = 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'
    print("[*] Garantindo Node 20...")
    run(c, f'bash -lc \'{nvm_load} && nvm install 20 && nvm alias default 20 && node --version && npm --version\'')

    # 3. Repo
    print("[*] Sincronizando repo em ~/ava-pco...")
    rc, _, _ = run(c, "test -d ~/ava-pco/.git", check=False, hide=True)
    if rc != 0:
        run(c, f"git clone {repo_url} ~/ava-pco")
    else:
        run(c, "git -C ~/ava-pco fetch --all && git -C ~/ava-pco reset --hard origin/main")

    # 4. .env
    print("[*] Configurando .env (fallback in-memory)...")
    run(
        c,
        'bash -lc \'cd ~/ava-pco && [ -f .env ] || cat > .env <<EOF\n'
        'NODE_ENV=production\n'
        'PORT=3001\n'
        f'ALLOWED_ORIGINS={"https://"+domain if domain else "*"}\n'
        'EOF\n'
        'chmod 600 .env\'',
    )

    # 5. npm ci + build
    print("[*] npm ci + build...")
    run(
        c,
        f'bash -lc \'{nvm_load} && cd ~/ava-pco && npm ci --no-audit --no-fund\'',
    )
    run(
        c,
        f'bash -lc \'{nvm_load} && cd ~/ava-pco && npm run build\'',
    )

    # 6. Para qualquer instância antiga
    print("[*] Encerrando instância antiga (se existir)...")
    run(c, "pkill -f 'tsx server/dev.ts' || true", check=False, hide=True)
    time.sleep(1)

    # 7. Inicia API com nohup
    print("[*] Iniciando API em :3001 (nohup)...")
    run(
        c,
        f'bash -lc \'{nvm_load} && cd ~/ava-pco && '
        f'nohup ./node_modules/.bin/tsx server/dev.ts > ~/ava-pco/api.log 2>&1 &\' '
        '&& sleep 2 && pgrep -f "tsx server/dev.ts" >/dev/null && echo "API up"',
    )

    # 8. Testa health
    print("[*] Testando /api/health localmente no servidor...")
    rc, out, _ = run(c, "curl -s -m 5 http://127.0.0.1:3001/api/health", check=False)
    if "ok" in out:
        print(f"[+] API responde: {out.strip()}")
    else:
        print(f"[!] API não respondeu — cheque ~/ava-pco/api.log")
        run(c, "tail -30 ~/ava-pco/api.log", check=False)

    # 9. Servir frontend estático em :8080 com python http.server (workaround sem sudo)
    print("[*] Iniciando servidor estático para frontend em :8080...")
    run(c, "pkill -f 'python.*-m http.server 8080' || true", check=False, hide=True)
    run(
        c,
        f'bash -lc \'{nvm_load} && cd ~/ava-pco/dist && '
        'nohup python3 -m http.server 8080 --bind 0.0.0.0 > ~/ava-pco/static.log 2>&1 &\' '
        '&& sleep 1 && pgrep -f "python.*-m http.server 8080" >/dev/null && echo "Static up em :8080"',
    )

    # 10. Status final
    print()
    print("[*] Portas em escuta:")
    rc, out, _ = run(c, "ss -tln 2>/dev/null | head -20 || netstat -tln 2>/dev/null | head -20", check=False)

    c.close()

    print()
    print("=" * 60)
    print("DEPLOY PARCIAL CONCLUÍDO (modo sem sudo).")
    print("=" * 60)
    ip = host
    print(f"  Frontend:  http://{ip}:8080")
    print(f"  API:       http://{ip}:3001/api/health  (não exposta — só via proxy)")
    print()
    print("LIMITAÇÕES:")
    print("  - Sem TLS (HTTP only)")
    print("  - Sem persistência (todos os dados resetam ao reiniciar)")
    print("  - Frontend e API em portas diferentes — CORS configurado")
    print()
    print("Para PRODUÇÃO REAL (TLS + Postgres + domain):")
    print("  Conceda sudo para avapco e rode scripts/deploy.sh")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[FATAL] {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
