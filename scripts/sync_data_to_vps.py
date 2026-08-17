#!/usr/bin/env python3
"""
OBSOLETO desde 2026-07-03 — NÃO use para migrar dados.

Produção passou a ler do Postgres (DivZ) naquela data. Copiar `data/*.json`
para o VPS deixou de afetar o que o AVA mostra: o app nem abre esses arquivos
enquanto houver DATABASE_URL. Rodar isto dá a impressão de ter sincronizado
alunos, matrículas e pedidos, e não sincroniza nada.

O caminho certo para alunos/matrículas é `scripts/load_v3_to_divz.ts`, que
escreve no Postgres reconciliando por e-mail. Para as vendas novas da loja,
`scripts/sync_wc_delta.ts`.

O script segue aqui porque o VPS ainda guarda alguns JSONs de runtime, e um dia
pode ser útil para copiá-los. Para rodar assim mesmo, passe SEI_O_QUE_FACO=1.

Uso (legado):
  SEI_O_QUE_FACO=1 HOST=195.200.0.253 USER_NAME=avapco PORT=22 SSH_PASSWORD='...' \
    python scripts/sync_data_to_vps.py

Flags opcionais:
  DRY_RUN=1      Só lista o que faria, sem subir/restartar
  SKIP_BACKUP=1  Pula o backup remoto (não recomendado)
  SKIP_RESTART=1 Não reinicia o app no fim (deixa o restart pro user)

Arquivos sincronizados (lista whitelist — evita subir runtime sensível
indevidamente):
  - users.json                 (1641 users importados + 3 seed)
  - admin-students.json        (793 alunos com matriculas + progressao)
  - external-references.json   (8547 cross-refs)
  - import-connections.json    (2 conexoes criptografadas)
  - import-jobs.json           (jobs de migracao)
  - payment-products.json      (5 produtos WC)
  - payment-orders.json        (1775 orders WC, se existir)
  - lesson-progress.json       (vazio hoje — incluso por seguranca)

NAO sincroniza: audit-log.json, errors.json, sessions.json, etc — esses
sao do dia-a-dia do VPS e nao devem ser sobrescritos.
"""
import os
import sys
import time
import json
import datetime as dt
from pathlib import Path

import paramiko

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


# ---------- Config ----------

LOCAL_DATA = Path(__file__).resolve().parent.parent / 'data'
REMOTE_APP = '/home/avapco/ava-pco'  # diretorio do app no VPS
REMOTE_DATA = f'{REMOTE_APP}/data'
REMOTE_BACKUP_DIR = '/tmp'

# Whitelist: arquivos que serao sincronizados
SYNC_FILES = [
    'users.json',
    'admin-students.json',
    'external-references.json',
    'import-connections.json',
    'import-jobs.json',
    'payment-products.json',
    'payment-orders.json',
    'lesson-progress.json',
    'courses.json',
    'news.json',
    'question-bank-stubs.json',
]

DRY_RUN = os.environ.get('DRY_RUN') == '1'
SKIP_BACKUP = os.environ.get('SKIP_BACKUP') == '1'
SKIP_RESTART = os.environ.get('SKIP_RESTART') == '1'


def must_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f'env {name} ausente')
    return v


host = must_env('HOST')
user = must_env('USER_NAME')
port = int(os.environ.get('PORT', '22'))
password = must_env('SSH_PASSWORD')


# ---------- SSH helpers ----------

def connect_ssh() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        host, port=port, username=user, password=password,
        look_for_keys=False, allow_agent=False, timeout=15,
    )
    return c


def run(c: paramiko.SSHClient, cmd: str, check=True, timeout=60) -> str:
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    short = cmd[:140] + ('...' if len(cmd) > 140 else '')
    print(f'$ {short}')
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(f'[stderr] {err.rstrip()}')
    if check and rc != 0:
        sys.exit(f'failed (rc={rc}): {cmd}')
    return out


def count_entries(local_path: Path) -> int:
    """Conta entries de um JSON array. Retorna -1 se nao for array ou nao existir."""
    if not local_path.exists():
        return -1
    try:
        with local_path.open('r', encoding='utf-8') as f:
            data = json.load(f)
        return len(data) if isinstance(data, list) else -2
    except Exception:
        return -3


# ---------- Main ----------

def main() -> None:
    # Guarda contra o pior caso: alguém rodar isto achando que está migrando
    # alunos para produção. Desde 2026-07-03 o AVA lê do Postgres, e o efeito
    # real seria zero — com aparência de sucesso.
    if not os.environ.get('SEI_O_QUE_FACO'):
        print('ABORTADO: este script NÃO migra dados para produção desde 2026-07-03.')
        print('  Produção lê do Postgres (DivZ); copiar data/*.json não muda nada no ar.')
        print('  Alunos e matrículas  → npx tsx scripts/load_v3_to_divz.ts')
        print('  Vendas novas da loja → npx tsx scripts/sync_wc_delta.ts')
        print('  Para copiar JSON assim mesmo, rode com SEI_O_QUE_FACO=1.')
        sys.exit(2)

    print(f'== AVA PCO sync data → {host} ==')
    print(f'  local: {LOCAL_DATA}')
    print(f'  remote: {REMOTE_DATA}')
    print(f'  dry-run: {DRY_RUN} · skip-backup: {SKIP_BACKUP} · skip-restart: {SKIP_RESTART}')
    print()

    # 1) Inventario local
    print('[*] Inventario local (arquivos a sincronizar):')
    to_sync = []
    for name in SYNC_FILES:
        local_path = LOCAL_DATA / name
        n = count_entries(local_path)
        if not local_path.exists():
            print(f'  - {name:<32} (nao existe local, pula)')
            continue
        sz = local_path.stat().st_size
        cnt = f'{n} entries' if n >= 0 else 'nao-array'
        print(f'  + {name:<32} {sz:>10} bytes  {cnt}')
        to_sync.append(name)
    print()

    if not to_sync:
        print('Nada para sincronizar. Saindo.')
        return

    if DRY_RUN:
        print('DRY_RUN=1 → nao conectaria no VPS nem subiria nada.')
        return

    # 2) Conecta SSH
    print('[*] Conectando SSH...')
    c = connect_ssh()
    try:
        run(c, f'mkdir -p {REMOTE_DATA}', check=True)

        # 3) Backup do data/ remoto
        if not SKIP_BACKUP:
            ts = dt.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
            backup_path = f'{REMOTE_BACKUP_DIR}/avapco-data-pre-sync-{ts}.tgz'
            print(f'[*] Backup remoto → {backup_path}')
            run(c, f'cd {REMOTE_APP} && tar czf {backup_path} data/ 2>/dev/null || true', check=False)
            run(c, f'ls -la {backup_path}', check=True)
            print()

        # 4) Estado remoto antes
        print('[*] Estado remoto ANTES:')
        for name in to_sync:
            out = run(
                c,
                f'[ -f {REMOTE_DATA}/{name} ] && '
                f'wc -c < {REMOTE_DATA}/{name} || echo "(nao existe)"',
                check=False,
            )
            print(f'  {name:<32} {out.strip()}')
        print()

        # 5) Upload via SFTP
        sftp = c.open_sftp()
        print('[*] Upload SFTP...')
        for name in to_sync:
            local_path = LOCAL_DATA / name
            remote_path = f'{REMOTE_DATA}/{name}'
            sz = local_path.stat().st_size
            print(f'  ↑ {name:<32} ({sz:>10} bytes)')
            sftp.put(str(local_path), remote_path)
        sftp.close()
        print()

        # 6) Verifica estado pos-upload
        print('[*] Estado remoto DEPOIS:')
        for name in to_sync:
            remote_size = run(c, f'wc -c < {REMOTE_DATA}/{name}', check=False).strip()
            # contagem JSON via python no remoto
            remote_count = run(
                c,
                f'python3 -c "import json; print(len(json.load(open(\'{REMOTE_DATA}/{name}\'))))" 2>/dev/null || echo "?"',
                check=False,
            ).strip()
            local_count = count_entries(LOCAL_DATA / name)
            match = '✓' if str(local_count) == remote_count else '!!'
            print(f'  {match} {name:<32} remote={remote_size} bytes / {remote_count} entries (local={local_count})')
        print()

        # 7) Restart
        if SKIP_RESTART:
            print('[*] SKIP_RESTART=1 — nao reinicia app. Voce roda manualmente.')
        else:
            print('[*] Reiniciando app...')
            run(c, "pkill -f 'tsx server/dev.ts' 2>/dev/null || true", check=False)
            run(c, "pkill -f 'node.*server/dev' 2>/dev/null || true", check=False)
            time.sleep(2)
            run(
                c,
                f'cd {REMOTE_APP} && '
                f"setsid nohup npx tsx server/dev.ts > app.log 2>&1 < /dev/null &",
                check=False,
            )
            time.sleep(4)
            print('[*] Health check:')
            run(c, 'curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:3035/api/health', check=False)

        print()
        print('== sync OK ==')

    finally:
        c.close()


if __name__ == '__main__':
    main()
