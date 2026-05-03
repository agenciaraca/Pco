#!/usr/bin/env python3
"""
harden_ssh.py — depois de bootstrap_ssh ter instalado a chave,
desabilita PasswordAuthentication no sshd e verifica.

Conecta usando a CHAVE SSH (não senha).
Usa a senha antiga apenas como sudo password (via stdin, sem pty).
"""
from __future__ import annotations
import os
import sys
import base64
import shlex
from pathlib import Path

import paramiko


def sudo_exec(client: paramiko.SSHClient, command: str, sudo_password: str) -> tuple[int, str, str]:
    """Executa `command` com sudo, alimentando a senha via stdin (-S, sem pty)."""
    full = f"sudo -S -p '' {command}"
    stdin, stdout, stderr = client.exec_command(full, get_pty=False)
    stdin.write(sudo_password + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return rc, out, err


def plain_exec(client: paramiko.SSHClient, command: str) -> tuple[int, str, str]:
    stdin, stdout, stderr = client.exec_command(command, get_pty=False)
    rc = stdout.channel.recv_exit_status()
    return rc, stdout.read().decode(errors="replace"), stderr.read().decode(errors="replace")


def main() -> int:
    host = os.environ["HOST"]
    user = os.environ["USER_NAME"]
    sudo_password = os.environ["SUDO_PASSWORD"]
    keyfile = Path(os.environ["KEY_PATH"]).expanduser()

    print(f"[*] Conectando {user}@{host} via chave SSH...")
    pkey = paramiko.Ed25519Key.from_private_key_file(str(keyfile))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        hostname=host, username=user, pkey=pkey,
        look_for_keys=False, allow_agent=False, timeout=15,
    )
    rc, out, _ = plain_exec(c, "whoami && hostname && lsb_release -d 2>/dev/null || cat /etc/os-release | head -2")
    print("[+] Conectado:")
    for line in out.strip().splitlines():
        print(f"    {line}")

    # 1. Verifica sudo
    print("[*] Verificando privilégios sudo...")
    rc, out, err = sudo_exec(c, "id -u", sudo_password)
    if rc != 0 or "0" not in out:
        print(f"    [!] Falha sudo (rc={rc}): {err.strip() or out.strip()}")
        if "Sorry" in err or "incorrect" in err:
            print("    [!] Senha sudo recusada — pode estar errada ou usuário sem sudo.")
        c.close()
        return 1
    print(f"    [+] sudo OK (uid={out.strip()})")

    # 2. Backup do sshd_config
    print("[*] Backup /etc/ssh/sshd_config...")
    rc, _, err = sudo_exec(c, "cp -n /etc/ssh/sshd_config /etc/ssh/sshd_config.bak", sudo_password)
    print(f"    rc={rc}")

    # 3. Aplica hardening usando sed
    print("[*] Aplicando configurações de segurança...")
    sed_cmds = [
        "sed -i 's/^[#[:space:]]*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
        "sed -i 's/^[#[:space:]]*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config",
        "sed -i 's/^[#[:space:]]*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config",
        "sed -i 's/^[#[:space:]]*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config",
        # garantir as linhas (caso não existam)
        r"grep -q '^PasswordAuthentication no' /etc/ssh/sshd_config || printf '\nPasswordAuthentication no\n' >> /etc/ssh/sshd_config",
        r"grep -q '^PubkeyAuthentication yes' /etc/ssh/sshd_config || printf 'PubkeyAuthentication yes\n' >> /etc/ssh/sshd_config",
    ]
    for cmd in sed_cmds:
        rc, _, err = sudo_exec(c, f"bash -c {shlex.quote(cmd)}", sudo_password)
        if rc != 0:
            print(f"    [!] {cmd[:60]}... rc={rc} err={err.strip()}")

    # 4. Cloud-init / Ubuntu 22+ pode ter override em /etc/ssh/sshd_config.d/*
    print("[*] Verificando overrides em /etc/ssh/sshd_config.d/...")
    rc, out, _ = sudo_exec(
        c,
        "bash -c 'grep -lr \"^[[:space:]]*PasswordAuthentication\" /etc/ssh/sshd_config.d/ 2>/dev/null || true'",
        sudo_password,
    )
    if out.strip():
        for path in out.strip().splitlines():
            print(f"    [!] override em {path} — sobrescrevendo")
            sudo_exec(
                c,
                f"sed -i 's/^[[:space:]]*PasswordAuthentication.*/PasswordAuthentication no/' {shlex.quote(path)}",
                sudo_password,
            )

    # 5. Valida config
    print("[*] sshd -t (validação)...")
    rc, _, err = sudo_exec(c, "sshd -t", sudo_password)
    if rc != 0:
        print(f"    [!] sshd config inválido! Restaurando backup...")
        sudo_exec(c, "cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config", sudo_password)
        print("    [!] Backup restaurado. Aborte hardening e revise manualmente.")
        return 1
    print("    [+] config válida")

    # 6. Restart sshd
    print("[*] Reiniciando ssh...")
    rc, _, err = sudo_exec(c, "systemctl restart ssh 2>/dev/null || systemctl restart sshd", sudo_password)
    print(f"    rc={rc}")

    # 7. Verifica resultado
    rc, out, _ = sudo_exec(c, "sshd -T 2>/dev/null | grep -i passwordauth", sudo_password)
    print(f"[+] Estado atual: {out.strip()}")

    c.close()
    print()
    print("=" * 60)
    print("HARDENING CONCLUÍDO.")
    print("Login SSH agora SÓ por chave.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[FATAL] {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
