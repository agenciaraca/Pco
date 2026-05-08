// Tests do sendSafe + log-store de mensageria.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let sendSafe: typeof import('../server/messaging/sender').sendSafe;
let logStore: typeof import('../server/messaging/log-store');
let resetMockMessages: typeof import('../server/messaging/providers/mock').resetMockMessages;
let getMessagingProvider: typeof import('../server/messaging/providers/registry').getMessagingProvider;
let MessagingProviderError: typeof import('../server/messaging/providers/types').MessagingProviderError;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-msg-'));
  process.env.DATA_DIR = tmpDir;
  ({ sendSafe } = await import('../server/messaging/sender'));
  logStore = await import('../server/messaging/log-store');
  ({ resetMockMessages } = await import('../server/messaging/providers/mock'));
  ({ getMessagingProvider } = await import('../server/messaging/providers/registry'));
  ({ MessagingProviderError } = await import('../server/messaging/providers/types'));
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

beforeEach(async () => {
  resetMockMessages();
  await logStore.clearLog();
});

const baseConfig = {
  id: 'cfg',
  provider: 'mock' as const,
  enabled: true,
  fromNumber: '+1',
  createdAt: '',
  updatedAt: '',
};

describe('sendSafe', () => {
  it('envia via mock + registra log status=sent', async () => {
    const r = await sendSafe(baseConfig, {}, { to: '+5511', body: 'oi' });
    expect(r.ok).toBe(true);
    expect(r.result?.providerId).toBe('mock');
    const log = await logStore.listLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      provider: 'mock',
      to: '+5511',
      status: 'sent',
    });
  });

  it('config disabled → ok=false + log status=failed', async () => {
    const r = await sendSafe(
      { ...baseConfig, enabled: false },
      {},
      { to: '+5511', body: 'oi' },
    );
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('DISABLED');
    const log = await logStore.listLog();
    expect(log[0].status).toBe('failed');
    expect(log[0].error).toMatch(/disabled/i);
  });

  it('provider desconhecido → captura UNKNOWN_PROVIDER', async () => {
    const r = await sendSafe(
      { ...baseConfig, provider: 'foo' as never },
      {},
      { to: '+5511', body: 'oi' },
    );
    expect(r.ok).toBe(false);
    expect(r.error?.code).toMatch(/UNKNOWN/);
    const log = await logStore.listLog();
    expect(log[0].status).toBe('failed');
  });

  it('truncates body em 200 chars no log', async () => {
    const big = 'x'.repeat(500);
    await sendSafe(baseConfig, {}, { to: '+5511', body: big });
    const log = await logStore.listLog();
    expect(log[0].body.length).toBe(200);
  });

  it('preserva tag no log', async () => {
    await sendSafe(baseConfig, {}, { to: '+5511', body: 'x', tag: 'reengage' });
    const log = await logStore.listLog();
    expect(log[0].tag).toBe('reengage');
  });
});

describe('log-store filters', () => {
  it('filtra por provider', async () => {
    await sendSafe(baseConfig, {}, { to: '+1', body: 'a' });
    await sendSafe(baseConfig, {}, { to: '+2', body: 'b' });
    const all = await logStore.listLog({ provider: 'mock' });
    expect(all.length).toBe(2);
    const none = await logStore.listLog({ provider: 'twilio' });
    expect(none.length).toBe(0);
  });

  it('filtra por status', async () => {
    await sendSafe(baseConfig, {}, { to: '+1', body: 'a' });
    await sendSafe(
      { ...baseConfig, enabled: false },
      {},
      { to: '+2', body: 'b' },
    );
    const sent = await logStore.listLog({ status: 'sent' });
    const failed = await logStore.listLog({ status: 'failed' });
    expect(sent.length).toBe(1);
    expect(failed.length).toBe(1);
  });

  it('filtra por to substring', async () => {
    await sendSafe(baseConfig, {}, { to: '+5511999', body: 'a' });
    await sendSafe(baseConfig, {}, { to: '+11222', body: 'b' });
    const r = await logStore.listLog({ to: '5511' });
    expect(r.length).toBe(1);
    expect(r[0].to).toContain('5511');
  });

  it('limit cap 5000', async () => {
    const r = await logStore.listLog({ limit: 99999 });
    expect(r.length).toBeLessThanOrEqual(5000);
  });
});
