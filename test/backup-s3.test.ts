// Tests do uploadSnapshotToS3 (mock fetch + tmpfs).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { uploadSnapshotToS3 } from '../server/db/backup-s3';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-s3-'));
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.S3_BUCKET;
  delete process.env.S3_REGION;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_BACKUP_PREFIX;
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function seedSnapshot(files: Record<string, string>): Promise<string> {
  const dir = path.join(tmpDir, '2026-05-08');
  await fs.mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), body, 'utf8');
  }
  return dir;
}

function setEnv() {
  process.env.S3_BUCKET = 'b';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = 'AKIA';
  process.env.S3_SECRET_ACCESS_KEY = 's';
}

describe('uploadSnapshotToS3', () => {
  it('é no-op sem env vars', async () => {
    const dir = await seedSnapshot({ 'a.json': '{}' });
    const r = await uploadSnapshotToS3(dir, '2026-05-08');
    expect(r.enabled).toBe(false);
    expect(r.uploaded).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sobe todos os .json com prefix default', async () => {
    setEnv();
    const dir = await seedSnapshot({
      'users.json': '{"x":1}',
      'orders.json': '[1,2,3]',
      'README.md': 'ignore me',
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const r = await uploadSnapshotToS3(dir, '2026-05-08');
    expect(r.enabled).toBe(true);
    expect(r.uploaded).toBe(2); // 2 .json arquivos, README ignorado
    expect(r.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('ava-pco-backups/2026-05-08/users.json'))).toBe(
      true,
    );
    expect(urls.some((u) => u.includes('ava-pco-backups/2026-05-08/orders.json'))).toBe(
      true,
    );
  });

  it('respeita S3_BACKUP_PREFIX customizado', async () => {
    setEnv();
    process.env.S3_BACKUP_PREFIX = '/empresa-x/snapshots/';
    const dir = await seedSnapshot({ 'a.json': '{}' });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('', { status: 200 }),
    );
    await uploadSnapshotToS3(dir, '2026-05-08');
    const url = String(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(url).toContain('empresa-x/snapshots/2026-05-08/a.json');
    expect(url).not.toContain('//empresa');
  });

  it('conta failed em HTTP 403', async () => {
    setEnv();
    const dir = await seedSnapshot({ 'a.json': '{}', 'b.json': '{}' });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('AccessDenied', { status: 403 }));
    const r = await uploadSnapshotToS3(dir, '2026-05-08');
    expect(r.uploaded).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.errors[0]).toMatch(/403/);
  });

  it('lida com diretório inexistente', async () => {
    setEnv();
    const r = await uploadSnapshotToS3(
      path.join(tmpDir, 'no-such-dir'),
      '2026-05-08',
    );
    expect(r.enabled).toBe(true);
    expect(r.uploaded).toBe(0);
    expect(r.errors[0]).toMatch(/readdir/i);
  });
});
