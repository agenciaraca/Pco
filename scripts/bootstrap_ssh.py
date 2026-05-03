#!/usr/bin/env python3
"""
bootstrap_ssh.py — bootstrap único do servidor:
  1. Conecta via senha
  2. Instala chave pública em authorized_keys
  3. Gera senha aleatória forte e troca a senha do usuário
  4. Desabilita PasswordAuthentication no sshd
  5. Restart sshd
  6. Verifica login por chave OK

Uso (variáveis via stdin / env):
  HOST, USER, OLD_PASSWORD, PUBKEY_PATH

Saídas: nova senha (descartada após uso) é mostrada apenas uma vez
        e jamais persiste em arquivo nem é printada se NEW_PASSWORD_DISCARD=1.
"""
from __future__ import annotations
import os
import sys
import secrets
import string
import time
from pathlib import Path

import paramiko


def gen_password(n: int = 32) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#%^*-_+="
    return "".join(secrets.choice(alphabet) for _ in range(n))


def run(client: paramiko.SSHClient, cmd: str, sudo_pw: str | None = None, check: bool = True) -> tuple[int, str, str]:
    """Run command, optionally feeding sudo password to stdin."""
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=bool(sudo_pw))
    if sudo_pw is not None:
        stdin.write(sudo_pw + "\n")
        stdin.flush()
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if check and code != 0:
        print(f"[!] FAIL ({code}) cmd: {cmd}")
        if out: print("STDOUT:", out)
        if err: print("STDERR:", err)
        raise RuntimeError(f"command failed: {cmd}")
    return code, out, err


def main() -> int:
    host = os.environ["HOST"]
    user = os.environ["USER"]
    old_password = os.environ["OLD_PASSWORD"]
    pubkey_path = Path(os.environ["PUBKEY_PATH"]).expanduser()

    pubkey = pubkey_path.read_text().strip()

    print(f"[*] Conectando {user}@{host} com senha (última vez)...")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(hostname=host, username=user, password=old_password, look_for_keys=False, allow_agent=False, timeout=15)

    print("[*] Instalando chave pública...")
    run(c, "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys")
    # Adiciona se não existe
    run(c, f"grep -qxF '{pubkey}' ~/.ssh/authorized_keys || echo '{pubkey}' >> ~/.ssh/authorized_keys")
    print("    [+] chave adicionada")

    # Verifica sudo
    print("[*] Verificando sudo...")
    code, out, _ = run(c, "command -v sudo && id -u", check=False)
    has_sudo = code == 0 and out.strip().endswith("\n0") is False  # sudo exists, not root
    if "/sudo" in out:
        print(f"    [+] sudo presente: {out.strip().splitlines()[0]}")

    # Gera nova senha forte
    new_password = gen_password(32)
    print("[*] Trocando senha do usuário (chpasswd via sudo)...")
    # chpasswd lê 'user:password' do stdin
    cmd = f"echo '{user}:{new_password}' | sudo -S chpasswd"
    stdin, stdout, stderr = c.exec_command(cmd, get_pty=True)
    stdin.write(old_password + "\n")
    stdin.flush()
    rc = stdout.channel.recv_exit_status()
    if rc != 0:
        err = stderr.read().decode("utf-8", errors="replace")
        out = stdout.read().decode("utf-8", errors="replace")
        print("    [!] chpasswd falhou:", err or out)
        raise SystemExit(1)
    print("    [+] senha trocada (a nova fica neste log e é descartada)")

    # Hardening sshd
    print("[*] Endurecendo sshd_config (desabilita PasswordAuthentication)...")
    sshd_cmds = """
sudo sed -i 's/^[#[:space:]]*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^[#[:space:]]*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo sed -i 's/^[#[:space:]]*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
grep -q '^PasswordAuthentication no' /etc/ssh/sshd_config || echo 'PasswordAuthentication no' | sudo tee -a /etc/ssh/sshd_config
grep -q '^PubkeyAuthentication yes' /etc/ssh/sshd_config || echo 'PubkeyAuthentication yes' | sudo tee -a /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl restart ssh || sudo systemctl restart sshd
""".strip()
    # Executa um comando único com sudo password no início
    full = f"echo '{new_password}' | sudo -S bash -c '{sshd_cmds}'"
    stdin, stdout, stderr = c.exec_command(f"bash -lc {paramiko.util.shlex.quote(full)}" if hasattr(paramiko.util, 'shlex') else f"bash -lc {repr(full)}", get_pty=True)
    rc = stdout.channel.recv_exit_status()
    sout = stdout.read().decode('utf-8', errors='replace')
    serr = stderr.read().decode('utf-8', errors='replace')
    if rc != 0:
        print("    [!] hardening sshd falhou:")
        print(sout); print(serr)
        # Não fatal — login por chave já adicionado
    else:
        print("    [+] sshd reiniciado, password auth desabilitado")

    c.close()

    # Testa login por chave
    print("[*] Validando acesso por chave...")
    keyfile = str(pubkey_path).replace(".pub", "")
    pkey = paramiko.Ed25519Key.from_private_key_file(keyfile)
    c2 = paramiko.SSHClient()
    c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c2.connect(hostname=host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)
    _, out, _ = run(c2, "whoami && hostname && uname -srm")
    print("[+] LOGIN POR CHAVE OK:")
    for line in out.strip().splitlines():
        print(f"    {line}")
    c2.close()

    print()
    print("=" * 60)
    print("BOOTSTRAP CONCLUÍDO.")
    print("Senha antiga JÁ NÃO funciona mais.")
    print("Acesso futuro: ssh -i", keyfile, f"{user}@{host}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[FATAL] {e}", file=sys.stderr)
        sys.exit(1)
