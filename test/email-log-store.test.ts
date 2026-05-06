import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let logStore: typeof import('../server/notifications/log-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-eml-'));
  process.env.DATA_DIR = tmpDir;
  logStore = await import('../server/notifications/log-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('notifications/log-store', () => {
  it('pushLog gera id + ts', async () => {
    const log = await logStore.pushLog({
      configId: 'cfg-1',
      provider: 'mock',
      to: 'a@x.com',
      subject: 'Teste',
      status: 'sent',
      externalId: 'mock-1',
    });
    expect(log.id).toMatch(/^eml-/);
    expect(log.ts).toMatch(/T.*Z$/);
    expect(log.subject).toBe('Teste');
  });

  it('listLogs ordena desc por ts', async () => {
    await logStore.pushLog({
      configId: 'cfg-1',
      provider: 'mock',
      to: 'a@x.com',
      subject: 'Antigo',
      status: 'sent',
    });
    await new Promise((r) => setTimeout(r, 10));
    const last = await logStore.pushLog({
      configId: 'cfg-1',
      provider: 'mock',
      to: 'a@x.com',
      subject: 'Recente',
      status: 'sent',
    });
    const list = await logStore.listLogs();
    expect(list[0]!.id).toBe(last.id);
  });

  it('listLogs respeita limit', async () => {
    const list = await logStore.listLogs(2);
    expect(list.length).toBeLessThanOrEqual(2);
  });

  it('listLogs clamp (1..1000)', async () => {
    const r0 = await logStore.listLogs(0);
    expect(r0.length).toBeLessThanOrEqual(1);
    const rBig = await logStore.listLogs(99999);
    expect(rBig.length).toBeLessThanOrEqual(1000);
  });

  it('failed status preserva error message', async () => {
    const log = await logStore.pushLog({
      configId: 'cfg-fail',
      provider: 'mock',
      to: 'fail@x.com',
      subject: 'Falha',
      status: 'failed',
      error: 'connection refused',
    });
    expect(log.status).toBe('failed');
    expect(log.error).toBe('connection refused');
  });
});
