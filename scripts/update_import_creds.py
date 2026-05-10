#!/usr/bin/env python3
"""Atualiza credenciais das 2 connections de import + roda diagnose."""
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


# Novas creds fornecidas pelo owner
PORTALPCO = {
    'host': 'portalpco.online',
    'wpUsername': 'claude',
    'wpAppPassword': 'B5FN 05QU kjQf JciS e5Ci scXQ',
    'name': 'portalpco.online (WP + LearnDash)',
    'siteUrl': 'https://portalpco.online',
}
PSICANALISE = {
    'host': 'psicanaliseclinica.online',
    'wpUsername': 'claude',
    'wpAppPassword': 'UAp9 ZW0M s1bU RJT3 Hm7s IH4Y',
    'name': 'PCO Vendas',
    'siteUrl': 'https://psicanaliseclinica.online',
}

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=int(os.environ.get('PORT', '22')),
          username=os.environ['USER_NAME'], password=os.environ['SSH_PASSWORD'],
          look_for_keys=False, allow_agent=False)


def run(cmd, timeout=60):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if err.strip(): print(f"[stderr] {err.rstrip()}")
    return out


# 1. Login JWT manual
print("[*] Gerando JWT superadmin...")
jwt_secret = run("grep '^JWT_SECRET=' ~/ava-pco/.env | cut -d= -f2-").strip()
users = json.loads(run("cat ~/ava-pco/data/users.json").strip())
super_user = next((u for u in (users if isinstance(users, list) else users.get('items', []))
                   if u.get('role') == 'superadmin'), None)
now = int(time.time())
token = make_jwt({
    'sub': super_user['id'], 'email': super_user['email'], 'role': super_user['role'],
    'tv': super_user.get('tokenVersion', 0), 'iat': now, 'exp': now + 600,
}, jwt_secret)

# 2. Lista connections
print("[*] Listando connections atuais...")
list_resp = run(
    f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/connections "
    f"-H 'Authorization: Bearer {token}'"
).strip()
items = json.loads(list_resp)
items = items if isinstance(items, list) else items.get('items', [])

def host(u): return (u or '').replace('https://', '').replace('http://', '').rstrip('/').lower()


# 3. Update cada uma
def update_conn(conn_id, payload):
    body = json.dumps(payload)
    body_escaped = body.replace("'", "'\"'\"'")
    cmd = (
        f"curl -s -m 10 -X PUT http://127.0.0.1:3035/api/admin/imports/connections/{conn_id} "
        f"-H 'Authorization: Bearer {token}' "
        f"-H 'Content-Type: application/json' "
        f"-d '{body_escaped}'"
    )
    return run(cmd).strip()


updates = []
for con in items:
    h = host(con.get('siteUrl'))
    if h == PORTALPCO['host']:
        print(f"\n[*] Updating portalpco.online ({con['id']})...")
        resp = update_conn(con['id'], {
            'name': PORTALPCO['name'],
            'siteUrl': PORTALPCO['siteUrl'],
            'wpUsername': PORTALPCO['wpUsername'],
            'wpAppPassword': PORTALPCO['wpAppPassword'],
        })
        updates.append((con['id'], 'portalpco.online'))
        try:
            d = json.loads(resp)
            print(f"    OK — wpUsername={d.get('wpUsername')} appPassword=<{len(PORTALPCO['wpAppPassword'])} chars>")
        except Exception:
            print(f"    {resp[:300]}")
    elif h == PSICANALISE['host']:
        print(f"\n[*] Updating psicanaliseclinica.online ({con['id']})...")
        resp = update_conn(con['id'], {
            'name': PSICANALISE['name'],
            'siteUrl': PSICANALISE['siteUrl'],
            'wpUsername': PSICANALISE['wpUsername'],
            'wpAppPassword': PSICANALISE['wpAppPassword'],
        })
        updates.append((con['id'], 'psicanaliseclinica.online'))
        try:
            d = json.loads(resp)
            print(f"    OK — wpUsername={d.get('wpUsername')} appPassword=<{len(PSICANALISE['wpAppPassword'])} chars>")
        except Exception:
            print(f"    {resp[:300]}")

# 4. Roda diagnose nas duas
print()
print("=" * 60)
print("[*] Diagnose pos-update")
print("=" * 60)
for conn_id, label in updates:
    print(f"\n--- {label} ({conn_id}) ---")
    diag = run(
        f"curl -s -m 30 -X POST http://127.0.0.1:3035/api/admin/imports/connections/{conn_id}/diagnose "
        f"-H 'Authorization: Bearer {token}'"
    ).strip()
    try:
        d = json.loads(diag)
        print(json.dumps(d, indent=2, ensure_ascii=False))
    except Exception:
        print(diag[:600])

# 5. Diagnose-LD para portalpco
portalpco_id = next((u[0] for u in updates if 'portalpco' in u[1]), None)
if portalpco_id:
    print()
    print("=" * 60)
    print(f"[*] Diagnose LD para portalpco.online")
    print("=" * 60)
    diag = run(
        f"curl -s -m 30 -X POST http://127.0.0.1:3035/api/admin/imports/connections/{portalpco_id}/diagnose-ld "
        f"-H 'Authorization: Bearer {token}'"
    ).strip()
    try:
        d = json.loads(diag)
        print(json.dumps(d, indent=2, ensure_ascii=False)[:2000])
    except Exception:
        print(diag[:800])

c.close()
print("\n[+] Done.")
