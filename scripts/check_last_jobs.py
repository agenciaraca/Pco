#!/usr/bin/env python3
"""Le os 2 ultimos jobs via API (mais robusto que ler JSON diretamente)."""
import os, sys, json, time, base64, hmac, hashlib, paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def make_jwt(payload: dict, secret: str) -> str:
    h = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    p = b64url(json.dumps(payload, separators=(',', ':')).encode())
    sig = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"


c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=22, username=os.environ['USER_NAME'],
          password=os.environ['SSH_PASSWORD'], look_for_keys=False, allow_agent=False)


def run(cmd, t=30):
    si, so, se = c.exec_command(cmd, timeout=t)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    return out


jwt_secret = run("grep '^JWT_SECRET=' ~/ava-pco/.env | cut -d= -f2-").strip()
users = json.loads(run("cat ~/ava-pco/data/users.json").strip())
sup = next((u for u in (users if isinstance(users, list) else users.get('items', []))
            if u.get('role') == 'superadmin'), None)
now = int(time.time())
token = make_jwt({'sub': sup['id'], 'email': sup['email'], 'role': sup['role'],
                  'tv': sup.get('tokenVersion', 0), 'iat': now, 'exp': now + 600}, jwt_secret)

jobs = json.loads(
    run(f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/jobs -H 'Authorization: Bearer {token}'").strip()
)
items = jobs if isinstance(jobs, list) else jobs.get('items', [])
items.sort(key=lambda j: j.get('startedAt', ''), reverse=True)

for j in items[:3]:
    print("=" * 60)
    print(f"JOB {j['id']} — status: {j['status']}")
    print(f"  startedAt: {j.get('startedAt')}")
    print(f"  finishedAt: {j.get('finishedAt')}")
    print(f"  stats: {json.dumps(j.get('stats'), ensure_ascii=False)}")
    print(f"  perEntity:")
    for ent, st in (j.get('perEntity') or {}).items():
        print(f"    {ent}: {json.dumps(st, ensure_ascii=False)}")
    notes = j.get('notes', [])
    print(f"  ultimas notas:")
    for n in notes[-8:]:
        print(f"    [{n.get('level','?')}] {(n.get('message') or '')[:200]}")
    print()

c.close()
