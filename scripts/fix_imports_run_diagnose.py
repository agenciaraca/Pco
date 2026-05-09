#!/usr/bin/env python3
"""1. Atualiza portalpco.com.br -> portalpco.online no JsonStore.
2. Re-roda diagnose nas 2 connections via JWT manual.
3. Lista TODOS os namespaces /wp-json para detectar ldlms.
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


def run(cmd, timeout=60):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip():
        print(f"[stderr] {err.rstrip()}")
    return out


print("=" * 60)
print("[1] Update siteUrl portalpco.com.br -> portalpco.online")
print("=" * 60)

# Upload script python que faz o update + backup
UPDATE_SCRIPT = '''
import json, os, shutil, time
p = "/home/avapco/ava-pco/data/import-connections.json"
shutil.copy(p, p + ".bak." + time.strftime("%Y%m%dT%H%M%SZ"))
with open(p) as f:
    d = json.load(f)
changed = False
for c in d:
    if "portalpco.com.br" in (c.get("siteUrl") or ""):
        old = c["siteUrl"]
        c["siteUrl"] = "https://portalpco.online"
        c["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        changed = True
        print("  UPDATED:", c["id"], old, "->", c["siteUrl"])
if changed:
    with open(p, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print("  saved.")
else:
    print("  no change needed.")
'''

sftp = c.open_sftp()
with sftp.open('/tmp/update_conn.py', 'w') as f:
    f.write(UPDATE_SCRIPT)
sftp.close()
print(run('python3 /tmp/update_conn.py').strip())
run('rm -f /tmp/update_conn.py')

print()
print("=" * 60)
print("[2] Login JWT manual + diagnose ambas connections")
print("=" * 60)

jwt_secret = run("grep '^JWT_SECRET=' ~/ava-pco/.env | cut -d= -f2-").strip()
users_raw = run("cat ~/ava-pco/data/users.json").strip()
users = json.loads(users_raw)
items = users if isinstance(users, list) else users.get('items', [])
super_user = next((u for u in items if u.get('role') == 'superadmin'), None)

now = int(time.time())
payload = {
    'sub': super_user['id'],
    'email': super_user['email'],
    'role': super_user['role'],
    'tv': super_user.get('tokenVersion', 0),
    'iat': now,
    'exp': now + 600,
}
token = make_jwt(payload, jwt_secret)

list_resp = run(
    f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/connections "
    f"-H 'Authorization: Bearer {token}'"
).strip()
connections = json.loads(list_resp)
items = connections if isinstance(connections, list) else connections.get('items', [])

for con in items:
    print(f"\n--- {con['name']} ({con['id']}) ---")
    print(f"  siteUrl: {con.get('siteUrl')}")
    diag = run(
        f"curl -s -m 30 -X POST http://127.0.0.1:3035/api/admin/imports/connections/{con['id']}/diagnose "
        f"-H 'Authorization: Bearer {token}'"
    ).strip()
    try:
        d = json.loads(diag)
        print(json.dumps(d, indent=2, ensure_ascii=False)[:1500])
    except Exception:
        print(diag[:500])

print()
print("=" * 60)
print("[3] Lista TODOS namespaces /wp-json (psicanaliseclinica.online)")
print("=" * 60)
out = run(
    "curl -s -m 15 https://psicanaliseclinica.online/wp-json/ "
    "| python3 -c 'import json,sys;d=json.load(sys.stdin);print(\"\\n\".join(d.get(\"namespaces\", [])))'"
)
print(out.strip())

print()
print("=" * 60)
print("[4] Lista TODOS namespaces /wp-json (portalpco.online)")
print("=" * 60)
out = run(
    "curl -s -m 15 https://portalpco.online/wp-json/ "
    "| python3 -c 'import json,sys;d=json.load(sys.stdin);print(\"\\n\".join(d.get(\"namespaces\", [])))'"
)
print(out.strip())

c.close()
print()
print("[+] Done.")
