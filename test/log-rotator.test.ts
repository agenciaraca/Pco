import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';

let tmpDir: string;
let logPath: string;
let rotator: typeof import('../server/services/log-rotator');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-log-'));
  logPath = path.join(tmpDir, 'app.log');
  process.env.APP_LOG_PATH = logPath;
  rotator = await import('../server/services/log-rotator');
});

afterAll(async () => {
  rotator.stopWorker();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('log-rotator', () => {
  it('getStatus reflete inicialização', () => {
    const s = rotator.getStatus();
    expect(s.name).toBe('log-rotator');
    expect(s.enabled).toBe(false); // não iniciamos worker
    expect(s.logPath).toBe(logPath);
    expect(s.maxSizeBytes).toBeGreaterThan(0);
  });

  it('startWorker + stopWorker são idempotentes', () => {
    rotator.startWorker(60 * 60_000);
    expect(rotator.getStatus().enabled).toBe(true);
    rotator.startWorker(60 * 60_000); // chamada 2x não duplica
    expect(rotator.getStatus().enabled).toBe(true);
    rotator.stopWorker();
    expect(rotator.getStatus().enabled).toBe(false);
    rotator.stopWorker(); // sem erro
  });

  it('não rotaciona se log < threshold (não existe ainda)', async () => {
    // Worker é tick-baseado, mas podemos verificar que nenhum arquivo extra existe
    const entries = await fs.readdir(tmpDir);
    expect(entries.filter((e) => e.startsWith('app.log.'))).toEqual([]);
  });

  it('mantém log path configurável via APP_LOG_PATH', () => {
    expect(rotator.getStatus().logPath).toContain('app.log');
  });
});
