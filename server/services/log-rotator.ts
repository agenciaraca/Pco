// Rotaciona app.log quando ultrapassa MAX_SIZE. Mantém N rotações compactadas.
// Worker tick-baseado (a cada 1h verifica).
//
// Cria app.log.1.gz, app.log.2.gz, ... até app.log.MAX_ROTATIONS.gz
// O processo principal continua escrevendo no app.log original (truncado).

import { promises as fs } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const LOG_PATH = process.env.APP_LOG_PATH ?? path.resolve(process.env.HOME ?? '.', 'ava-pco/app.log');
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROTATIONS = 4;

let interval: NodeJS.Timeout | null = null;
let lastRotatedAt: string | null = null;
let totalRotations = 0;

async function rotateIfNeeded(): Promise<boolean> {
  let stat;
  try {
    stat = await fs.stat(LOG_PATH);
  } catch {
    return false; // log não existe
  }
  if (stat.size < MAX_SIZE_BYTES) return false;

  // Shift rotations: app.log.3.gz → app.log.4.gz, app.log.2.gz → 3.gz, etc.
  for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
    const src = `${LOG_PATH}.${i}.gz`;
    const dst = `${LOG_PATH}.${i + 1}.gz`;
    try {
      await fs.rename(src, dst);
    } catch {
      /* file doesn't exist, skip */
    }
  }

  // Lê o log atual, gzipa pra .1.gz, trunca o original
  const content = await fs.readFile(LOG_PATH);
  await fs.writeFile(`${LOG_PATH}.1.gz`, gzipSync(content));
  await fs.writeFile(LOG_PATH, '');

  // Remove a rotação mais antiga se passou do limite
  for (let i = MAX_ROTATIONS + 1; i <= 10; i++) {
    try {
      await fs.unlink(`${LOG_PATH}.${i}.gz`);
    } catch {
      break;
    }
  }

  lastRotatedAt = new Date().toISOString();
  totalRotations++;
  return true;
}

export function startWorker(intervalMs = 60 * 60_000): void {
  if (interval) return;
  // Tick imediato após 5min (após boot estabilizar)
  setTimeout(() => {
    void rotateIfNeeded().catch(() => {});
  }, 5 * 60_000);
  interval = setInterval(() => {
    void rotateIfNeeded().catch(() => {});
  }, intervalMs);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return {
    name: 'log-rotator',
    enabled: interval !== null,
    lastRotatedAt,
    totalRotations,
    logPath: LOG_PATH,
    maxSizeBytes: MAX_SIZE_BYTES,
    maxRotations: MAX_ROTATIONS,
  };
}
