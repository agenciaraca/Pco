import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let sender: typeof import('../server/notifications/sender');
let configStore: typeof import('../server/notifications/config-store');
let logStore: typeof import('../server/notifications/log-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mail-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  sender = await import('../server/notifications/sender');
  configStore = await import('../server/notifications/config-store');
  logStore = await import('../server/notifications/log-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('notifications/sender', () => {
  it('sendEmail lança quando não há config ativa', async () => {
    await expect(
      sender.sendEmail({
        to: { email: 'a@b.com' },
        subject: 'X',
        html: '<p>x</p>',
        text: 'x',
      }),
    ).rejects.toThrow(/Nenhuma configuração/);
  });

  it('sendWithConfig usa mock provider e loga sent', async () => {
    const cfg = await configStore.createConfig({
      provider: 'mock',
      enabled: true,
      fromEmail: 'no-reply@avapco.com',
      fromName: 'AVA PCO',
    });
    const raw = await configStore.getConfig(cfg.id);
    const r = await sender.sendWithConfig(raw!, {
      to: { email: 'a@b.com' },
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(r.providerId).toBe('mock');
    expect(r.accepted).toBe(1);
    expect(r.externalId).toMatch(/^mock-/);

    const logs = await logStore.listLogs();
    const sent = logs.find(
      (l) => l.subject === 'Test' && l.status === 'sent',
    );
    expect(sent).toBeDefined();
    expect(sent!.provider).toBe('mock');
  });

  it('sendEmail usa active config (mock) quando configId omitido', async () => {
    const r = await sender.sendEmail({
      to: { email: 'use-active@x.com' },
      subject: 'Active',
      html: '<p>x</p>',
      text: 'x',
    });
    expect(r.providerId).toBe('mock');
  });

  it('sendEmail rejeita config disabled', async () => {
    const cfg = await configStore.createConfig({
      provider: 'mock',
      enabled: false,
      fromEmail: 'disabled@x.com',
    });
    await expect(
      sender.sendEmail(
        { to: { email: 'a@b.com' }, subject: 'X', html: '<p>x</p>', text: 'x' },
        { configId: cfg.id },
      ),
    ).rejects.toThrow(/desativada/);
  });

  it('sendSafe nunca lança (retorna ok=false)', async () => {
    // sem config ativa, sendEmail lança — sendSafe deve capturar
    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mail-empty-'));
    // não conseguimos isolar configs já criadas neste describe, então testamos
    // o caso "config inexistente"
    const r = await sender.sendSafe(
      { to: { email: 'x@x.com' }, subject: 'S', html: 'h', text: 't' },
      { configId: 'inexistente-emc-id' },
    );
    await fs.rm(tmpDir2, { recursive: true, force: true });
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('pingConfig retorna ok pra mock', async () => {
    const cfg = await configStore.createConfig({
      provider: 'mock',
      enabled: true,
      fromEmail: 'ping@x.com',
    });
    const r = await sender.pingConfig(cfg.id);
    expect(r.ok).toBe(true);
  });

  it('pingConfig de id inexistente retorna ok=false', async () => {
    const r = await sender.pingConfig('nao-existe');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('não encontrada');
  });

  it('multiple recipients são contados em accepted', async () => {
    const cfg = await configStore.createConfig({
      provider: 'mock',
      enabled: true,
      fromEmail: 'multi@x.com',
    });
    const raw = await configStore.getConfig(cfg.id);
    const r = await sender.sendWithConfig(raw!, {
      to: [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }],
      subject: 'Multi',
      html: '<p>x</p>',
      text: 'x',
    });
    expect(r.accepted).toBe(3);
  });
});
