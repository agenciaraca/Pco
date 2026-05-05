import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let backup: typeof import('../server/db/backup-worker');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-bk-'));
  process.env.DATA_DIR = tmpDir;
  process.env.BACKUP_KEEP_DAYS = '5';
  backup = await import('../server/db/backup-worker');

  // Cria alguns arquivos de teste
  await fs.writeFile(path.join(tmpDir, 'users.json'), '[]', 'utf8');
  await fs.writeFile(path.join(tmpDir, 'orders.json'), '[{"id":"x"}]', 'utf8');
  await fs.writeFile(path.join(tmpDir, 'README.txt'), 'not json', 'utf8');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('runBackup', () => {
  it('copia *.json para backups/YYYY-MM-DD/', async () => {
    const r = await backup.runBackup();
    expect(r.filesBackedUp).toBe(2); // só os .json
    expect(r.errors.length).toBe(0);
    const backupDir = path.join(tmpDir, 'backups', r.date);
    const files = await fs.readdir(backupDir);
    expect(files.sort()).toEqual(['orders.json', 'users.json']);
  });

  it('preserva conteúdo', async () => {
    const r = await backup.runBackup();
    const ordersBackup = await fs.readFile(
      path.join(tmpDir, 'backups', r.date, 'orders.json'),
      'utf8',
    );
    expect(ordersBackup).toBe('[{"id":"x"}]');
  });

  it('listSnapshots retorna metadata', async () => {
    const list = await backup.listSnapshots();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.files.find((f) => f.name === 'orders.json')).toBeDefined();
  });

  it('mantém apenas KEEP_DAYS snapshots', async () => {
    // Cria 7 snapshots manualmente
    for (let i = 1; i <= 7; i++) {
      const day = `2025-01-0${i}`;
      const dir = path.join(tmpDir, 'backups', day);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'old.json'), '[]', 'utf8');
    }
    await backup.runBackup();
    const list = await backup.listSnapshots();
    // KEEP_DAYS=5; deve sobrar no máximo 5 + hoje = 6, mas como cleanup roda
    // depois do backup do dia, esperamos exatamente 5 (limite)
    expect(list.length).toBeLessThanOrEqual(5);
  });
});
