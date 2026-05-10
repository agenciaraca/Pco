#!/usr/bin/env python3
"""Inspeciona logs/jobs/erros recentes da importacao."""
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


def run(cmd, timeout=30):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    return out


print("=" * 60)
print("[1] Tail recentes do app.log com qualquer 'import|error|warn|wp_An|coordenadas'")
print("=" * 60)
print(run(
    "tail -200 ~/ava-pco/app.log | grep -iE 'import|error|warn|exception|wp_An|coord|throw' | tail -60"
))

print()
print("=" * 60)
print("[2] Import jobs recentes (data/import-jobs.json)")
print("=" * 60)
print(run(
    "if [ -f ~/ava-pco/data/import-jobs.json ]; then "
    "  python3 -c \"import json; d=json.load(open('/home/avapco/ava-pco/data/import-jobs.json'));"
    " jobs = d if isinstance(d,list) else d.get('items',[]);"
    " jobs.sort(key=lambda j: j.get('createdAt',''), reverse=True);"
    " import json as J;"
    " [print(J.dumps({k:v for k,v in j.items() if k not in ('result','log')}, indent=2, ensure_ascii=False)) for j in jobs[:5]]\";"
    "else echo '(no import-jobs.json)'; fi"
))

print()
print("=" * 60)
print("[3] external-references store (data/external-references.json) — buscar wp_An8BFmdIVjDezu8R7IlU434jhsE")
print("=" * 60)
print(run(
    "if [ -f ~/ava-pco/data/external-references.json ]; then "
    "  grep -A 2 -B 2 'wp_An8BFmdIVjDezu8R7IlU434jhsE' ~/ava-pco/data/external-references.json | head -30;"
    "  echo '---total entries:'; "
    "  python3 -c \"import json; d=json.load(open('/home/avapco/ava-pco/data/external-references.json')); print(len(d) if isinstance(d,list) else len(d.get('items',[])))\";"
    "else echo '(no external-references.json)'; fi"
))

print()
print("=" * 60)
print("[4] errors.json — eventuais 5xx do server")
print("=" * 60)
print(run(
    "if [ -f ~/ava-pco/data/errors.json ]; then "
    "  python3 -c \"import json; d=json.load(open('/home/avapco/ava-pco/data/errors.json'));"
    " items = d if isinstance(d,list) else d.get('items',[]);"
    " import json as J;"
    " [print(J.dumps({k:v for k,v in i.items() if k!='stack'}, indent=2)) for i in items[:5]]\";"
    "else echo '(no errors.json)'; fi"
))

c.close()
print("\n[+] Done.")
