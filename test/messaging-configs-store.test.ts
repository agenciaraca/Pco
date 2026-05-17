import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/messaging/configs-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-msg-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  store = await import('../server/messaging/configs-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('messaging/configs-store', () => {
  it('lista vazia inicial', async () => {
    expect(await store.listConfigs()).toEqual([]);
  });

  it('createConfig criptografa apiKey e retorna view sem segredo', async () => {
    const cfg = await store.createConfig({
      provider: 'whatsapp-meta',
      fromNumber: '+5511999999999',
      apiKey: 'EAA-secret-token',
      whatsappPhoneNumberId: '109123456789012',
    });
    expect(cfg.id).toMatch(/^msgc-/);
    expect(cfg.provider).toBe('whatsapp-meta');
    expect(cfg.hasApiKey).toBe(true);
    expect(cfg.whatsappPhoneNumberId).toBe('109123456789012');
    expect((cfg as unknown as Record<string, unknown>).apiKeyEncrypted).toBeUndefined();
  });

  it('getActiveConfig prefere provider real sobre mock', async () => {
    await store.createConfig({ provider: 'mock', fromNumber: 'MOCK', enabled: true });
    const active = await store.getActiveConfig();
    expect(active?.provider).toBe('whatsapp-meta'); // ainda prefere o whatsapp criado antes
  });

  it('updateConfig troca enabled + preserva apiKey antiga', async () => {
    const list = await store.listConfigs();
    const wpp = list.find((c) => c.provider === 'whatsapp-meta')!;
    const updated = await store.updateConfig(wpp.id, { enabled: false });
    expect(updated?.enabled).toBe(false);
    expect(updated?.hasApiKey).toBe(true); // ainda tem a apiKey original
  });

  it('updateConfig com nova apiKey re-criptografa', async () => {
    const list = await store.listConfigs();
    const wpp = list.find((c) => c.provider === 'whatsapp-meta')!;
    const updated = await store.updateConfig(wpp.id, { apiKey: 'EAA-novo-token' });
    expect(updated?.hasApiKey).toBe(true);
    const full = await store.getConfig(wpp.id);
    expect(full?.apiKeyEncrypted).toBeTruthy();
    expect(full?.apiKeyEncrypted).not.toContain('EAA-novo-token'); // criptografado
  });

  it('deleteConfig remove e libera slot', async () => {
    const before = (await store.listConfigs()).length;
    const list = await store.listConfigs();
    const ok = await store.deleteConfig(list[0]!.id);
    expect(ok).toBe(true);
    expect((await store.listConfigs()).length).toBe(before - 1);
  });

  it('recordTest atualiza lastTested* fields', async () => {
    const created = await store.createConfig({
      provider: 'mock',
      fromNumber: 'PING-TEST',
    });
    await store.recordTest(created.id, { ok: true, message: 'pong' });
    const after = await store.getConfig(created.id);
    expect(after?.lastTestStatus).toBe('ok');
    expect(after?.lastTestMessage).toBe('pong');
    expect(after?.lastTestedAt).toBeTruthy();
  });
});
