#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=22, username=os.environ['USER_NAME'], password=os.environ['SSH_PASSWORD'], look_for_keys=False, allow_agent=False)

SCRIPT = '''
import json
with open("/home/avapco/ava-pco/data/import-jobs.json") as f:
    d = json.load(f)
jobs = d if isinstance(d, list) else d.get("items", [])
jobs.sort(key=lambda x: x.get("startedAt", ""), reverse=True)

for j in jobs[:2]:
    print("="*60)
    print("JOB", j["id"])
    errs = j.get("errorsLog", [])
    by_entity = {}
    for e in errs:
        by_entity.setdefault(e.get("entity", "?"), []).append(e)
    for ent, lst in by_entity.items():
        print(f"\\n  {ent}: {len(lst)} erros — sample 3:")
        for e in lst[:3]:
            print(f"    {json.dumps(e, ensure_ascii=False)[:300]}")
'''

sftp = c.open_sftp()
with sftp.open('/tmp/insp.py', 'w') as f:
    f.write(SCRIPT)
sftp.close()
si, so, se = c.exec_command('python3 /tmp/insp.py && rm -f /tmp/insp.py')
print(so.read().decode(errors='replace'))
err = se.read().decode(errors='replace')
if err.strip(): print("STDERR:", err)
c.close()
