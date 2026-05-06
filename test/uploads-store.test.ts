import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/uploads/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-up-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/uploads/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function fakeImage(mime: string, sizeBytes: number): File {
  const buf = new Uint8Array(sizeBytes);
  return new File([buf], 'test.bin', { type: mime });
}

describe('uploads/store', () => {
  it('saveUpload aceita PNG e devolve url + metadata', async () => {
    const f = fakeImage('image/png', 1024);
    const r = await store.saveUpload(f);
    expect(r.url).toMatch(/^\/uploads\/[a-f0-9]{24}\.png$/);
    expect(r.filename).toMatch(/\.png$/);
    expect(r.size).toBe(1024);
    expect(r.mime).toBe('image/png');

    // Arquivo realmente criado
    const filepath = path.join(store.uploadsDir(), r.filename);
    const st = await fs.stat(filepath);
    expect(st.size).toBe(1024);
  });

  it('aceita JPG, WEBP, GIF', async () => {
    for (const mime of ['image/jpeg', 'image/webp', 'image/gif']) {
      const r = await store.saveUpload(fakeImage(mime, 100));
      expect(r.mime).toBe(mime);
    }
  });

  it('rejeita MIME inválido (UploadError INVALID_MIME)', async () => {
    const f = fakeImage('application/pdf', 100);
    await expect(store.saveUpload(f)).rejects.toMatchObject({
      code: 'INVALID_MIME',
      status: 400,
    });
  });

  it('rejeita arquivo > 5MB (FILE_TOO_LARGE)', async () => {
    const f = fakeImage('image/png', 6 * 1024 * 1024);
    await expect(store.saveUpload(f)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('uploads diferentes geram filenames únicos', async () => {
    const a = await store.saveUpload(fakeImage('image/png', 50));
    const b = await store.saveUpload(fakeImage('image/png', 50));
    expect(a.filename).not.toBe(b.filename);
  });

  it('uploadsDir() retorna caminho absoluto dentro de DATA_DIR', () => {
    const dir = store.uploadsDir();
    expect(dir).toContain('uploads');
    expect(dir).toContain(tmpDir);
  });
});
