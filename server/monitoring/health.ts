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
}

export async function gatherHealth(db: 'connected' | 'fallback'): Promise<HealthStats> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const errs = await listErrors({ since, limit: 1000 });
  const dataSize = await dirSizeBytes(DATA_DIR);
  const mem = process.memoryUsage().rss;
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
  };
}
