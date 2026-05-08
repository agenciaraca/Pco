#!/usr/bin/env python3
"""Diagnostico read-only do estado de secrets em producao."""
import os
import sys
import paramiko

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


def run(cmd, timeout=30):
    si, so, se = c.exec_command(cmd, get_pty=False, timeout=timeout)
    rc = so.channel.recv_exit_status()
    out = so.read().decode(errors='replace')
    err = se.read().decode(errors='replace')
    print(f"$ {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(f"[stderr] {err.rstrip()}")
    print()
    return out


# Upload um script Python para o servidor (mais robusto que heredoc)
SCAN_SCRIPT = '''
import json, os
home = os.path.expanduser("~")
DATA = os.path.join(home, "ava-pco", "data")

def classify(v):
    if not isinstance(v, str) or not v: return None
    if v.startswith("dev:"): return "dev:"
    parts = v.split(".")
    if len(parts) == 3: return "aes-gcm"
    return "plain/other"

def scan_file(path, fields):
    if not os.path.exists(path): return None
    try:
        with open(path) as f: d = json.load(f)
    except Exception as e:
        return f"(read error: {e})"
    items = d if isinstance(d, list) else d.get("items", []) if isinstance(d, dict) else [d]
    counts = {"dev:": 0, "aes-gcm": 0, "plain/other": 0, "empty": 0}
    for item in items:
        if not isinstance(item, dict): continue
        for f in fields:
            v = item.get(f)
            if isinstance(v, dict):
                for sk, sv in v.items():
                    cls = classify(sv)
                    if cls: counts[cls] = counts.get(cls,0)+1
            else:
                cls = classify(v)
                if cls: counts[cls] = counts.get(cls,0)+1
    return counts

files = [
    ("ai-configurations.json", ["encryptedKey","apiKey"]),
    ("gateways-store.json", ["credentials"]),
    ("email-config-store.json", ["apiKeyEncrypted","smtpPasswordEncrypted","sesSecretAccessKeyEncrypted"]),
    ("webhooks-endpoints-store.json", ["secretEncrypted","headersEncrypted"]),
    ("imports-connections-store.json", ["password","token","encryptedPassword","encryptedToken","encryptedSecret"]),
    ("users.json", ["totpSecretEncrypted"]),
]
total_aes = 0
for name, fields in files:
    r = scan_file(os.path.join(DATA, name), fields)
    print("  %s: %s" % (name, r))
    if isinstance(r, dict): total_aes += r.get("aes-gcm", 0)

print()
print("TOTAL aes-gcm payloads: %d" % total_aes)
if total_aes > 0:
    print("ALERT: existem creds REAIS criptografadas.")
else:
    print("SAFE: nenhuma cred AES-GCM real.")
'''

# Upload pra /tmp e roda
sftp = c.open_sftp()
with sftp.open('/tmp/scan_secrets.py', 'w') as f:
    f.write(SCAN_SCRIPT)
sftp.close()

print("=" * 60)
print("[1] .env atual (mascarado)")
print("=" * 60)
run("ls -la ~/ava-pco/.env 2>&1 || echo '(no .env)'")
run(
    "if [ -f ~/ava-pco/.env ]; then "
    "awk -F= '{key=$1; rest=$0; sub(/^[^=]*=/, \"\", rest); "
    "if (length(rest)>10) rest=substr(rest,1,4)\"...\"substr(rest,length(rest)-2); "
    "if (rest==\"\") rest=\"(empty)\"; print key\"=\"rest}' ~/ava-pco/.env; "
    "fi"
)

print("=" * 60)
print("[2] Crypto state (data/*.json)")
print("=" * 60)
run("python3 /tmp/scan_secrets.py")

print("=" * 60)
print("[3] App health")
print("=" * 60)
run("curl -s -m 5 http://127.0.0.1:3035/api/health")
run("rm -f /tmp/scan_secrets.py")

c.close()
print("[+] Done.")
