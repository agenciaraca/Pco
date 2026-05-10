#!/usr/bin/env python3
"""Dispara dry-run em ambas connections com TODAS entidades.
Confirma que entidades indisponiveis (WC em portalpco, LD em psicanalise)
sao puladas em vez de falhar o job.
"""
import os, sys, json, time, base64, hmac, hashlib, paramiko

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def make_jwt(payload: dict, secret: str) -> str:
    h = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    p = b64url(json.dumps(payload, separators=(',', ':')).encode())
    sig = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"


c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=int(os.environ.get('PORT', '22')),
          username=os.environ['USER_NAME'], password=os.environ['SSH_PASSWORD'],
          look_for_keys=False, allow_agent=False)


def run(cmd, timeout=120):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    return out


jwt_secret = run("grep '^JWT_SECRET=' ~/ava-pco/.env | cut -d= -f2-").strip()
users = json.loads(run("cat ~/ava-pco/data/users.json").strip())
super_user = next((u for u in (users if isinstance(users, list) else users.get('items', []))
                   if u.get('role') == 'superadmin'), None)
now = int(time.time())
token = make_jwt({
    'sub': super_user['id'], 'email': super_user['email'], 'role': super_user['role'],
    'tv': super_user.get('tokenVersion', 0), 'iat': now, 'exp': now + 1800,
}, jwt_secret)

list_resp = run(
    f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/connections "
    f"-H 'Authorization: Bearer {token}'"
).strip()
items = json.loads(list_resp)
items = items if isinstance(items, list) else items.get('items', [])

ALL_ENTITIES = ['student', 'course', 'lesson', 'topic', 'quiz', 'question',
                'group', 'enrollment', 'progress', 'product', 'order']

ENROLL = {
    "startRule": "paid_date",
    "expirationRule": "start_plus_duration",
    "defaultAccessDurationDays": 365,
    "wcStatusMap": {},
    "userMatchKeys": ["email", "document", "external_id"],
    "unmatchedUserPolicy": "skip",
    "conflictStrategy": "update"
}

for con in items:
    print()
    print("=" * 60)
    print(f"DRY-RUN em {con['siteUrl']}  ({con['id']})")
    print("=" * 60)
    body = json.dumps({
        "connectionId": con['id'],
        "entities": ALL_ENTITIES,
        "dryRun": True,
        "enrollmentRules": ENROLL,
    })
    resp = run(
        f"curl -s -m 30 -X POST http://127.0.0.1:3035/api/admin/imports/run/api "
        f"-H 'Authorization: Bearer {token}' "
        f"-H 'Content-Type: application/json' "
        f"-d '{body}'"
    ).strip()
    try:
        r = json.loads(resp)
    except Exception:
        print(f"  PARSE FAIL: {resp[:300]}")
        continue
    job_id = r.get('jobId')
    print(f"  jobId={job_id}")

    # Poll status
    final = None
    for i in range(60):
        time.sleep(2)
        jr = run(
            f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/jobs/{job_id} "
            f"-H 'Authorization: Bearer {token}'"
        ).strip()
        try:
            j = json.loads(jr)
        except Exception:
            print(f"  poll parse fail: {jr[:200]}")
            break
        status = j.get('status')
        if status in ('completed', 'failed'):
            final = j
            break
        if i % 5 == 0:
            print(f"  ... status={status} after {i*2}s")
    if not final:
        print(f"  TIMEOUT — last status={status}")
        continue

    print(f"\n  STATUS FINAL: {final.get('status')}")
    print(f"  STATS: {json.dumps(final.get('stats'), ensure_ascii=False)}")
    print(f"  PER-ENTITY: {json.dumps(final.get('perEntity'), ensure_ascii=False)}")
    print(f"\n  NOTES:")
    for note in final.get('notes', [])[-15:]:
        lvl = note.get('level', '?').upper()
        msg = note.get('message', '')[:200]
        print(f"    [{lvl}] {msg}")

c.close()
print("\n[+] Done.")
