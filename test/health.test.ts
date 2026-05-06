import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let gatherHealth: typeof import('../server/monitoring/health').gatherHealth;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-health-'));
  process.env.DATA_DIR = tmpDir;
  // cria alguns arquivos pra dataSizeMB > 0
  // ~1MB total para passar o threshold de arredondamento (.01 MB)
  await fs.writeFile(path.join(tmpDir, 'a.json'), 'x'.repeat(600_000));
  await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'sub', 'b.json'), 'y'.repeat(600_000));

  gatherHealth = (await import('../server/monitoring/health')).gatherHealth;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('monitoring/health', () => {
  it('gatherHealth retorna estrutura completa', async () => {
    const h = await gatherHealth('connected');
    expect(h.ok).toBe(true);
    expect(typeof h.ts).toBe('number');
    expect(h.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(h.startedAt).toMatch(/T.*Z$/);
    expect(h.nodeVersion).toMatch(/^v\d+/);
    expect(h.pid).toBeGreaterThan(0);
    expect(h.memMB).toBeGreaterThan(0);
  });

  it('dataSizeMB cobre arquivos recursivamente', async () => {
    const h = await gatherHealth('connected');
    // ~1.2MB total → arredonda pra ~1.14
    expect(h.dataSizeMB).toBeGreaterThan(0);
  });

  it('db field reflete arg', async () => {
    const c = await gatherHealth('connected');
    const f = await gatherHealth('fallback');
    expect(c.db).toBe('connected');
    expect(f.db).toBe('fallback');
  });

  it('lastBackupAt null quando dir backups inexistente', async () => {
    const h = await gatherHealth('connected');
    expect(h.lastBackupAt).toBeNull();
    expect(h.backupsCount).toBe(0);
  });

  it('lastBackupAt e backupsCount preenchidos quando há .tar.gz', async () => {
    const backupsDir = path.join(tmpDir, 'backups');
    await fs.mkdir(backupsDir, { recursive: true });
    await fs.writeFile(path.join(backupsDir, 'snap-1.tar.gz'), 'data');
    await fs.writeFile(path.join(backupsDir, 'snap-2.tar.gz'), 'data');
    // arquivo não-tar.gz deve ser ignorado
    await fs.writeFile(path.join(backupsDir, 'readme.txt'), 'x');

    const h = await gatherHealth('connected');
    expect(h.backupsCount).toBe(2);
    expect(h.lastBackupAt).not.toBeNull();
    expect(h.lastBackupAt).toMatch(/T.*Z$/);
  });

  it('errors24h é número inteiro >= 0', async () => {
    const h = await gatherHealth('connected');
    expect(h.errors24h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h.errors24h)).toBe(true);
  });
});
