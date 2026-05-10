#!/usr/bin/env python3
"""Inspeciona errorsLog dos jobs recentes pra entender por que rows sao invalidos."""
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
    return so.read().decode(errors='replace')


SCRIPT = '''
import json
with open("/home/avapco/ava-pco/data/import-jobs.json") as f:
    d = json.load(f)
jobs = d if isinstance(d, list) else d.get("items", [])
jobs.sort(key=lambda j: j.get("createdAt", ""), reverse=True)

for j in jobs[:2]:
    print("="*60)
    print(f"JOB {j['id']} status={j['status']}")
    print(f"  createdAt={j.get('createdAt')}")
    print(f"  stats={j.get('stats')}")
    errs = j.get("errorsLog", [])
    print(f"  errorsLog: {len(errs)} entries")
    # Sample 5 errors per entity
    by_entity = {}
    for e in errs:
        ent = e.get("entity", "?")
        by_entity.setdefault(ent, []).append(e)
    for ent, lst in by_entity.items():
        print(f"\\n  --- {ent}: {len(lst)} erros ---")
        for e in lst[:3]:
            row = e.get("row") or {}
            row_keys = list(row.keys())[:8] if isinstance(row, dict) else "?"
            print(f"    line={e.get('line')} reason={(e.get('reason') or '')[:200]}")
            print(f"    row_keys={row_keys}")
            if isinstance(row, dict):
                # Print primeiras keys + valores
                for k in row_keys[:5]:
                    v = row[k]
                    s = str(v)[:80]
                    print(f"      {k}={s}")
    print()
'''

sftp = c.open_sftp()
with sftp.open('/tmp/inspect_jobs.py', 'w') as f:
    f.write(SCRIPT)
sftp.close()
print(run('python3 /tmp/inspect_jobs.py'))
run('rm -f /tmp/inspect_jobs.py')

c.close()
