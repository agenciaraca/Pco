#!/usr/bin/env python3
"""Consolida 2 connections portalpco.online em 1.

Estado pos-execucao:
  - 1 connection portalpco.online (mantem o id mais antigo + creds completas)
  - 1 connection PCO Vendas (psicanaliseclinica.online) — intacta
"""
import os, sys, paramiko

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


def run(cmd):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=30)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    return out


CLEANUP = '''
import json, shutil, time
p = "/home/avapco/ava-pco/data/import-connections.json"
shutil.copy(p, p + ".bak.consolidate." + time.strftime("%Y%m%dT%H%M%SZ"))
with open(p) as f:
    d = json.load(f)

def host(u): return (u or "").replace("https://","").replace("http://","").rstrip("/").lower()

# 1) Normaliza siteUrls que apontam pra portalpco
for c in d:
    h = host(c.get("siteUrl"))
    if "portalpco" in h:
        c["siteUrl"] = "https://portalpco.online"
        c["name"] = "portalpco.online (WP + LearnDash)"

# 2) Detecta duplicatas portalpco — escolhe melhor candidato
portalpco_conns = [c for c in d if host(c.get("siteUrl")) == "portalpco.online"]
others = [c for c in d if host(c.get("siteUrl")) != "portalpco.online"]

if len(portalpco_conns) > 1:
    print(f"  found {len(portalpco_conns)} portalpco connections — consolidating")
    # Ordena: prefere quem tem wpAppPassword + createdAt mais antigo
    portalpco_conns.sort(key=lambda c: (
        0 if c.get("wpAppPassword") else 1,
        c.get("createdAt", ""),
    ))
    keep = portalpco_conns[0]
    # Merge creds das duplicatas (caso uma tenha algo que a keep nao tem)
    for other in portalpco_conns[1:]:
        for f in ("wpAppPassword", "wcConsumerKey", "wcConsumerSecret"):
            if other.get(f) and not keep.get(f):
                keep[f] = other[f]
        print(f"  drop: {other['id']} ({other.get('createdAt')})")
    keep["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    print(f"  keep: {keep['id']} ({keep.get('createdAt')})")
    final = others + [keep]
elif len(portalpco_conns) == 1:
    print(f"  single portalpco connection ok: {portalpco_conns[0]['id']}")
    final = others + portalpco_conns
else:
    print("  no portalpco connection found")
    final = d

print(f"  total before: {len(d)} after: {len(final)}")
with open(p, "w") as f:
    json.dump(final, f, indent=2, ensure_ascii=False)
print("  saved.")
'''

print("[*] Consolidando connections portalpco...")
sftp = c.open_sftp()
with sftp.open('/tmp/cleanup.py', 'w') as f:
    f.write(CLEANUP)
sftp.close()
print(run('python3 /tmp/cleanup.py'))
run('rm -f /tmp/cleanup.py')

print()
print("[*] Estado final:")
print(run("grep -E '\"id\"|\"siteUrl\"|\"name\"' ~/ava-pco/data/import-connections.json"))

c.close()
print("[+] Done.")
