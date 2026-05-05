// Backup automático dos JSON stores. Roda 1x ao dia, copia data/*.json para
// data/backups/YYYY-MM-DD/. Mantém últimos N dias (default 14) e podia.
// Para restore, admin escolhe a data e vê arquivos disponíveis.

import { promises as fs } from 'node:fs';
import path from 'node:path';

function getDataDir(): string {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
}

const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS ?? 14);
const BACKUP_SUBDIR = 'backups';

function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface BackupRunResult {
  date: string;
  filesBackedUp: number;
  bytesTotal: number;
  errors: string[];
}

/** Faz uma snapshot das *.json no DATA_DIR. */
export async function runBackup(now: Date = new Date()): Promise<BackupRunResult> {
  const dataDir = getDataDir();
  const date = todayKey(now);
  const backupDir = path.join(dataDir, BACKUP_SUBDIR, date);
  const errors: string[] = [];
  let filesBackedUp = 0;
  let bytesTotal = 0;

  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (err) {
    errors.push(`mkdir falhou: ${err instanceof Error ? err.message : String(err)}`);
    return { date, filesBackedUp, bytesTotal, errors };
  }

  let entries: string[];
  try {
    entries = await fs.readdir(dataDir);
  } catch (err) {
    errors.push(`readdir falhou: ${err instanceof Error ? err.message : String(err)}`);
    return { date, filesBackedUp, bytesTotal, errors };
  }

  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const src = path.join(dataDir, name);
    const dest = path.join(backupDir, name);
    try {
      const stat = await fs.stat(src);
      if (!stat.isFile()) continue;
      await fs.copyFile(src, dest);
      filesBackedUp++;
      bytesTotal += stat.size;
    } catch (err) {
      errors.push(
        `${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Cleanup snapshots antigos
  try {
    const allBackups = await fs.readdir(path.join(dataDir, BACKUP_SUBDIR));
    const dated = allBackups
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (dated.length > KEEP_DAYS) {
      const toDelete = dated.slice(0, dated.length - KEEP_DAYS);
      for (const d of toDelete) {
        await fs.rm(path.join(dataDir, BACKUP_SUBDIR, d), {
          recursive: true,
          force: true,
        });
      }
    }
  } catch {
    /* ignore */
  }

  return { date, filesBackedUp, bytesTotal, errors };
}

export interface BackupSnapshot {
  date: string;
  files: Array<{ name: string; size: number }>;
}

export async function listSnapshots(): Promise<BackupSnapshot[]> {
  const dataDir = getDataDir();
  const root = path.join(dataDir, BACKUP_SUBDIR);
  try {
    const dirs = await fs.readdir(root);
    const result: BackupSnapshot[] = [];
    for (const d of dirs.sort().reverse()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const dir = path.join(root, d);
      const files = await fs.readdir(dir);
      const list: BackupSnapshot['files'] = [];
      for (const f of files) {
        try {
          const s = await fs.stat(path.join(dir, f));
          list.push({ name: f, size: s.size });
        } catch {
          /* ignore */
        }
      }
      result.push({ date: d, files: list });
    }
    return result;
  } catch {
    return [];
  }
}

let interval: NodeJS.Timeout | null = null;
let lastRunAt: string | null = null;
let lastResult: BackupRunResult | null = null;

const ONE_HOUR = 60 * 60_000;

/**
 * Worker que tick a cada hora. Se hour atual UTC == 4 (1h BRT) e ainda não rodou hoje, roda.
 */
export function startWorker(): void {
  if (interval) return;
  let lastDay: string | null = null;
  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() !== 4) return;
    const day = todayKey(now);
    if (lastDay === day) return;
    try {
      const r = await runBackup(now);
      lastDay = day;
      lastRunAt = new Date().toISOString();
      lastResult = r;
      // eslint-disable-next-line no-console
      console.log(
        `[backup] ${r.filesBackedUp} arquivos · ${(r.bytesTotal / 1024).toFixed(1)}kB · erros: ${r.errors.length}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[backup] erro:', err);
    }
  };
  interval = setInterval(() => {
    void tick();
  }, ONE_HOUR);
  void tick();
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return { enabled: interval !== null, lastRunAt, lastResult, keepDays: KEEP_DAYS };
}
