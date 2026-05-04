// Health stats — calcula uptime, contagem de erros nas últimas 24h, tamanho de data/.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listErrors } from '../errors/store';

const startedAt = Date.now();
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

async function dirSizeBytes(dir: string): Promise<number> {
  let total = 0;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      total += await dirSizeBytes(p);
    } else if (e.isFile()) {
      try {
        const st = await fs.stat(p);
        total += st.size;
      } catch {
        // ignora
      }
    }
  }
  return total;
}

export interface HealthStats {
  ok: true;
  ts: number;
  uptimeSec: number;
  startedAt: string;
  nodeVersion: string;
  pid: number;
  memMB: number;
  dataSizeMB: number;
  errors24h: number;
  db: 'connected' | 'fallback';
  lastBackupAt: string | null;
  backupsCount: number;
}

async function findLastBackup(): Promise<{ at: string | null; count: number }> {
  const backupsDir = path.join(DATA_DIR, 'backups');
  try {
    const entries = await fs.readdir(backupsDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith('.tar.gz'));
    let latest = 0;
    for (const f of files) {
      try {
        const st = await fs.stat(path.join(backupsDir, f.name));
        if (st.mtimeMs > latest) latest = st.mtimeMs;
      } catch {
        // ignora
      }
    }
    return {
      at: latest > 0 ? new Date(latest).toISOString() : null,
      count: files.length,
    };
  } catch {
    return { at: null, count: 0 };
  }
}

export async function gatherHealth(db: 'connected' | 'fallback'): Promise<HealthStats> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const errs = await listErrors({ since, limit: 1000 });
  const dataSize = await dirSizeBytes(DATA_DIR);
  const mem = process.memoryUsage().rss;
  const backup = await findLastBackup();
  return {
    ok: true,
    ts: Date.now(),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    nodeVersion: process.version,
    pid: process.pid,
    memMB: Math.round(mem / (1024 * 1024)),
    dataSizeMB: Math.round((dataSize / (1024 * 1024)) * 100) / 100,
    errors24h: errs.length,
    db,
    lastBackupAt: backup.at,
    backupsCount: backup.count,
  };
}
