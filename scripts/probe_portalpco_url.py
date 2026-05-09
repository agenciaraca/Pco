#!/usr/bin/env python3
"""Investiga qual URL real responde como WordPress do portalpco.

A connection cadastrada usa https://portalpco.com.br que da ENOTFOUND.
Tenta variantes comuns e reporta qual responde com /wp-json (= eh WP).
"""
import os, sys, json, paramiko
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=int(os.environ.get('PORT', '22')),
          username=os.environ['USER_NAME'], password=os.environ['SSH_PASSWORD'],
          look_for_keys=False, allow_agent=False)

CANDIDATES = [
    "https://portalpco.com.br",
    "https://portalpco.online",
    "https://portalpco.com",
    "https://www.portalpco.com.br",
    "https://www.portalpco.online",
    "https://aluno.portalpco.online",
    "https://portal.psicanaliseclinica.online",
    "https://www.psicanaliseclinica.online",
    "https://psicanaliseclinica.online",
    "https://app.psicanaliseclinica.online",
    "https://portalpco.psicanaliseclinica.online",
]

print("[*] Probing candidate URLs (DNS + /wp-json)...\n")
for url in CANDIDATES:
    # Use curl -sS -m 8 com resolve via DNS do servidor
    cmd = (
        f"curl -sS -o /dev/null -m 8 -w '%{{http_code}} %{{remote_ip}} %{{time_total}}s' "
        f"-H 'Accept: application/json' '{url}/wp-json/' 2>&1 | head -1"
    )
    si, so, se = c.exec_command(cmd)
    out = so.read().decode(errors='replace').strip()
    err = se.read().decode(errors='replace').strip()
    status = out or err or '(empty)'
    print(f"  {url}")
    print(f"    -> {status}")
    print()

# E confirma o atual
print("\n[*] Connection atual no AVA:")
si, so, se = c.exec_command(
    "python3 -c \"import json; d=json.load(open('/home/avapco/ava-pco/data/import-connections.json'));"
    " [print(c['id'], c['siteUrl']) for c in d]\""
)
print(so.read().decode())

c.close()
