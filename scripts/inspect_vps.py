#!/usr/bin/env python3
"""Inspeciona o estado do VPS para entender o que já está configurado."""
import os
import paramiko

host = os.environ['HOST']
user = os.environ['USER_NAME']
pkey = paramiko.Ed25519Key.from_private_key_file(os.environ['KEY_PATH'])
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, pkey=pkey, look_for_keys=False, allow_agent=False, timeout=15)


def run(cmd: str, label: str = '') -> None:
    si, so, se = c.exec_command(cmd, get_pty=False)
    rc = so.channel.recv_exit_status()
    print(f"\n=== {label or cmd[:60]} ===")
    out = so.read().decode(errors='replace').rstrip()
    err = se.read().decode(errors='replace').rstrip()
    if out:
        print(out)
    if err and 'Permission denied' not in err:
        print(f"[stderr] {err}")


run('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null', 'Portas em escuta')
run('ls -la ~', 'Home directory')
run('ls /var/www 2>/dev/null', '/var/www')
run('ls /opt 2>/dev/null', '/opt')
run('test -d /etc/nginx && ls /etc/nginx/sites-enabled/ 2>/dev/null && cat /etc/nginx/sites-enabled/* 2>/dev/null | head -80', 'nginx config')
run('test -f /etc/caddy/Caddyfile && cat /etc/caddy/Caddyfile', 'Caddyfile')
run('curl -s -m 3 -I http://localhost:3035 2>&1 | head -10', 'localhost:3035')
run('curl -s -m 3 -I http://localhost:80 2>&1 | head -10', 'localhost:80')
run('curl -s -m 3 -I http://127.0.0.1:443 2>&1 | head -10', '127.0.0.1:443')
run('ps -ef | grep -iE "node|nginx|caddy|apache|httpd" | grep -v grep | head -20', 'processos web')
run('cat /etc/os-release | head -3', 'OS')
run('which node npm pm2 2>/dev/null', 'binaries')
run('test -d ~/ava-pco && ls -la ~/ava-pco 2>/dev/null', '~/ava-pco existe?')
run('ls /home/ 2>/dev/null', '/home/')
run('groups', 'Grupos do avapco')
c.close()
