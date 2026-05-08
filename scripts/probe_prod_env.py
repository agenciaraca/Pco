#!/usr/bin/env python3
"""Probe das envs do node real do AVA PCO em prod (filtra por user avapco + path ava-pco)."""
import os, paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ['HOST'], port=int(os.environ.get('PORT', '22')),
          username=os.environ['USER_NAME'], password=os.environ['SSH_PASSWORD'],
          look_for_keys=False, allow_agent=False)

CMD = r"""
PID=$(ps -u avapco -o pid,cmd | grep 'node.*ava-pco.*server/dev.ts' | grep -v grep | head -1 | awk '{print $1}')
echo "PID=$PID"
if [ -n "$PID" ]; then
  cat /proc/$PID/environ 2>&1 | tr '\0' '\n' | \
    grep -E '^(JWT_SECRET|AI_KEY_ENCRYPTION_SECRET|INITIAL_|NODE_ENV|PORT|SERVE_STATIC|HOST=)' | \
    awk -F= '{n=length($2); if (n>10) print $1"=<"n" chars> "substr($2,1,4)"..."substr($2,n-2); else print $0}'
fi
echo
echo "[health]"
curl -s -m 5 http://127.0.0.1:3035/api/health
echo
"""

si, so, se = c.exec_command(CMD)
print(so.read().decode())
err = se.read().decode()
if err.strip():
    print("[stderr]", err)
c.close()
