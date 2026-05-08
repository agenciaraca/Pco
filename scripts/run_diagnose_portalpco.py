#!/usr/bin/env python3
"""Roda /admin/imports/connections/:id/diagnose para a connection portalpco.

Faz login como superadmin local via curl no proprio servidor (loopback)
e chama os endpoints com o JWT obtido.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import paramiko


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def make_jwt(payload: dict, secret: str) -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    h = b64url(json.dumps(header, separators=(',', ':')).encode())
    p = b64url(json.dumps(payload, separators=(',', ':')).encode())
    sig_input = f"{h}.{p}".encode()
    sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

host = os.environ['HOST']
user = os.environ['USER_NAME']
port = int(os.environ.get('PORT', '22'))
password = os.environ['SSH_PASSWORD']

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, port=port, username=user, password=password,
          look_for_keys=False, allow_agent=False, timeout=15)


def run(cmd, check=False, timeout=30):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    if rc != 0 and check:
        print(f"FAIL ({rc}): {cmd}")
        print(out, err)
        sys.exit(1)
    return out


print("[1] Lendo JWT_SECRET + superadmin do users.json...")
jwt_secret = run("grep '^JWT_SECRET=' ~/ava-pco/.env | cut -d= -f2-").strip()
if not jwt_secret:
    print("FAIL: JWT_SECRET nao encontrado no .env")
    sys.exit(1)
users_raw = run("cat ~/ava-pco/data/users.json").strip()
try:
    users = json.loads(users_raw)
except Exception as e:
    print(f"FAIL parse users.json: {e}")
    sys.exit(1)
items = users if isinstance(users, list) else users.get('items', [])
super_user = next((u for u in items if u.get('role') == 'superadmin'), None)
if not super_user:
    print("FAIL: nenhum superadmin no users.json")
    sys.exit(1)
print(f"  superadmin: {super_user.get('email')} (id={super_user.get('id')})")

print()
print("[2] Gerando JWT manualmente (HS256)...")
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
print("OK JWT gerado")

print()
print("[3] Listando connections de imports...")
list_cmd = (
    f"curl -s -m 10 http://127.0.0.1:3035/api/admin/imports/connections "
    f"-H 'Authorization: Bearer {token}'"
)
list_resp = run(list_cmd).strip()
try:
    connections = json.loads(list_resp)
except Exception:
    print(f"FAIL parse list: {list_resp[:300]}")
    sys.exit(1)
items = connections if isinstance(connections, list) else connections.get('items', [])
print(f"  {len(items)} connections encontradas")
target = None
for con in items:
    name = (con.get('name') or '').lower()
    base = (con.get('baseUrl') or '').lower()
    print(f"  - {con.get('id')} | {con.get('connector')} | {con.get('name')} | {con.get('baseUrl')}")
    if 'portalpco' in name or 'portalpco' in base:
        target = con

if not target:
    print("FAIL: nenhuma connection portalpco encontrada")
    sys.exit(1)

print()
print(f"[4] Rodando diagnose para {target['id']}...")
diag_cmd = (
    f"curl -s -m 30 -X POST "
    f"http://127.0.0.1:3035/api/admin/imports/connections/{target['id']}/diagnose "
    f"-H 'Authorization: Bearer {token}'"
)
diag_resp = run(diag_cmd).strip()
print(diag_resp[:3000])
print()

c.close()
print("[+] Done.")
